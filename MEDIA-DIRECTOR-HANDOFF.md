# QBIO Report — Media Director Handoff

**Last updated:** 2026-04-17
**Owner:** Olli
**Status:** In active development, working prototype.

---

## 1. What this is

QBIO Report is an automated news aggregator for quantum biology and adjacent
fields. Once triggered, it:

1. Scrapes ~30 sources (academic journals, preprint servers, APIs, forums)
2. Scores each article by how many quantum-biology keywords it matches
3. Publishes a styled news-report page showing the most recent and most
   relevant hits
4. Regenerates a source-inventory spreadsheet for team review

The front-end visual style is a light parody of the Drudge Report, rendered
in the Quantum Biology DAO brand palette and typography.

---

## 2. Where everything lives

All files are in `C:\Users\ollip\OneDrive\Desktop\QBIO DAO\QBIO NEWS\`:

```
QBIO NEWS/
├── index.html                      ← the web page (what readers see)
├── feed.json                       ← article data, AUTO-GENERATED
├── QBIO-Report-Sources.xlsx        ← source inventory, AUTO-GENERATED
├── MEDIA-DIRECTOR-HANDOFF.md       ← this document
├── assets/
│   ├── logo-icon.svg               ← the DAO hex icon (used in "Breaking")
│   └── fonts/                      ← Apercu Pro + Chap
└── scraper/
    ├── scraper.py                  ← the engine (don't touch unless asked)
    ├── keywords.txt                ← >>> YOU EDIT THIS <<<
    └── requirements.txt            ← Python dependencies (install once)
```

**Two files your team should know intimately:**

- `scraper/keywords.txt` — the list of terms that define "relevant" for us.
  Editable. Changes take effect the next time the scraper runs.
- `QBIO-Report-Sources.xlsx` — shows where articles are coming from and which
  sources are broken. Regenerated every scraper run.

---

## 3. Daily / weekly workflows

### A. Refreshing the feed (running the scraper)

Recommended cadence: once or twice a day.

1. Open **PowerShell** in the QBIO NEWS folder.
   *(In File Explorer: right-click inside the folder → "Open in Terminal"
   or "Open PowerShell window here".)*
2. Run this single command:
   ```
   py scraper\scraper.py
   ```
3. Wait ~1–2 minutes. You'll see progress printed live for each source:
   ```
   RSS: arXiv — Quantum Physics ...
       -> 3 matched (of 133)
   ```
4. When you see `Done! NNN unique articles`, you're good.
5. The page updates automatically next time you refresh your browser.
6. The spreadsheet (`QBIO-Report-Sources.xlsx`) also updates automatically.

> **If you see `'python' is not recognized`** → use `py` instead of `python`.
> The command above already uses `py` — always use that on Windows.

### B. Viewing the page

The page has to be served by a mini web server; you can't just double-click
`index.html` (the browser blocks it from loading the data file for security
reasons).

**If the server is already running**, open any browser and go to:

> **http://localhost:8000**

**If the server is NOT running**, start it:

1. Open PowerShell in the QBIO NEWS folder.
2. Run:
   ```
   py -m http.server 8000
   ```
3. Leave that terminal window open. Closing it stops the server.
4. Visit `http://localhost:8000` in any browser.

### C. Editing the keyword list

1. Open `scraper\keywords.txt` in **Notepad**, **VS Code**, or any text editor.
2. Read the comment block at the top — it explains exactly how keywords
   are used (for scoring AND for searching the big APIs).
3. Rules:
   - One keyword or phrase per line.
   - Lines starting with `#` are comments (ignored).
   - Don't worry about alphabetical order — grouping is purely for readability.
   - Multi-word phrases (e.g. `quantum coherence`) match as a single unit.
4. Save the file.
5. Your changes take effect on the **next scraper run**.

**Judgment calls when editing:**

- Too broad a keyword (e.g. just `biology`) → floods the feed with noise.
- Too narrow → misses cross-field work.
- A good rule: if you wouldn't want an article containing only that term
  to show up, don't add it alone.

### D. Reviewing the source spreadsheet

Open `QBIO-Report-Sources.xlsx` in Excel — or drag it into Google Drive
to auto-convert into a Google Sheet.

Five tabs:

| Tab | What's in it |
|---|---|
| **Summary** | One-row-per-tier: sources configured, articles contributed, errors |
| **Tier 1 - RSS Feeds** | Journal + news RSS feeds (16 sources) |
| **Tier 2 - Search APIs** | PubMed, arXiv search, Europe PMC |
| **Tier 3a - Forums** | Reddit, Hacker News, Stack Exchange |
| **Tier 3b - Social** | Bluesky (currently broken) |

**Color coding on every tier tab:**

- 🟩 Green = Working, matched ≥ 1 article
- 🟨 Yellow = Working, but found 0 relevant articles this run
- 🟥 Red = Errored — see the **Error** column for the technical message

The sheet regenerates on every scraper run. Don't hand-edit it; changes
will be overwritten. If you want to annotate a source, tell Olli and
they'll update the underlying scraper config.

---

## 4. What the team can change vs. what needs Olli

### Self-serve (no developer needed)
- Add / remove / reorder terms in `scraper/keywords.txt`
- Review `QBIO-Report-Sources.xlsx` and flag concerns
- Run the scraper
- View the page
- Share the page URL once it's deployed publicly

### Needs Olli (developer work)
- Adding a new source (RSS, API, forum, etc.)
- Fixing a broken source
- Changing the page design or layout
- Changing how articles are scored
- Deploying the site publicly (GitHub Pages)
- Changing source categories / badges
- Anything involving `scraper.py` or `index.html`

---

## 5. Known issues (as of 2026-04-17)

These are documented and on the fix list:

1. **Bluesky** — all queries error with a JSON parse failure. The public API
   endpoint likely requires auth now. Visible in the spreadsheet as red rows.
2. **Europe PMC** — the search endpoint accepts our query but returns 0
   results. Query-format debugging pending.
3. **ChemRxiv** and **Royal Society Interface** — RSS URLs return empty.
   Both need replacement URLs.
4. **Broad news feeds** (Nature, ScienceDaily, PNAS, etc.) rarely produce
   matches because quantum biology is a niche topic inside broad science.
   These are intentionally kept as **long-tail** — they'll catch surprise
   crossover hits once a month, and cost nothing to leave in.

Check the Error column in the spreadsheet for the latest status on any
of these.

---

## 6. Troubleshooting

| Symptom | What's happening | Fix |
|---|---|---|
| `'python' is not recognized` | `python` isn't on this machine's PATH | Use `py` instead |
| Page shows **"Failed to fetch"** | The server isn't running | Start it: `py -m http.server 8000` |
| Page shows **"NO FEED.JSON — RUN THE SCRAPER FIRST"** | No article data exists yet | Run the scraper: `py scraper\scraper.py` |
| Browser opens a **Google search for "index.html"** | You typed it into the address bar | Instead, type `http://localhost:8000` |
| Scraper runs but produces 0 articles | Unusual, probably a network issue | Re-run after a minute; if it persists, contact Olli |
| Terminal says `Device or resource busy` when re-running | A previous scraper process is still holding a file | Close other terminals / wait 30 seconds |

---

## 7. When to contact Olli

Raise a flag when:

- Something in the workflow above fails and the troubleshooting table
  didn't help.
- You want to add a new source or remove an existing one.
- You notice consistent red rows in the spreadsheet week after week.
- The article feed feels off — too narrow, too broad, missing a topic area.
- You want to change the page design, layout, or copy.
- You want the site published publicly.

Contact: **ollipayne182@gmail.com**

---

## 8. Quick reference card (print this)

**Refresh the feed:** `py scraper\scraper.py`
**Start the server:** `py -m http.server 8000`
**View the page:** `http://localhost:8000`
**Edit keywords:** open `scraper\keywords.txt` in any text editor
**Review sources:** open `QBIO-Report-Sources.xlsx`

Feed updates on every scraper run. Spreadsheet updates on every scraper run.
Page updates on the next browser refresh after a scraper run.
