import puppeteer, { type Page } from "puppeteer";
import { googleMapsProxyManager } from "./google-maps.proxy.js";

export type GoogleMapsLead = {
  name: string;
  address: string;
  website: string;
  phone_number: string;
  reviews_count: number | null;
  reviews_average: number | null;
  store_shopping: string;
  in_store_pickup: string;
  store_delivery: string;
  place_type: string;
  opens_at: string;
  introduction: string;
};

type ElementWithTextContent = {
  textContent: string | null;
};

type ElementWithHref = {
  getAttribute(name: string): string | null;
};

async function extractText(page: Page, xpath: string) {
  try {
    const element = await page.waitForSelector(`xpath/${xpath}`, { timeout: 2000 });
    if (!element) {
      return "";
    }
    const text = await page.evaluate((node: ElementWithTextContent) => node.textContent, element);
    return text?.trim() || "";
  } catch {
    return "";
  }
}

async function extractPlace(page: Page): Promise<GoogleMapsLead> {
  const xpaths = {
    name: '//div[@class="TIHn2 "]//h1[@class="DUwDvf lfPIob"]',
    address: '//button[@data-item-id="address"]//div[contains(@class, "fontBodyMedium")]',
    website: '//a[@data-item-id="authority"]//div[contains(@class, "fontBodyMedium")]',
    phoneNumber: '//button[contains(@data-item-id, "phone:tel:")]//div[contains(@class, "fontBodyMedium")]',
    reviewsCount: '//div[@class="TIHn2 "]//div[@class="fontBodyMedium dmRWX"]//div//span//span//span[@aria-label]',
    reviewsAverage: '//div[@class="TIHn2 "]//div[@class="fontBodyMedium dmRWX"]//div//span[@aria-hidden]',
    info1: '//div[@class="LTs0Rc"][1]',
    info2: '//div[@class="LTs0Rc"][2]',
    info3: '//div[@class="LTs0Rc"][3]',
    opensAt: '//button[contains(@data-item-id, "oh")]//div[contains(@class, "fontBodyMedium")]',
    opensAt2: '//div[@class="MkV9"]//span[@class="ZDu9vd"]//span[2]',
    placeType: '//div[@class="LBgpqf"]//button[@class="DkEaL "]',
    intro: '//div[@class="WeS02d fontBodyMedium"]//div[@class="PYvSYb "]',
  };

  const place: GoogleMapsLead = {
    name: await extractText(page, xpaths.name),
    address: await extractText(page, xpaths.address),
    website: await extractText(page, xpaths.website),
    phone_number: await extractText(page, xpaths.phoneNumber),
    reviews_count: null,
    reviews_average: null,
    store_shopping: "No",
    in_store_pickup: "No",
    store_delivery: "No",
    place_type: await extractText(page, xpaths.placeType),
    opens_at: "",
    introduction: (await extractText(page, xpaths.intro)) || "None Found",
  };

  const reviewsCountRaw = await extractText(page, xpaths.reviewsCount);
  if (reviewsCountRaw) {
    const parsed = Number.parseInt(reviewsCountRaw.replace(/[^\d]/g, ""), 10);
    if (!Number.isNaN(parsed)) {
      place.reviews_count = parsed;
    }
  }

  const reviewsAverageRaw = await extractText(page, xpaths.reviewsAverage);
  if (reviewsAverageRaw) {
    const match = reviewsAverageRaw.replace(/,/g, ".").match(/(\d+(\.\d+)?)/);
    if (match?.[0]) {
      const parsed = Number.parseFloat(match[0]);
      if (!Number.isNaN(parsed)) {
        place.reviews_average = parsed;
      }
    }
  }

  for (const xpath of [xpaths.info1, xpaths.info2, xpaths.info3]) {
    const info = await extractText(page, xpath);
    const details = info.split("·")[1]?.toLowerCase() || "";
    if (details.includes("shop")) place.store_shopping = "Yes";
    if (details.includes("pickup")) place.in_store_pickup = "Yes";
    if (details.includes("delivery")) place.store_delivery = "Yes";
  }

  let opensAtRaw = await extractText(page, xpaths.opensAt);
  if (!opensAtRaw) {
    opensAtRaw = await extractText(page, xpaths.opensAt2);
  }
  if (opensAtRaw) {
    place.opens_at = (opensAtRaw.split("⋅")[1] || opensAtRaw).trim().replace(/\u202f/g, "");
  }

  return place;
}

export async function scrapeGoogleMapsPlaces(input: {
  query: string;
  location: string;
  total: number;
  useProxy: boolean;
  headless: boolean;
  onLeadFound: (lead: GoogleMapsLead) => Promise<void>;
}) {
  if (input.useProxy && googleMapsProxyManager.isEmpty()) {
    await googleMapsProxyManager.loadProxies();
  }

  const proxy = input.useProxy ? googleMapsProxyManager.getNextProxy() || undefined : undefined;
  const browser = await puppeteer.launch({
    headless: input.headless,
    args: googleMapsProxyManager.getPuppeteerArgs(proxy),
  });

  const page = await browser.newPage();
  let processed = 0;

  try {
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );

    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(`${input.query} in ${input.location}`)}?hl=en`;
    await page.goto(searchUrl, { waitUntil: "networkidle2" });

    try {
      const consentButton = await page.waitForSelector('xpath///form//button[contains(@aria-label, "Accept")]', {
        timeout: 5000,
      });
      if (consentButton) {
        await consentButton.click();
        await page.waitForNavigation({ waitUntil: "networkidle2" });
      }
    } catch {
      // Ignore missing cookie consent.
    }

    const listingXpath = '//a[contains(@href, "https://www.google.com/maps/place")]';
    await page.waitForSelector(`xpath/${listingXpath}`, { timeout: 15000 });

    let knownCount = 0;
    while (true) {
      await page.evaluate(() => {
        const scrollable = document.querySelector('div[role="feed"]');
        if (scrollable) {
          scrollable.scrollBy(0, 10000);
        } else {
          window.scrollBy(0, 10000);
        }
      });

      await new Promise((resolve) => setTimeout(resolve, 4000));
      const found = (await page.$$(`xpath/${listingXpath}`)).length;
      if (found >= input.total || found === knownCount) {
        break;
      }
      knownCount = found;
    }

    const visitedUrls = new Set<string>();
    let noNewListingsCount = 0;

    while (processed < input.total) {
      const currentListings = await page.$$(`xpath/${listingXpath}`);
      let newItemsFound = false;

      for (const listing of currentListings) {
        if (processed >= input.total) {
          break;
        }

        const href = await listing.evaluate((element) => (element as ElementWithHref).getAttribute("href"));
        if (!href || visitedUrls.has(href)) {
          continue;
        }

        visitedUrls.add(href);
        newItemsFound = true;
        noNewListingsCount = 0;

        const detailsPage = await browser.newPage();
        try {
          await detailsPage.setUserAgent(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          );
          await detailsPage.goto(href, { waitUntil: "domcontentloaded", timeout: 30000 });
          await detailsPage.waitForSelector('xpath///div[@class="TIHn2 "]//h1[@class="DUwDvf lfPIob"]', {
            timeout: 10000,
          });
          await new Promise((resolve) => setTimeout(resolve, 1000));

          const place = await extractPlace(detailsPage);
          if (!place.name) {
            continue;
          }

          await input.onLeadFound(place);
          processed += 1;
        } catch (error) {
          console.error(`Failed to process Google Maps listing ${href}:`, error);
        } finally {
          await detailsPage.close();
        }
      }

      await page.evaluate(() => {
        const scrollable = document.querySelector('div[role="feed"]');
        if (scrollable) {
          scrollable.scrollBy(0, 5000);
        } else {
          window.scrollBy(0, 5000);
        }
      });
      await new Promise((resolve) => setTimeout(resolve, 2000));

      if (!newItemsFound) {
        noNewListingsCount += 1;
        if (noNewListingsCount >= 5) {
          break;
        }
      }
    }

    return processed;
  } finally {
    await browser.close();
  }
}
