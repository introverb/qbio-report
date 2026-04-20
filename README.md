# QUBIE News

Automated news aggregator for quantum biology and adjacent fields. Built for
the Quantum Biology DAO.

## What it does

1. Scrapes ~30 sources twice a day (journals, preprint servers, APIs, forums)
2. Scores each article by keyword relevance
3. Generates plain-English "why it matters" blurbs for the most important ones
4. Serves a styled news-report page + admin tools for editing keywords and
   requesting new sources

## Stack

- Python 3.11 + Flask (server)
- APScheduler (twice-daily scrape)
- Claude Haiku (article blurbs)
- openpyxl (source-inventory spreadsheet)
- Static HTML/CSS/JS frontend (no build step)

## Run locally

```bash
pip install -r requirements.txt
python server.py
```

Then visit `http://localhost:8000`.

## Deploy on Railway

1. Push this repo to GitHub
2. New project on Railway → Deploy from GitHub repo
3. Add environment variables:
   - `ANTHROPIC_API_KEY` — your Claude API key (for blurb generation)
   - `DATA_DIR` — `/data` (points at the persistent volume)
   - `SCRAPE_HOURS` — optional, default `8,18` (UTC hours to scrape)
   - `SCRAPE_ON_STARTUP` — optional, `1` for initial content right after deploy
4. Add a Volume mounted at `/data`
5. Deploy

Railway auto-detects `Procfile` + `requirements.txt` and runs the web service.

## Structure

```
.
├── server.py                    # Flask app
├── index.html                   # The Report
├── sources.html                 # Sources admin page
├── keywords.html                # Keywords admin page
├── assets/                      # fonts, logo, shared CSS
├── scraper/
│   ├── scraper.py              # the scraping engine
│   └── keywords.txt            # keyword list (also copied to DATA_DIR on first run)
├── Procfile                    # Railway entrypoint
├── requirements.txt            # Python deps
└── runtime.txt                 # pinned Python version
```

## License

Private to Quantum Biology DAO.
