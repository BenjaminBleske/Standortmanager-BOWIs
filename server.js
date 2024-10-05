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


// Ensure the database and table exist, and add 'erstellungszeit' column if necessary
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

  // Prüfe, ob die Spalte 'erstellungszeit' existiert, und füge sie hinzu, falls sie fehlt
  db.all("PRAGMA table_info(locations);", (err, columns) => {
    if (err) {
      console.error("Error checking table structure:", err);
      return;
    }

    // Überprüfe, ob 'columns' tatsächlich ein Array ist
    if (Array.isArray(columns)) {
      const hasErstellungszeit = columns.some(col => col.name === 'erstellungszeit');
      
      if (!hasErstellungszeit) {
        db.run("ALTER TABLE locations ADD COLUMN erstellungszeit TEXT", (err) => {
          if (err) {
            console.error("Fehler beim Hinzufügen der Spalte 'erstellungszeit':", err.message);
          } else {
            console.log("Spalte 'erstellungszeit' erfolgreich hinzugefügt.");
          }
        });
      } else {
        console.log("Spalte 'erstellungszeit' ist bereits vorhanden.");
      }
    } else {
      console.error("Die Abfrage 'PRAGMA table_info' hat keine gültigen Daten zurückgegeben.");
    }
  });
});







// Home route for the app (renders index.hbs)
fastify.get("/", async (request, reply) => {
  return reply.view("/src/pages/index.hbs");
});





// Save location data to the SQLite database
fastify.post("/saveLocation", async (request, reply) => {
  try {
    const { bezirk, x_coord, y_coord, sonstiges, erstellungsdatum } = request.body;
    const erstellungszeit = new Date().toISOString().split('T')[1].split('.')[0]; // Uhrzeit hinzufügen

    console.log("Received data:", { bezirk, x_coord, y_coord, sonstiges, erstellungsdatum, erstellungszeit });

    if (!bezirk || !x_coord || !y_coord || !erstellungsdatum) {
      console.error("Fehlende erforderliche Felder:", { bezirk, x_coord, y_coord, erstellungsdatum });
      return reply.status(400).send({ status: "error", message: "Fehlende erforderliche Felder" });
    }

    // Insert the new location into the database using Promises
    const result = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO locations (bezirk, erstellungsdatum, erstellungszeit, x_coord, y_coord, sonstiges) VALUES (?, ?, ?, ?, ?, ?)`,
        [bezirk, erstellungsdatum, erstellungszeit, x_coord, y_coord, sonstiges || ''],
        function (err) {
          if (err) {
            return reject(err);  // Promise rejected if an error occurs
          }
          resolve(this.lastID); // Resolve with last inserted ID
        }
      );
    });

    console.log("Location successfully saved:", { id: result });
    return reply.code(200).send({ status: "success", message: "Standort erfolgreich gespeichert!", id: result });

  } catch (err) {
    console.error("Fehler beim Speichern des Standorts:", err);
    return reply.code(500).send({ status: "error", message: "Interner Serverfehler beim Speichern des Standorts" });
  }
});










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
fastify.get('/download-csv', async (request, reply) => {
  try {
    // Fetch all locations from the database
    const rows = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM locations', [], (err, rows) => {
        if (err) {
          return reject(err); // Reject if there's an error
        }
        resolve(rows); // Resolve with rows if successful
      });
    });

    if (!rows.length) {
      return reply.status(404).send({ error: 'Keine Daten in der Datenbank vorhanden.' });
    }

    // Convert the rows to CSV format with erstellungszeit
    const csvData = rows.map(row => `${row.id},${row.bezirk},${row.erstellungsdatum},${row.erstellungszeit},${row.x_coord},${row.y_coord},${row.sonstiges}`).join('\n');
    const csvContent = "ID,Bezirk,Erstellungsdatum,Erstellungszeit,x_coord,y_coord,sonstiges\n" + csvData;

    // Set the response type to CSV
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="locations.csv"');
    return reply.send(csvContent); // Send the CSV data

  } catch (err) {
    console.error("Fehler beim Abrufen der CSV-Daten:", err);
    return reply.code(500).send({ status: "error", message: "Fehler beim Erstellen der CSV-Datei" });
  }
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



// Route für die Admin-Seite
fastify.get('/admin', async (request, reply) => {
  const key = request.query.key; // Schlüssel aus der URL-Abfrage entnehmen

  // Überprüfe, ob der Admin-Schlüssel korrekt ist
  if (key !== process.env.ADMIN_KEY) {
    return reply.view('/src/pages/admin.hbs', { error: "Ungültiger Admin-Schlüssel", showPasswordForm: true });
  }

  try {
    // Standort-Daten aus der Datenbank holen
    const logs = await new Promise((resolve, reject) => {
      db.all('SELECT id, bezirk, erstellungsdatum, x_coord, y_coord, sonstiges FROM locations ORDER BY id DESC', (err, rows) => {
        if (err) {
          console.error('Fehler bei der Datenbankabfrage:', err);
          return reject(err);
        }

        console.log('Abgerufene Standort-Daten:', rows);  // Debug-Ausgabe der abgerufenen Daten

        // Datum und Uhrzeit aufteilen
        const formattedRows = rows.map(row => {
          const [date, time] = row.erstellungsdatum.split(' ');  // Datum und Uhrzeit aufteilen
          return {
            ...row,
            date,   // Datum
            time    // Uhrzeit
          };
        });
        resolve(formattedRows);
      });
    });

    if (logs.length > 0) {
      console.log('Logs an Template übergeben:', logs);  // Debug-Ausgabe der an das Template übergebenen Daten
      return reply.view('/src/pages/admin.hbs', { optionHistory: logs });
    } else {
      return reply.view('/src/pages/admin.hbs', { error: "Keine Standorte gefunden!" });
    }
  } catch (error) {
    console.error('Fehler beim Abrufen der Standorte:', error);
    return reply.code(500).send({ error: 'Fehler beim Abrufen der Standorte' });
  }
});






// Route zum Löschen von Standorten
fastify.post('/admin/delete', async (request, reply) => {
  const { id, key } = request.body;  // ID des Standorts und Schlüssel aus dem Formular

  // Überprüfe den Admin-Schlüssel
  if (key !== process.env.ADMIN_KEY) {
    return reply.view('/src/pages/admin.hbs', { error: "Ungültiger Admin-Schlüssel", showPasswordForm: true });
  }
  
  

  // Lösche den Standort aus der Datenbank
  try {
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM locations WHERE id = ?', [id], (err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });

    return reply.redirect('/admin?key=' + key);  // Admin-Seite nach Löschen neu laden
  } catch (error) {
    console.error('Fehler beim Löschen des Standorts:', error);
    return reply.code(500).send({ error: 'Fehler beim Löschen des Standorts' });
  }
});

