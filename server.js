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
  reply.view("/src/pages/index.hbs");
});

// Save location data to the SQLite database
fastify.post("/saveLocation", async (request, reply) => {
  const { bezirk, x_coord, y_coord, sonstiges, erstellungsdatum } = request.body;

  // Insert the new location into the database
  db.run(
    `INSERT INTO locations (bezirk, erstellungsdatum, x_coord, y_coord, sonstiges) VALUES (?, ?, ?, ?, ?)`,
    [bezirk, erstellungsdatum, x_coord, y_coord, sonstiges],
    function (err) {
      if (err) {
        reply.send({ status: "error", message: "Fehler beim Speichern des Standorts" });
        return console.error(err.message);
      }
      reply.send({ status: "success", message: "Standort erfolgreich gespeichert!" });
    }
  );
});

// Route to fetch the last 5 locations from the database
fastify.get("/last-locations", (req, res) => {
  db.all(`SELECT * FROM locations ORDER BY id DESC LIMIT 5`, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: 'Fehler beim Abrufen der Standorte' });
      return;
    }
    res.json(rows);
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

// Run the server and report out to the logs
fastify.listen({ port: process.env.PORT || 3000, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Your app is listening on ${address}`);
});
