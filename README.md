# Website Analytics for Claude Code

Review website acquisition, landing pages and follow-up work in a database you own. A focused replacement for the reporting desk around saved Matomo visits.

Built by Enterprise DNA. MIT licence. Works with Claude Code, Codex, OpenCode or Cursor.

The [Matomo pricing page](https://matomo.org/pricing/) lists a US$1,900 monthly Cloud offer for ten million monthly hits, or US$22,800 over twelve monthly payments before tax. This is a list-price scenario, not a verified customer invoice. Matomo Community is already free and open source.

| Do it yourself | We customise it | We run it for you |
|---|---|---|
| Free. Install the database and commands below. | Your measurement rules, history mapping, connections and screens. | Installed and operated through Omni by Enterprise DNA. Setup fee, then a retainer. |
| [Quick start](#quick-start) | [Get your version built](https://enterprisedna.co/omni/book/?offer=replace-software&utm_medium=github&utm_campaign=matomo) | [Book a call](https://enterprisedna.co/omni/book/?offer=replace-software&utm_medium=github&utm_campaign=matomo) |

## Quick start

Node 20 or newer. No vendor account or hosted database needed for the fictional demo.

```bash
npm install
npm run demo
npm run analytics -- acquisition --site="Fictional Studio"
npm run view
npm run docs
```

PGlite stores the local database in .data/db. Set DATABASE_URL to use PostgreSQL, then run npm run migrate. The CLI assumes a trusted operator database connection. Shared use needs enforced identity, least privilege, backups and a retention process.

The demo contains ten visits, fourteen saved pageviews and three converted visits. Search has four visits and two converted visits, a 50 percent conversion rate. One visit has incomplete action details and is excluded from landing-page totals. A deliberately old visit and overdue follow-up give the review commands something to find. Everything is fictional.

## The working week

1. /coverage checks the declared date spans and counts before interpreting changes.
2. /acquisition compares channel conversion rates.
3. /landing reviews page performance and single-action visits.
4. /attention finds overdue improvements, stale imports and record-control findings.
5. /weekly-review writes the Monday owner brief from metrics, actions and coverage.

30 slash commands live in .claude/commands. The single CLI has 26 verbs including help. Read npm run analytics -- help. Reads produce human-readable columns by default and support --json. Site names match without case. Unique ID prefixes work. Ambiguous references list candidates and exit 1.

## Bring Matomo history across

Use a saved Live.getLastVisitsDetails JSON export. Register the source instance and site once, then import the file with one command. The import checks site identity, independent row count, duplicate visit IDs and UTC date bounds. A repeat skips identical evidence. Changed evidence under an existing ID is refused. Test with --dry-run first.

```bash
npm run analytics -- import matomo --site="Your site" --file=imports/visits.json --expected-count=100 --from=2026-11-01 --to=2026-11-18 --source-ref="Actual export job and filters" --actor="Actual operator" --dry-run
```

The count and dates above are placeholders. Use the actual export scope. Read [the switching guide](docs/replace-matomo.md) before importing.

This base reads saved visits. It does not collect browser events, administer consent, replay sessions or replace a live tracking service. Keep collection running until a replacement has been built and reconciled. Enterprise DNA scopes that connection as part of your version. Matomo Community is already free and open source; the decision is whether you need its full platform or a smaller owned reporting workflow.

## Ten questions to ask

These are shipped queries. They are not claims that Matomo cannot answer the same questions. Your locally assigned work and review evidence are the additional context.

1. Which acquisition channels brought converted visits? Use acquisition.
2. Which landing pages have visits but no recorded conversions? Use landing.
3. How do mobile and desktop conversion rates compare? Use devices.
4. Which pages have the most observed views? Use pages.
5. How did visits change across the imported dates? Use trends.
6. Which country groups have converted visits? Use countries.
7. What page sequence preceded a recorded conversion? Use journeys.
8. Which website improvements are overdue and who owns them? Use actions.
9. Which imports have declared counts and which visits have incomplete details? Use coverage and compliance.
10. Which site records need a privacy, access or retention review? Use compliance.

## Metric definitions

A visit is one unique source-instance/site/visit ID. A converted visit is the vendor’s visitConverted flag, not a sale count. Conversion rate is converted visits divided by observed visits. Pageviews include only actionDetails entries whose type is action. Observed page time sums their timeSpent values and does not invent a duration for an unmeasured final page. Landing pages use the first saved page action only when the recorded detail count covers reported actions. Single-action visits are labelled as such, not presented as an exact vendor bounce-rate replica.

Dates group the firstActionTimestamp in UTC. Matomo site-local date reports can differ. No cross-session visitor identity, unique-visitor counts, attribution model, revenue or statistical significance is inferred. Missing dates are unknown. Imported scope is a declaration, not proof of a complete extract. Reconcile filtered or paginated exports before relying on comparisons.

## Your first hour: ten things to ask for

1. Set our business name and colours in brand.json.
2. Register our actual Matomo instance and site ID.
3. Record the owner and purpose of this analysis.
4. Agree retention and privacy review settings.
5. Export a closed period with an independently checked visit count.
6. Run the import check without writing.
7. Compare the loaded counts with the source.
8. Assign an owner to one page improvement.
9. Produce our private website brief.
10. Add the one report our Monday meeting needs.

/customise adds a field or rule through a tested migration. /new-view adds a read-only report. [Why no front end](docs/why-no-front-end.md).

## Paperwork, controls and backups

npm run docs writes branded website performance briefs and analytics record control reviews to docs-out/. npm run view writes views/week.html. Both use brand.json and escape record text.

/compliance checks review dates, retention settings and truncated action history. Read [the source rules](docs/compliance.md). It is an operational check, not a certificate. Import drops IP addresses, visitor and user IDs, coordinates, page titles, query strings and fragments. URL paths, referrer labels, source visit IDs and your notes can still identify people. Review those fields and protect outputs.

Imports, visits, pageviews, notes and activity events are append-only through this base. Corrections and retention deletions require a reviewed maintenance process. The database owner can bypass application controls. Typed operator names provide attribution, not authentication. Do not commit customer exports or reports.

npm run analytics -- export --file=exports/backup-YYYY-MM-DD.json writes all seven record types to a new private JSON file and refuses overwrites. Automated restore is not included. Keep native database backups and original exports under the agreed retention policy.

## Validation and selection

npm test exercises every CLI verb, repeated migrations and seed, metric denominators, source isolation, repeated imports, incomplete histories, privacy minimisation, action evidence, private drafts, backups and escaped HTML. [Execution evidence](docs/validation.md). [Selection and sources](docs/research.md).

MIT. Built and optionally operated through [Omni by Enterprise DNA](https://enterprisedna.co/omni/instead-of/matomo).
