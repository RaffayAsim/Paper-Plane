import { launch } from "cloakbrowser/puppeteer";
import { config } from "../../lib/config.js";
import { googleMapsProxyManager, type GoogleMapsProxy } from "./google-maps.proxy.js";

type PageSnapshotApi = {
  content(): Promise<string>;
  title(): Promise<string>;
  url(): string;
};

type PageEventApi = {
  on(event: "response", listener: (response: any) => void): void;
  on(event: "requestfailed", listener: (request: any) => void): void;
};

export type YellowPagesLead = {
  name: string;
  address: string;
  website: string;
  phone_number: string;
  categories: string[];
  reviews_count: number | null;
  reviews_average: number | null;
  snippet: string;
  detail_url: string;
  business_status: string;
};

type ScrapedYellowPagesLead = YellowPagesLead & {
  nextPageUrl: string | null;
};

type YellowPagesBlockState = {
  blocked: boolean;
  reason: string | null;
};

type YellowPagesPageData = {
  results: Array<{
    name: string;
    address: string;
    website: string;
    phone_number: string;
    categories: string[];
    reviews_count: string;
    reviews_average: string;
    snippet: string;
    detail_url: string;
    business_status: string;
  }>;
  nextPageUrl: string | null;
};

const KEEP_BROWSER_OPEN_IN_DEV = config.NODE_ENV === "development";

function parseProxyOverride(value?: string) {
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
        } satisfies GoogleMapsProxy;
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeUrl(input: string | null | undefined) {
  if (!input) {
    return "";
  }

  if (input.startsWith("http://") || input.startsWith("https://")) {
    return input;
  }

  if (input.startsWith("//")) {
    return `https:${input}`;
  }

  if (input.startsWith("/")) {
    return `https://www.yellowpages.com${input}`;
  }

  return input;
}

function slugifySegment(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function buildSearchUrls(query: string, location: string) {
  const querySlug = slugifySegment(query);
  const locationSlug = slugifySegment(location);
  const urls = [
    `https://www.yellowpages.com/search?search_terms=${encodeURIComponent(query)}&geo_location_terms=${encodeURIComponent(location)}`,
    `https://www.yellowpages.com/${locationSlug}/${querySlug}`,
  ];

  return [...new Set(urls.filter(Boolean))];
}

function parseRatingValue(raw: string) {
  const match = raw.replace(/,/g, ".").match(/(\d+(\.\d+)?)/);
  if (!match?.[0]) {
    return null;
  }

  const parsed = Number.parseFloat(match[0]);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseReviewCount(raw: string) {
  const match = raw.match(/\d[\d,]*/);
  if (!match?.[0]) {
    return null;
  }

  const parsed = Number.parseInt(match[0].replace(/,/g, ""), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function detectBlockedYellowPagesPage(input: { title: string; bodySnippet: string; finalUrl: string }) {
  const haystack = `${input.title}\n${input.bodySnippet}\n${input.finalUrl}`.toLowerCase();
  const blockedPhrases = [
    "sorry, you have been blocked",
    "unable to access",
    "access denied",
    "forbidden",
    "verify you are human",
    "captcha",
    "blocked",
    "security check",
  ];

  for (const phrase of blockedPhrases) {
    if (haystack.includes(phrase)) {
      return {
        blocked: true,
        reason: phrase,
      } satisfies YellowPagesBlockState;
    }
  }

  return {
    blocked: false,
    reason: null,
  } satisfies YellowPagesBlockState;
}

function summarizeForLog(value: string, maxLength = 500) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3)}...` : normalized;
}

async function scrapeYellowPagesResultsPageWithCloakBrowser(
  pageUrl: string,
  proxy?: GoogleMapsProxy,
): Promise<YellowPagesPageData> {
  const puppeteerArgs = googleMapsProxyManager.getPuppeteerArgs(proxy);
  const browser = await launch({
    headless: config.YELLOW_PAGES_HEADLESS ?? true,
    humanize: true,
    args: puppeteerArgs,
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
    const pageEvents = page as unknown as PageEventApi;
    const selectedProxy = proxy ? `${proxy.protocol}://${proxy.host}:${proxy.port}` : null;
    const proxyMode = proxy
      ? config.YELLOW_PAGES_PROXY_OVERRIDE
        ? "override"
        : "shared_pool"
      : "disabled";
    let mainDocumentStatus: number | null = null;
    let mainDocumentUrl: string | null = null;
    let mainRequestFailure: string | null = null;

    console.log("[yellow-pages] Starting scrape", {
      url: pageUrl,
      useProxy: Boolean(proxy),
      proxyMode,
      selectedProxy,
      headless: config.YELLOW_PAGES_HEADLESS ?? true,
      launchArgs: puppeteerArgs,
    });

    pageEvents.on("response", (response) => {
      if (response.request().resourceType() === "document") {
        mainDocumentStatus = response.status();
        mainDocumentUrl = response.url();
      }
    });

    pageEvents.on("requestfailed", (request) => {
      if (request.resourceType() === "document") {
        mainRequestFailure = request.failure()?.errorText || "Unknown request failure";
      }
    });

    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    );
    await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: proxy ? 15000 : 30000 });
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const pageSnapshot = page as unknown as PageSnapshotApi;
    const title = await pageSnapshot.title();
    const finalUrl = pageSnapshot.url();

    console.log("[yellow-pages] Navigation result", {
      requestedUrl: pageUrl,
      mainDocumentStatus,
      mainDocumentUrl,
      mainRequestFailure,
      finalUrl,
      title,
      selectedProxy,
    });

    const parsed = await (page as unknown as {
      evaluate(script: string): Promise<{
        results: YellowPagesPageData["results"];
        nextPageUrl: string | null;
        candidateCount: number;
        businessLinkCount: number;
        heading: string;
        bodySnippet: string;
      }>;
    }).evaluate(`
      (() => {
      function readText(root, selectors) {
        for (var i = 0; i < selectors.length; i += 1) {
          var selector = selectors[i];
          var node = root.querySelector(selector);
          var text = node && node.textContent ? node.textContent.trim() : "";
          if (text) {
            return text;
          }
        }
        return "";
      }

      function readHref(root, selectors) {
        for (var i = 0; i < selectors.length; i += 1) {
          var selector = selectors[i];
          var node = root.querySelector(selector);
          var href = node ? node.getAttribute("href") || "" : "";
          href = href.trim();
          if (href) {
            return href;
          }
        }
        return "";
      }

      var resultSelectors = [
        ".search-results .result",
        ".organic .result",
        ".result",
        "article.result",
        "[class*='result']",
      ];

      var candidates = [];
      var seen = new Set();

      for (var selectorIndex = 0; selectorIndex < resultSelectors.length; selectorIndex += 1) {
        var nodes = document.querySelectorAll(resultSelectors[selectorIndex]);
        for (var nodeIndex = 0; nodeIndex < nodes.length; nodeIndex += 1) {
          var element = nodes[nodeIndex];
          if (!seen.has(element)) {
            seen.add(element);
            candidates.push(element);
          }
        }
      }

      var results = [];

      for (var candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
        var element = candidates[candidateIndex];
        var className = element.getAttribute("class") || "";
        if (className.indexOf("related-search") !== -1 || className.indexOf("search-ad") !== -1 || className.indexOf("featured") !== -1) {
          continue;
        }

        var name = readText(element, [".business-name", "h2 a", "h2"]);
        if (!name) {
          continue;
        }

        var streetAddress = readText(element, [".street-address", ".adr .street-address"]);
        var locality = readText(element, [".locality", ".adr .locality"]);
        var phone = readText(element, [".phones.phone.primary", ".phone", "[itemprop='telephone']"]);
        var website = readHref(element, ["a.track-visit-website", ".links a.track-visit-website", "a.website", "a[data-analytics='website']"]);
        var detailUrl = readHref(element, ["a.business-name", "h2 a"]);
        var categoryNodes = element.querySelectorAll(".categories a");
        var categories = [];

        for (var categoryIndex = 0; categoryIndex < categoryNodes.length; categoryIndex += 1) {
          var categoryText = categoryNodes[categoryIndex].textContent ? categoryNodes[categoryIndex].textContent.trim() : "";
          if (categoryText) {
            categories.push(categoryText);
          }
        }

        var snippet = readText(element, [".snippet", ".body", ".description", ".result-snippet"]);
        var businessStatus = readText(element, [".open-now", ".open-status", ".hours-info", ".availability-info"]);
        var ratingsElement = element.querySelector(".ratings");
        var ratingText = readText(element, [".ratings .result-rating", ".rating", "[class*='rating']"]) || (ratingsElement ? ratingsElement.getAttribute("aria-label") || "" : "");
        var reviewCountText = readText(element, [".ratings .count", ".count", ".rating-count"]);

        results.push({
          name: name,
          address: [streetAddress, locality].filter(Boolean).join(", "),
          website: website,
          phone_number: phone,
          categories: categories,
          reviews_count: reviewCountText,
          reviews_average: ratingText,
          snippet: snippet,
          detail_url: detailUrl,
          business_status: businessStatus,
        });
      }

      var nextPageNode = document.querySelector("a.next.ajax-page, a.next, .pagination a[rel='next']");
      var bodyText = document.body && document.body.textContent ? document.body.textContent.replace(/\\s+/g, " ").trim() : "";
      var headingNode = document.querySelector("h1");

      return {
        results: results,
        nextPageUrl: nextPageNode ? (nextPageNode.getAttribute("href") || "").trim() || null : null,
        candidateCount: candidates.length,
        businessLinkCount: document.querySelectorAll("a.business-name, a[href*='/listing_profile/'], a[href*='/biz/']").length,
        heading: headingNode && headingNode.textContent ? headingNode.textContent.trim() : "",
        bodySnippet: bodyText.slice(0, 1200),
      };
    })()
    `);

    const blockState = detectBlockedYellowPagesPage({
      title,
      finalUrl,
      bodySnippet: parsed.bodySnippet,
    });

    if (blockState.blocked) {
      console.warn("[yellow-pages] Blocked page detected", {
        requestedUrl: pageUrl,
        finalUrl,
        title,
        statusCode: mainDocumentStatus,
        reason: blockState.reason,
        snippet: summarizeForLog(parsed.bodySnippet),
      });

      throw new Error(
        `Yellow Pages blocked by Cloudflare (${blockState.reason || "unknown_block"}). status=${mainDocumentStatus ?? "unknown"} title="${title}" url="${finalUrl}"`,
      );
    }

    if (parsed.results.length === 0) {
      console.warn("[yellow-pages] Empty results page", {
        requestedUrl: pageUrl,
        finalUrl,
        title,
        heading: parsed.heading,
        candidateCount: parsed.candidateCount,
        businessLinkCount: parsed.businessLinkCount,
        snippet: summarizeForLog(parsed.bodySnippet),
      });

      throw new Error(
        `No Yellow Pages results found. status=${mainDocumentStatus ?? "unknown"} title="${title}" url="${finalUrl}" heading="${parsed.heading}" candidateCount=${parsed.candidateCount} businessLinkCount=${parsed.businessLinkCount}`,
      );
    }

    return {
      results: parsed.results,
      nextPageUrl: parsed.nextPageUrl,
    };
  } finally {
    if (KEEP_BROWSER_OPEN_IN_DEV) {
      console.log("[yellow-pages] keeping browser open in development mode");
    } else {
      await browser.close();
    }
  }
}

export async function scrapeYellowPagesPlaces(input: {
  query: string;
  location: string;
  total: number;
  onLeadFound: (lead: YellowPagesLead) => Promise<void>;
}) {
  const visitedDetailUrls = new Set<string>();
  const visitedPages = new Set<string>();
  let processed = 0;
  const initialUrls = buildSearchUrls(input.query, input.location);
  let currentPageUrl = initialUrls[0] || "";
  let initialUrlIndex = 0;
  const proxyOverride = parseProxyOverride(config.YELLOW_PAGES_PROXY_OVERRIDE);

  if (config.YELLOW_PAGES_USE_PROXY && !proxyOverride && googleMapsProxyManager.isEmpty()) {
    console.log("[yellow-pages] Proxy mode enabled, loading shared proxy pool...");
    await googleMapsProxyManager.loadProxies();
  }

  while (currentPageUrl && processed < input.total && !visitedPages.has(currentPageUrl)) {
    visitedPages.add(currentPageUrl);

    let pageData: YellowPagesPageData | null = null;
    let lastError: unknown = null;
    const maxAttempts = config.YELLOW_PAGES_USE_PROXY ? 5 : 1;

    for (let attempt = 0; !pageData && attempt < maxAttempts; attempt += 1) {
      const proxy = proxyOverride || (config.YELLOW_PAGES_USE_PROXY ? googleMapsProxyManager.getNextProxy() || undefined : undefined);

      try {
        pageData = await scrapeYellowPagesResultsPageWithCloakBrowser(currentPageUrl, proxy);
        break;
      } catch (error) {
        lastError = error;
        console.warn("[yellow-pages] Scrape attempt failed", {
          url: currentPageUrl,
          attempt: attempt + 1,
          maxAttempts,
          selectedProxy: proxy ? `${proxy.protocol}://${proxy.host}:${proxy.port}` : null,
          message: error instanceof Error ? error.message : "Unknown scrape error",
        });
      }
    }

    if (!pageData) {
      if (initialUrlIndex < initialUrls.length - 1) {
        initialUrlIndex += 1;
        currentPageUrl = initialUrls[initialUrlIndex] || "";
        continue;
      }

      const message = lastError instanceof Error ? lastError.message : "Unknown Yellow Pages scraping error";
      throw new Error(`Yellow Pages search page failed for ${currentPageUrl}: ${message}`);
    }

    const { results, nextPageUrl } = pageData;
    const normalizedResults: ScrapedYellowPagesLead[] = results.map((item) => ({
      name: item.name,
      address: item.address,
      website: normalizeUrl(item.website),
      phone_number: item.phone_number,
      categories: item.categories,
      reviews_count: parseReviewCount(item.reviews_count),
      reviews_average: parseRatingValue(item.reviews_average),
      snippet: item.snippet,
      detail_url: normalizeUrl(item.detail_url),
      business_status: item.business_status,
      nextPageUrl: normalizeUrl(nextPageUrl),
    }));

    let foundNewResult = false;

    for (const result of normalizedResults) {
      if (processed >= input.total) {
        break;
      }

      const uniqueKey = result.detail_url || `${result.name}|${result.address}|${result.phone_number}`;
      if (!uniqueKey || visitedDetailUrls.has(uniqueKey)) {
        continue;
      }

      visitedDetailUrls.add(uniqueKey);
      foundNewResult = true;

      await input.onLeadFound({
        name: result.name,
        address: result.address,
        website: result.website,
        phone_number: result.phone_number,
        categories: result.categories,
        reviews_count: result.reviews_count,
        reviews_average: result.reviews_average,
        snippet: result.snippet,
        detail_url: result.detail_url,
        business_status: result.business_status,
      });
      processed += 1;
    }

    const nextUrl = normalizedResults[0]?.nextPageUrl || normalizeUrl(nextPageUrl);
    if (!foundNewResult || !nextUrl) {
      break;
    }

    currentPageUrl = nextUrl;
  }

  return processed;
}
