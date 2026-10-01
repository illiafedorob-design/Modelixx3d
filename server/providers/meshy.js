// Meshy Text-to-3D (API v2). Prüfe Parameter ggf. gegen https://docs.meshy.ai
const BASE = 'https://api.meshy.ai/openapi/v2/text-to-3d';
const key = () => process.env.MESHY_API_KEY;

async function call(url, opt = {}) {
  const r = await fetch(url, {
    ...opt,
    headers: { Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json' },
  });
  if (!r.ok) throw new Error(`Meshy-Fehler ${r.status}: ${(await r.text()).slice(0, 160)}`);
  return r.json();
}

module.exports = {
  name: 'meshy',
  get info() {
    return {
      name: 'meshy', label: 'Meshy KI', ready: !!key(),
      note: key() ? '' : 'MESHY_API_KEY fehlt in der .env-Datei.',
    };
  },
  async start(prompt) {
    if (!key()) throw new Error('MESHY_API_KEY fehlt in der .env-Datei.');
    const res = await call(BASE, {
      method: 'POST',
      body: JSON.stringify({
        mode: 'preview',
        prompt: `${prompt}, low poly, game asset, clean topology`,
        topology: 'triangle',
        should_remesh: true,
        target_polycount: Number(process.env.TARGET_POLYCOUNT) || 4000,
      }),
    });
    return { taskId: 'preview:' + res.result };
  },
  async poll(taskId) {
    const [stage, id] = taskId.split(':');
    const refine = process.env.MESHY_REFINE !== 'false';
    const t = await call(`${BASE}/${id}`);
    if (t.status === 'FAILED' || t.status === 'CANCELED')
      return { status: 'failed', error: t.task_error?.message || 'Generierung fehlgeschlagen.' };
    if (t.status !== 'SUCCEEDED') {
      const p = t.progress || 0;
      return { status: 'running', progress: stage === 'preview' && refine ? p / 2 : refine ? 50 + p / 2 : p };
    }
    if (stage === 'preview' && refine) {
      const r = await call(BASE, { method: 'POST', body: JSON.stringify({ mode: 'refine', preview_task_id: id }) });
      return { status: 'running', progress: 50, taskId: 'refine:' + r.result };
    }
    const url = t.model_urls?.glb;
    if (!url) return { status: 'failed', error: 'Anbieter lieferte keine GLB-Datei.' };
    const f = await fetch(url);
    if (!f.ok) return { status: 'failed', error: 'GLB-Download vom Anbieter fehlgeschlagen.' };
    return { status: 'done', glb: Buffer.from(await f.arrayBuffer()) };
  },
};
