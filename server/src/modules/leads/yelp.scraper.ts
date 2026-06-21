import { launch } from "cloakbrowser/puppeteer";
import type { Page } from "puppeteer";
import { browserless } from "../../lib/browserless.js";
import { config } from "../../lib/config.js";
import { logger } from "../../lib/logger.js";
import { googleMapsProxyManager, type GoogleMapsProxy } from "./google-maps.proxy.js";

export type YelpReview = {
  author?: string;
  rating?: number;
  text?: string;
  date?: string;
};

export type YelpContact = {
  phone?: string;
  address?: string;
  website?: string;
};

export type YelpEnrichment = {
  email?: string;
  website?: string;
};

export type YelpResult = {
  name: string;
  url: string;
  neighborhood?: string;
  categories?: string[];
  reviewsCount?: number | null;
  reviewsAverage?: number | null;
  snippet?: string;
  businessStatus?: string;
  contact?: YelpContact;
  reviews?: YelpReview[];
  enrichment?: YelpEnrichment;
};

export type YelpLead = {
  name: string;
  neighborhood: string;
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

type YelpScraperEnrichmentOptions = {
  findEmail?: boolean;
  findWebsite?: boolean;
};

type YelpScraperOptions = {
  limit?: number;
  includeReviews?: boolean;
  includeContact?: boolean;
  enrichment?: YelpScraperEnrichmentOptions;
  headless?: boolean;
  humanize?: boolean;
  waitMs?: number;
  proxy?: GoogleMapsProxy | null;
};

type BaseYelpResult = Omit<YelpResult, "contact" | "reviews" | "enrichment">;

type YelpPageState = {
  title: string;
  finalUrl: string;
  bodySnippet: string;
};

const DEFAULT_OPTIONS: Required<Omit<YelpScraperOptions, "proxy">> = {
  limit: 10,
  includeReviews: false,
  includeContact: false,
  enrichment: {
    findEmail: false,
    findWebsite: false,
  },
  headless: true,
  humanize: true,
  waitMs: 3000,
};

const RESULTS_PER_PAGE = 10;
const KEEP_BROWSER_OPEN_IN_DEV = config.NODE_ENV === "development";

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

async function waitForResults(page: Page) {
  await sleep(3000);
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

function detectBlockedYelpReason(state: YelpPageState) {
  const haystack = `${state.title}\n${state.finalUrl}\n${state.bodySnippet}`.toLowerCase();
  const blockedPhrases = [
    "sorry, you have been blocked",
    "access denied",
    "forbidden",
    "verify you are human",
    "captcha",
    "temporarily unavailable",
    "unusual traffic",
    "blocked",
  ];

  if (state.finalUrl.startsWith("chrome-error://")) {
    return "chrome navigation error";
  }

  for (const phrase of blockedPhrases) {
    if (haystack.includes(phrase)) {
      return phrase;
    }
  }

  return null;
}

function isRecoverablePageContextError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("Execution context was destroyed") ||
    error.message.includes("Navigating frame was detached") ||
    error.message.includes("Cannot find context with specified id")
  );
}

async function waitForPageToSettle(page: Page) {
  try {
    await page.waitForNavigation({
      waitUntil: "domcontentloaded",
      timeout: 3000,
    });
  } catch {
    // Ignore timeouts here; we only want to give in-flight navigations a moment to finish.
  }

  try {
    await page.waitForFunction(() => document.readyState === "interactive" || document.readyState === "complete", {
      timeout: 2500,
    });
  } catch {
    // If the page is still unstable, the retry path below will surface the real failure.
  }

  await sleep(1000);
}

async function withPageEvaluateRetry<T>(page: Page, label: string, run: () => Promise<T>) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      if (!isRecoverablePageContextError(error) || attempt === 2) {
        throw error;
      }

      logger.warn("[yelp] page context lost during evaluate; retrying", {
        label,
        attempt,
        url: page.url(),
        message: error instanceof Error ? error.message : "Unknown page evaluate error",
      });

      await waitForPageToSettle(page);
    }
  }

  throw new Error(`Unreachable retry state for ${label}`);
}

async function extractPageResults(page: Page) {
  return withPageEvaluateRetry(page, "extractPageResults", () =>
    (page as unknown as { evaluate(script: string): Promise<BaseYelpResult[]> }).evaluate(buildYelpResultExtractionScript("document")),
  );
}

async function inspectYelpPageState(page: Page) {
  return withPageEvaluateRetry(page, "inspectYelpPageState", () =>
    (page as unknown as { evaluate(script: string): Promise<YelpPageState> }).evaluate(`
      (() => {
        const bodyText = document.body?.innerText ?? document.body?.textContent ?? "";
        return {
          title: document.title || "",
          finalUrl: window.location.href || "",
          bodySnippet: String(bodyText).replace(/\\s+/g, " ").trim().slice(0, 1500),
        };
      })()
    `),
  );
}

async function extractPageResultsFromHtml(page: Page, html: string) {
  return withPageEvaluateRetry(page, "extractPageResultsFromHtml", () =>
    (page as unknown as { evaluate(script: string): Promise<BaseYelpResult[]> }).evaluate(`
      (() => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(${JSON.stringify(html)}, "text/html");
        return ${buildYelpResultExtractionScript("doc")};
      })()
    `),
  );
}

async function fetchYelpResultsWithBrowserless(page: Page, url: string) {
  if (!browserless.isConfigured()) {
    return null;
  }

  logger.info("[yelp] attempting Browserless fallback for search page", {
    url,
    browserlessProxy: config.YELP_BROWSERLESS_PROXY ?? null,
    hasExternalProxy: Boolean(config.YELP_BROWSERLESS_EXTERNAL_PROXY),
  });

  const response = await browserless.unblock({
    url,
    content: true,
    bestAttempt: true,
    waitForTimeout: config.YELP_BROWSERLESS_WAIT_MS,
    timeout: config.YELP_BROWSERLESS_TIMEOUT_MS,
    proxy: config.YELP_BROWSERLESS_PROXY,
    externalProxyServer: config.YELP_BROWSERLESS_EXTERNAL_PROXY,
  });

  const html = response.content?.trim();
  if (!html) {
    throw new Error("Browserless returned empty Yelp search HTML");
  }

  return extractPageResultsFromHtml(page, html);
}

async function resolveYelpSearchPageResults(page: Page, url: string, context: { query: string; location: string; pageNumber: number }) {
  if (!config.YELP_FORCE_BROWSERLESS) {
    return null;
  }

  if (!browserless.isConfigured()) {
    logger.warn("[yelp] YELP_FORCE_BROWSERLESS enabled but Browserless is not configured", {
      query: context.query,
      location: context.location,
      pageNumber: context.pageNumber,
      url,
    });
    return null;
  }

  const forcedResults = await fetchYelpResultsWithBrowserless(page, url);
  logger.info("[yelp] forced Browserless search page fetch completed", {
    query: context.query,
    location: context.location,
    pageNumber: context.pageNumber,
    url,
    resultCount: forcedResults?.length ?? 0,
  });

  return forcedResults;
}

async function extractBusinessDetails(page: Page) {
  return withPageEvaluateRetry(page, "extractBusinessDetails", () =>
    (page as unknown as {
      evaluate(script: string): Promise<Pick<YelpResult, "contact" | "reviews" | "enrichment">>;
    }).evaluate(`
    (() => {
      const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      const parsedJson = scripts.flatMap((script) => {
        try {
          const json = JSON.parse(script.textContent ?? "null");
          return Array.isArray(json) ? json : [json];
        } catch {
          return [];
        }
      });

      const flattened = parsedJson.flatMap((item) => {
        if (item && typeof item === "object" && Array.isArray(item["@graph"])) {
          return item["@graph"];
        }

        return [item];
      });

      const businessNode =
        flattened.find(
          (item) =>
            item &&
            typeof item === "object" &&
            ["LocalBusiness", "HomeAndConstructionBusiness", "Organization"].includes(String(item["@type"] ?? "")),
        ) ?? null;

      const reviewNodes = flattened.flatMap((item) => {
        if (!item || typeof item !== "object") {
          return [];
        }

        if (Array.isArray(item.review)) {
          return item.review;
        }

        if (item.review && typeof item.review === "object") {
          return [item.review];
        }

        if (String(item["@type"] ?? "") === "Review") {
          return [item];
        }

        return [];
      });

      const business = businessNode;
      const contact = {};
      const enrichment = {};

      if (business?.telephone) {
        contact.phone = business.telephone;
      }

      if (business?.url) {
        contact.website = business.url;
      }

      const externalWebsiteLink = Array.from(document.querySelectorAll("a[href]")).find((anchor) => {
        const href = anchor.getAttribute("href") ?? "";
        return href.includes("/biz_redir?") || anchor.textContent?.trim().toLowerCase() === "business website";
      });

      const resolvedExternalWebsite = (() => {
        const href = externalWebsiteLink?.getAttribute("href");
        if (!href) {
          return undefined;
        }

        try {
          const url = new URL(href, window.location.origin);
          const redirectedUrl = url.searchParams.get("url");
          return redirectedUrl ? decodeURIComponent(redirectedUrl) : url.toString();
        } catch {
          return undefined;
        }
      })();

      if (resolvedExternalWebsite) {
        enrichment.website = resolvedExternalWebsite;
      }

      const emailHref = Array.from(document.querySelectorAll('a[href^="mailto:"]'))[0]?.href;
      if (emailHref) {
        enrichment.email = emailHref.replace(/^mailto:/i, "").trim() || undefined;
      }

      if (!enrichment.email) {
        const bodyText = document.body?.innerText ?? "";
        const emailMatch = bodyText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/i);
        if (emailMatch?.[0]) {
          enrichment.email = emailMatch[0];
        }
      }

      if (typeof business?.address === "string") {
        contact.address = business.address;
      } else if (business?.address) {
        const parts = [
          business.address.streetAddress,
          business.address.addressLocality,
          business.address.addressRegion,
          business.address.postalCode,
        ].filter(Boolean);

        if (parts.length > 0) {
          contact.address = parts.join(", ");
        }
      }

      const reviews = reviewNodes
        .flatMap((review) => {
          if (!review || typeof review !== "object") {
            return [];
          }

          const author =
            typeof review.author === "string"
              ? review.author
              : typeof review.author?.name === "string"
                ? review.author.name
                : undefined;

          const ratingValue = review.reviewRating?.ratingValue;
          const rating =
            typeof ratingValue === "number"
              ? ratingValue
              : typeof ratingValue === "string"
                ? Number(ratingValue)
                : undefined;

          const text = review.description ?? review.reviewBody;

          if (!author && !text && rating === undefined) {
            return [];
          }

          return [
            {
              author,
              rating: Number.isFinite(rating) ? rating : undefined,
              text,
              date: review.datePublished,
            },
          ];
        })
        .slice(0, 5);

      return {
        contact: Object.keys(contact).length > 0 ? contact : undefined,
        reviews: reviews.length > 0 ? reviews : undefined,
        enrichment: Object.keys(enrichment).length > 0 ? enrichment : undefined,
      };
    })()
  `),
  );
}

async function enrichBusiness(page: Page, result: YelpResult, options: Required<Omit<YelpScraperOptions, "proxy">>) {
  if (
    !options.includeContact &&
    !options.includeReviews &&
    !options.enrichment.findEmail &&
    !options.enrichment.findWebsite
  ) {
    return result;
  }

  try {
    await page.goto(result.url, {
      waitUntil: "domcontentloaded",
      timeout: config.YELP_DETAIL_TIMEOUT_MS,
    });
  } catch (error) {
    logger.warn("[yelp] detail navigation failed", {
      url: result.url,
      timeoutMs: config.YELP_DETAIL_TIMEOUT_MS,
      message: error instanceof Error ? error.message : "Unknown detail navigation error",
    });
    throw error;
  }
  await sleep(options.waitMs);

  const details = await extractBusinessDetails(page);

  return {
    ...result,
    ...(options.includeContact ? { contact: details.contact } : {}),
    ...(options.includeReviews ? { reviews: details.reviews } : {}),
    ...(options.enrichment.findEmail || options.enrichment.findWebsite
      ? {
          enrichment:
            Object.keys({
              ...(options.enrichment.findEmail && details.enrichment?.email
                ? { email: details.enrichment.email }
                : {}),
              ...(options.enrichment.findWebsite && details.enrichment?.website
                ? { website: details.enrichment.website }
                : {}),
            }).length > 0
              ? {
                  ...(options.enrichment.findEmail && details.enrichment?.email
                    ? { email: details.enrichment.email }
                    : {}),
                  ...(options.enrichment.findWebsite && details.enrichment?.website
                    ? { website: details.enrichment.website }
                    : {}),
                }
              : undefined,
        }
      : {}),
  };
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
    return `https://www.yelp.com${input}`;
  }

  return input;
}

function parseRatingFromText(value: string) {
  const match = value.match(/(\d+(\.\d+)?)/);
  if (!match?.[1]) {
    return null;
  }

  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseReviewCountFromReviews(reviews?: YelpReview[]) {
  if (!reviews?.length) {
    return null;
  }

  return reviews.length;
}

function deriveCategories(result: YelpResult) {
  return result.categories ?? [];
}

function deriveNeighborhood(result: YelpResult) {
  if (result.neighborhood?.trim()) {
    return result.neighborhood.trim();
  }

  const address = result.contact?.address ?? "";
  if (!address) {
    return "";
  }

  const parts = address.split(",").map((item) => item.trim()).filter(Boolean);
  return parts.length > 1 ? parts[1] ?? parts[0] ?? "" : parts[0] ?? "";
}

function deriveSnippet(result: YelpResult) {
  if (result.snippet?.trim()) {
    return result.snippet.trim();
  }

  const reviewText = result.reviews?.find((entry) => entry.text?.trim())?.text?.trim();
  return reviewText ?? "";
}

function deriveBusinessStatus(result: YelpResult) {
  return result.businessStatus ?? "";
}

function toYelpLead(result: YelpResult): YelpLead {
  return {
    name: result.name,
    neighborhood: deriveNeighborhood(result),
    address: result.contact?.address ?? "",
    website: normalizeUrl(result.enrichment?.website ?? result.contact?.website ?? ""),
    phone_number: result.contact?.phone ?? "",
    categories: deriveCategories(result),
    reviews_count: result.reviewsCount ?? parseReviewCountFromReviews(result.reviews),
    reviews_average: result.reviewsAverage ?? result.reviews?.[0]?.rating ?? parseRatingFromText(deriveSnippet(result)),
    snippet: deriveSnippet(result),
    detail_url: normalizeUrl(result.url),
    business_status: deriveBusinessStatus(result),
  };
}

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

async function searchYelp(query: string, location: string, options: YelpScraperOptions = {}) {
  const resolvedOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
    enrichment: {
      ...DEFAULT_OPTIONS.enrichment,
      ...options.enrichment,
    },
    limit: Math.max(1, Math.floor(options.limit ?? DEFAULT_OPTIONS.limit)),
  };

  const browser = await launch({
    headless: resolvedOptions.headless,
    humanize: resolvedOptions.humanize,
    args: options.proxy ? googleMapsProxyManager.getPuppeteerArgs(options.proxy) : ["--no-sandbox", "--disable-setuid-sandbox"],
    proxy: options.proxy
      ? {
          server: `${options.proxy.protocol}://${options.proxy.host}:${options.proxy.port}`,
        }
      : undefined,
  });

  const searchPage = await browser.newPage();
  const detailPage =
    resolvedOptions.includeContact ||
    resolvedOptions.includeReviews ||
    resolvedOptions.enrichment.findEmail ||
    resolvedOptions.enrichment.findWebsite
      ? await browser.newPage()
      : null;

  if (options.proxy?.username || options.proxy?.password) {
    await searchPage.authenticate({
      username: options.proxy.username ?? "",
      password: options.proxy.password ?? "",
    });

    if (detailPage) {
      await detailPage.authenticate({
        username: options.proxy.username ?? "",
        password: options.proxy.password ?? "",
      });
    }
  }

  const allResults: YelpResult[] = [];
  const seenBusinesses = new Set<string>();
  const totalPages = Math.max(1, Math.ceil(resolvedOptions.limit / RESULTS_PER_PAGE));

  try {
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      const currentUrl = buildSearchUrl(query, location, (pageNumber - 1) * RESULTS_PER_PAGE);
      let pageState: YelpPageState = {
        title: "",
        finalUrl: currentUrl,
        bodySnippet: "",
      };
      let blockedReason: string | null = null;
      let pageResults: BaseYelpResult[] = [];

      const forcedBrowserlessResults = await resolveYelpSearchPageResults(searchPage, currentUrl, {
        query,
        location,
        pageNumber,
      });

      if (forcedBrowserlessResults?.length) {
        pageResults = forcedBrowserlessResults;
      } else {
        try {
          await searchPage.goto(currentUrl, {
            waitUntil: "domcontentloaded",
            timeout: config.YELP_NAVIGATION_TIMEOUT_MS,
          });
        } catch (error) {
          logger.warn("[yelp] search navigation failed", {
            url: currentUrl,
            pageNumber,
            timeoutMs: config.YELP_NAVIGATION_TIMEOUT_MS,
            message: error instanceof Error ? error.message : "Unknown search navigation error",
          });
          throw error;
        }
        await sleep(resolvedOptions.waitMs);
        await waitForResults(searchPage);

        pageState = await inspectYelpPageState(searchPage);
        blockedReason = detectBlockedYelpReason(pageState);
        pageResults = await extractPageResults(searchPage);

        if ((blockedReason || pageResults.length === 0) && browserless.isConfigured()) {
          try {
            const fallbackResults = await fetchYelpResultsWithBrowserless(searchPage, currentUrl);
            if (fallbackResults?.length) {
              pageResults = fallbackResults;
              logger.info("[yelp] Browserless fallback recovered search results", {
                query,
                location,
                pageNumber,
                resultCount: fallbackResults.length,
              });
            }
          } catch (error) {
            logger.warn("[yelp] Browserless fallback failed for search page", {
              query,
              location,
              pageNumber,
              url: currentUrl,
              message: error instanceof Error ? error.message : "Unknown Browserless fallback error",
            });
          }
        }
      }

      if (pageResults.length === 0) {
        logger.warn("[yelp] no results extracted from search page", {
          query,
          location,
          pageNumber,
          url: pageState.finalUrl || searchPage.url(),
          title: pageState.title,
          blockedReason,
          bodySnippet: pageState.bodySnippet,
        });
        break;
      }

      for (const pageResult of pageResults) {
        if (seenBusinesses.has(pageResult.url)) {
          continue;
        }

        seenBusinesses.add(pageResult.url);

        const baseResult: YelpResult = {
          ...pageResult,
        };

        const enrichedResult =
          detailPage === null ? baseResult : await enrichBusiness(detailPage, baseResult, resolvedOptions);

        allResults.push(enrichedResult);

        if (allResults.length >= resolvedOptions.limit) {
          break;
        }
      }

      if (allResults.length >= resolvedOptions.limit) {
        break;
      }
    }

    return allResults.slice(0, resolvedOptions.limit);
  } finally {
    if (KEEP_BROWSER_OPEN_IN_DEV) {
      console.log("[yelp] keeping browser open in development mode");
    } else {
      await browser.close();
    }
  }
}

export async function scrapeYelpPlaces(input: {
  query: string;
  location: string;
  total: number;
  onLeadFound: (lead: YelpLead) => Promise<void>;
}) {
  const proxyOverride = parseProxyOverride(config.YELP_PROXY_OVERRIDE);

  if (config.YELP_USE_PROXY && !proxyOverride && googleMapsProxyManager.isEmpty()) {
    console.log("[yelp] Proxy mode enabled, loading shared proxy pool...");
    await googleMapsProxyManager.loadProxies();
  }

  const proxy =
    proxyOverride || (config.YELP_USE_PROXY ? googleMapsProxyManager.getNextProxy() || undefined : undefined);

  const results = await searchYelp(input.query, input.location, {
    limit: input.total,
    includeContact: true,
    includeReviews: true,
    enrichment: {
      findWebsite: true,
      findEmail: false,
    },
    headless: config.YELP_HEADLESS ?? true,
    humanize: true,
    waitMs: 3000,
    proxy,
  });

  let processed = 0;

  for (const result of results) {
    if (processed >= input.total) {
      break;
    }

    await input.onLeadFound(toYelpLead(result));
    processed += 1;
  }

  return processed;
}
