// ============================================================
// Movie-Shock · server.js
// Tiny Express server — serves static files + CSV read/write
// Run: node server.js
// ============================================================

const express = require('express');
const fs      = require('fs');
const path    = require('path');

const app     = express();
const PORT    = 3456;
const CSV_FILE = path.join(__dirname, 'movies.csv');
const HEADERS  = ['id','title','year','poster_path','franchise','type','added_date','overview'];

// ─── Middleware ───────────────────────────────────────────────
app.use(express.json());
app.use(express.static(__dirname));

// ─── CSV Helpers ─────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = (values[i] || '').replace(/^"|"$/g, '').replace(/""/g, '"');
    });
    return obj;
  }).filter(e => e.id && e.title);
}

function parseCSVLine(line) {
  const result = [];
  let current = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (line[i] === ',' && !inQuotes) {
      result.push(current); current = '';
    } else {
      current += line[i];
    }
  }
  result.push(current);
  return result;
}

function toCSV(entries) {
  const rows = entries.map(e =>
    HEADERS.map(h => `"${(e[h] || '').toString().replace(/"/g, '""')}"`).join(',')
  );
  return [HEADERS.join(','), ...rows].join('\n') + '\n';
}

function ensureCSV() {
  if (!fs.existsSync(CSV_FILE)) {
    fs.writeFileSync(CSV_FILE, HEADERS.join(',') + '\n', 'utf8');
  }
}

// ─── API Routes ───────────────────────────────────────────────

// GET /api/movies  → returns all entries as JSON
app.get('/api/movies', (req, res) => {
  ensureCSV();
  const text    = fs.readFileSync(CSV_FILE, 'utf8');
  const entries = parseCSV(text);
  res.json(entries);
});

// POST /api/movies  → replace entire CSV with new dataset
app.post('/api/movies', (req, res) => {
  const entries = req.body;
  if (!Array.isArray(entries)) return res.status(400).json({ error: 'Expected array' });
  fs.writeFileSync(CSV_FILE, toCSV(entries), 'utf8');
  res.json({ ok: true, count: entries.length });
});

// ─── Start ────────────────────────────────────────────────────
ensureCSV();
app.listen(PORT, () => {
  console.log(`\n🎬  MovieShock running at http://localhost:${PORT}\n`);
});
