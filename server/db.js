// server/db.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'paired_numbers.db');
const db = new sqlite3.Database(dbPath);

// Create table if not exists
db.run(`
  CREATE TABLE IF NOT EXISTS pairing_numbers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number TEXT UNIQUE,
    created_at INTEGER
  )
`);

function saveNumber(number) {
  return new Promise((resolve, reject) => {
    const now = Date.now();
    db.run(`INSERT OR REPLACE INTO pairing_numbers (number, created_at) VALUES (?, ?)`, [number, now], (err) => {
      if (err) return reject(err);
      resolve(true);
    });
  });
}

function isNumberAllowed(number) {
  return new Promise((resolve, reject) => {
    const now = Date.now();
    db.get(`SELECT created_at FROM pairing_numbers WHERE number = ?`, [number], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(true); // No entry means allowed

      const diff = (now - row.created_at) / 1000;
      if (diff > 300) return resolve(true); // More than 5 minutes
      return resolve(false); // Still within 5 mins
    });
  });
}

module.exports = { saveNumber, isNumberAllowed };
