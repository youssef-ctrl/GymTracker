// Store locale: IndexedDB è la fonte di verità, tutto viene tenuto anche in memoria
// (i volumi sono piccoli: qualche migliaio di serie l'anno).
// Ogni riga ha updated_at; _dirty = da spingere sul server.

const DB_NAME = 'gymtracker';
const DB_VERSION = 1;
export const TABLES = ['programs', 'sessions', 'sets', 'exercise_notes'];
const KEY = { programs: 'id', sessions: 'id', sets: 'id', exercise_notes: 'exercise_key' };

let idb;
export const mem = { programs: new Map(), sessions: new Map(), sets: new Map(), exercise_notes: new Map(), meta: new Map() };
const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);
const emit = (table) => listeners.forEach((fn) => fn(table));

function req(r) {
  return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}

export async function openDb() {
  idb = await new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const d = r.result;
      for (const t of TABLES) if (!d.objectStoreNames.contains(t)) d.createObjectStore(t, { keyPath: KEY[t] });
      if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'k' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  for (const t of [...TABLES, 'meta']) {
    const rows = await req(idb.transaction(t).objectStore(t).getAll());
    for (const row of rows) mem[t].set(row[t === 'meta' ? 'k' : KEY[t]], row);
  }
  // chiede al browser di non sfrattare i dati sotto pressione di spazio
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
}

export const keyOf = (table, row) => row[KEY[table]];
export const now = () => new Date().toISOString();
export const uuid = () => crypto.randomUUID();

// Scrittura locale: marca dirty e aggiorna updated_at
export async function put(table, row, { dirty = true, touch = true } = {}) {
  const r = { ...row };
  if (touch) r.updated_at = now();
  if (dirty) r._dirty = 1; else delete r._dirty;
  mem[table].set(keyOf(table, r), r);
  await req(idb.transaction(table, 'readwrite').objectStore(table).put(r));
  emit(table);
  return r;
}

export async function putMany(table, rows) {
  if (!rows.length) return;
  const tx = idb.transaction(table, 'readwrite');
  const st = tx.objectStore(table);
  for (const r of rows) { mem[table].set(keyOf(table, r), r); st.put(r); }
  await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  emit(table);
}

// Cancellazione = soft delete, così si propaga col sync
export const remove = (table, row) => put(table, { ...row, deleted_at: now() });

export const all = (table) => [...mem[table].values()].filter((r) => !r.deleted_at);
export const get = (table, k) => { const r = mem[table].get(k); return r && !r.deleted_at ? r : undefined; };
export const dirty = (table) => [...mem[table].values()].filter((r) => r._dirty);

export const getMeta = (k, d = null) => mem.meta.get(k)?.v ?? d;
export async function setMeta(k, v) {
  mem.meta.set(k, { k, v });
  await req(idb.transaction('meta', 'readwrite').objectStore('meta').put({ k, v }));
}
