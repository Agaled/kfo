// db.js
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const dbPath = path.join(__dirname, "..", "data.sqlite");
const db = new sqlite3.Database(dbPath);

// ========================
//  SKAPA TABELLER
// ========================
db.serialize(() => {
  // --- HUVUDTABELL: Ansökningar ---
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'Ny'
    )
  `);

  // --- Migration: lägg till status om saknas ---
  db.all("PRAGMA table_info(applications);", (err, cols) => {
    if (err) return console.error("PRAGMA error:", err);

    const hasStatus = Array.isArray(cols) && cols.some(c => c.name === "status");

    if (!hasStatus) {
      db.run("ALTER TABLE applications ADD COLUMN status TEXT", (e) => {
        if (e) return console.error("ALTER TABLE error:", e);
        db.run("UPDATE applications SET status = 'Ny' WHERE status IS NULL");
      });
    }
  });

  // --- NY TABELL: Loggning av admin-åtgärder ---
  db.run(`
    CREATE TABLE IF NOT EXISTS admin_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      actor TEXT,
      action TEXT NOT NULL,
      application_id INTEGER,
      details TEXT
    )
  `);
});

// ========================
//  FUNKTION: logAdminAction
// ========================
function logAdminAction({ actor, action, applicationId, details }) {
  db.run(
    `INSERT INTO admin_logs (actor, action, application_id, details)
     VALUES (?, ?, ?, ?)`,
    [
      actor || null,
      action,
      applicationId || null,
      details ? JSON.stringify(details) : null
    ],
    (err) => {
      if (err) {
        console.error("Kunde inte spara admin-logg:", err);
      }
    }
  );
}

// ========================
//  EXPORT
// ========================
module.exports = {
  db,
  logAdminAction
};
