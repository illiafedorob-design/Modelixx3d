/*
 * Anbieter-Schnittstelle (austauschbar):
 *   info            -> { name, label, ready, note }
 *   start(prompt)   -> { glb: Buffer }  (sofort fertig)  ODER  { taskId }
 *   poll(taskId)    -> { status: 'running'|'done'|'failed', progress?, glb?, error?, taskId? }
 * Neuen Anbieter hinzufügen: Datei in diesem Ordner anlegen und unten eintragen.
 */
const providers = {
  local: require('./local'),
  meshy: require('./meshy'),
  selfhosted: require('./selfhosted'),
};

exports.get = () => {
  const name = (process.env.TEXT3D_PROVIDER || 'local').toLowerCase();
  const p = providers[name];
  if (!p) throw new Error(`Unbekannter Anbieter "${name}". Erlaubt: ${Object.keys(providers).join(', ')}`);
  return p;
};
