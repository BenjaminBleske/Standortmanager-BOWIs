const sqlite3 = require("sqlite3").verbose();
const dbFile = "./locations.db"; // Path to the database file
const db = new sqlite3.Database(dbFile);
const fetch = require('node-fetch');

// Sicherstellen, dass die Tabelle mit allen erforderlichen Spalten existiert
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

  // Überprüfen, ob alle Spalten vorhanden sind (falls noch nicht hinzugefügt)
  const columnsToCheck = ['hausnummer', 'strasse', 'bezirk_spez', 'ort', 'bundesland', 'plz', 'land'];
  db.all("PRAGMA table_info(locations);", (err, columns) => {
    if (err) {
      console.error("Fehler beim Überprüfen der Tabellenstruktur:", err);
      return;
    }

    columnsToCheck.forEach(col => {
      const columnExists = columns.some(column => column.name === col);
      if (!columnExists) {
        db.run(`ALTER TABLE locations ADD COLUMN ${col} TEXT`, (err) => {
          if (err) {
            console.error(`Fehler beim Hinzufügen der Spalte '${col}':`, err.message);
          } else {
            console.log(`Spalte '${col}' erfolgreich hinzugefügt.`);
          }
        });
      } else {
        console.log(`Spalte '${col}' ist bereits vorhanden.`);
      }
    });
  });
});

// Export der benötigten Datenbankmethoden
module.exports = {
  saveLocation: async (locationData) => {
    try {
      return await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO locations 
          (bezirk, erstellungsdatum, erstellungszeit, x_coord, y_coord, sonstiges, adresse, hausnummer, strasse, bezirk_spez, ort, bundesland, plz, land) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            locationData.bezirk, 
            locationData.erstellungsdatum, 
            locationData.erstellungszeit, 
            locationData.x_coord, 
            locationData.y_coord, 
            locationData.sonstiges || '', 
            locationData.adresse || '', 
            locationData.hausnummer || '', 
            locationData.strasse || '', 
            locationData.bezirk_spez || '', 
            locationData.ort || '', 
            locationData.bundesland || '', 
            locationData.plz || '', 
            locationData.land || ''
          ],
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
