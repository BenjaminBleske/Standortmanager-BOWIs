// Utilities we need
const sqlite3 = require("sqlite3").verbose();
const dbFile = "./locations.db"; // Path to the database file
const db = new sqlite3.Database(dbFile);


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




// Export the database methods as needed
module.exports = {
  saveLocation: async (locationData) => {
    try {
      return await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO locations (bezirk, erstellungsdatum, erstellungszeit, x_coord, y_coord, sonstiges) VALUES (?, ?, ?, ?, ?, ?)`,
          [locationData.bezirk, locationData.erstellungsdatum, locationData.erstellungszeit, locationData.x_coord, locationData.y_coord, locationData.sonstiges],
          function (err) {
            if (err) {
              reject(err);
            } else {
              resolve({ id: this.lastID });
            }
          }
        );
      });
    } catch (dbError) {
      console.error(dbError);
    }
  },

  getLastLocations: async () => {
    try {
      return await new Promise((resolve, reject) => {
        db.all("SELECT * FROM locations ORDER BY id DESC LIMIT 5", [], (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        });
      });
    } catch (dbError) {
      console.error(dbError);
    }
  },

  getAllLocations: async () => {
    try {
      return await new Promise((resolve, reject) => {
        db.all("SELECT * FROM locations", [], (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        });
      });
    } catch (dbError) {
      console.error(dbError);
    }
  },
};
