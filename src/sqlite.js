/**
 * Module handles database management for location data
 *
 * Server API calls the methods in here to query and update the SQLite database
 */

// Utilities we need
const sqlite3 = require("sqlite3").verbose();
const dbFile = "./locations.db"; // Path to the database file
const db = new sqlite3.Database(dbFile);

// Ensure the database and table exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bezirk TEXT,
      erstellungsdatum TEXT,
      x_coord REAL,
      y_coord REAL,
      sonstiges TEXT,
      erstellungszeit TEXT
    )
  `);
});

// Our server script will call these methods to connect to the db
module.exports = {

  /**
   * Save a new location to the database
   *
   * @param {Object} locationData - Contains the data to be saved (bezirk, x_coord, y_coord, sonstiges, erstellungsdatum, erstellungszeit)
   */
  saveLocation: async (locationData) => {
    try {
      return await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO locations (bezirk, erstellungsdatum, x_coord, y_coord, sonstiges, erstellungszeit) VALUES (?, ?, ?, ?, ?, ?)`,
          [locationData.bezirk, locationData.erstellungsdatum, locationData.x_coord, locationData.y_coord, locationData.sonstiges, locationData.erstellungszeit],
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

  /**
   * Get the last 5 locations from the database
   *
   * Returns an array of the most recent 5 locations ordered by ID
   */
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

  /**
   * Export all locations as CSV
   *
   * Returns all the data from the locations table
   */
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
