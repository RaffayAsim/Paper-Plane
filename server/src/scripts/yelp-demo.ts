import { launch } from "cloakbrowser/puppeteer";
import type { Page } from "puppeteer";

type DemoProxy = {
  protocol: "http" | "https" | "socks4" | "socks5";
  host: string;
  port: number;
  username?: string;
  password?: string;
};

type DemoResult = {
  name: string;
  url: string;
  neighborhood?: string;
  categories?: string[];
  reviewsCount?: number | null;
  reviewsAverage?: number | null;
  snippet?: string;
  businessStatus?: string;
};

type DemoPageState = {
  title: string;
  finalUrl: string;
  bodySnippet: string;
};

function getArg(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildSearchUrl(query: string, location: string, start = 0) {
  const url = new URL("https://www.yelp.com/search");
  url.searchParams.set("find_desc", query);
  url.searchParams.set("find_loc", location);
  if (start > 0) {
    url.searchParams.set("start", String(start));
  }
  return url.toString();
}

function parseProxyOverride(value?: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const withProtocol = /^[a-z0-9]+:\/\//i.test(normalized) ? normalized : `http://${normalized}`;

  try {
    const parsed = new URL(withProtocol);
    const protocol = parsed.protocol.replace(":", "");

    if (
      (protocol === "http" || protocol === "https" || protocol === "socks4" || protocol === "socks5") &&
      parsed.hostname &&
      parsed.port
    ) {
      return {
        protocol,
        host: parsed.hostname,
        port: Number(parsed.port),
        username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
        password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      } satisfies DemoProxy;
    }
  } catch {
    return null;
  }

  return null;
}

function buildYelpResultExtractionScript(rootRef: string) {
  return `
    (() => {
      const root = ${rootRef};
      const normalizeText = (value) => String(value || "").replace(/\\s+/g, " ").trim();
      const findResultContainer = (anchor) => {
        let current = anchor.parentElement;
        let fallback = anchor.parentElement || anchor;
        let steps = 0;

        while (current && steps < 8) {
          const text = normalizeText(current.textContent);
          if (
            text.length > 60 &&
            (/\\(\\d[\\d,]*\\s+reviews?\\)/i.test(text) ||
              /\\d\\.\\d/.test(text) ||
              /open until|closed|available by appointment/i.test(text))
          ) {
            return current;
          }

          fallback = current;
          current = current.parentElement;
          steps += 1;
        }

        return fallback;
      };

      const seen = new Set();
      const items = [];
      const links = Array.from(root.querySelectorAll('a[href*="/biz/"]'));

      for (const link of links) {
        const name = normalizeText(link.textContent);
        const href = link.getAttribute("href");

        if (!name || !href || href.includes("/adredir?") || name.toLowerCase() === "more") {
          continue;
        }

        const url = new URL(href, "https://www.yelp.com");
        url.search = "";
        url.hash = "";

        const key = url.pathname.toLowerCase();
        if (seen.has(key)) {
          continue;
        }

        const container = findResultContainer(link);
        const containerText = normalizeText(container.textContent);
        if (!containerText) {
          continue;
        }

        seen.add(key);

        const ratingMatch = containerText.match(/(\\d\\.\\d)\\s*\\(([\\d,]+)\\s+reviews?\\)/i);
        const snippetMatch = containerText.match(/"([^"]{20,500})"/);
        const statusMatch = containerText.match(
          /(Open until [A-Za-z0-9:.\\s]+|Open now|Closed today|Closed until [A-Za-z0-9:.\\s]+|Closed|Available by appointment)/i,
        );

        let neighborhood = "";
        if (ratingMatch) {
          const afterReviews = containerText.slice((ratingMatch.index || 0) + ratingMatch[0].length).trim();
          const stopTokens = [
            "Open until",
            "Open now",
            "Closed today",
            "Closed until",
            "Closed",
            "Verified License",
            "Certified professionals",
            "Available by appointment",
            "\\"",
          ];

          let stopIndex = afterReviews.length;
          for (const token of stopTokens) {
            const foundIndex = afterReviews.indexOf(token);
            if (foundIndex !== -1 && foundIndex < stopIndex) {
              stopIndex = foundIndex;
            }
          }

          neighborhood = normalizeText(afterReviews.slice(0, stopIndex));
        }

        const categoryLinks = Array.from(container.querySelectorAll("a"));
        const categories = [];
        const seenCategories = new Set();

        for (const categoryLink of categoryLinks) {
          const categoryText = normalizeText(categoryLink.textContent);
          if (
            !categoryText ||
            categoryText === name ||
            categoryText.toLowerCase() === "more" ||
            categoryText.toLowerCase() === "see portfolio" ||
            categoryText.toLowerCase() === "request an appointment" ||
            categoryText.toLowerCase() === "verified license"
          ) {
            continue;
          }

          if (categoryText.length > 40 || /reviews?/i.test(categoryText) || /^\\d/.test(categoryText)) {
            continue;
          }

          if (!seenCategories.has(categoryText)) {
            seenCategories.add(categoryText);
            categories.push(categoryText);
          }
        }

        items.push({
          name,
          url: url.toString(),
          neighborhood,
          categories: categories.slice(0, 5),
          reviewsCount: ratingMatch ? Number.parseInt(ratingMatch[2].replace(/,/g, ""), 10) : null,
          reviewsAverage: ratingMatch ? Number.parseFloat(ratingMatch[1]) : null,
          snippet: snippetMatch ? snippetMatch[1] : "",
          businessStatus: statusMatch ? normalizeText(statusMatch[1]) : "",
        });
      }

      return items;
    })()
  `;
}

function detectBlockedReason(state: DemoPageState) {
  const haystack = `${state.title}\n${state.finalUrl}\n${state.bodySnippet}`.toLowerCase();
  const blockedPhrases = [
    "sorry, you have been blocked",
    "access denied",
    "forbidden",
    "verify you are human",
    "captcha",
    "temporarily unavailable",
    "unusual traffic",
    "please enable js and disable any ad blocker",
    "blocked",
  ];

  for (const phrase of blockedPhrases) {
    if (haystack.includes(phrase)) {
      return phrase;
    }
  }

  return null;
}

async function inspectPageState(page: Page) {
  return (page as unknown as { evaluate(script: string): Promise<DemoPageState> }).evaluate(`
    (() => {
      const bodyText = document.body?.innerText ?? document.body?.textContent ?? "";
      return {
        title: document.title || "",
        finalUrl: window.location.href || "",
        bodySnippet: String(bodyText).replace(/\\s+/g, " ").trim().slice(0, 1500),
      };
    })()
  `);
}

async function extractResults(page: Page) {
  return (page as unknown as { evaluate(script: string): Promise<DemoResult[]> }).evaluate(
    buildYelpResultExtractionScript("document"),
  );
}

async function runDemo() {
  const query = getArg("--query") || getArg("-q") || "dentists";
  const location = getArg("--location") || getArg("-l") || "new york, ny";
  const totalRaw = getArg("--total") || getArg("-t") || "5";
  const total = Number.parseInt(totalRaw, 10);
  const headlessArg = (getArg("--headless") || "true").toLowerCase();
  const headless = headlessArg !== "false";
  const proxy = parseProxyOverride(getArg("--proxy"));
  const url = buildSearchUrl(query, location);

  const browser = await launch({
    headless,
    humanize: true,
    args: proxy ? [`--no-sandbox`, `--disable-setuid-sandbox`, `--proxy-server=${proxy.host}:${proxy.port}`] : ["--no-sandbox", "--disable-setuid-sandbox"],
    proxy: proxy
      ? {
          server: `${proxy.protocol}://${proxy.host}:${proxy.port}`,
        }
      : undefined,
  });

  try {
    const page = await browser.newPage();

    if (proxy?.username || proxy?.password) {
      await page.authenticate({
        username: proxy.username ?? "",
        password: proxy.password ?? "",
      });
    }

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    );
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await sleep(8000);

    const pageState = await inspectPageState(page);
    const blockedReason = detectBlockedReason(pageState);
    const results = await extractResults(page);

    console.log(
      JSON.stringify(
        {
          query,
          location,
          requested: total,
          headless,
          proxy: proxy ? `${proxy.protocol}://${proxy.host}:${proxy.port}` : null,
          blockedReason,
          page: pageState,
          found: results.length,
          items: results.slice(0, total),
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
}

void runDemo().catch((error) => {
  console.error(error);
  process.exit(1);
});
