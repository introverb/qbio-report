"""
QUBIE News — SQLite database layer
==================================
Single file (`qubie.db`) on the persistent volume. Holds:

  users   - signup-created accounts; one is the bootstrap admin
  saves   - per-user article bookmarks; the article snapshot is stored
            inline so saves survive feed.json regeneration

The DB is created on first import. All queries go through this module so
server.py stays focused on routing.
"""
import os
import sqlite3
import secrets
from contextlib import contextmanager
from datetime import datetime, timedelta

import bcrypt

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
HERE     = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.environ.get("DATA_DIR") or HERE
DB_PATH  = os.path.join(DATA_DIR, "qubie.db")

# Bootstrap: the first user to sign up matching this username is auto-promoted
# to admin. Set as Railway env var BOOTSTRAP_ADMIN_USERNAME.
BOOTSTRAP_ADMIN_USERNAME = (os.environ.get("BOOTSTRAP_ADMIN_USERNAME") or "").strip().lower()


SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT    NOT NULL,
    bio           TEXT    NOT NULL DEFAULT '',
    avatar_url    TEXT    NOT NULL DEFAULT '',
    is_admin      INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS saves (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER NOT NULL,
    article_link     TEXT    NOT NULL,
    article_title    TEXT    NOT NULL,
    article_source   TEXT    NOT NULL DEFAULT '',
    article_category TEXT    NOT NULL DEFAULT '',
    article_summary  TEXT    NOT NULL DEFAULT '',
    article_blurb    TEXT    NOT NULL DEFAULT '',
    article_date_iso TEXT    NOT NULL DEFAULT '',
    saved_at         TEXT    NOT NULL,
    UNIQUE(user_id, article_link),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_saves_link     ON saves(article_link);
CREATE INDEX IF NOT EXISTS idx_saves_user     ON saves(user_id);
CREATE INDEX IF NOT EXISTS idx_saves_saved_at ON saves(saved_at DESC);
"""


def init_db():
    """Create tables if they don't exist. Safe to call repeatedly."""
    os.makedirs(DATA_DIR, exist_ok=True)
    with connect() as conn:
        conn.executescript(SCHEMA)
        conn.commit()


@contextmanager
def connect():
    """Context-managed sqlite3 connection. Returns a Connection with row_factory."""
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    try:
        yield conn
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Password helpers
# ---------------------------------------------------------------------------
def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# ---------------------------------------------------------------------------
# Username validation
# ---------------------------------------------------------------------------
import re as _re
_USERNAME_RE = _re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{1,23}$")
RESERVED_USERNAMES = {"admin", "api", "auth", "login", "logout", "signup",
                      "me", "u", "user", "users", "report", "chatter",
                      "video", "suggest", "library", "saves", "saved",
                      "static", "assets", "feed", "sources", "keywords",
                      "anonymous", "qubie", "qbio"}


def validate_username(username: str) -> str:
    """Return error string if invalid, '' if OK."""
    if not username:
        return "Username is required."
    if not _USERNAME_RE.match(username):
        return ("Username must be 2-24 chars, start with a letter or number, "
                "and contain only letters, numbers, '_' or '-'.")
    if username.lower() in RESERVED_USERNAMES:
        return "That username is reserved. Pick something else."
    return ""


def validate_password(password: str) -> str:
    if not password:
        return "Password is required."
    if len(password) < 8:
        return "Password must be at least 8 characters."
    return ""


# ---------------------------------------------------------------------------
# User CRUD
# ---------------------------------------------------------------------------
def create_user(username: str, password: str) -> dict:
    """Create a new user. Auto-promotes to admin if username matches the
    BOOTSTRAP_ADMIN_USERNAME env var. Raises ValueError on duplicate username."""
    is_admin = 1 if (BOOTSTRAP_ADMIN_USERNAME and
                     username.lower() == BOOTSTRAP_ADMIN_USERNAME) else 0
    now = datetime.utcnow().isoformat(timespec="seconds")
    pw_hash = hash_password(password)
    with connect() as conn:
        try:
            cur = conn.execute(
                "INSERT INTO users (username, password_hash, is_admin, created_at) "
                "VALUES (?, ?, ?, ?)",
                (username, pw_hash, is_admin, now),
            )
            conn.commit()
            return get_user_by_id(cur.lastrowid)
        except sqlite3.IntegrityError:
            raise ValueError("Username is already taken.")


def get_user_by_username(username: str) -> dict | None:
    with connect() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE username = ? COLLATE NOCASE",
            (username,)
        ).fetchone()
        return _row_to_user(row) if row else None


def get_user_by_id(user_id: int) -> dict | None:
    with connect() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        return _row_to_user(row) if row else None


def authenticate(username: str, password: str) -> dict | None:
    """Return user dict if password matches, None otherwise."""
    user_full = _get_user_with_hash(username)
    if not user_full:
        return None
    if not verify_password(password, user_full["password_hash"]):
        return None
    # Strip the hash before returning
    user = dict(user_full)
    user.pop("password_hash", None)
    return user


def _get_user_with_hash(username: str) -> dict | None:
    with connect() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE username = ? COLLATE NOCASE",
            (username,)
        ).fetchone()
        return dict(row) if row else None


def update_profile(user_id: int, bio: str = None, avatar_url: str = None):
    """Update profile fields. Pass None to skip a field."""
    fields, values = [], []
    if bio is not None:
        fields.append("bio = ?")
        values.append(bio)
    if avatar_url is not None:
        fields.append("avatar_url = ?")
        values.append(avatar_url)
    if not fields:
        return
    values.append(user_id)
    with connect() as conn:
        conn.execute(f"UPDATE users SET {', '.join(fields)} WHERE id = ?", values)
        conn.commit()


def _row_to_user(row) -> dict:
    """Public user dict — never includes password_hash."""
    return {
        "id":         row["id"],
        "username":   row["username"],
        "bio":        row["bio"],
        "avatar_url": row["avatar_url"],
        "is_admin":   bool(row["is_admin"]),
        "created_at": row["created_at"],
    }


# ---------------------------------------------------------------------------
# Saves CRUD
# ---------------------------------------------------------------------------
def add_save(user_id: int, article: dict) -> int:
    """Save an article for a user. Returns save id. No-op (returns existing id)
    if this user has already saved this article (matched by link)."""
    now = datetime.utcnow().isoformat(timespec="seconds")
    with connect() as conn:
        try:
            cur = conn.execute(
                "INSERT INTO saves (user_id, article_link, article_title, "
                "  article_source, article_category, article_summary, "
                "  article_blurb, article_date_iso, saved_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (user_id,
                 article.get("link") or "",
                 article.get("title") or "",
                 article.get("source") or "",
                 article.get("source_category") or "",
                 article.get("summary") or "",
                 article.get("blurb") or "",
                 article.get("date_iso") or "",
                 now),
            )
            conn.commit()
            return cur.lastrowid
        except sqlite3.IntegrityError:
            # Already saved — return the existing id
            row = conn.execute(
                "SELECT id FROM saves WHERE user_id = ? AND article_link = ?",
                (user_id, article.get("link") or "")
            ).fetchone()
            return row["id"] if row else 0


def remove_save(user_id: int, article_link: str) -> bool:
    """Unsave by article link. Returns True if a row was removed."""
    with connect() as conn:
        cur = conn.execute(
            "DELETE FROM saves WHERE user_id = ? AND article_link = ?",
            (user_id, article_link)
        )
        conn.commit()
        return cur.rowcount > 0


def list_user_saves(user_id: int, limit: int = 500) -> list[dict]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM saves WHERE user_id = ? "
            "ORDER BY saved_at DESC LIMIT ?",
            (user_id, limit)
        ).fetchall()
        return [_row_to_save(r) for r in rows]


def list_user_saved_links(user_id: int) -> set[str]:
    """Just the set of links a user has saved — for fast 'is this saved?' checks."""
    with connect() as conn:
        rows = conn.execute(
            "SELECT article_link FROM saves WHERE user_id = ?", (user_id,)
        ).fetchall()
        return {r["article_link"] for r in rows}


def most_saved(window_days: int = 30, limit: int = 10) -> list[dict]:
    """Return articles ranked by number of saves in the last N days. Each
    entry includes the latest saver's username + total save count."""
    cutoff = (datetime.utcnow() - timedelta(days=window_days)).isoformat(timespec="seconds")
    with connect() as conn:
        rows = conn.execute("""
            SELECT
                s.article_link,
                s.article_title,
                s.article_source,
                s.article_category,
                s.article_summary,
                s.article_blurb,
                s.article_date_iso,
                COUNT(*)        AS save_count,
                MAX(s.saved_at) AS latest_save_at
            FROM saves s
            WHERE s.saved_at >= ?
            GROUP BY s.article_link
            ORDER BY save_count DESC, latest_save_at DESC
            LIMIT ?
        """, (cutoff, limit)).fetchall()

        results = []
        for r in rows:
            # Find the latest saver's username
            latest = conn.execute("""
                SELECT u.username
                FROM saves s
                JOIN users u ON u.id = s.user_id
                WHERE s.article_link = ?
                ORDER BY s.saved_at DESC
                LIMIT 1
            """, (r["article_link"],)).fetchone()
            results.append({
                "link":            r["article_link"],
                "title":           r["article_title"],
                "source":          r["article_source"],
                "source_category": r["article_category"],
                "summary":         r["article_summary"],
                "blurb":           r["article_blurb"],
                "date_iso":        r["article_date_iso"],
                "save_count":      r["save_count"],
                "latest_saver":    latest["username"] if latest else "",
            })
        return results


def _row_to_save(row) -> dict:
    return {
        "id":              row["id"],
        "link":            row["article_link"],
        "title":           row["article_title"],
        "source":          row["article_source"],
        "source_category": row["article_category"],
        "summary":         row["article_summary"],
        "blurb":           row["article_blurb"],
        "date_iso":        row["article_date_iso"],
        "saved_at":        row["saved_at"],
    }
