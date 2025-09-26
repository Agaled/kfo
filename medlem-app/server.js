// --- Imports & konfiguration ---
require("dotenv").config();                // .env-support
const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const db = require("./config/db");         // SQLite-koppling (config/db.js)

const app = express();
const PORT = 3000; // kör lokalt på port 3000

// --- Middleware ---
app.use(cors());
//app.options("*", cors());                  // preflight för PATCH m.m.
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Servera statiska filer från /public
app.use(express.static(path.join(__dirname, "public")));

// Root -> index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Liten test-route
app.get("/api/hello", (req, res) => {
  res.json({ message: "Servern funkar! 🚀" });
});

// ====== FORM: spara ansökan ======
app.post("/api/apply", (req, res) => {
  const { name, email, phone, address, swimming, experience, rescue, message } = req.body;

  // Grundläggande validering
  if (!name || !email || !swimming || !experience || !rescue) {
    return res.status(400).json({ error: "Obligatoriska fält saknas." });
  }

  const sql = `
    INSERT INTO applications (name, email, phone, address, swimming, experience, rescue, message, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Ny')
  `;

  db.run(
    sql,
    [name, email, phone || "", address || "", swimming, experience, rescue, message || ""],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Kunde inte spara ansökan." });
      }
      res.json({ ok: true, id: this.lastID });
    }
  );
});

// ====== ADMIN: login (JWT) ======
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
    const token = jwt.sign({ role: "admin" }, process.env.JWT_SECRET, { expiresIn: "8h" });
    return res.json({ token });
  }
  res.status(401).json({ error: "Fel inloggning." });
});

// --- Auth-middleware för skyddade endpoints ---
function auth(req, res, next) {
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Saknar token." });
  try {
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Ogiltig eller utgången token." });
  }
}

// ====== ADMIN: lista ansökningar (skyddad) ======
app.get("/api/applications", auth, (req, res) => {
  db.all(`SELECT * FROM applications ORDER BY created_at DESC`, [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Kunde inte hämta data." });
    }
    res.json(rows);
  });
});

// ====== ADMIN: uppdatera status på en ansökan (skyddad) ======
app.patch("/api/applications/:id/status", auth, (req, res) => {
  const idNum = Number(req.params.id);
  const status = String((req.body?.status ?? "")).trim();

  console.log("[PATCH] /api/applications/%s/status -> %s", idNum, status);

  if (!Number.isInteger(idNum) || idNum <= 0) {
    return res.status(400).json({ error: "Ogiltigt id." });
  }

  const allowed = ["Ny", "Under behandling", "Godkänd", "Avslagen"];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: "Ogiltig status." });
  }

  const sql = "UPDATE applications SET status = ? WHERE id = ?";
  db.run(sql, [status, idNum], function (err) {
    if (err) {
      console.error("SQLite error:", err);
      return res.status(500).json({ error: "Kunde inte uppdatera status." });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: "Hittade ingen ansökan med det ID:t." });
    }
    res.json({ ok: true, id: idNum, status });
  });
});

// --- Starta servern ---
app.listen(PORT, () => {
  console.log(`Server kör på http://localhost:${PORT}`);
});
