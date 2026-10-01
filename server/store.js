// Speichert Modelle als GLB-Dateien plus Metadaten in data/models.json
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = path.join(__dirname, '..', 'data');
const FILES = path.join(DIR, 'models');
const DB = path.join(DIR, 'models.json');
fs.mkdirSync(FILES, { recursive: true });

const read = () => { try { return JSON.parse(fs.readFileSync(DB, 'utf8')); } catch { return []; } };
const write = (l) => fs.writeFileSync(DB, JSON.stringify(l, null, 1));

function stats(b) {
  let tris = 0;
  try {
    const len = b.readUInt32LE(12);
    const j = JSON.parse(b.subarray(20, 20 + len).toString('utf8'));
    for (const m of j.meshes || []) for (const p of m.primitives) {
      const a = j.accessors[p.indices !== undefined ? p.indices : p.attributes.POSITION];
      tris += Math.round(a.count / 3);
    }
  } catch {}
  return { tris, kb: Math.round(b.length / 1024) };
}

exports.isGLB = (b) => Buffer.isBuffer(b) && b.length > 20 && b.readUInt32LE(0) === 0x46546c67;
exports.list = () => read().sort((a, b) => b.created - a.created);
exports.get = (id) => read().find((m) => m.id === id);
exports.file = (id) => path.join(FILES, id + '.glb');
exports.add = (meta, buf) => {
  const id = crypto.randomUUID();
  fs.writeFileSync(exports.file(id), buf);
  const m = { id, ...meta, ...stats(buf), created: Date.now() };
  write([m, ...read()]);
  return m;
};
exports.remove = (id) => {
  const l = read();
  if (!l.some((m) => m.id === id)) return false;
  write(l.filter((m) => m.id !== id));
  try { fs.unlinkSync(exports.file(id)); } catch {}
  return true;
};
