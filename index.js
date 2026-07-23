const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
app.use(express.json()); // to parse JSON bodies

// Setup SQLite DB
const fs = require('fs');
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path.join(dataDir, 'data.db');
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
  db.prepare("INSERT INTO config (id, ip_address) VALUES (1, '')").run();
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

// GET endpoint for all other routes to serve the iframe
app.get('*', (req, res) => {
  try {
    const record = db.prepare('SELECT ip_address FROM config WHERE id = 1').get();
    
    if (!record || !record.ip_address) {
      return res.status(404).send("<h1>IP Address not set yet. Please wait for the worker to update.</h1>");
    }

    // Path yang diketik user di browser hp (misal: /link)
    const targetPath = req.originalUrl;
    
    // Kita gunakan trik JS agar Cloudflare "Automatic HTTPS Rewrites" tidak otomatis
    // mengubah http:// menjadi https:// di dalam string HTML.
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Manga Scraper</title>
        <style>
          body, html { margin: 0; padding: 0; height: 100%; overflow: hidden; }
          iframe { width: 100%; height: 100%; border: none; }
        </style>
      </head>
      <body>
        <iframe id="manga-frame"></iframe>
        <script>
          // Build URL dengan Javascript agar tidak ketahuan Cloudflare
          const ip = "${record.ip_address}";
          const path = "${targetPath}";
          const finalUrl = 'http://' + ip + ':6060' + path;
          
          document.getElementById('manga-frame').src = finalUrl;

          // Untuk mengupdate URL bar di HP saat halaman di dalam iframe berubah
          window.addEventListener('message', (e) => {
            if (e.data && e.data.type === 'URL_CHANGE' && e.data.url) {
              window.history.replaceState(null, '', e.data.url);
            }
          });
        </script>
      </body>
      </html>
    `;
    res.send(html);
  } catch (err) {
    console.error('Error reading IP:', err);
    res.status(500).send("Internal Server Error");
  }
});

// Start the server
const PORT = process.env.PORT || 5175;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Redirector App listening on port ${PORT}`);
});
