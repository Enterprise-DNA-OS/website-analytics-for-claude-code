# Bring saved Matomo visits across

The importer accepts a JSON array from Matomo's Live.getLastVisitsDetails reporting method. This is a visit-history import, not a CSV summary-report importer. The committed example is fictional and follows the vendor's documented export and public demo response shape.

## Export

Use a view-only Matomo account and export a closed reporting period. Follow [Matomo's raw-data export guide](https://matomo.org/faq/how-to/faq_24536/). Select the correct instance, idSite and date scope. Request format=JSON. For a large result, use filter_limit and filter_offset, then combine the returned arrays into one array. Check the unique visit count independently against the source. Do not paste authentication tokens into this repository or command history.

Matomo limits the number of action details returned per visit. Its guide describes the default limit and configuration. Export complete details where available. The importer flags detail_count below actions, and excludes those visits from landing-page totals. It cannot detect every form of filtering or an omitted visit. Site-local days can cross UTC boundaries, so declare a UTC date range containing every visit start and explain the original date filters in source-ref. Visit metrics use firstActionTimestamp rather than formatted local dates.

Native format references: [Reporting API](https://developer.matomo.org/guides/reporting-api), [export choices](https://matomo.org/faq/how-to/faq_26727/), and [public demo API](https://demo.matomo.cloud/?module=API&method=Live.getLastVisitsDetails&idSite=1&period=day&date=yesterday&format=JSON&filter_limit=1). The live example was inspected on 19 November 2026; no live visitor data was committed.

## Register once

Run add-site with the actual name, source instance label, vendor site ID, owner, purpose, retention period and review dates. The unique identity is source instance plus vendor site ID. Two Matomo instances can both have site 1 without mixing their visits. Registration is deliberate; imports never silently create a site.

## Import with one command

```bash
npm run analytics -- import matomo --site="Your site" --file=imports/visits.json --expected-count=100 --from=2026-11-01 --to=2026-11-18 --source-ref="Actual export job, filters and count" --actor="Actual operator" --dry-run
```

Replace the illustrative count and dates with the actual values. Inspect added, unchanged and incomplete counts. Run the same command without --dry-run to write. Repeating identical visits is safe. A changed visit under an existing source ID is rejected, so do not export active visits. Corrections require a reviewed reconciliation, not a new site invented to bypass the conflict.

| Source field | Destination and meaning |
|---|---|
| idSite | Must match the registered site |
| idVisit | Visit identity within that site and source |
| firstActionTimestamp | UTC start instant and reporting date |
| referrerType, referrerName | Acquisition group and reported source label |
| deviceType, countryCode | Reported device category and country |
| visitConverted | Boolean converted-visit flag |
| actions, actionDetails length | Completeness check |
| visitDuration | Reported duration in seconds |
| actionDetails type=action | Pageviews in the saved array order |
| action URL | Origin and path only; query and fragment removed |
| action timeSpent | Observed page seconds, zero if omitted |

IP addresses, visitor and user IDs, coordinates, page titles, URL queries and fragments are discarded. Other custom dimensions, goals, revenue, events, downloads, outlinks and attribution fields are not mapped. The original export is not retained by the importer. Protect it separately under the agreed retention policy. Retained paths and labels can still contain personal information.

## Reconcile and switch

Compare site counts, date bounds, channel totals and converted visits. Review coverage and compliance, then inspect several journeys against the source. The free base is useful for saved-history review on day one. It does not capture new visits, operate consent controls or replace session recordings. Keep the current collector running until a separately implemented replacement has passed reconciliation. Do not cancel a working tracking service merely because an import succeeded.

Matomo Community already offers free self-hosted analytics. Enterprise DNA can scope a smaller owned reporting system, a collector connection, a screen or continued use of that existing platform around the business's needs.
