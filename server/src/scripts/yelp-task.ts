import { scrapeYelpPlaces } from "../modules/leads/yelp.scraper.js";

function getArg(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

async function main() {
  const query = getArg("--query") || getArg("-q");
  const location = getArg("--location") || getArg("-l");
  const totalRaw = getArg("--total") || getArg("-t") || "10";
  const total = Number.parseInt(totalRaw, 10);

  if (!query || !location || Number.isNaN(total) || total <= 0) {
    console.error("Usage: npm run yelp:task -- --query \"dentists\" --location \"new york, ny\" --total 10");
    process.exit(1);
  }

  const leads: Awaited<ReturnType<typeof collectLeads>> = await collectLeads(query, location, total);
  console.log(JSON.stringify({ query, location, totalRequested: total, found: leads.length, items: leads }, null, 2));
}

async function collectLeads(query: string, location: string, total: number) {
  const leads: Array<Awaited<Parameters<Parameters<typeof scrapeYelpPlaces>[0]["onLeadFound"]>[0]>> = [];

  await scrapeYelpPlaces({
    query,
    location,
    total,
    onLeadFound: async (lead) => {
      leads.push(lead);
    },
  });

  return leads;
}

void main().catch((error) => {
  console.error(error);
  console.error("\nIf Yelp blocks your IP, enable YELP_USE_PROXY=true in server/.env or run with YELP_HEADLESS=false for debugging.");
  process.exit(1);
});
