/*
 * Eigener Server (z. B. TripoSR, Shap-E, InstantMesh hinter einer kleinen HTTP-API).
 * Vertrag:  POST {SELFHOSTED_URL}/generate   Body: {"prompt":"..."}
 *           Antwort: GLB-Binärdaten (Content-Type: model/gltf-binary)
 */
module.exports = {
  name: 'selfhosted',
  get info() {
    return { name: 'selfhosted', label: 'Eigener Server', ready: !!process.env.SELFHOSTED_URL, note: 'SELFHOSTED_URL fehlt.' };
  },
  async start(prompt) {
    const headers = { 'Content-Type': 'application/json' };
    if (process.env.SELFHOSTED_TOKEN) headers.Authorization = `Bearer ${process.env.SELFHOSTED_TOKEN}`;
    const r = await fetch(`${process.env.SELFHOSTED_URL}/generate`, {
      method: 'POST', headers, body: JSON.stringify({ prompt }),
    });
    if (!r.ok) throw new Error(`Eigener Server antwortete mit Status ${r.status}.`);
    return { glb: Buffer.from(await r.arrayBuffer()) };
  },
  async poll() { return { status: 'failed', error: 'Nicht unterstützt.' }; },
};
