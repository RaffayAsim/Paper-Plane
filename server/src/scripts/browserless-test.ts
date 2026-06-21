import { browserless } from "../lib/browserless.js";

function getArg(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.replace(/\s+/g, " ").trim() || "";
}

function extractBodySnippet(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1200);
}

async function main() {
  const url = getArg("--url") || getArg("-u");
  const mode = (getArg("--mode") || "content").toLowerCase();
  const waitForTimeout = Number.parseInt(getArg("--wait") || "5000", 10);
  const timeout = Number.parseInt(getArg("--timeout") || "90000", 10);
  const bestAttempt = (getArg("--best-attempt") || "true").toLowerCase() === "true";
  const proxy = getArg("--proxy");
  const externalProxyServer = getArg("--external-proxy");

  if (!url) {
    console.error(
      "Usage: npm run browserless:test -- --url \"https://www.yelp.com/search?find_desc=dentists&find_loc=new+york\" --mode content",
    );
    process.exit(1);
  }

  if (!browserless.isConfigured()) {
    throw new Error("BROWSERLESS_TOKEN is not configured");
  }

  if (mode === "content") {
    const result = await browserless.fetchContent({
      url,
      waitForTimeout: Number.isNaN(waitForTimeout) ? 5000 : waitForTimeout,
      bestAttempt,
    });

    console.log(
      JSON.stringify(
        {
          mode,
          url,
          responseCode: result.responseCode,
          responseStatus: result.responseStatus,
          responseUrl: result.responseUrl,
          title: extractTitle(result.html),
          snippet: extractBodySnippet(result.html),
        },
        null,
        2,
      ),
    );
    return;
  }

  if (mode === "unblock") {
    const result = await browserless.unblock({
      url,
      content: true,
      cookies: false,
      screenshot: false,
      browserWSEndpoint: false,
      bestAttempt,
      waitForTimeout: Number.isNaN(waitForTimeout) ? 5000 : waitForTimeout,
      timeout: Number.isNaN(timeout) ? 90000 : timeout,
      proxy: proxy === "residential" ? "residential" : undefined,
      externalProxyServer: externalProxyServer || undefined,
    });

    const html = result.content || "";
    console.log(
      JSON.stringify(
        {
          mode,
          url,
          proxy: proxy || null,
          externalProxyServer: externalProxyServer || null,
          timeout: Number.isNaN(timeout) ? 90000 : timeout,
          title: extractTitle(html),
          snippet: extractBodySnippet(html),
        },
        null,
        2,
      ),
    );
    return;
  }

  throw new Error(`Unsupported mode: ${mode}. Use content or unblock.`);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
