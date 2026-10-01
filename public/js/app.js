const $ = (s) => document.querySelector(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const el = (t, a = {}, ...c) => {
  const n = document.createElement(t);
  for (const [k, v] of Object.entries(a)) k === 'class' ? (n.className = v) : k.startsWith('on') ? n.addEventListener(k.slice(2), v) : n.setAttribute(k, v);
  n.append(...c);
  return n;
};
async function api(url, opt) {
  const r = await fetch(url, opt);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `Fehler ${r.status}`);
  return d;
}

const EXAMPLES = [
  'Ein kleiner roter Low-Poly-Roboter mit schwarzem Schwert',
  'Grüner Baum mit braunem Stamm',
  'Gemütliches Haus mit rotem Dach',
  'Blaues Low-Poly-Auto',
];
const ROBLOX_MAX_TRIS = 21844;
let models = [], currentId = null;

const showError = (m) => { const e = $('#error'); e.textContent = m; e.hidden = false; };
const clearError = () => { $('#error').hidden = true; };

function setBusy(on, text) {
  $('#go').disabled = on;
  $('#go').textContent = on ? 'Wird erstellt …' : '3D-Modell erstellen';
  $('#loader').hidden = !on;
  $('#empty').hidden = on || !!currentId;
  if (text) $('#loadtxt').textContent = text;
  if (on) { $('.bar').classList.remove('det'); $('#barfill').style.width = ''; }
}

function showModel(m) {
  if (!m) return;
  currentId = m.id;
  $('#viewer').src = `/api/models/${m.id}/file`;
  $('#t-view').textContent = m.name;
  const ok = m.tris <= ROBLOX_MAX_TRIS;
  $('#meta').replaceChildren(
    `${m.tris.toLocaleString('de-DE')} Dreiecke · ${m.kb} KB · `,
    el('span', { class: ok ? 'ok-tag' : 'warn-tag' }, ok ? 'Roblox-tauglich' : 'Zu viele Dreiecke für ein MeshPart')
  );
  const dl = $('#dl');
  dl.href = `/api/models/${m.id}/file?download=1`;
  dl.setAttribute('aria-disabled', 'false');
  $('#empty').hidden = true;
  renderGallery();
}

function renderGallery() {
  const g = $('#grid');
  if (!models.length) return g.replaceChildren(el('p', { class: 'none' }, 'Noch keine Modelle. Erstelle dein erstes oben.'));
  g.replaceChildren(...models.map((m) =>
    el('div', {}, el('button', { class: 'item' + (m.id === currentId ? ' active' : ''), onclick: () => showModel(m) },
      el('strong', {}, m.name), el('span', {}, m.prompt),
      el('div', { class: 'row' }, `${m.tris.toLocaleString('de-DE')} Dreiecke · ${new Date(m.created).toLocaleDateString('de-DE')}`)),
      el('button', { class: 'del', 'aria-label': `${m.name} löschen`, onclick: () => remove(m) }, 'Löschen'))));
}

async function remove(m) {
  if (!confirm(`„${m.name}“ löschen?`)) return;
  try {
    await api(`/api/models/${m.id}`, { method: 'DELETE' });
    if (currentId === m.id) { currentId = null; $('#viewer').removeAttribute('src'); $('#t-view').textContent = 'Noch kein Modell'; $('#dl').setAttribute('aria-disabled', 'true'); $('#empty').hidden = false; $('#meta').textContent = 'Erstelle ein Modell oder wähle eines aus der Galerie.'; }
    await loadGallery();
  } catch (e) { showError(e.message); }
}

async function loadGallery() { models = await api('/api/models'); renderGallery(); }

async function generate() {
  const prompt = $('#prompt').value.trim();
  clearError();
  if (prompt.length < 3) return showError('Beschreibe dein Modell mit mindestens 3 Zeichen.');
  setBusy(true, 'Anfrage wird gesendet …');
  try {
    const { jobId } = await api('/api/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, name: $('#name').value.trim() }),
    });
    $('#loadtxt').textContent = 'Modell wird geschmiedet …';
    for (;;) {
      await sleep(1200);
      const j = await api(`/api/jobs/${jobId}`);
      if (j.progress > 0) { $('.bar').classList.add('det'); $('#barfill').style.width = j.progress + '%'; $('#loadtxt').textContent = `Modell wird geschmiedet … ${j.progress} %`; }
      if (j.status === 'failed') throw new Error(j.error || 'Generierung fehlgeschlagen.');
      if (j.status === 'done') { await loadGallery(); showModel(models.find((m) => m.id === j.modelId)); break; }
    }
  } catch (e) { showError(e.message); }
  finally { setBusy(false); }
}

async function init() {
  $('#examples').replaceChildren(...EXAMPLES.map((t) => el('button', { class: 'chip', type: 'button', onclick: () => { $('#prompt').value = t; $('#prompt').focus(); } }, t)));
  $('#go').addEventListener('click', generate);
  $('#prompt').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) generate(); });
  $('#viewer').addEventListener('error', () => showError('Das Modell konnte nicht im Viewer geladen werden.'));
  setTimeout(() => { if (!customElements.get('model-viewer')) showError('Der 3D-Viewer konnte nicht geladen werden. Prüfe deine Internetverbindung (cdn.jsdelivr.net).'); }, 5000);
  try {
    const s = await api('/api/status');
    const p = $('#status');
    p.textContent = s.ready ? `Bereit · ${s.label}` : `${s.label}: nicht eingerichtet`;
    p.classList.add(s.ready ? 'ok' : 'bad');
    if (!s.ready) showError(s.note);
    await loadGallery();
    if (models[0]) showModel(models[0]);
  } catch (e) {
    $('#status').textContent = 'Server nicht erreichbar'; $('#status').classList.add('bad'); showError(e.message);
  }
}
init();
