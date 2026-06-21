import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import { prisma } from "../src/lib/prisma.js";

type YelpBusiness = {
  business_id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
  stars?: number;
  review_count?: number;
  is_open?: number;
  attributes?: unknown;
  categories?: string;
  hours?: unknown;
};

type YelpReview = {
  review_id: string;
  user_id: string;
  business_id: string;
  stars?: number;
  useful?: number;
  funny?: number;
  cool?: number;
  text?: string;
  date?: string;
};

type ReviewSample = {
  reviewId: string;
  userId: string;
  stars: number | null;
  text: string;
  date: string | null;
};

type Args = {
  archivePath: string;
  businessLimit: number;
  campaignId: string | null;
  includeReviews: boolean;
  maxReviewSamples: number;
  resetYelp: boolean;
};

const defaultArchivePath = fileURLToPath(new URL("./yelp_data.json", import.meta.url));

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const parsed: Args = {
    archivePath: defaultArchivePath,
    businessLimit: Number.POSITIVE_INFINITY,
    campaignId: null,
    includeReviews: true,
    maxReviewSamples: 3,
    resetYelp: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const nextArg = args[index + 1];

    if (arg === "--archive" && nextArg) {
      parsed.archivePath = nextArg;
      index += 1;
    } else if (arg === "--limit" && nextArg) {
      parsed.businessLimit = Number(nextArg);
      index += 1;
    } else if (arg === "--campaign-id" && nextArg) {
      parsed.campaignId = nextArg;
      index += 1;
    } else if (arg === "--max-review-samples" && nextArg) {
      parsed.maxReviewSamples = Math.max(0, Number(nextArg));
      index += 1;
    } else if (arg === "--no-reviews") {
      parsed.includeReviews = false;
    } else if (arg === "--reset-yelp") {
      parsed.resetYelp = true;
    }
  }

  return parsed;
}

function tarLines(archivePath: string, memberName: string) {
  const tar = spawn("tar", ["-xOf", archivePath, memberName], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  const lines = createInterface({
    input: tar.stdout,
    crlfDelay: Infinity,
  });

  return { lines, tar };
}

function normalizeKey(name: string, location: string | null) {
  return `${name.trim().toLowerCase()}|${(location ?? "").trim().toLowerCase()}`;
}

function categoriesFromBusiness(business: YelpBusiness) {
  return (business.categories ?? "")
    .split(",")
    .map((category) => category.trim())
    .filter(Boolean);
}

function addressFromBusiness(business: YelpBusiness) {
  return [business.city, business.state]
    .filter(Boolean)
    .join(", ");
}

function detailUrlFromBusinessId(businessId: string) {
  return `https://www.yelp.com/biz/${encodeURIComponent(businessId)}`;
}

async function collectExistingYelpKeys() {
  const existing = await prisma.lead.findMany({
    where: { source: "yelp" },
    select: { name: true, location: true },
  });

  return new Set(existing.map((lead) => normalizeKey(lead.name, lead.location)));
}

async function collectReviewSamples(
  args: Args,
  businessIds: Set<string>,
): Promise<Map<string, ReviewSample[]>> {
  const samples = new Map<string, ReviewSample[]>();
  if (!args.includeReviews || args.maxReviewSamples === 0 || businessIds.size === 0) {
    return samples;
  }

  const { lines, tar } = tarLines(args.archivePath, "yelp_academic_dataset_review.json");
  let scanned = 0;

  for await (const line of lines) {
    if (!line.trim()) continue;

    scanned += 1;
    if (scanned % 100_000 === 0) {
      console.log(`reviews: scanned ${scanned.toLocaleString()} rows`);
    }

    const review = JSON.parse(line) as YelpReview;
    if (!businessIds.has(review.business_id)) continue;

    const existingSamples = samples.get(review.business_id) ?? [];
    if (existingSamples.length >= args.maxReviewSamples) continue;

    existingSamples.push({
      reviewId: review.review_id,
      userId: review.user_id,
      stars: review.stars ?? null,
      text: (review.text ?? "").slice(0, 1_000),
      date: review.date ?? null,
    });
    samples.set(review.business_id, existingSamples);

    if (
      samples.size === businessIds.size &&
      [...samples.values()].every((items) => items.length >= args.maxReviewSamples)
    ) {
      break;
    }
  }

  if (!tar.killed) {
    tar.kill();
  }

  console.log(`reviews: collected samples for ${samples.size.toLocaleString()} businesses`);
  return samples;
}

async function importBusinesses(args: Args) {
  if (args.resetYelp) {
    const deleted = await prisma.lead.deleteMany({ where: { source: "yelp" } });
    console.log(`reset: deleted ${deleted.count.toLocaleString()} existing Yelp leads`);
  }

  const existingKeys = await collectExistingYelpKeys();
  const pendingBusinesses: YelpBusiness[] = [];
  const importedBusinessIds = new Set<string>();
  const { lines, tar } = tarLines(args.archivePath, "yelp_academic_dataset_business.json");

  let scanned = 0;
  for await (const line of lines) {
    if (!line.trim()) continue;

    scanned += 1;
    const business = JSON.parse(line) as YelpBusiness;
    const location = addressFromBusiness(business) || null;
    const key = normalizeKey(business.name, location);

    if (!existingKeys.has(key)) {
      pendingBusinesses.push(business);
      existingKeys.add(key);
      importedBusinessIds.add(business.business_id);
    }

    if (pendingBusinesses.length >= args.businessLimit) {
      break;
    }
  }

  if (!tar.killed) {
    tar.kill();
  }

  console.log(
    `business: scanned ${scanned.toLocaleString()} rows, prepared ${pendingBusinesses.length.toLocaleString()} new leads`,
  );

  const reviewSamples = await collectReviewSamples(args, importedBusinessIds);
  const batchSize = 500;
  let created = 0;

  for (let index = 0; index < pendingBusinesses.length; index += batchSize) {
    const batch = pendingBusinesses.slice(index, index + batchSize);

    await prisma.lead.createMany({
      data: batch.map((business) => {
        const categories = categoriesFromBusiness(business);
        const location = addressFromBusiness(business) || null;

        return {
          campaignId: args.campaignId,
          source: "yelp",
          name: business.name,
          business: business.name,
          email: null,
          phone: null,
          website: null,
          industry: categories[0] ?? null,
          location,
          categories,
          reviewsCount: business.review_count ?? null,
          address: business.address ?? null,
          city: business.city ?? null,
          state: business.state ?? null,
          status: "new",
          outreachEnabled: false,
          metadata: {
            yelpBusinessId: business.business_id,
            categories,
            reviewsCount: business.review_count ?? null,
            reviewsAverage: business.stars ?? null,
            reviewSamples: reviewSamples.get(business.business_id) ?? [],
            detailUrl: detailUrlFromBusinessId(business.business_id),
            businessStatus: business.is_open === 1 ? "open" : "closed",
            address: {
              street: business.address ?? null,
              city: business.city ?? null,
              state: business.state ?? null,
              postalCode: business.postal_code ?? null,
            },
            coordinates: {
              latitude: business.latitude ?? null,
              longitude: business.longitude ?? null,
            },
            attributes: business.attributes ?? null,
            hours: business.hours ?? null,
          },
        };
      }),
    });

    created += batch.length;
    console.log(`lead: created ${created.toLocaleString()} / ${pendingBusinesses.length.toLocaleString()}`);
  }

  console.log(`done: imported ${created.toLocaleString()} Yelp leads`);
}

const args = parseArgs();

importBusinesses(args)
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
