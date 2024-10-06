const fs = require("fs");
const path = require("path");
const fastify = require("fastify")({ logger: true });
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./locations.db");
const fetch = require('node-fetch');


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

// Prüfen und Hinzufügen der Spalte 'adresse'
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bezirk TEXT,
      erstellungsdatum TEXT,
      erstellungszeit TEXT,
      x_coord REAL,
      y_coord REAL,
      sonstiges TEXT,
      adresse TEXT,
      hausnummer TEXT,
      strasse TEXT,
      bezirk_spez TEXT,
      ort TEXT,
      bundesland TEXT,
      plz TEXT,
      land TEXT
    )
  `, (err) => {
    if (err) {
      console.error('Fehler beim Erstellen der Tabelle:', err);
    } else {
      console.log('Tabelle erstellt oder existiert bereits.');
    }
  });
});


// Funktion zur Adressabfrage mit OpenStreetMap API
async function fetchAddress(lat, lon) {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`, {
      headers: {
        'User-Agent': 'YourAppName/1.0 (your.email@example.com)' // Füge hier deinen User-Agent hinzu
      }
    });
    if (!response.ok) {
      throw new Error(`OSM API Error: ${response.statusText}`);
    }
    const data = await response.json();
    return data.display_name || 'Adresse nicht gefunden';
  } catch (error) {
    console.error("Fehler bei der Adressabfrage:", error);
    return 'Adresse nicht gefunden';
  }
}






// Home route (renders index.hbs)
fastify.get("/", async (request, reply) => {
  return reply.view("/src/pages/index.hbs");
});


// Save location to the database including the specific parts of the address
// Save location to the database including the specific parts of the address
fastify.post("/saveLocation", async (request, reply) => {
  try {
    const { bezirk, x_coord, y_coord, sonstiges, erstellungsdatum } = request.body;

    // Zeit um 2 Stunden vorverlegen (UTC+2)
    const erstellungszeit = new Date(new Date().getTime() + 2 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[1]
      .split(".")[0];

    if (!bezirk || !x_coord || !y_coord || !erstellungsdatum) {
      return reply
        .status(400)
        .send({ status: "error", message: "Fehlende erforderliche Felder" });
    }

    // Adresse von OpenStreetMap API abrufen und zerlegen
    const adresse = await fetchAddress(y_coord, x_coord); // Holt die gesamte Adresse von OSM

    // Zerlegen der Adresse in spezifische Teile
    const addressParts = adresse.split(','); // Zerlegt den Adress-String in Teile
    const hausnummer = addressParts[0] || ''; // Hausnummer
    const strasse = addressParts[1] || ''; // Straße
    const bezirk_spez = addressParts[2] || ''; // Spezifischer Bezirk
    const ort = addressParts[3] || ''; // Ort
    const bundesland = addressParts[4] || ''; // Bundesland
    const plz = addressParts[5] || ''; // Postleitzahl
    const land = addressParts[6] || ''; // Land

    // Standort in die Datenbank einfügen, speichere die separaten Adressteile
    const result = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO locations 
        (bezirk, erstellungsdatum, erstellungszeit, x_coord, y_coord, sonstiges, adresse, hausnummer, strasse, bezirk_spez, ort, bundesland, plz, land) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          bezirk, 
          erstellungsdatum, 
          erstellungszeit, 
          x_coord, 
          y_coord, 
          sonstiges || '', 
          adresse, 
          hausnummer, 
          strasse, 
          bezirk_spez, 
          ort, 
          bundesland, 
          plz, 
          land
        ],
        function (err) {
          if (err) reject(err);
          resolve(this.lastID);
        }
      );
    });

    return reply
      .code(200)
      .send({ status: "success", message: "Standort erfolgreich gespeichert!", id: result });
  } catch (err) {
    console.error("Fehler in /saveLocation:", err);
    return reply
      .code(500)
      .send({ status: "error", message: "Interner Serverfehler" });
  }
});










// Fetch the last 5 locations including the address
fastify.get("/last-locations", (req, reply) => {
  db.all("SELECT * FROM locations ORDER BY id DESC LIMIT 5", [], (err, rows) => {
    if (err) {
      return reply.code(500).send({ error: "Fehler beim Abrufen der Standorte" });
    }
    return reply.send(rows);  // Adresse ist jetzt auch in den Ergebnissen
  });
});




// Route to download all locations as a CSV file including the address
fastify.get('/download-csv', async (request, reply) => {
  try {
    const rows = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM locations', [], (err, rows) => {
        if (err) {
          return reject(err);
        }
        resolve(rows);
      });
    });

    if (!rows.length) {
      return reply.status(404).send({ error: 'Keine Daten in der Datenbank vorhanden.' });
    }

    const csvData = rows.map(row => 
      `${row.id},${row.bezirk},${row.erstellungsdatum},${row.erstellungszeit},${row.x_coord},${row.y_coord},${row.sonstiges || ''},${row.hausnummer || ''},${row.strasse || ''},${row.bezirk_spez || ''},${row.ort || ''},${row.bundesland || ''},${row.plz || ''},${row.land || ''}`
    ).join('\n');

    const csvContent = "id,bezirk,erstellungsdatum,erstellungszeit,x_coord,y_coord,sonstiges,hausnummer,strasse,bezirk_spez,ort,bundesland,plz,land\n" + csvData;

    // Hole das aktuelle Datum und Uhrzeit und stelle sicher, dass es die deutsche Zeit ist
    const now = new Date();
    
    // Deutsche Zeitzone (Berlin) manuell anwenden
    const offset = now.getTimezoneOffset(); // Zeitversatz von UTC in Minuten
    const germanTime = new Date(now.getTime() + (120 * 60 * 1000)); // Offset um 2 Stunden (in Millisekunden)
    
    const date = germanTime.toISOString().split('T')[0];
    const time = germanTime.toTimeString().split(' ')[0].replace(/:/g, '-');

    const filename = `${date}_Sicherungskopie_${time}.csv`;

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
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
