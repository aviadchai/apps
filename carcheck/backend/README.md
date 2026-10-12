# CarScope Historical API — backend

Self-hosted Cloudflare Worker + D1 SQL database to store provenance-preserving vehicle odometer history **from the moment the service begins collecting data**. Does not scrape Carzone or proprietary pricebooks.

## Endpoints

- GET /api/health — database config status (not a proof that the database tables were migrated).
- GET /api/vehicle?plate=12345678 — 3 parallel government lookups, live vehicle + ownership, current MOT mileage, database snapshots and anomaly alerts.
- GET /api/prices?manufacturer=...&model=... — licensed evidence only; empty until an approved source is imported.

No public write endpoints. Strict 7–8 digit plate validation, official sources hardcoded, parameterized SQL, origin-specific CORS. Client requests store official snapshots and add the plate to the weekly refresh queue; scheduled Worker wakes daily to process **up to 50 due plates per day**. This is a small-scale MVP, not a scan of the entire Israeli fleet.

## Deploy via Cloudflare

1. From /carcheck/backend run \`npm install\` and \`npx wrangler login\`.
2. Run \`npx wrangler d1 create carscope-history\`. Add the returned \`database_id\` to \`wrangler.jsonc\` under \`d1_databases\`. Cloudflare dashboard Git integrations may instead auto-provision an ID; check binding and migrations.
3. Run \`npm run db:migrate\` and then \`npm run deploy\`.
4. Open \`https://carscope-history-api.<your-subdomain>.workers.dev/api/health\` and ensure \`database: configured\`.
5. After a live test request, verify D1 contains an odometer observation. Then set \`window.CARSCOPE_API_BASE\` to the **real** API URL in the site's \`api-config.js\`. Do not invent or hardcode an unverified Worker URL.

Cron runs at 03:00 UTC daily and updates only the 50 oldest due plates per run. It is **not enough** for an entire 2.5M-vehicle archive: for that use a separate bulk ingestion service with government-provided bulk CSV, cost estimates, rate limits, data retention and required licenses.

## What historical data can and cannot be retrieved

The open dataset \`56063a99-8a3e-4ff4-912e-5966c0279bad\` contains \`kilometer_test_aharon\` — last test. It does not expose all previous tests via its current public schema. The backend saves observed snapshots. When earlier data is supplied by a licensed archival provider, ingest it as \`historical_source\` with source, date and citation in separate controlled import code. No guessed past mileage.

Carzone publicly describes several sources, including past ads and previous inspection reports, but offers no publicly documented unrestricted API that can be used to republish its entire history. Confirm permission/licensing before any partner integration.

Prices: D1 price table is intentionally empty until evidence has been legally imported. Never label asking prices as completed sale prices. A first-party database does not grant permission to copy Levi Yitzhak or Yad2 pricebooks without agreement.

This backend has been committed as source only. A live Cloudflare deployment and D1 creation need an authorized Cloudflare account; GitHub Pages alone cannot run or store the service.
