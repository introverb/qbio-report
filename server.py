"""
QBIO Report local server
========================
Replaces `python -m http.server` with a Flask app that:
  - Serves the static site (index.html, feed.json, assets, etc.)
  - Provides an admin API so the Sources and Keywords pages can
    read/write the underlying config files.

Run:
    python server.py

Then visit:
    http://localhost:8000            -> the Report
    http://localhost:8000/sources    -> the Sources admin page
    http://localhost:8000/keywords   -> the Keywords admin page
"""
import json
import os
import shutil
import subprocess
import sys
import threading
from datetime import datetime
from functools import wraps

from flask import Flask, Response, jsonify, request, send_from_directory, abort
from openpyxl import load_workbook

# --- Paths ------------------------------------------------------------------
# Locally: files live next to server.py
# On Railway: DATA_DIR points to the persistent volume so user edits + scrape
# output survive redeploys.
HERE          = os.path.dirname(os.path.abspath(__file__))
DATA_DIR      = os.environ.get("DATA_DIR") or HERE
BUNDLED_KEYWORDS = os.path.join(HERE, "scraper", "keywords.txt")

KEYWORDS_FILE = os.path.join(DATA_DIR, "keywords.txt")
XLSX_FILE     = os.path.join(DATA_DIR, "QBIO-Report-Sources.xlsx")
SOURCES_JSON  = os.path.join(DATA_DIR, "sources.json")
FEED_JSON     = os.path.join(DATA_DIR, "feed.json")
LOG_FILE      = os.path.join(DATA_DIR, "source_requests_log.md")
REQUESTS_TAB  = "Source Requests"

# First-run seed: if the volume is empty, copy the bundled keywords.txt in so
# the scraper has a starting point. User edits thereafter stay on the volume.
def _seed_volume():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(KEYWORDS_FILE) and os.path.exists(BUNDLED_KEYWORDS):
        shutil.copyfile(BUNDLED_KEYWORDS, KEYWORDS_FILE)
        print(f"[seed] Copied bundled keywords.txt -> {KEYWORDS_FILE}")

_seed_volume()

# ============================================================================
# Auth
# ============================================================================
# Simple HTTP Basic Auth protects admin pages + write endpoints.
# Username can be anything; only the password is checked.
# Override via ADMIN_PASSWORD env var on Railway.

ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "coherence")


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.authorization
        if not auth or auth.password != ADMIN_PASSWORD:
            return Response(
                "Login required. Contact Olli for the password.",
                401,
                {"WWW-Authenticate": 'Basic realm="QBIO Report Admin"'},
            )
        return f(*args, **kwargs)
    return decorated

LOG_HEADER = (
    "# QBIO Report - Source Requests Log\n\n"
    "_Newest at top. Each entry is formatted for copy-paste straight to Claude._\n\n"
    "<!-- NEW_ENTRIES_BELOW -->\n\n"
)
LOG_SENTINEL = "<!-- NEW_ENTRIES_BELOW -->\n\n"

PORT = int(os.environ.get("PORT", 8000))

app = Flask(__name__, static_folder=HERE, static_url_path="")


# ============================================================================
# Page routes
# ============================================================================

@app.route("/")
def page_report():
    return send_from_directory(HERE, "index.html")


@app.route("/chatter")
def page_chatter():
    return send_from_directory(HERE, "chatter.html")


@app.route("/sources")
@require_auth
def page_sources():
    return send_from_directory(HERE, "sources.html")


@app.route("/keywords")
@require_auth
def page_keywords():
    return send_from_directory(HERE, "keywords.html")


# These are data files on the volume (not static assets) — serve from DATA_DIR
@app.route("/feed.json")
def serve_feed():
    if not os.path.exists(FEED_JSON):
        return jsonify({"error": "No feed yet — scraper hasn't run."}), 404
    return send_from_directory(DATA_DIR, "feed.json")


@app.route("/sources.json")
def serve_sources_json():
    if not os.path.exists(SOURCES_JSON):
        return jsonify({"error": "No sources.json yet — scraper hasn't run."}), 404
    return send_from_directory(DATA_DIR, "sources.json")


# ============================================================================
# Keywords API
# ============================================================================

def _read_keywords_file():
    """Return (lines, keywords_only) where lines is the raw file and
    keywords_only is the non-comment, non-blank entries."""
    if not os.path.exists(KEYWORDS_FILE):
        return [], []
    with open(KEYWORDS_FILE, "r", encoding="utf-8") as f:
        lines = f.read().splitlines()
    keywords = [
        ln.strip() for ln in lines
        if ln.strip() and not ln.strip().startswith("#")
    ]
    return lines, keywords


def _write_keywords_lines(lines):
    with open(KEYWORDS_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


@app.route("/api/keywords", methods=["GET"])
@require_auth
def api_list_keywords():
    lines, keywords = _read_keywords_file()
    return jsonify({"keywords": keywords, "count": len(keywords)})


@app.route("/api/keywords", methods=["POST"])
@require_auth
def api_add_keyword():
    data = request.get_json(force=True, silent=True) or {}
    new_kw = (data.get("keyword") or "").strip()
    if not new_kw:
        return jsonify({"error": "Empty keyword"}), 400
    if new_kw.startswith("#"):
        return jsonify({"error": "Keywords cannot start with '#'"}), 400

    lines, keywords = _read_keywords_file()
    if new_kw.lower() in (k.lower() for k in keywords):
        return jsonify({"error": "Already exists"}), 409

    # Append at end of file. Keeps the user's section grouping untouched.
    if lines and lines[-1].strip():
        lines.append("")  # ensure trailing blank line before new entry
    lines.append(new_kw)
    _write_keywords_lines(lines)
    return jsonify({"ok": True, "keyword": new_kw})


@app.route("/api/keywords/<path:keyword>", methods=["DELETE"])
@require_auth
def api_delete_keyword(keyword):
    target = keyword.strip().lower()
    lines, _ = _read_keywords_file()
    new_lines = [ln for ln in lines if ln.strip().lower() != target]
    if len(new_lines) == len(lines):
        return jsonify({"error": "Not found"}), 404
    _write_keywords_lines(new_lines)
    return jsonify({"ok": True, "keyword": keyword})


# ============================================================================
# Source Requests API (reads/writes Tab 6 of the xlsx)
# ============================================================================

REQUEST_HEADERS = ["Source Name", "Type", "URL or Endpoint", "Why / Notes",
                   "API Key Needed?", "Priority", "Status"]


def _is_example_row(row):
    """Is this the italic-gray template row we insert on first run?"""
    return row and isinstance(row[0], str) and row[0].startswith("e.g.")


def _read_source_requests():
    if not os.path.exists(XLSX_FILE):
        return []
    wb = load_workbook(XLSX_FILE)
    if REQUESTS_TAB not in wb.sheetnames:
        return []
    ws = wb[REQUESTS_TAB]
    rows = []
    for i, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if not any(c not in (None, "") for c in row):
            continue
        if _is_example_row(row):
            continue
        rows.append({
            "row_number":      i,
            "source_name":     row[0] or "",
            "type":            row[1] or "",
            "url":             row[2] or "",
            "why_notes":       row[3] or "",
            "api_key_needed":  row[4] or "",
            "priority":        row[5] or "",
            "status":          row[6] or "Requested",
        })
    return rows


@app.route("/api/source-requests", methods=["GET"])
@require_auth
def api_list_source_requests():
    return jsonify({"requests": _read_source_requests()})


def _log_source_request(payload):
    """Prepend a new source request entry to source_requests_log.md.
    Newest-at-top so you skim the latest right away."""
    timestamp = datetime.now().isoformat(timespec="seconds")
    entry = (
        f"## {timestamp}\n\n"
        f"- **Source:** {payload.get('source_name', '')}\n"
        f"- **Type:** {payload.get('type', '')}\n"
        f"- **URL / Target:** {payload.get('url', '')}\n"
        f"- **Why / Notes:** {payload.get('why_notes', '')}\n"
        f"- **API Key Needed:** {payload.get('api_key_needed', 'Unknown')}\n"
        f"- **Priority:** {payload.get('priority', 'Medium')}\n"
        f"- **Status:** {payload.get('status', 'Requested')}\n\n"
        f"---\n\n"
    )
    if not os.path.exists(LOG_FILE):
        with open(LOG_FILE, "w", encoding="utf-8") as f:
            f.write(LOG_HEADER)
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        content = f.read()
    if LOG_SENTINEL in content:
        content = content.replace(LOG_SENTINEL, LOG_SENTINEL + entry, 1)
    else:
        content = LOG_HEADER + entry + content
    with open(LOG_FILE, "w", encoding="utf-8") as f:
        f.write(content)


@app.route("/api/source-requests", methods=["POST"])
@require_auth
def api_add_source_request():
    data = request.get_json(force=True, silent=True) or {}
    if not (data.get("source_name") or "").strip():
        return jsonify({"error": "source_name is required"}), 400

    if not os.path.exists(XLSX_FILE):
        return jsonify({"error": "Sources workbook not found. Run the scraper first."}), 400

    wb = load_workbook(XLSX_FILE)
    if REQUESTS_TAB not in wb.sheetnames:
        return jsonify({"error": f"Tab '{REQUESTS_TAB}' missing. Run scraper first."}), 500
    ws = wb[REQUESTS_TAB]
    payload = {
        "source_name":     data.get("source_name", "").strip(),
        "type":            data.get("type", "").strip(),
        "url":             data.get("url", "").strip(),
        "why_notes":       data.get("why_notes", "").strip(),
        "api_key_needed":  data.get("api_key_needed", "").strip() or "Unknown",
        "priority":        data.get("priority", "").strip() or "Medium",
        "status":          data.get("status", "").strip() or "Requested",
    }
    ws.append([payload["source_name"], payload["type"], payload["url"],
               payload["why_notes"], payload["api_key_needed"],
               payload["priority"], payload["status"]])
    wb.save(XLSX_FILE)

    # Also prepend to the copy-paste-ready log file
    try:
        _log_source_request(payload)
    except Exception as e:
        # Log failure shouldn't block the save — just report it
        print(f"WARN: failed to write source_requests_log.md: {e}")

    return jsonify({"ok": True, "logged_to": "source_requests_log.md"})


@app.route("/api/source-requests/<int:row_number>", methods=["DELETE"])
@require_auth
def api_delete_source_request(row_number):
    if row_number < 2:
        return jsonify({"error": "Cannot delete header row"}), 400
    if not os.path.exists(XLSX_FILE):
        return jsonify({"error": "Workbook not found"}), 404

    wb = load_workbook(XLSX_FILE)
    if REQUESTS_TAB not in wb.sheetnames:
        return jsonify({"error": "Requests tab missing"}), 404
    ws = wb[REQUESTS_TAB]
    if row_number > ws.max_row:
        return jsonify({"error": "Row out of range"}), 404
    ws.delete_rows(row_number, 1)
    wb.save(XLSX_FILE)
    return jsonify({"ok": True})


# ============================================================================
# Sources (live stats) — read-only passthrough to sources.json
# ============================================================================

@app.route("/api/sources", methods=["GET"])
def api_sources():
    if not os.path.exists(SOURCES_JSON):
        return jsonify({"error": "No sources.json — run the scraper first."}), 404
    with open(SOURCES_JSON, "r", encoding="utf-8") as f:
        return f.read(), 200, {"Content-Type": "application/json"}


# ============================================================================
# Scheduled scraper
# ============================================================================
# Runs the scraper twice a day (at 08:00 and 18:00 UTC by default).
# Override with SCRAPE_HOURS env var (comma-separated UTC hours, e.g. "12,0").
# Set SCRAPE_ON_STARTUP=1 to run a scrape ~60s after boot so a fresh deploy
# has content without waiting for the next scheduled time.

def run_scrape_sync():
    """Invoke the scraper as a subprocess so it can't crash the web server."""
    print(f"[scrape] starting at {datetime.utcnow().isoformat()}Z")
    try:
        subprocess.run(
            [sys.executable, os.path.join(HERE, "scraper", "scraper.py")],
            check=False,
            timeout=60 * 20,  # 20 min hard cap
        )
        print(f"[scrape] finished at {datetime.utcnow().isoformat()}Z")
    except Exception as e:
        print(f"[scrape] ERROR: {e}")


def _start_scheduler():
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.cron import CronTrigger
    except ImportError:
        print("[scheduler] apscheduler not installed; skipping schedule.")
        return

    scheduler = BackgroundScheduler(timezone="UTC", daemon=True)
    hours_str = os.environ.get("SCRAPE_HOURS", "8,18")
    for h in [h.strip() for h in hours_str.split(",") if h.strip()]:
        try:
            scheduler.add_job(run_scrape_sync, CronTrigger(hour=int(h), minute=0),
                              id=f"scrape-{h}", replace_existing=True)
            print(f"[scheduler] scrape scheduled at {h}:00 UTC daily")
        except ValueError:
            print(f"[scheduler] invalid hour {h!r}, skipping")
    scheduler.start()

    # Optional warm-up scrape so a fresh deploy has content quickly
    if os.environ.get("SCRAPE_ON_STARTUP") == "1":
        threading.Timer(60, run_scrape_sync).start()
        print("[scheduler] warm-up scrape in 60s")


@app.route("/api/scrape", methods=["POST"])
@require_auth
def api_manual_scrape():
    """Manually trigger a scrape (useful from the admin pages)."""
    threading.Thread(target=run_scrape_sync, daemon=True).start()
    return jsonify({"ok": True, "status": "scrape started in background"})


# Kick off the scheduler when the module loads (works under gunicorn/flask run alike)
_start_scheduler()


# ============================================================================
# Main
# ============================================================================

if __name__ == "__main__":
    print(f"QBIO Report server starting on port {PORT}")
    print(f"  /           - Report")
    print(f"  /sources    - Sources admin")
    print(f"  /keywords   - Keywords admin")
    print(f"  DATA_DIR    = {DATA_DIR}")
    app.run(host="0.0.0.0", port=PORT, debug=False)
