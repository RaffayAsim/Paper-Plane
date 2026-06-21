# Yelp Lead Import

This folder imports the Yelp academic dataset into the existing Prisma/MariaDB `Lead` table.

The importer maps each Yelp business into a `Lead`:

- `source`: `yelp`
- `name` / `business`: Yelp business name
- `industry`: first Yelp category
- `location`: full address
- `metadata`: Yelp business id, categories, rating, review count, address parts, coordinates, hours, attributes, and review samples

Run a small smoke import:

```bash
bun run yelp:import -- --limit 10 --no-reviews
```

Import businesses with review samples:

```bash
bun run yelp:import
```

Useful options:

```text
--limit 1000              Import only this many businesses
--no-reviews              Skip scanning review samples
--max-review-samples 3    Store up to N review samples per business
--campaign-id <id>        Attach imported leads to an existing LeadCampaign
--reset-yelp              Delete existing Yelp leads before importing
--archive <path>          Use a different Yelp dataset archive path
```

`yelp_data.json` is intentionally ignored by git.
