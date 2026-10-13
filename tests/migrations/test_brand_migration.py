"""Run with python -m unittest discover -s tests/migrations -v (stdlib only)."""

from pathlib import Path
import sqlite3
import unittest


ROOT = Path(__file__).resolve().parents[2]
MIGRATION = (ROOT / 'migrations/0001_onlyphoto_budget.sql').read_text()


class BrandMigrationTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.addCleanup(self.db.close)
        self.db.executescript((ROOT / 'migrations/0000_nappy_speed_demon.sql').read_text())

    def insert(self, name, used, limit, updated):
        self.db.execute('INSERT INTO live_budget VALUES (?, ?, ?, ?, ?)',
                        (name, name, used, limit, updated))

    def rows(self):
        return self.db.execute('SELECT * FROM live_budget ORDER BY id').fetchall()

    def test_empty_database(self):
        self.db.executescript(MIGRATION)
        self.assertEqual(self.rows(), [])

    def test_preserves_usage_and_is_idempotent(self):
        self.insert('photomaster-dev-run', 7, 12, 100)
        self.db.executescript(MIGRATION)
        self.db.executescript(MIGRATION)
        self.assertEqual(self.rows(), [('onlyphoto-dev-run', 'onlyphoto-dev-run', 7, 12, 100)])

    def test_merges_without_increasing_budget(self):
        self.insert('photomaster-dev-run', 7, 12, 100)
        self.insert('onlyphoto-dev-run', 2, 20, 200)
        self.db.executescript(MIGRATION)
        self.db.executescript(MIGRATION)
        self.assertEqual(self.rows(), [('onlyphoto-dev-run', 'onlyphoto-dev-run', 9, 12, 200)])

    def test_preserves_new_and_unrelated_ledgers(self):
        self.insert('onlyphoto-dev-run', 4, 8, 100)
        self.insert('other-task', 3, 10, 200)
        before = self.rows()
        self.db.executescript(MIGRATION)
        self.assertEqual(self.rows(), before)
