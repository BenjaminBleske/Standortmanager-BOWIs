const fs = require("fs");
const path = require("path");
const fastify = require("fastify")({ logger: true });
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./locations.db");

fastify.register(require("@fastify/static"), {
  root: path.join(__dirname, "public"),
  prefix: "/",
});

fastify.register(require("@fastify/formbody"));
fastify.register(require("@fastify/view"), {
  engine: {
    handlebars: require("handlebars"),
  },
});

// Ensure the database and table exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bezirk TEXT,
      erstellungsdatum TEXT,
      erstellungszeit TEXT,
      x_coord REAL,
      y_coord REAL,
      sonstiges TEXT
    )
  `);
});

// Home route (renders index.hbs)
fastify.get("/", async (request, reply) => {
  return reply.view("/src/pages/index.hbs");
});

// Save location to the database
fastify.post("/saveLocation", async (request, reply) => {
  try {
    const { bezirk, x_coord, y_coord, sonstiges, erstellungsdatum } = request.body;
    const erstellungszeit = new Date().toISOString().split('T')[1].split('.')[0];

    if (!bezirk || !x_coord || !y_coord || !erstellungsdatum) {
      return reply.status(400).send({ status: "error", message: "Fehlende erforderliche Felder" });
    }

    const result = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO locations (bezirk, erstellungsdatum, erstellungszeit, x_coord, y_coord, sonstiges) VALUES (?, ?, ?, ?, ?, ?)`,
        [bezirk, erstellungsdatum, erstellungszeit, x_coord, y_coord, sonstiges || ''],
        function (err) {
          if (err) reject(err);
          resolve(this.lastID);
        }
      );
    });

    return reply.code(200).send({ status: "success", message: "Standort erfolgreich gespeichert!", id: result });
  } catch (err) {
    return reply.code(500).send({ status: "error", message: "Interner Serverfehler" });
  }
});

// Fetch the last 5 locations
fastify.get("/last-locations", (req, reply) => {
  db.all("SELECT * FROM locations ORDER BY id DESC LIMIT 5", [], (err, rows) => {
    if (err) {
      return reply.code(500).send({ error: "Fehler beim Abrufen der Standorte" });
    }
    return reply.send(rows);
  });
});

// Download all locations as CSV
fastify.get("/download-csv", async (request, reply) => {
  try {
    const rows = await new Promise((resolve, reject) => {
      db.all("SELECT * FROM locations", [], (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      });
    });

    if (!rows.length) {
      return reply.status(404).send({ error: "Keine Daten in der Datenbank vorhanden" });
    }

    const csvData = rows.map(row => `${row.id},${row.bezirk},${row.erstellungsdatum},${row.erstellungszeit},${row.x_coord},${row.y_coord},${row.sonstiges}`).join('\n');
    const csvContent = "ID,Bezirk,Erstellungsdatum,Erstellungszeit,x_coord,y_coord,sonstiges\n" + csvData;

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="locations.csv"');
    return reply.send(csvContent);
  } catch (err) {
    return reply.code(500).send({ status: "error", message: "Fehler beim Erstellen der CSV-Datei" });
  }
});

// Admin page with password authentication
fastify.get("/admin", async (request, reply) => {
  const key = request.query.key || ""; // Admin-Schlüssel aus der URL (falls vorhanden)

  if (key !== process.env.ADMIN_KEY) {
    return reply.view("/src/pages/admin.hbs", { error: "Ungültiger Admin-Schlüssel", showPasswordForm: true });
  }

  try {
    const logs = await new Promise((resolve, reject) => {
      db.all("SELECT * FROM locations ORDER BY id DESC", [], (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      });
    });

    return reply.view("/src/pages/admin.hbs", { optionHistory: logs });
  } catch (error) {
    return reply.code(500).send({ error: "Fehler beim Abrufen der Standorte" });
  }
});

// Admin login route
fastify.post("/admin/login", async (request, reply) => {
  const { key } = request.body;

  if (key !== process.env.ADMIN_KEY) {
    return reply.view("/src/pages/admin.hbs", { error: "Ungültiger Admin-Schlüssel", showPasswordForm: true });
  }

  try {
    const logs = await new Promise((resolve, reject) => {
      db.all("SELECT * FROM locations ORDER BY id DESC", [], (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      });
    });

    return reply.view("/src/pages/admin.hbs", { optionHistory: logs });
  } catch (error) {
    return reply.code(500).send({ error: "Fehler beim Abrufen der Standorte" });
  }
});

// Delete location
fastify.post("/admin/delete", async (request, reply) => {
  const { id, key } = request.body;

  if (key !== process.env.ADMIN_KEY) {
    return reply.view("/src/pages/admin.hbs", { error: "Ungültiger Admin-Schlüssel", showPasswordForm: true });
  }

  try {
    await new Promise((resolve, reject) => {
      db.run("DELETE FROM locations WHERE id = ?", [id], (err) => {
        if (err) reject(err);
        resolve();
      });
    });

    return reply.redirect("/admin?key=" + key);
  } catch (error) {
    return reply.code(500).send({ error: "Fehler beim Löschen des Standorts" });
  }
});

// Run the server
fastify.listen({ port: process.env.PORT || 3000, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server läuft auf ${address}`);
});
