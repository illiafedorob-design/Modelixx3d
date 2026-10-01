const express = require('express');
const crypto = require('crypto');
const providers = require('../providers');
const store = require('../store');

const router = express.Router();
const jobs = new Map();
const hits = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// einfache Begrenzung: 10 Generierungen pro Minute und IP, max. 3 gleichzeitig
function limited(ip) {
  const now = Date.now();
  const l = (hits.get(ip) || []).filter((t) => now - t < 60000);
  l.push(now); hits.set(ip, l);
  return l.length > 10;
}
const running = () => [...jobs.values()].filter((j) => j.status === 'running').length;

async function run(job) {
  try {
    const p = providers.get();
    const r = await p.start(job.prompt);
    const t0 = Date.now();
    while (!r.glb) {
      await sleep(3000);
      if (Date.now() - t0 > 10 * 60000) throw new Error('Zeitüberschreitung: Der Anbieter hat zu lange gebraucht.');
      const s = await p.poll(r.taskId);
      if (s.taskId) r.taskId = s.taskId;
      if (s.progress != null) job.progress = Math.round(s.progress);
      if (s.status === 'failed') throw new Error(s.error || 'Generierung fehlgeschlagen.');
      if (s.status === 'done') r.glb = s.glb;
    }
    if (!store.isGLB(r.glb)) throw new Error('Der Anbieter hat keine gültige GLB-Datei geliefert.');
    job.modelId = store.add({ name: job.name, prompt: job.prompt, provider: p.name }, r.glb).id;
    job.status = 'done'; job.progress = 100;
  } catch (e) {
    console.error('Job fehlgeschlagen:', e.message);
    job.status = 'failed'; job.error = e.message;
  }
}

router.get('/status', (req, res) => {
  try { res.json(providers.get().info); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/generate', (req, res) => {
  const prompt = String(req.body?.prompt || '').trim();
  if (prompt.length < 3 || prompt.length > 400) return res.status(400).json({ error: 'Der Prompt muss 3 bis 400 Zeichen lang sein.' });
  if (limited(req.ip)) return res.status(429).json({ error: 'Zu viele Anfragen. Bitte warte eine Minute.' });
  if (running() >= 3) return res.status(429).json({ error: 'Es laufen bereits mehrere Generierungen. Bitte warte kurz.' });
  let info;
  try { info = providers.get().info; } catch (e) { return res.status(500).json({ error: e.message }); }
  if (!info.ready) return res.status(503).json({ error: info.note || 'Anbieter ist nicht eingerichtet.' });
  const name = String(req.body?.name || '').trim().slice(0, 60) ||
    prompt.split(/\s+/).slice(0, 4).join(' ').replace(/^./, (c) => c.toUpperCase());
  const job = { id: crypto.randomUUID(), prompt, name, status: 'running', progress: 0 };
  jobs.set(job.id, job);
  setTimeout(() => jobs.delete(job.id), 3600000).unref();
  run(job);
  res.status(202).json({ jobId: job.id });
});

router.get('/jobs/:id', (req, res) => {
  const j = jobs.get(req.params.id);
  if (!j) return res.status(404).json({ error: 'Auftrag nicht gefunden (Server neu gestartet?).' });
  res.json({ status: j.status, progress: j.progress, modelId: j.modelId, error: j.error });
});

router.get('/models', (req, res) => res.json(store.list()));

router.get('/models/:id/file', (req, res) => {
  const m = store.get(req.params.id);
  if (!m) return res.status(404).json({ error: 'Modell nicht gefunden.' });
  const fname = (m.name.replace(/[^\w\-]+/g, '_').replace(/^_+|_+$/g, '') || 'model') + '.glb';
  res.set('Content-Type', 'model/gltf-binary');
  if (req.query.download) res.set('Content-Disposition', `attachment; filename="${fname}"`);
  res.sendFile(store.file(m.id));
});

router.delete('/models/:id', (req, res) =>
  store.remove(req.params.id) ? res.json({ ok: true }) : res.status(404).json({ error: 'Modell nicht gefunden.' }));

module.exports = router;
