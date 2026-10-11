from __future__ import annotations

import sqlite3
import threading
from pathlib import Path

from .config import ROOT, settings

MIGRATIONS_DIR = ROOT / "migrations"
_local = threading.local()


def database_path() -> Path:
    raw = settings.database_url
    if raw.startswith("file:"):
        raw = raw[len("file:") :]
    path = Path(raw)
    if not path.is_absolute():
        path = ROOT / raw
    return path


def upload_dir() -> Path:
    path = Path(settings.upload_dir)
    if not path.is_absolute():
        path = ROOT / settings.upload_dir
    path.mkdir(parents=True, exist_ok=True)
    return path


def _configure(conn: sqlite3.Connection) -> None:
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 5000")


def connect() -> sqlite3.Connection:
    path = database_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, check_same_thread=False)
    _configure(conn)
    return conn


def get_conn() -> sqlite3.Connection:
    """Thread-local connection (route handlers run in a thread pool)."""
    conn = getattr(_local, "conn", None)
    if conn is None:
        conn = connect()
        _local.conn = conn
    return conn


def query_all(sql: str, params: tuple | list = ()) -> list[sqlite3.Row]:
    return get_conn().execute(sql, params).fetchall()


def query_one(sql: str, params: tuple | list = ()) -> sqlite3.Row | None:
    return get_conn().execute(sql, params).fetchone()


def execute(sql: str, params: tuple | list = ()) -> sqlite3.Cursor:
    conn = get_conn()
    cur = conn.execute(sql, params)
    conn.commit()
    return cur


def executescript(script: str) -> None:
    conn = get_conn()
    conn.executescript(script)
    conn.commit()


# Columns added after the initial schema. SQLite has no "ADD COLUMN IF NOT EXISTS",
# so they are ensured explicitly. Keep this in sync with migrations/*.sql.
_EXPECTED_COLUMNS: dict[str, list[tuple[str, str]]] = {
    "comments": [("parent_id", "text")],
}


def _ensure_columns(conn: sqlite3.Connection) -> None:
    for table, columns in _EXPECTED_COLUMNS.items():
        existing = {row[1] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}
        if not existing:
            continue  # table not created yet; the migration will create it
        for name, decl in columns:
            if name not in existing:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN {name} {decl}")
        conn.commit()


def run_migrations() -> None:
    """Apply every migrations/*.sql in order, recording applied files.

    All DDL is idempotent (IF NOT EXISTS), so an existing database created by the
    reference (Node/Drizzle) implementation is left intact.
    """
    conn = connect()
    try:
        conn.execute(
            "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at integer NOT NULL)"
        )
        conn.commit()
        applied = {row[0] for row in conn.execute("SELECT name FROM schema_migrations").fetchall()}
        for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
            if path.name in applied:
                continue
            conn.executescript(path.read_text(encoding="utf-8"))
            conn.execute(
                "INSERT OR REPLACE INTO schema_migrations (name, applied_at) VALUES (?, ?)",
                (path.name, _now_ms()),
            )
            conn.commit()
        _ensure_columns(conn)
    finally:
        conn.close()


def _now_ms() -> int:
    import time

    return int(time.time() * 1000)