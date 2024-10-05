// Utilities we need
const fs = require("fs");
const path = require("path");

// Require the fastify framework and instantiate it
const fastify = require("fastify")({
  logger: true, // Set this to true for detailed logging
});

// Import SQLite3
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./locations.db');

// Setup our static files
fastify.register(require("@fastify/static"), {
  root: path.join(__dirname, "public"),
  prefix: "/", // optional: default '/'
});

// Formbody lets us parse incoming forms
fastify.register(require("@fastify/formbody"));

// View is a templating manager for fastify
fastify.register(require("@fastify/view"), {
  engine: {
    handlebars: require("handlebars"),
  },
});

// Create the database table if it doesn't exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bezirk TEXT,
      erstellungsdatum TEXT,
      x_coord REAL,
      y_coord REAL,
      sonstiges TEXT
    )
  `);
});

// Home route for the app (renders index.hbs)
fastify.get("/", async (request, reply) => {
  return reply.view("/src/pages/index.hbs");
});



// Save location data to the SQLite database
// Save location data to the SQLite database
fastify.post("/saveLocation", async (request, reply) => {
  try {
    const { bezirk, x_coord, y_coord, sonstiges, erstellungsdatum } = request.body;

    // Logging the request body to debug input data
    console.log("Received data:", { bezirk, x_coord, y_coord, sonstiges, erstellungsdatum });

    // Basic validation to ensure required fields are provided
    if (!bezirk || !x_coord || !y_coord || !erstellungsdatum) {
      console.error("Fehlende erforderliche Felder:", { bezirk, x_coord, y_coord, erstellungsdatum });
      return reply.status(400).send({ status: "error", message: "Fehlende erforderliche Felder" });
    }

    // Insert the new location into the database
    db.run(
      `INSERT INTO locations (bezirk, erstellungsdatum, x_coord, y_coord, sonstiges) VALUES (?, ?, ?, ?, ?)`,
      [bezirk, erstellungsdatum, x_coord, y_coord, sonstiges || ''],
      function (err) {
        if (err) {
          console.error("Fehler beim Speichern des Standorts:", err.message);
          return reply.code(500).send({ status: "error", message: "Fehler beim Speichern des Standorts" });
        }
        // Send success response with the inserted location ID
        console.log("Location successfully saved:", { id: this.lastID });
        return reply.code(200).send({ status: "success", message: "Standort erfolgreich gespeichert!" });
      }
    );
  } catch (err) {
    console.error("Fehler beim Speichern des Standorts:", err);
    return reply.code(500).send({ status: "error", message: "Interner Serverfehler beim Speichern des Standorts" });
  }
});



// Route to fetch the last 5 locations from the database
// Route to fetch the last 5 locations from the database
fastify.get("/last-locations", (req, reply) => {
  db.all(`SELECT * FROM locations ORDER BY id DESC LIMIT 5`, [], (err, rows) => {
    if (err) {
      return reply.code(500).send({ error: 'Fehler beim Abrufen der Standorte' });
    }
    return reply.send(rows); // Korrekt in Fastify
  });
});


// Route to download all locations as a CSV file
fastify.get('/download-csv', (req, res) => {
  db.all('SELECT * FROM locations', [], (err, rows) => {
    if (err) {
      res.status(500).send('Fehler beim Abrufen der Daten.');
      return;
    }

    const csvData = rows.map(row => `${row.id},${row.bezirk},${row.erstellungsdatum},${row.x_coord},${row.y_coord},${row.sonstiges}`).join('\n');
    const csvContent = "ID,Bezirk,Erstellungsdatum,x_coord,y_coord,sonstiges\n" + csvData;

    fs.writeFileSync('./public/locations.csv', csvContent);
    res.download('./public/locations.csv');
  });
});

// Route to clear all location logs with admin key authentication
fastify.post("/reset", async (request, reply) => {
  const { key } = request.body;

  // Validate Admin Key (from environment variables)
  if (!key || key !== process.env.ADMIN_KEY) {
    return reply.status(401).view("/src/pages/admin.hbs", { failed: "Ungültiger Admin-Schlüssel!" });
  }

  // If Admin Key is valid, clear the locations table
  try {
    await new Promise((resolve, reject) => {
      db.run("DELETE FROM locations", (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
    return reply.view("/src/pages/admin.hbs", { success: "Standort-Logs erfolgreich gelöscht!" });

  } catch (err) {
    console.error("Fehler beim Löschen der Standort-Logs:", err);
    return reply.status(500).view("/src/pages/admin.hbs", { error: "Fehler beim Löschen der Standort-Logs" });
  }
});

// Run the server and report out to the logs
fastify.listen({ port: process.env.PORT || 3000, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Your app is listening on ${address}`);
});
