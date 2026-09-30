require('dotenv').config();
const express = require('express');
const path = require('path');
const api = require('./routes/api');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' });
  next();
});
app.use('/api', api);
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use((req, res) => res.status(404).json({ error: 'Nicht gefunden.' }));
app.use((err, req, res, next) => res.status(400).json({ error: 'Ungültige Anfrage.' }));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`3DForge AI läuft auf http://localhost:${port}`));
