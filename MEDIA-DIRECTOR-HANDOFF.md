# QUBIE News — Media Director Handoff

**Last updated:** 2026-04-20
**Owner:** Olli (ollipayne182@gmail.com)
**Status:** Live in production on Railway.

---

## 1. What this is

QUBIE News is an automated news aggregator for quantum biology and adjacent
fields. It runs 24/7 on a cloud host, scrapes ~30 sources twice a day, scores
articles by keyword relevance, generates plain-English summaries of the most
important ones, and publishes everything to a styled news-report page.

You don't need to install anything or run anything on your computer. Just
visit URLs and log in when asked.

---

## 2. The four URLs

| URL | What it is | Public? |
|---|---|---|
| **https://web-production-2537b.up.railway.app/** | The Report (the main feed, with a search box at the top) | Yes — anyone can see it |
| **https://web-production-2537b.up.railway.app/chatter** | Chatter (Reddit, Hacker News, Bluesky, etc.) | Yes — anyone can see it |
| **https://web-production-2537b.up.railway.app/keywords** | Keywords admin (add / remove / weight) | No — password required |
| **https://web-production-2537b.up.railway.app/sources** | Sources admin (view stats, submit source requests) | No — password required |

### Admin password

The admin pages show a simple password form. Enter:

**Password:** `coherence`

Your browser remembers it for the session (up to 31 days). Close the browser or visit `/logout` to sign out.

---

## 3. How the system runs

| Thing | When |
|---|---|
| Scrape runs automatically | Twice a day at **08:00 UTC** and **18:00 UTC** (= 04:00 and 14:00 US Eastern) |
| Keyword edits take effect | **Next scheduled scrape** (max 12 hours later) |
| Source requests reach Olli | Immediately — they appear in the log for Olli to action |
| Blurbs ("why it matters" summaries) | Regenerated on each scrape for new articles; cached for seen ones |

You don't need to "run the scraper" — it runs itself.

---

## 4. Daily / weekly workflows

### A. Read the news

Just visit **https://web-production-2537b.up.railway.app/** and scroll.
No login needed. The page auto-refreshes each scrape cycle.

A **search box** at the very top of the page indexes every article in the feed — type any phrase (multi-word = AND), results filter live.

### A2. Read the chatter

For community/social signal (Reddit, Hacker News, Bluesky), visit **/chatter**. Same public page. Filter buttons let you narrow to just forums, just social, or direct-quantum-biology items only.

### B. Edit the keyword list

Keywords define what counts as "relevant" to QUBIE News. Adding one makes
the scraper actively search for it on PubMed / arXiv / Europe PMC / Hacker News /
Bluesky *and* use it in relevance scoring.

1. Go to **/keywords** and log in
2. See all current keywords as small tags
3. To **add**: type the phrase, optionally set a weight (1–10), click "Add keyword"
4. To **remove**: click the `×` button on any tag
5. To **update a weight**: re-add the same keyword with a new weight (it replaces the old entry)
6. Changes take effect on the next scheduled scrape (max 12 hours later)

**Weighting:** Each keyword has a weight (default 1). An article's score = sum of matched keyword weights. Higher-scored articles rank higher in the feed. Give core terms like `quantum biology` or `radical pair` a higher weight (e.g. 5) to make directly-on-topic papers rise to the top.

**Judgment calls:**
- Too broad a keyword (e.g. just `biology`) floods the feed with noise.
- Too narrow misses cross-field work.
- A good rule: if you wouldn't want an article containing *only* that term
  to show up, don't add it alone.

### C. Request a new source

Use this when you want QUBIE News to pull from a new journal, subreddit,
API, etc. that isn't already configured.

1. Go to **/sources** (you'll be prompted for the password)
2. Click the **Source Requests** tab (the last tab)
3. Fill in the form at the top:
   - **Source Name** (e.g. `Biophysical Journal`)
   - **Type** (RSS / API / Forum / Social / Other)
   - **URL or Endpoint** (or the subreddit name, hashtag, etc.)
   - **Why / Notes** — any context for Olli to act on
   - **Priority** (High / Medium / Low)
   - **API Key Needed?** (Yes / No / Unknown)
4. Click **Submit request**
5. Your request shows up in the table below + is logged for Olli
6. Olli sees the request, wires the source into the system, redeploys.
   Usually within a day of the request.

### D. Review source coverage

Same **/sources** page, first 5 tabs:

- **Summary** — top-level totals per tier
- **Tier 1 - RSS Feeds** — journal / news RSS feeds
- **Tier 2 - Search APIs** — PubMed, arXiv, Europe PMC
- **Tier 3a - Forums** — Reddit, Hacker News, Stack Exchange, Bluesky
- **Tier 3b - Social** — (currently just Bluesky)

**Color coding on the tier tabs:**
- 🟩 **Green** = Working (found matches this run)
- 🟨 **Yellow** = Working, but 0 matches this run
- 🟥 **Red** = Errored — see the **Error** column for the technical message

The numbers update every scrape — so the most recent run's stats are always
what you see.

---

## 5. What the team can do vs. what needs Olli

### Self-serve (no Olli needed)
- Read the Report (public URL, no login)
- Add or remove keywords on /keywords
- Submit source requests on /sources
- Review source coverage in the tier tabs

### Needs Olli
- Acting on source requests (wiring them into the scraper)
- Fixing broken sources (red rows on /sources)
- Changing the page design or layout
- Changing how scoring works
- Rotating the admin password
- Anything involving code changes

---

## 6. Known issues

Some sources are intentionally marked red / ERROR because their public RSS
feeds are blocked by Cloudflare bot protection:

- **ChemRxiv** — HTTP 403 from Cloudflare
- **Royal Society Interface** — HTTP 403 from Cloudflare

These can't be worked around without a headless browser (heavy infrastructure).
Replacements are on Olli's list.

Everything else is working or correctly no-hit (yellow) depending on the day.

---

## 7. Troubleshooting

| Symptom | What to try |
|---|---|
| Browser shows "Login required" on a page you've already logged into | Browser closed between sessions. Just log in again. |
| Page loads but says "NO FEED.JSON — RUN THE SCRAPER FIRST" | Scraper hasn't run yet. Wait until the next 08:00 or 18:00 UTC scrape, or ask Olli to trigger one. |
| Keyword edits aren't reflected in the Report | Scraper hasn't run yet since your edit. Wait until next scheduled scrape (max 12 hours). |
| Can't reach any URL at all | Cloud host is down or redeploying. Try again in ~2 minutes. |
| Some source has been showing red for days | Ping Olli — that one needs attention. |

---

## 8. When to contact Olli

Raise a flag when:
- You submit a source request and want to flag it as urgent
- A source has been red for more than a few days
- The article feed feels off — too narrow, too broad, missing a topic area
- You want to change the page design, layout, or copy
- Something in the workflow doesn't work and the troubleshooting table didn't help

Contact: **ollipayne182@gmail.com**

---

## 9. Quick reference card

| Task | URL | Login? |
|---|---|---|
| Read the news | `/` | No |
| Search the feed | `/` (box at the top) | No |
| Read community chatter | `/chatter` | No |
| Edit keywords | `/keywords` | Yes (pw: `coherence`) |
| Submit source request | `/sources` → Source Requests tab | Yes (pw: `coherence`) |
| Review source stats | `/sources` → any tier tab | Yes (pw: `coherence`) |

Base URL: **https://web-production-2537b.up.railway.app/**
