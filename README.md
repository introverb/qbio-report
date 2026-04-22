# QUBIE News

*Hi! I'm Qubie — a fish, a mascot, and the unofficial librarian of the
[Quantum Biology DAO](https://quantumbiologydao.xyz). This is the repo behind my little
news project.*

---

## 🔗 See it live

**→ [qubiereport.up.railway.app](https://qubiereport.up.railway.app/)**

No log-in. Swim on in.

---

## What is this?

Quantum biology is a **radical pair** of words — half quantum physics, half
living-things biology — and the field moves faster than you'd think. Preprints
drop weekly, forums buzz daily, and papers land in journals across physics,
biology, chemistry, and a dozen specialties. Keeping up *solo* is a lot.

So I cast a wide net. Every 12 hours, QUBIE News visits **~30 sources** —
peer-reviewed journals, preprint servers, Reddit, Hacker News, Stack Exchange,
Bluesky — and scores each new article against a curated list of
quantum-biology keywords. The most on-topic ones float to the top, get a
plain-English "why it matters" blurb from Claude, and land on a styled
news-report page.

Everything stays **coherent**: papers in one section, informal chatter in
another, archived older stuff filed by date, and a search bar that filters
the whole feed live. No need to go fishing across a dozen tabs.

## Sections of the site

- **The Report** — papers, preprints, and news-news, sorted by date with blurbs
- **Chatter** — forum and social signal (Reddit, HN, Bluesky, SE), kept playfully separate so the serious stuff stays serious
- **Suggest** — a public page where *anyone* can request a new source or a keyword weight-change (no login)
- **Admin** — the project owner's command console: pending-request queues, source stats, error flags, on-demand scrapes (password-protected)

## Tech stack

I'm just a fish, but the humans who built me used:

- **Python 3.11 + Flask** — the web server
- **APScheduler** — twice-daily scheduled scrapes (08:00 & 18:00 UTC)
- **Claude Haiku** via the Anthropic SDK — generates the "why it matters" blurbs
- **openpyxl** — source-inventory spreadsheet that survives redeploys
- **Plain HTML / CSS / JS** frontend — no build step, no framework, no fuss

Hosted on **Railway** with a persistent volume for data that needs to stick
around (keywords, pending requests, scraped feed, the spreadsheet).

## Run me locally

```bash
pip install -r requirements.txt
python server.py
# then visit http://localhost:8000
```

Admin stuff (like `/admin`) will need env vars set before it works — look for
placeholders like `please-set-ADMIN_PASSWORD-env-var` in the code. Drop a
`.env` file in the project root with:

```
ADMIN_PASSWORD=<pick-something>
FLASK_SECRET_KEY=<random-30+-chars>
ANTHROPIC_API_KEY=sk-ant-...         # only if you want LLM blurbs
REDDIT_CLIENT_ID=<your-reddit-app>   # only if you want Reddit scraping
REDDIT_CLIENT_SECRET=<your-secret>
```

`python-dotenv` will pick it up automatically.

## Deploy on Railway (or anywhere that runs Python + has a volume)

1. Clone / fork this repo
2. New Railway project → Deploy from GitHub repo
3. Set the env vars from the local-run section, plus:
   - `DATA_DIR=/data` — where persistent files live
   - `SCRAPE_HOURS=8,18` — UTC hours for scheduled scrapes (optional)
   - `SCRAPE_ON_STARTUP=1` — run a scrape shortly after boot (optional)
4. Attach a volume mounted at `/data`
5. Deploy — Railway auto-detects `Procfile` + `requirements.txt`

Every commit you push auto-redeploys.

## Structure

```
.
├── server.py             # Flask app + scheduler + admin APIs
├── index.html            # The Report (homepage)
├── chatter.html          # /chatter
├── suggest.html          # /suggest
├── admin.html            # /admin (password-protected)
├── login.html            # /login
├── assets/               # fonts, logo, shared CSS
├── scraper/
│   ├── scraper.py        # scraping engine
│   └── keywords.txt      # seed keyword list
├── Procfile              # Railway entrypoint
├── requirements.txt      # Python deps
└── runtime.txt           # pinned Python version
```

## About the DAO

The [Quantum Biology DAO](https://quantumbiologydao.xyz) is a community at the
frontier where physics meets life. If you care about quantum effects in living
systems — photosynthesis, bird navigation, enzyme catalysis, cryptochrome,
radical pair mechanisms, all the weird-beautiful stuff — come wave hi.

## License

Private to the Quantum Biology DAO. Code is visible for transparency; please
check in with the DAO before reusing substantial chunks.

---

*— Qubie, blowing quantum-coherent bubbles at you from the bottom of the
scientific record since 2026.*
