import { config } from "./config.js";

type BrowserlessFunctionResponse<T> = {
  data: T;
  type?: string;
};

type BrowserlessFunctionOptions = {
  code: string;
  context?: Record<string, unknown>;
};

type BrowserlessUnblockOptions = {
  url: string;
  content?: boolean;
  cookies?: boolean;
  screenshot?: boolean;
  browserWSEndpoint?: boolean;
  bestAttempt?: boolean;
  waitForTimeout?: number;
  timeout?: number;
  proxy?: "residential";
  externalProxyServer?: string;
};

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/g, "");
}

function buildResponseErrorMessage(response: Response, bodyText: string) {
  const upstreamCode = response.headers.get("x-response-code");
  const upstreamStatus = response.headers.get("x-response-status");
  const upstreamUrl = response.headers.get("x-response-url");

  const details = [
    `Browserless request failed with HTTP ${response.status}`,
    upstreamCode ? `siteCode=${upstreamCode}` : null,
    upstreamStatus ? `siteStatus=${upstreamStatus}` : null,
    upstreamUrl ? `siteUrl=${upstreamUrl}` : null,
    bodyText ? `body=${bodyText.slice(0, 500)}` : null,
  ].filter(Boolean);

  return details.join(" ");
}

function toBrowserlessTimeoutSeconds(value?: number) {
  if (!value || Number.isNaN(value) || value <= 0) {
    return undefined;
  }

  return String(Math.max(1, Math.ceil(value / 1000)));
}

class BrowserlessClient {
  isConfigured() {
    return Boolean(config.BROWSERLESS_TOKEN);
  }

  private get baseUrl() {
    return trimTrailingSlash(config.BROWSERLESS_BASE_URL || "https://production-sfo.browserless.io");
  }

  private get token() {
    return config.BROWSERLESS_TOKEN || "";
  }

  private buildUrl(path: string) {
    return `${this.baseUrl}${path}?token=${encodeURIComponent(this.token)}`;
  }

  private buildUrlWithParams(path: string, params: Record<string, string | undefined>) {
    const url = new URL(this.buildUrl(path));

    for (const [key, value] of Object.entries(params)) {
      if (value) {
        url.searchParams.set(key, value);
      }
    }

    return url.toString();
  }

  async runFunction<T>(input: BrowserlessFunctionOptions): Promise<T> {
    if (!this.isConfigured()) {
      throw new Error("Browserless is not configured");
    }

    const response = await fetch(this.buildUrl("/function"), {
      method: "POST",
      headers: {
        "Cache-Control": "no-cache",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code: input.code,
        context: input.context ?? {},
      }),
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      throw new Error(buildResponseErrorMessage(response, bodyText));
    }

    const result = (await response.json()) as BrowserlessFunctionResponse<T>;
    return result.data;
  }

  async fetchContent(input: {
    url: string;
    waitForTimeout?: number;
    bestAttempt?: boolean;
    waitForSelector?: {
      selector: string;
      timeout?: number;
      visible?: boolean;
      hidden?: boolean;
    };
  }) {
    if (!this.isConfigured()) {
      throw new Error("Browserless is not configured");
    }

    const response = await fetch(this.buildUrl("/content"), {
      method: "POST",
      headers: {
        "Cache-Control": "no-cache",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: input.url,
        waitForTimeout: input.waitForTimeout,
        bestAttempt: input.bestAttempt,
        waitForSelector: input.waitForSelector,
      }),
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      throw new Error(buildResponseErrorMessage(response, bodyText));
    }

    return {
      html: await response.text(),
      responseCode: response.headers.get("x-response-code"),
      responseStatus: response.headers.get("x-response-status"),
      responseUrl: response.headers.get("x-response-url"),
    };
  }

  async unblock(input: BrowserlessUnblockOptions) {
    if (!this.isConfigured()) {
      throw new Error("Browserless is not configured");
    }

    const response = await fetch(
      this.buildUrlWithParams("/unblock", {
        proxy: input.proxy,
        externalProxyServer: input.externalProxyServer,
        timeout: toBrowserlessTimeoutSeconds(input.timeout),
      }),
      {
        method: "POST",
        headers: {
          "Cache-Control": "no-cache",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: input.url,
          content: input.content ?? true,
          cookies: input.cookies ?? false,
          screenshot: input.screenshot ?? false,
          browserWSEndpoint: input.browserWSEndpoint ?? false,
          bestAttempt: input.bestAttempt,
          waitForTimeout: input.waitForTimeout,
        }),
      },
    );

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      throw new Error(buildResponseErrorMessage(response, bodyText));
    }

    return response.json() as Promise<{
      content?: string | null;
      cookies?: unknown[];
      screenshot?: string | null;
      browserWSEndpoint?: string | null;
    }>;
  }
}

export const browserless = new BrowserlessClient();
