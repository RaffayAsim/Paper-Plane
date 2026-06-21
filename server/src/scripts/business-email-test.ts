import { findBusinessEmailFromWebsite } from "../modules/leads/business-email.service.js";

function getArg(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

async function main() {
  const website = getArg("--website") || getArg("-w") || getArg("--url") || getArg("-u");

  if (!website) {
    console.error(
      "Usage: npm run business-email:test -- --website \"https://www.bowerydental.com\"",
    );
    process.exit(1);
  }

  const result = await findBusinessEmailFromWebsite(website);

  console.log(
    JSON.stringify(
      {
        website,
        found: Boolean(result.email),
        email: result.email,
        sourceUrl: result.sourceUrl,
        scannedUrls: result.scannedUrls,
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
