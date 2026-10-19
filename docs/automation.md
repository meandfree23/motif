# MOTIF daily publication

The production site is https://meandfree23.github.io/motif/. The source of truth is this repository's main branch: data.json, curator_memory.json, sources.json, signals.json and toolkit.json.

## Scheduled operation

The publication agent reuses one ongoing conversation. Each check must use Asia/Seoul dates and the repository records, not the last date visible in conversation history. Repeated checks of an unchanged healthy site should remain quiet.

1. Read the latest data.json and curator_memory.json. If today's issue exists, verify the live site instead of generating a duplicate.
2. If today's issue is missing, research original artist and institutional sources. Preserve the current schema and curator mission, editorial rules, taste profile and dedup policy. Prepare 6–8 distinct Latest works and one Focus. Do not copy an old issue under a new date.
3. Preserve insight, tags, origin, crosscurrent and Focus fields. Use a maximum of two items per source domain and at least three regions. Unknown biographical facts remain null. Focus uses at least two verified sources and four analytical sections. Verify that photographs depict the actual work and record their provenance.
4. Run candidate checks, then run the date-specific duplicate gate before committing:
   - node scripts/check-dedup.mjs data.json --candidates candidates.json --memory curator_memory.json --json
   - node scripts/check-dedup.mjs data.json --new YYYY-MM-DD --memory curator_memory.json --json
5. Require zero FAIL results, the issue's minimum item count, complete Focus and verified self-hosted images. Do not publish guessed material to satisfy the count.
6. Re-read data.json immediately before a write. Preserve concurrent changes and skip the write if another publisher has already published today's issue. Use conditional file SHA updates or an atomic commit with an expected branch-head SHA. Never force-push.
7. After committing, check the live data.json with cache bypass. Confirm the date, title, item IDs, Focus and image responses. A successful commit alone is not a verified publication. Bound a single verification wait to three minutes and resume it at the next check if needed.
8. Update the operational status record in place. Report a new actionable error or its resolution once. Do not create a separate conversation or repeated reports for every unchanged check.

Past-date backfill requires an explicit requested date range. Existing issues must not be deleted or relabeled. Sunday Signals and Toolkit updates follow the evidence thresholds in curator_memory.json.
