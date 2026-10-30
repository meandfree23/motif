# 2026-10-30 collection quality repair

The original 69 issue dates and all 375 item IDs are retained. No issue was cloned, deleted or relabeled. Existing taste, mission and research direction remain intact.

## Applied

- One-character Korean search now works; short Latin acronyms match whole tokens. Search has incremental results instead of silently stopping at 24.
- First-visit quantity matches 6–8. World shows the 30-day region share used by the editorial policy. Partial JSON loading errors are visible instead of looking like empty collections.
- Nine image assets replaced or restored from official project pages, artist video previews or artist submissions. Artwork still, installation view, rendering and portfolio preview are captioned distinctly. Alt text and provenance are recorded for repaired assets.
- Twenty-three single-source Focus articles now have at least two source records. Sources are identified as artist statements, partner/institutional records, programme context or project media; two records do not imply independent reporting. The same institution may supply both records. Expired GIFF and authenticated artist endpoints were replaced with public work records.
- Empty originals and confirmed creator prefixes were corrected without stripping actual subtitles. Exhibition, programme, portfolio and project-overview entries are labeled. Liza Mizuno spelling and Acropora/Robert Borghesi credits were corrected from public sources.
- Postcards from Latent Space was re-grounded in the artist's submitted statement. Unsupported claims about LED touring, historical research and model details were removed. SOLSTICE is grounded in the artist's official video without confusing metaphorical human energy with power generation.
- A shared content checker covers count, source concentration, region diversity, Focus, insights, tags, references, self-hosted images and future provenance. The within-issue duplicate scan now honors the same allowlist as the archive scan. Regression checks protect these cases.

## Explicitly unresolved

- `2026-10-08-01` Quiver: the institution's available cover image depicts a different game, Pop-up Crashout. It was not substituted. The image area and caption state that the artwork image is pending.
- `2026-10-28-03` CAUTÍN LEWFÜ: the two official presenters supply an artist portrait. It is labeled prominently as a portrait, not performance documentation. The collection is preserved while a matching performance image remains unavailable.
- The same-project Amplify Me entries remain preserved and linked by `projectGroup`; the archival warning is retained. A later editorial consolidation must preserve old ID links.
- Pre-2026-10-20 count/source/region deviations are reported as historical warnings. They are not concealed by fabricated backfill or changed dates. The 2026-10-20 and later daily standard is enforced as a failure.
- This repair does not claim a line-by-line fact check or rights clearance for every older record. Official availability and attribution are recorded as preview provenance, not as an invented license grant.

## Publication checks

Run all of the following before publication, using freshly downloaded source files:

```
node scripts/test-quality.mjs
node scripts/check-dedup.mjs data.json --memory curator_memory.json --json
node scripts/check-dedup.mjs data.json --new YYYY-MM-DD --memory curator_memory.json --json
node scripts/check-linked-data.mjs data.json signals.json toolkit.json
python3 scripts/check-images.py data.json --date YYYY-MM-DD --root .
```

`check-images.py` uses Pillow (available in the current publication environment). It decodes real bytes and catches missing/unreadable/all-black assets; it cannot establish whether a colorful image depicts the correct artwork. Human visual comparison and the imageMeta source/credit/type/caption remain required. Never add guessed provenance just to pass the check. New issues from 2026-10-31 require imageMeta. After commit, repeat the image check with `--base https://meandfree23.github.io/motif` and compare live JSON/source SHA.
