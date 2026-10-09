// Sync verso Supabase. Local-first: l'app funziona anche senza login e senza rete,
// il sync spinge le righe dirty e scarica le righe più nuove (last-write-wins su updated_at).
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { TABLES, mem, dirty, putMany, keyOf, getMeta, setMeta } from './db.js';

const ON_CONFLICT = { programs: 'id', sessions: 'id', sets: 'id', exercise_notes: 'user_id,exercise_key' };
const ts = (s) => (s ? Date.parse(s) : 0);

export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' }
});

let user = null;
let running = false;
let again = false;
let timer = null;
const state = { status: 'local', error: null, last: null };
const listeners = new Set();
export const onSync = (fn) => listeners.add(fn);
const set = (patch) => { Object.assign(state, patch); listeners.forEach((fn) => fn(state)); };
export const syncState = () => state;
export const currentUser = () => user;

export async function initSync() {
  const { data } = await sb.auth.getSession();
  user = data.session?.user ?? null;
  set({ status: user ? 'idle' : 'local' });
  sb.auth.onAuthStateChange((_e, session) => {
    const was = user?.id;
    user = session?.user ?? null;
    set({ status: user ? 'idle' : 'local' });
    if (user && user.id !== was) syncNow();
  });
  window.addEventListener('online', () => syncNow());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') syncNow(); });
  // pulisce l'hash del magic link dall'URL
  if (location.hash.includes('access_token')) history.replaceState(null, '', location.pathname + '#/');
  if (user) syncNow();
}

export async function login(email) {
  const redirect = location.origin + location.pathname;
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
  if (error) throw error;
}

export async function logout() {
  await sb.auth.signOut();
  user = null;
  set({ status: 'local' });
}

// Chiamato dopo ogni scrittura: raggruppa le scritture ravvicinate
export function scheduleSync(delay = 2500) {
  if (!user) return;
  clearTimeout(timer);
  timer = setTimeout(syncNow, delay);
}

export async function syncNow() {
  if (!user) return;
  if (!navigator.onLine) { set({ status: 'offline' }); return; }
  if (running) { again = true; return; }
  running = true;
  set({ status: 'syncing', error: null });
  try {
    await push();
    await pull();
    // il programma seed nasce solo locale: se dopo il pull non è stato sostituito
    // da una versione del server, lo carica
    const seeds = [...mem.programs.values()].filter((p) => p._seed);
    if (seeds.length) {
      await putMany('programs', seeds.map(({ _seed, ...p }) => ({ ...p, _dirty: 1 })));
      await push();
    }
    set({ status: 'idle', last: new Date().toISOString() });
  } catch (e) {
    console.error('sync', e);
    set({ status: 'error', error: e.message || String(e) });
  } finally {
    running = false;
    if (again) { again = false; scheduleSync(500); }
  }
}

async function push() {
  for (const t of TABLES) {
    const rows = dirty(t);
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const payload = chunk.map(({ _dirty, _seed, ...r }) => ({ ...r, user_id: user.id }));
      const { error } = await sb.from(t).upsert(payload, { onConflict: ON_CONFLICT[t] });
      if (error) throw new Error(`${t}: ${error.message}`);
      // pulisce il flag solo se la riga non è cambiata nel frattempo
      const clean = [];
      for (const r of chunk) {
        const cur = mem[t].get(keyOf(t, r));
        if (cur && cur.updated_at === r.updated_at) { const { _dirty, ...c } = cur; clean.push(c); }
      }
      await putMany(t, clean);
    }
  }
}

async function pull() {
  for (const t of TABLES) {
    const cursorKey = `pull_${t}_${user.id}`;
    let since = getMeta(cursorKey, '1970-01-01T00:00:00Z');
    for (;;) {
      const { data, error } = await sb.from(t).select('*')
        .gt('updated_at', since).order('updated_at', { ascending: true }).limit(1000);
      if (error) throw new Error(`${t}: ${error.message}`);
      if (!data.length) break;
      const take = [];
      for (const { user_id, ...remote } of data) {
        const local = mem[t].get(keyOf(t, remote));
        if (!local || ts(remote.updated_at) > ts(local.updated_at)) take.push(remote);
      }
      await putMany(t, take);
      since = data[data.length - 1].updated_at;
      await setMeta(cursorKey, since);
      if (data.length < 1000) break;
    }
  }
}
