const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
app.use(express.json()); // to parse JSON bodies

// Setup SQLite DB
const dbPath = path.join(__dirname, 'data.db');
const db = new Database(dbPath);

// Create table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS config (
    id INTEGER PRIMARY KEY,
    ip_address TEXT
  )
`);

// Insert default row if DB is fresh
const row = db.prepare('SELECT count(*) as count FROM config').get();
if (row.count === 0) {
  db.prepare('INSERT INTO config (id, ip_address) VALUES (1, "")').run();
}

// POST endpoint to update the IP address
app.post('/update-ip-address', (req, res) => {
  const { ip } = req.body;
  if (!ip) {
    return res.status(400).json({ error: 'IP address is required' });
  }

  try {
    const stmt = db.prepare('UPDATE config SET ip_address = ? WHERE id = 1');
    stmt.run(ip);
    console.log(`[${new Date().toLocaleString()}] IP Updated to: ${ip}`);
    res.json({ success: true, message: 'IP address updated successfully', ip });
  } catch (err) {
    console.error('Error updating IP:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET endpoint to redirect to the latest IP
app.get('/redirect', (req, res) => {
  try {
    const record = db.prepare('SELECT ip_address FROM config WHERE id = 1').get();
    
    if (!record || !record.ip_address) {
      return res.status(404).send("<h1>IP Address not set yet. Please wait for the worker to update.</h1>");
    }

    // Redirect to http://<ip>:6060/link
    const targetUrl = `http://${record.ip_address}:6060/link`;
    res.redirect(302, targetUrl);
  } catch (err) {
    console.error('Error reading IP:', err);
    res.status(500).send("Internal Server Error");
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Redirector App listening on port ${PORT}`);
});
