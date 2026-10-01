/*
 * Eingebauter Low-Poly-Generator: baut aus Stichworten im Prompt (Roboter, Baum, Haus, Auto,
 * Schwert, Farben) ein echtes GLB aus Quadern. Funktioniert ohne API-Key und dient als Fallback.
 */
const COLORS = {
  rot: [.85, .08, .08], red: [.85, .08, .08], blau: [.12, .35, .9], blue: [.12, .35, .9],
  grün: [.12, .7, .25], gruen: [.12, .7, .25], green: [.12, .7, .25], gelb: [.95, .8, .1], yellow: [.95, .8, .1],
  schwarz: [.07, .07, .08], black: [.07, .07, .08], weiß: [.95, .95, .95], weiss: [.95, .95, .95], white: [.95, .95, .95],
  lila: [.55, .25, .85], purple: [.55, .25, .85], orange: [.95, .5, .1], grau: [.5, .5, .52], gray: [.5, .5, .52],
  grey: [.5, .5, .52], pink: [.95, .45, .7], rosa: [.95, .45, .7], braun: [.4, .25, .12], brown: [.4, .25, .12],
  gold: [.9, .7, .15], silber: [.75, .77, .8], silver: [.75, .77, .8],
};
const DARK = [.12, .12, .14];

function findColors(text) {
  const hits = [];
  for (const [w, c] of Object.entries(COLORS)) { const i = text.indexOf(w); if (i >= 0) hits.push([i, c]); }
  hits.sort((a, b) => a[0] - b[0]);
  return hits.map((h) => h[1]).filter((c, i, a) => a.findIndex((x) => x === c) === i);
}

// Teile: [Größe[3], Mitte[3], Farbe[3]]
function design(prompt) {
  const t = prompt.toLowerCase();
  const [c1, c2] = findColors(t);
  const sword = /schwert|sword/.test(t);
  if (/baum|tree/.test(t))
    return [[[.3, 1, .3], [0, .5, 0], COLORS.braun], ...[[1.4, 1.25], [1, 1.7], [.6, 2.1]].map(([s, y]) => [[s, .5, s], [0, y, 0], c1 || COLORS.grün])];
  if (/haus|house/.test(t))
    return [
      [[2, 1.2, 1.6], [0, .6, 0], c1 || [.85, .75, .6]],
      ...[[2.2, 1.35, 1.8], [1.6, 1.65, 1.4], [1, 1.95, 1]].map(([w, y, d]) => [[w, .3, d], [0, y, 0], c2 || [.6, .15, .1]]),
      [[.4, .7, .05], [0, .35, .81], COLORS.braun],
      [[.35, .35, .05], [-.6, .75, .81], [.6, .8, .95]], [[.35, .35, .05], [.6, .75, .81], [.6, .8, .95]],
    ];
  if (/auto|car|fahrzeug|vehicle/.test(t))
    return [
      [[2, .45, .9], [0, .45, 0], c1 || COLORS.rot], [[1, .4, .8], [-.1, .9, 0], c2 || DARK],
      ...[[-.65, -.5], [.65, -.5], [-.65, .5], [.65, .5]].map(([x, z]) => [[.4, .4, .15], [x, .2, z], DARK]),
    ];
  const main = c1 || COLORS.rot, accent = c2 || DARK;
  const parts = [
    [[.3, .6, .3], [-.17, .3, 0], DARK], [[.3, .6, .3], [.17, .3, 0], DARK],
    [[.8, .8, .45], [0, 1, 0], main], [[.55, .5, .5], [0, 1.65, 0], main],
    [[.1, .1, .05], [-.13, 1.68, .26], [.95, .95, .6]], [[.1, .1, .05], [.13, 1.68, .26], [.95, .95, .6]],
    [[.06, .25, .06], [0, 2.05, 0], accent],
    [[.22, .7, .22], [-.52, 1, 0], main], [[.22, .7, .22], [.52, 1, 0], main],
  ];
  if (sword) parts.push(
    [[.06, .2, .06], [.52, .7, .3], DARK], [[.3, .06, .08], [.52, .82, .3], DARK],
    [[.08, .9, .03], [.52, 1.3, .3], c2 || COLORS.silber]);
  return parts;
}

function buildGLB(parts) {
  const P = parts.length, pos = Buffer.alloc(P * 288), nor = Buffer.alloc(P * 288), idx = Buffer.alloc(P * 72);
  const mats = [], matIdx = new Map(), prims = [], acc = [];
  parts.forEach(([size, mid, col], p) => {
    const min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
    for (let a = 0; a < 3; a++) for (const s of [1, -1]) {
      const b = (a + 1) % 3, c = (a + 2) % 3, f = (a * 2 + (s > 0 ? 0 : 1)) * 4;
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([u, v], k) => {
        const q = [0, 0, 0]; q[a] = s * size[a] / 2 + mid[a]; q[b] = u * size[b] / 2 + mid[b]; q[c] = v * size[c] / 2 + mid[c];
        const n = [0, 0, 0]; n[a] = s;
        for (let i = 0; i < 3; i++) {
          pos.writeFloatLE(q[i], p * 288 + (f + k) * 12 + i * 4);
          nor.writeFloatLE(n[i], p * 288 + (f + k) * 12 + i * 4);
          min[i] = Math.min(min[i], q[i]); max[i] = Math.max(max[i], q[i]);
        }
      });
      (s > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]).forEach((v, i) => idx.writeUInt16LE(f + v, p * 72 + (a * 2 + (s > 0 ? 0 : 1)) * 12 + i * 2));
    }
    const key = col.join();
    if (!matIdx.has(key)) {
      matIdx.set(key, mats.length);
      mats.push({ pbrMetallicRoughness: { baseColorFactor: [...col, 1], metallicFactor: 0.1, roughnessFactor: 0.75 } });
    }
    acc.push({ bufferView: 0, byteOffset: p * 288, componentType: 5126, count: 24, type: 'VEC3', min, max });
    acc.push({ bufferView: 1, byteOffset: p * 288, componentType: 5126, count: 24, type: 'VEC3' });
    acc.push({ bufferView: 2, byteOffset: p * 72, componentType: 5123, count: 36, type: 'SCALAR' });
    prims.push({ attributes: { POSITION: p * 3, NORMAL: p * 3 + 1 }, indices: p * 3 + 2, material: matIdx.get(key) });
  });
  const json = {
    asset: { version: '2.0', generator: '3DForge AI' }, scene: 0, scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'Model' }], meshes: [{ name: 'Model', primitives: prims }], materials: mats, accessors: acc,
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: pos.length, target: 34962 },
      { buffer: 0, byteOffset: pos.length, byteLength: nor.length, target: 34962 },
      { buffer: 0, byteOffset: pos.length + nor.length, byteLength: idx.length, target: 34963 },
    ],
    buffers: [{ byteLength: pos.length + nor.length + idx.length }],
  };
  // accessor 0/1/2 → bufferView-Offsets der Normalen/Indizes gelten relativ zur View
  let js = Buffer.from(JSON.stringify(json));
  js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const bin = Buffer.concat([pos, nor, idx]);
  const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4);
  head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  const ch = (len, type) => { const h = Buffer.alloc(8); h.writeUInt32LE(len, 0); h.writeUInt32LE(type, 4); return h; };
  return Buffer.concat([head, ch(js.length, 0x4e4f534a), js, ch(bin.length, 0x004e4942), bin]);
}

module.exports = {
  name: 'local',
  buildGLB, design,
  info: { name: 'local', label: 'Lokaler Generator', ready: true, note: 'Einfache Low-Poly-Formen. Für echte KI: TEXT3D_PROVIDER=meshy.' },
  async start(prompt) {
    await new Promise((r) => setTimeout(r, 1500));
    return { glb: buildGLB(design(prompt)) };
  },
  async poll() { return { status: 'failed', error: 'Nicht unterstützt.' }; },
};
