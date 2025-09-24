// config/db.js
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const dbPath = path.join(__dirname, "..", "data.sqlite");
const db = new sqlite3.Database(dbPath);

// Skapa tabellen om den inte finns
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      swimming TEXT NOT NULL,
      experience TEXT NOT NULL,
      rescue TEXT NOT NULL,
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // --- Migration: lägg till status-kolumn om den saknas ---
  db.all("PRAGMA table_info(applications);", (err, cols) => {
    if (err) return console.error("PRAGMA error:", err);
    const hasStatus = Array.isArray(cols) && cols.some(c => c.name === "status");
    if (!hasStatus) {
      db.serialize(() => {
        db.run("ALTER TABLE applications ADD COLUMN status TEXT", (e) => {
          if (e) return console.error("ALTER TABLE error:", e);
          db.run("UPDATE applications SET status = 'Ny' WHERE status IS NULL");
        });
      });
    }
  });
});

module.exports = db;
