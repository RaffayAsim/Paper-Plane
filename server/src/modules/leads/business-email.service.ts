import { launch } from "cloakbrowser/puppeteer";
import puppeteer from "puppeteer";
import { prisma } from "../../lib/prisma.js";

type EmailDiscoveryResult = {
  email: string | null;
  sourceUrl: string | null;
  scannedUrls: string[];
};

type EmailCandidate = {
  email: string;
  sourceUrl: string;
  strategy: string;
};

const DIRECT_PATH_HINTS = [
  "/contact",
  "/contact-us",
  "/contact-information",
  "/about",
  "/about-us",
  "/about/contact-information",
  "/support",
  "/team",
  "/directory",
  "/staff",
  "/thank-you",
  "/thank-you/",
  "/schedule-service/thank-you/",
  "/contact-us/thank-you/",
  "/book/thank-you/",
  "/appointment/thank-you/",
];

const DISCOVERY_KEYWORDS = [
  "contact",
  "contact-us",
  "contact-information",
  "directory",
  "staff",
  "faculty",
  "team",
  "support",
  "about",
  "office",
  "leadership",
  "schedule-service",
  "thank-you",
  "thankyou",
  "book",
  "appointment",
];

const SEARCH_QUERIES = [
  'site:{domain} "@{domain}"',
  'site:{domain} "mailto:"',
  'site:{domain} "contact" "@{domain}"',
  'site:{domain} "support" "@{domain}"',
  'site:{domain} "info@" OR "contact@" OR "support@"',
  'site:{domain} ("email" OR "contact us" OR "thank you")',
];
const GOOGLE_DORK_QUERIES = [
  'site:{domain} ("@{domain}" OR "mailto:")',
  'site:{domain} ("contact" OR "about" OR "team") "@{domain}"',
  'site:{domain} ("info@" OR "contact@" OR "support@" OR "sales@")',
  'site:{domain} filetype:pdf ("@{domain}" OR "email")',
  'site:{domain} ("owner" OR "founder" OR "director") "@{domain}"',
  'site:{domain} ("email" OR "contact us" OR "thank you" OR "schedule service")',
  'site:{domain} ("rrsc-email.com" OR "email us" OR "customer service")',
];

const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PREFERRED_LOCAL_PARTS = new Set([
  "info",
  "contact",
  "support",
  "sales",
  "hello",
  "frontdesk",
  "front-desk",
  "office",
  "accounting",
  "admin",
]);
const ACCEPTABLE_LOCAL_PARTS = new Set([
  "team",
  "admissions",
  "inquiries",
  "mail",
  "appsupport",
  "itsupport",
]);
const PERSONAL_ROLE_HINTS = ["principal", "director", "head", "founder", "ceo", "owner", "manager"];
const BLOCKED_HOSTS = ["facebook.com", "instagram.com", "linkedin.com", "twitter.com", "x.com", "youtube.com"];

function isIgnorablePuppeteerError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("Target closed") ||
    error.message.includes("Session closed") ||
    error.message.includes("Execution context was destroyed") ||
    error.message.includes("Navigating frame was detached")
  );
}

function normalizeWebsiteUrl(rawUrl: string) {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    return new URL(withProtocol);
  } catch {
    return null;
  }
}

function stripCommonSubdomains(hostname: string) {
  return hostname.replace(/^www\./i, "").toLowerCase();
}

function isBlockedHost(hostname: string) {
  const normalized = stripCommonSubdomains(hostname);
  return BLOCKED_HOSTS.some((host) => normalized === host || normalized.endsWith(`.${host}`));
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#64;/g, "@")
    .replace(/&#x40;/gi, "@")
    .replace(/&#46;/g, ".")
    .replace(/&#x2e;/gi, ".")
    .replace(/&commat;/gi, "@")
    .replace(/&period;/gi, ".")
    .replace(/&amp;/gi, "&");
}

function normalizeEmailCandidate(value: string) {
  return decodeHtmlEntities(value)
    .replace(/^mailto:/i, "")
    .split("?")[0]
    .replace(/[),;]+$/g, "")
    .trim()
    .toLowerCase();
}

function collectEmails(text: string) {
  const emails = new Set<string>();
  const decoded = decodeHtmlEntities(text);

  for (const match of decoded.matchAll(EMAIL_REGEX)) {
    const email = normalizeEmailCandidate(match[0]);
    if (email) emails.add(email);
  }

  for (const match of decoded.matchAll(/mailto:([^"'`\s>]+)/gi)) {
    const email = normalizeEmailCandidate(match[1]);
    if (email) emails.add(email);
  }

  return [...emails];
}

function scoreEmail(email: string, websiteHost: string) {
  const [localPart, domain = ""] = email.toLowerCase().split("@");
  if (!localPart || !domain) return Number.NEGATIVE_INFINITY;

  let score = 0;
  const normalizedHost = stripCommonSubdomains(websiteHost);
  const normalizedDomain = stripCommonSubdomains(domain);

  if (normalizedDomain === normalizedHost) {
    score += 120;
  } else if (normalizedDomain.endsWith(`.${normalizedHost}`) || normalizedHost.endsWith(`.${normalizedDomain}`)) {
    score += 70;
  } else {
    score -= 80;
  }

  if (localPart.includes("noreply") || localPart.includes("no-reply")) {
    score -= 150;
  }

  if (PREFERRED_LOCAL_PARTS.has(localPart)) {
    score += 60;
  } else if (ACCEPTABLE_LOCAL_PARTS.has(localPart)) {
    score += 30;
  } else if (localPart.includes(".")) {
    score -= 10;
  } else {
    score += 5;
  }

  if (PERSONAL_ROLE_HINTS.some((hint) => localPart.includes(hint))) {
    score += 5;
  }

  return score;
}

function scoreCandidate(candidate: EmailCandidate, websiteHost: string) {
  let score = scoreEmail(candidate.email, websiteHost);

  try {
    const sourceHost = stripCommonSubdomains(new URL(candidate.sourceUrl).hostname);
    const normalizedWebsiteHost = stripCommonSubdomains(websiteHost);
    const sourceIsFirstParty =
      sourceHost === normalizedWebsiteHost ||
      sourceHost.endsWith(`.${normalizedWebsiteHost}`) ||
      normalizedWebsiteHost.endsWith(`.${sourceHost}`);

    if (sourceIsFirstParty) {
      if (candidate.strategy === "direct_static" || candidate.strategy === "direct_rendered") {
        score += 120;
      } else if (candidate.strategy === "google_dork_result_static" || candidate.strategy === "ddg_search_result_static") {
        score += 105;
      } else if (candidate.strategy === "ddg_browser_search_result") {
        score += 90;
      }
    }
  } catch {
    // Ignore malformed source URLs during scoring.
  }

  return score;
}

function rankCandidates(candidates: EmailCandidate[], websiteHost: string) {
  return [...candidates].sort(
    (left, right) => scoreCandidate(right, websiteHost) - scoreCandidate(left, websiteHost),
  );
}

function appendCandidates(
  target: Map<string, EmailCandidate>,
  emails: string[],
  sourceUrl: string,
  strategy: string,
) {
  for (const email of emails) {
    if (!target.has(email)) {
      target.set(email, { email, sourceUrl, strategy });
    }
  }
}

function collectCandidateUrls(baseUrl: URL, html: string) {
  const urls = new Set<string>([baseUrl.toString()]);

  for (const path of DIRECT_PATH_HINTS) {
    urls.add(new URL(path, baseUrl).toString());
  }

  for (const match of html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)) {
    const href = match[1]?.trim();
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("#")) continue;

    try {
      const url = new URL(href, baseUrl);
      if (stripCommonSubdomains(url.hostname) !== stripCommonSubdomains(baseUrl.hostname)) continue;

      const combined = `${url.pathname}${url.search}`.toLowerCase();
      if (
        DIRECT_PATH_HINTS.some((hint) => url.pathname.toLowerCase() === hint || url.pathname.toLowerCase().startsWith(`${hint}/`)) ||
        DISCOVERY_KEYWORDS.some((keyword) => combined.includes(keyword))
      ) {
        urls.add(url.toString());
      }
    } catch {
      // Ignore malformed URLs.
    }
  }

  return [...urls].slice(0, 24);
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(12000),
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.toLowerCase().includes("text/html")) return null;

  return response.text();
}

async function renderHtmlWithPuppeteer(url: string) {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      protocolTimeout: 30000,
    });
    const page = await browser.newPage();
    try {
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      );
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return await page.evaluate(() => document.documentElement.outerHTML);
    } finally {
      await page.close().catch(() => undefined);
      await browser.close().catch(() => undefined);
    }
  } catch (error) {
    if (isIgnorablePuppeteerError(error)) {
      return null;
    }
    throw error;
  }
}

function extractDuckDuckGoResultUrls(baseUrl: URL, html: string) {
  const urls = new Set<string>();
  const websiteHost = stripCommonSubdomains(baseUrl.hostname);

  for (const match of html.matchAll(/<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"/gi)) {
    const href = decodeHtmlEntities(match[1] ?? "");
    if (!href) continue;

    try {
      const url = new URL(href);
      if (isBlockedHost(url.hostname)) continue;

      const resultHost = stripCommonSubdomains(url.hostname);
      if (resultHost === websiteHost || resultHost.endsWith(`.${websiteHost}`) || websiteHost.endsWith(`.${resultHost}`)) {
        urls.add(url.toString());
      }
    } catch {
      // Ignore malformed result URLs.
    }
  }

  return [...urls].slice(0, 8);
}

type GoogleSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

function buildGoogleSearchUrl(query: string) {
  const url = new URL("https://www.google.com/search");
  url.searchParams.set("q", query);
  url.searchParams.set("gl", "us");
  url.searchParams.set("hl", "en");
  return url.toString();
}

async function extractGoogleSearchResults(page: {
  evaluate(script: string): Promise<GoogleSearchResult[]>;
}) {
  return page.evaluate(`
    (() => {
      const seen = new Set();
      const items = [];
      const anchors = Array.from(document.querySelectorAll("a[href]"));

      for (const anchor of anchors) {
        const titleElement = anchor.querySelector("h3");
        const title = titleElement?.textContent?.trim();
        const href = anchor.getAttribute("href");

        if (!title || !href) {
          continue;
        }

        let resolvedUrl = null;

        try {
          const url = new URL(href, window.location.origin);

          if (url.pathname === "/url") {
            resolvedUrl = url.searchParams.get("q");
          } else if (url.protocol.startsWith("http")) {
            resolvedUrl = url.toString();
          }
        } catch {
          resolvedUrl = null;
        }

        if (!resolvedUrl) {
          continue;
        }

        if (
          resolvedUrl.startsWith("https://accounts.google.com/") ||
          resolvedUrl.startsWith("https://support.google.com/") ||
          resolvedUrl.includes("/search?")
        ) {
          continue;
        }

        if (seen.has(resolvedUrl)) {
          continue;
        }

        seen.add(resolvedUrl);

        const container =
          anchor.closest("div[data-snc]") ??
          anchor.closest("div.g") ??
          anchor.closest("div[data-hveid]") ??
          anchor.parentElement;

        const snippet =
          Array.from(container?.querySelectorAll("span, div") ?? [])
            .map((element) => element.innerText?.trim())
            .find((text) => Boolean(text) && text !== title) ?? "";

        items.push({
          title,
          url: resolvedUrl,
          snippet,
        });
      }

      return items;
    })()
  `);
}

async function runGoogleDorksStrategy(baseUrl: URL) {
  const candidates = new Map<string, EmailCandidate>();
  const scannedUrls: string[] = [];
  const domain = stripCommonSubdomains(baseUrl.hostname);

  try {
    const browser = await launch({
      headless: true,
      humanize: true,
    });
    const page = await browser.newPage();

    try {
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      );

      for (const template of GOOGLE_DORK_QUERIES) {
        const query = template.replaceAll("{domain}", domain);
        const searchUrl = buildGoogleSearchUrl(query);

        try {
          scannedUrls.push(searchUrl);
          await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
          await new Promise((resolve) => setTimeout(resolve, 3000));

          const searchHtml = await page.content();
          appendCandidates(
            candidates,
            collectEmails(searchHtml).filter((email) => stripCommonSubdomains(email.split("@")[1] ?? "") === domain),
            searchUrl,
            "google_dork_search_page",
          );

          const results = await extractGoogleSearchResults(page as unknown as { evaluate(script: string): Promise<GoogleSearchResult[]> });
          for (const result of results.slice(0, 10)) {
            try {
              const resultUrl = result.url;
              const resultHost = stripCommonSubdomains(new URL(resultUrl).hostname);
              if (
                isBlockedHost(resultHost) ||
                !(
                  resultHost === domain ||
                  resultHost.endsWith(`.${domain}`) ||
                  domain.endsWith(`.${resultHost}`)
                )
              ) {
                continue;
              }

              scannedUrls.push(resultUrl);
              appendCandidates(
                candidates,
                collectEmails(`${result.title}\n${result.snippet}`).filter(
                  (email) => stripCommonSubdomains(email.split("@")[1] ?? "") === domain,
                ),
                resultUrl,
                "google_dork_search_snippet",
              );

              const html = await fetchHtml(resultUrl);
              if (!html) {
                continue;
              }

              appendCandidates(candidates, collectEmails(html), resultUrl, "google_dork_result_static");
            } catch {
              // Keep searching other results.
            }
          }
        } catch {
          // Keep searching other queries.
        }
      }
    } finally {
      await page.close().catch(() => undefined);
      await browser.close().catch(() => undefined);
    }
  } catch {
    // Fall through with other strategies.
  }

  return {
    candidates: rankCandidates([...candidates.values()], baseUrl.hostname),
    scannedUrls,
  };
}

async function runDirectStaticStrategy(baseUrl: URL) {
  const candidates = new Map<string, EmailCandidate>();
  const scannedUrls: string[] = [];
  const homeHtml = await fetchHtml(baseUrl.toString());
  if (!homeHtml) {
    return { candidates: [], scannedUrls: [baseUrl.toString()] };
  }

  const urls = collectCandidateUrls(baseUrl, homeHtml);
  for (const url of urls) {
    try {
      const html = url === baseUrl.toString() ? homeHtml : await fetchHtml(url);
      scannedUrls.push(url);
      if (!html) continue;
      appendCandidates(candidates, collectEmails(html), url, "direct_static");
    } catch {
      scannedUrls.push(url);
    }
  }

  return {
    candidates: rankCandidates([...candidates.values()], baseUrl.hostname),
    scannedUrls,
  };
}

async function runDirectRenderedStrategy(baseUrl: URL, sourceUrls: string[]) {
  const candidates = new Map<string, EmailCandidate>();
  const scannedUrls: string[] = [];

  for (const url of sourceUrls.slice(0, 6)) {
    try {
      const html = await renderHtmlWithPuppeteer(url);
      scannedUrls.push(url);
      if (!html) continue;
      appendCandidates(candidates, collectEmails(html), url, "direct_rendered");
    } catch {
      scannedUrls.push(url);
    }
  }

  return {
    candidates: rankCandidates([...candidates.values()], baseUrl.hostname),
    scannedUrls,
  };
}

async function fetchDuckDuckGoSearchResults(query: string) {
  const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    redirect: "follow",
    signal: AbortSignal.timeout(12000),
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) return null;
  return response.text();
}

async function runDuckDuckGoStaticStrategy(baseUrl: URL) {
  const candidates = new Map<string, EmailCandidate>();
  const scannedUrls: string[] = [];
  const domain = stripCommonSubdomains(baseUrl.hostname);

  for (const template of SEARCH_QUERIES) {
    const query = template.replaceAll("{domain}", domain);
    const searchHtml = await fetchDuckDuckGoSearchResults(query);
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    scannedUrls.push(searchUrl);
    if (!searchHtml) continue;

    appendCandidates(
      candidates,
      collectEmails(searchHtml).filter((email) => stripCommonSubdomains(email.split("@")[1] ?? "") === domain),
      searchUrl,
      "ddg_search_page",
    );

    const resultUrls = extractDuckDuckGoResultUrls(baseUrl, searchHtml);
    for (const resultUrl of resultUrls.slice(0, 10)) {
      try {
        const html = await fetchHtml(resultUrl);
        scannedUrls.push(resultUrl);
        if (!html) continue;
        appendCandidates(candidates, collectEmails(html), resultUrl, "ddg_search_result_static");
      } catch {
        scannedUrls.push(resultUrl);
      }
    }
  }

  return {
    candidates: rankCandidates([...candidates.values()], baseUrl.hostname),
    scannedUrls,
  };
}

async function runDuckDuckGoRenderedStrategy(baseUrl: URL) {
  const candidates = new Map<string, EmailCandidate>();
  const scannedUrls: string[] = [];
  const domain = stripCommonSubdomains(baseUrl.hostname);

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      protocolTimeout: 30000,
    });
    for (const template of SEARCH_QUERIES.slice(0, 3)) {
      const query = template.replaceAll("{domain}", domain);
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const page = await browser.newPage();
      try {
        await page.setUserAgent(
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        );
        scannedUrls.push(searchUrl);
        await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const searchHtml = await page.evaluate(() => document.documentElement.outerHTML);

        appendCandidates(
          candidates,
          collectEmails(searchHtml).filter((email) => stripCommonSubdomains(email.split("@")[1] ?? "") === domain),
          searchUrl,
          "ddg_browser_search_page",
        );

        const resultUrls = extractDuckDuckGoResultUrls(baseUrl, searchHtml);
        for (const resultUrl of resultUrls.slice(0, 8)) {
          const detailPage = await browser.newPage();
          try {
            await detailPage.setUserAgent(
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            );
            scannedUrls.push(resultUrl);
            await detailPage.goto(resultUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
            await new Promise((resolve) => setTimeout(resolve, 1500));
            const html = await detailPage.evaluate(() => document.documentElement.outerHTML);
            appendCandidates(candidates, collectEmails(html), resultUrl, "ddg_browser_search_result");
          } catch {
            scannedUrls.push(resultUrl);
          } finally {
            await detailPage.close();
          }
        }
      } catch (error) {
        if (!isIgnorablePuppeteerError(error)) {
          // Ignore per-query failures and keep other strategies alive.
        }
        // Ignore per-query failures.
      } finally {
        await page.close().catch(() => undefined);
      }
    }
    await browser.close().catch(() => undefined);
  } catch (error) {
    if (!isIgnorablePuppeteerError(error)) {
      // Fall through with whatever other strategies found.
    }
  }

  return {
    candidates: rankCandidates([...candidates.values()], baseUrl.hostname),
    scannedUrls,
  };
}

function chooseBestResult(baseUrl: URL, results: Array<{ candidates: EmailCandidate[]; scannedUrls: string[] }>): EmailDiscoveryResult {
  const allCandidates = rankCandidates(
    results.flatMap((result) => result.candidates),
    baseUrl.hostname,
  );
  const scannedUrls = [...new Set(results.flatMap((result) => result.scannedUrls))];
  const best = allCandidates.find((candidate) => scoreCandidate(candidate, baseUrl.hostname) > 0) ?? null;

  return {
    email: best?.email ?? null,
    sourceUrl: best?.sourceUrl ?? null,
    scannedUrls,
  };
}

export async function findBusinessEmailFromWebsite(website: string | null | undefined): Promise<EmailDiscoveryResult> {
  const baseUrl = website ? normalizeWebsiteUrl(website) : null;
  if (!baseUrl || isBlockedHost(baseUrl.hostname)) {
    return { email: null, sourceUrl: null, scannedUrls: [] };
  }

  const results: Array<{ candidates: EmailCandidate[]; scannedUrls: string[] }> = [];

  try {
    const directStatic = await runDirectStaticStrategy(baseUrl);
    results.push(directStatic);
    const immediate = chooseBestResult(baseUrl, results);
    if (immediate.email) return immediate;

    const directRendered = await runDirectRenderedStrategy(baseUrl, directStatic.scannedUrls.length > 0 ? directStatic.scannedUrls : [baseUrl.toString()]);
    results.push(directRendered);
    const afterRendered = chooseBestResult(baseUrl, results);
    if (afterRendered.email) return afterRendered;

    const ddgStatic = await runDuckDuckGoStaticStrategy(baseUrl);
    results.push(ddgStatic);
    const afterDdgStatic = chooseBestResult(baseUrl, results);
    if (afterDdgStatic.email) return afterDdgStatic;

    const googleDorks = await runGoogleDorksStrategy(baseUrl);
    results.push(googleDorks);
    const afterGoogleDorks = chooseBestResult(baseUrl, results);
    if (afterGoogleDorks.email) return afterGoogleDorks;

    const ddgRendered = await runDuckDuckGoRenderedStrategy(baseUrl);
    results.push(ddgRendered);
    return chooseBestResult(baseUrl, results);
  } catch {
    return chooseBestResult(baseUrl, results.length > 0 ? results : [{ candidates: [], scannedUrls: [baseUrl.toString()] }]);
  }
}

export async function reEnrichMissingLeadEmailsForCampaign(campaignId: string) {
  const leads = await prisma.lead.findMany({
    where: {
      campaignId,
      OR: [{ email: null }, { email: "" }],
      website: { not: null },
    },
    select: {
      id: true,
      website: true,
      metadata: true,
    },
  });

  let processed = 0;
  let updated = 0;

  for (const lead of leads) {
    processed += 1;
    const result = await findBusinessEmailFromWebsite(lead.website);
    const previousMetadata =
      lead.metadata && typeof lead.metadata === "object" && !Array.isArray(lead.metadata)
        ? (lead.metadata as Record<string, unknown>)
        : {};

    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        ...(result.email ? { email: result.email } : {}),
        metadata: {
          ...previousMetadata,
          emailSourceUrl: result.sourceUrl,
          emailScannedUrls: result.scannedUrls,
        } as never,
      },
    });

    if (result.email) updated += 1;
  }

  return {
    processed,
    updated,
    totalMissing: leads.length,
  };
}
