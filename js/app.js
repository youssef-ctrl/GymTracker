import { openDb, onChange, put, remove, all, get, mem, uuid, now, getMeta } from './db.js';
import { initSync, scheduleSync, syncNow, onSync, syncState, currentUser, login, logout } from './sync.js';
import { SEED_PROGRAM } from './program.js';

const $app = document.getElementById('app');
const $dlg = document.getElementById('dlg');

// ---------- utilità ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtKg = (n) => (n == null || n === '' || Number.isNaN(+n) ? '–' : (+n).toLocaleString('it-IT', { maximumFractionDigits: 2 }));
const parseKg = (s) => { const n = parseFloat(String(s).replace(',', '.')); return Number.isFinite(n) ? Math.round(n * 100) / 100 : null; };
const parseInt0 = (s) => { const n = parseInt(s, 10); return Number.isFinite(n) && n >= 0 ? n : null; };
const fmtDate = (iso) => new Date(iso).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
const dayStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
function daysAgo(iso) {
  const d = Math.round((dayStart(new Date()) - dayStart(iso)) / 86400000);
  return d === 0 ? 'oggi' : d === 1 ? 'ieri' : `${d} giorni fa`;
}
function duration(a, b) {
  if (!a || !b) return '';
  const m = Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 60000));
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}'` : `${m}'`;
}
const RIR = ['Cedimento', '1 RIR', '2+ RIR'];
const RIR_SHORT = ['ced.', '1 RIR', '2+ RIR'];

const I = {
  back: '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>',
  chev: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>',
  pen: '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>'
};

// ---------- dominio ----------
function activeProgram() {
  const ps = all('programs').sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  return ps.find((p) => p.active) || ps[0];
}
function exerciseInfo(key) {
  for (const p of [activeProgram(), ...all('programs')]) {
    const e = p?.data?.exercises?.[key];
    if (e) return e;
  }
  const s = all('sets').find((x) => x.exercise_key === key);
  return { name: s?.exercise_name || key, unilateral: s ? s.reps_d != null : false, inc: 2.5 };
}
function templateOf(session) {
  const p = get('programs', session.program_id) || activeProgram();
  return p?.data.templates.find((t) => t.key === session.template_key)
    || activeProgram()?.data.templates.find((t) => t.key === session.template_key)
    || { key: session.template_key, name: session.template_name, slots: [] };
}
const sessionsDesc = () => all('sessions').sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at));
const openSession = () => sessionsDesc().find((s) => !s.ended_at);
const setsOf = (sid, exKey) => all('sets')
  .filter((s) => s.session_id === sid && (!exKey || s.exercise_key === exKey))
  .sort((a, b) => a.set_index - b.set_index || Date.parse(a.done_at) - Date.parse(b.done_at));

// Ultima seduta (diversa da quella corrente) con serie registrate per l'esercizio
function lastPerformance(exKey, excludeSid) {
  const bySession = new Map();
  for (const s of all('sets')) {
    if (s.exercise_key !== exKey || s.session_id === excludeSid) continue;
    if (!bySession.has(s.session_id)) bySession.set(s.session_id, []);
    bySession.get(s.session_id).push(s);
  }
  let best = null;
  for (const [sid, sets] of bySession) {
    const sess = get('sessions', sid);
    if (!sess) continue;
    if (!best || Date.parse(sess.started_at) > Date.parse(best.session.started_at)) best = { session: sess, sets };
  }
  if (best) best.sets.sort((a, b) => a.set_index - b.set_index);
  return best;
}

function nextTemplateKey() {
  const p = activeProgram();
  if (!p) return null;
  const keys = p.data.templates.map((t) => t.key);
  const last = sessionsDesc().find((s) => keys.includes(s.template_key));
  if (!last) return keys[0];
  return keys[(keys.indexOf(last.template_key) + 1) % keys.length];
}

function repsText(s, max) {
  const hit = (n) => (max != null && n != null && n >= max ? `<span class="top-hit">${n}</span>` : (n ?? '–'));
  return s.reps_d != null || s.reps_s != null ? `D ${hit(s.reps_d)} / S ${hit(s.reps_s)}` : `${hit(s.reps)}`;
}
// Forma compatta: unilaterale "9/6" (destro/sinistro)
function repsShort(s, max) {
  const hit = (n) => (max != null && n != null && n >= max ? `<span class="top-hit">${n}</span>` : (n ?? '–'));
  return s.reps_d != null || s.reps_s != null ? `${hit(s.reps_d)}/${hit(s.reps_s)}` : `${hit(s.reps)}`;
}
// "50 kg · 8 · 7" se il carico è uguale su tutte le serie, altrimenti "50×8 · 47,5×9"
function perfText(sets, max) {
  if (!sets.length) return '–';
  const same = sets.every((s) => s.kg === sets[0].kg);
  if (same) return `${fmtKg(sets[0].kg)} kg · ${sets.map((s) => repsShort(s, max)).join(' · ')}`;
  return sets.map((s) => `${fmtKg(s.kg)}×${repsShort(s, max)}`).join(' · ');
}

// ---------- scritture ----------
async function save(table, row) { const r = await put(table, row); scheduleSync(); return r; }
async function del(table, row) { await remove(table, row); scheduleSync(); }

async function startSession(tplKey) {
  const cur = openSession();
  if (cur) {
    if (!setsOf(cur.id).length) await del('sessions', cur);
    else if (!(await confirmDlg(`C'è una seduta di ${cur.template_name} ancora aperta. La chiudo e ne inizio una nuova?`, 'Chiudi e inizia'))) return;
    else await endSession(cur, false);
  }
  const p = activeProgram();
  const t = p.data.templates.find((x) => x.key === tplKey);
  const s = await save('sessions', {
    id: uuid(), program_id: p.id, template_key: t.key, template_name: t.name,
    started_at: now(), ended_at: null, note: null, deleted_at: null
  });
  ui.exIdx[s.id] = 0;
  ui.editor = null;
  go(`#/s/${s.id}`);
}

async function endSession(s, navigate = true) {
  const sets = setsOf(s.id);
  if (!sets.length) await del('sessions', s);
  else {
    const lastDone = sets.reduce((m, x) => (Date.parse(x.done_at) > Date.parse(m) ? x.done_at : m), s.started_at);
    await save('sessions', { ...s, ended_at: lastDone });
  }
  ui.editor = null;
  syncNow();
  if (navigate) go('#/');
}

// ---------- stato UI ----------
const ui = {
  exIdx: {},     // sessione -> indice esercizio corrente
  editor: null,  // { sid, exKey, editingId, kg, reps, reps_d, reps_s, rir, extra }
  authMsg: '',
  authErr: false
};

function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }

// ---------- dialog ----------
function confirmDlg(text, okLabel = 'Conferma', danger = false) {
  return new Promise((res) => {
    $dlg.innerHTML = `<form method="dialog" class="dlg-in">
      <div>${esc(text)}</div>
      <div class="dlg-actions">
        <button class="btn small outline" value="no">Annulla</button>
        <button class="btn small ${danger ? 'amber' : 'primary'}" value="ok">${esc(okLabel)}</button>
      </div></form>`;
    $dlg.onclose = () => res($dlg.returnValue === 'ok');
    $dlg.returnValue = '';
    $dlg.showModal();
  });
}
function noteDlg(title, value) {
  return new Promise((res) => {
    $dlg.innerHTML = `<form method="dialog" class="dlg-in">
      <div class="label">${esc(title)}</div>
      <textarea class="input" name="t" placeholder="Sensazioni, tecnica, setup macchina">${esc(value)}</textarea>
      <div class="dlg-actions">
        <button class="btn small outline" value="no">Annulla</button>
        <button class="btn small primary" value="ok">Salva</button>
      </div></form>`;
    const ta = $dlg.querySelector('textarea');
    $dlg.onclose = () => res($dlg.returnValue === 'ok' ? ta.value.trim() : null);
    $dlg.returnValue = '';
    $dlg.showModal();
  });
}

// ---------- viste ----------
function syncDot() {
  const st = syncState();
  const cls = st.status === 'local' ? '' : st.status;
  return `<span class="sync-dot ${cls}" title="${esc(st.status)}"></span>`;
}

function viewHome() {
  const p = activeProgram();
  const open = openSession();
  const next = nextTemplateKey();
  const sessions = sessionsDesc();
  const cards = p.data.templates.map((t) => {
    const last = sessions.find((s) => s.template_key === t.key && s.ended_at);
    const lastTxt = last ? `Ultima ${fmtDate(last.started_at)} · ${daysAgo(last.started_at)}` : 'Mai fatta';
    return `<button class="card tpl ${t.key === next && !open ? 'next' : ''}" data-act="start" data-k="${esc(t.key)}">
      <span style="display:flex;flex-direction:column;gap:4px">
        <span class="tpl-name">${esc(t.name)}</span>
        <span class="sub">${esc(lastTxt)}</span>
      </span>
      ${t.key === next && !open ? '<span class="pill accent">Prossima</span>' : ''}
    </button>`;
  }).join('');
  return `<section class="page">
    <div class="top">
      <div class="top-title">
        <span class="sub">${esc(p.name)} ${syncDot()}</span>
        <h1 class="h1">Palestra</h1>
      </div>
      <a class="icon-btn" href="#/settings" aria-label="Impostazioni">${I.gear}</a>
    </div>
    ${open ? `<a class="resume" href="#/s/${open.id}">
      <span style="display:flex;flex-direction:column;gap:2px">
        <span class="sub" style="color:var(--text)">Seduta in corso · dalle ${fmtTime(open.started_at)}</span>
        <b>${esc(open.template_name)}</b>
      </span>
      <span class="pill accent">Riprendi</span>
    </a>` : ''}
    <div class="stack">${cards}</div>
    <div class="stack">
      <a class="row" href="#/ex"><span class="r-title">Storico per esercizio</span>${I.chev}</a>
      <a class="row" href="#/sessions"><span class="r-title">Sedute passate</span>${I.chev}</a>
    </div>
  </section>`;
}

function defaultEditor(sid, slot, info) {
  const mine = setsOf(sid, slot.ex);
  const src = mine[mine.length - 1] || lastPerformance(slot.ex, sid)?.sets[0];
  const e = { sid, exKey: slot.ex, editingId: null, rir: slot.rir ?? 0, kg: src?.kg ?? null };
  if (info.unilateral) { e.reps_d = src?.reps_d ?? src?.reps ?? slot.min; e.reps_s = src?.reps_s ?? src?.reps ?? slot.min; }
  else e.reps = src?.reps ?? src?.reps_d ?? slot.min;
  return e;
}

function viewSession(sid) {
  const s = get('sessions', sid);
  if (!s) return `<section class="page"><div class="empty">Seduta non trovata.</div><a class="link-btn" href="#/">Torna alla home</a></section>`;
  const tpl = templateOf(s);
  // esercizi del template + eventuali esercizi registrati fuori template
  const slots = [...tpl.slots];
  for (const x of setsOf(sid)) if (!slots.some((sl) => sl.ex === x.exercise_key)) slots.push({ ex: x.exercise_key, sets: 0, min: null, max: null, rir: 0, note: '' });
  if (!slots.length) return `<section class="page"><div class="empty">Template vuoto.</div></section>`;

  if (ui.exIdx[sid] == null) {
    const firstOpen = slots.findIndex((sl) => setsOf(sid, sl.ex).length < sl.sets);
    ui.exIdx[sid] = firstOpen === -1 ? slots.length - 1 : firstOpen;
  }
  const idx = Math.min(ui.exIdx[sid], slots.length - 1);
  const slot = slots[idx];
  const info = exerciseInfo(slot.ex);
  const logged = setsOf(sid, slot.ex);
  const complete = logged.length >= slot.sets;

  let ed = ui.editor;
  if (!ed || ed.sid !== sid || ed.exKey !== slot.ex) ed = ui.editor = defaultEditor(sid, slot, info);
  const editing = !!ed.editingId;
  const showEditor = editing || !complete || ed.extra;

  const chips = slots.map((sl, i) => {
    const done = setsOf(sid, sl.ex).length >= sl.sets && sl.sets > 0;
    return `<button class="chip ${done ? 'done' : ''} ${i === idx ? 'cur' : ''}" data-act="ex" data-i="${i}" aria-label="Esercizio ${i + 1}">${i + 1}</button>`;
  }).join('');

  const last = lastPerformance(slot.ex, sid);
  const myNote = get('exercise_notes', slot.ex)?.note;
  const scheme = slot.sets ? `${slot.sets} × ${slot.min}-${slot.max}` : 'extra';

  const loggedRows = logged.map((x, i) => `
    <button class="logged ${ed.editingId === x.id ? 'editing' : ''}" data-act="editset" data-id="${x.id}">
      <span class="check">${I.check}</span>
      <span class="s-n">Serie ${i + 1}</span>
      <span class="s-v num">${fmtKg(x.kg)} kg · ${repsText(x, slot.max)}</span>
      <span class="s-r">${RIR_SHORT[x.rir ?? 0]}</span>
    </button>`).join('');

  const stepper = (field, label, value, step) => `
    <div class="step">
      <span class="step-label">${label}</span>
      <div class="step-ctl">
        <button class="step-btn" data-act="step" data-f="${field}" data-d="${-step}" aria-label="Diminuisci ${label}">−</button>
        <input class="step-in" data-f="${field}" inputmode="${field === 'kg' ? 'decimal' : 'numeric'}" value="${field === 'kg' ? (value == null ? '' : fmtKg(value)) : (value ?? '')}" aria-label="${label}" placeholder="–">
        <button class="step-btn" data-act="step" data-f="${field}" data-d="${step}" aria-label="Aumenta ${label}">+</button>
      </div>
    </div>`;

  const setNo = editing ? logged.findIndex((x) => x.id === ed.editingId) + 1 : logged.length + 1;
  const editor = showEditor ? `
    <div class="editor ${editing ? 'edit-mode' : ''}">
      <div class="ed-head">
        <span style="font-weight:600">${editing ? `Modifica serie ${setNo}` : `Serie ${setNo}`}</span>
        ${editing ? `<button class="link-btn danger" data-act="delset">Elimina</button>`
          : (ed.extra ? `<button class="link-btn" data-act="noextra" style="color:var(--muted)">Annulla</button>` : '')}
      </div>
      ${stepper('kg', 'Carico', ed.kg, info.inc || 2.5)}
      ${info.unilateral ? stepper('reps_d', 'Destro', ed.reps_d, 1) + stepper('reps_s', 'Sinistro', ed.reps_s, 1) : stepper('reps', 'Reps', ed.reps, 1)}
      <div class="seg">${RIR.map((l, i) => `<button class="${(ed.rir ?? 0) === i ? 'on' : ''}" data-act="rir" data-v="${i}">${l}</button>`).join('')}</div>
    </div>` : `
    <div class="done-box">
      <span>Esercizio completato</span>
      <button class="link-btn" data-act="extra">+ Serie extra</button>
    </div>`;

  const nextSlot = slots[idx + 1];
  const isLast = idx === slots.length - 1;
  let main;
  if (editing) main = `<button class="btn amber" data-act="saveset">Salva modifica</button>`;
  else if (showEditor) main = `<button class="btn primary" data-act="logset">Serie ${setNo} fatta</button>`;
  else if (!isLast) main = `<button class="btn primary" data-act="ex" data-i="${idx + 1}">Prossimo esercizio</button>`;
  else if (!s.ended_at) main = `<button class="btn primary" data-act="end">Termina seduta</button>`;
  else main = `<a class="btn outline" href="#/sessions">Chiudi</a>`;

  return `<section class="page with-bar">
    <div class="top">
      <a class="icon-btn" href="#/" aria-label="Home">${I.back}</a>
      <div class="top-title" style="align-items:center;text-align:center">
        <span style="font-family:var(--display);font-size:22px;font-weight:700;text-transform:uppercase">${esc(s.template_name)}</span>
        <span class="sub">${s.ended_at ? `${fmtDate(s.started_at)} · chiusa` : `Esercizio ${idx + 1} di ${slots.length}`}</span>
      </div>
      ${s.ended_at
        ? `<button class="sm-btn" data-act="delsession">Elimina</button>`
        : `<button class="sm-btn" data-act="end">Termina</button>`}
    </div>
    <div class="chips">${chips}</div>
    <div class="stack" style="gap:6px">
      <div class="ex-head">
        <a class="h2" href="#/ex/${encodeURIComponent(slot.ex)}">${esc(info.name)}</a>
        <span class="ex-scheme">${scheme}</span>
      </div>
      ${slot.note ? `<div class="note">${esc(slot.note)}${slot.rir === 1 ? ' · <b style="color:var(--text)">1 RIR</b>' : ''}</div>` : ''}
      ${myNote ? `<div class="note mine">${esc(myNote)}</div>` : ''}
    </div>
    <div class="last">
      <span class="sub">${last ? `Ultima · ${fmtDate(last.session.started_at)}` : 'Ultima volta'}${info.unilateral && last ? '<br>D/S' : ''}</span>
      <span class="num" style="text-align:right">${last ? perfText(last.sets, slot.max) : 'nessun dato'}</span>
    </div>
    ${loggedRows}
    ${editor}
    ${nextSlot ? `<div class="next-line"><span>Poi: ${esc(exerciseInfo(nextSlot.ex).name)}</span><span>${nextSlot.sets} × ${nextSlot.min}-${nextSlot.max}</span></div>` : ''}
  </section>
  <div class="bar"><div class="bar-in">
    <button class="btn ghost" data-act="note" aria-label="Nota esercizio">${I.pen}</button>
    ${main}
  </div></div>`;
}

function exerciseKeys() {
  const keys = [];
  const p = activeProgram();
  for (const t of p.data.templates) for (const sl of t.slots) if (!keys.includes(sl.ex)) keys.push(sl.ex);
  for (const s of all('sets')) if (!keys.includes(s.exercise_key)) keys.push(s.exercise_key);
  return keys;
}
function slotFor(key) {
  for (const t of activeProgram().data.templates) { const sl = t.slots.find((x) => x.ex === key); if (sl) return sl; }
  return null;
}

function viewExercises() {
  const rows = exerciseKeys().map((k) => {
    const last = lastPerformance(k, null);
    const sl = slotFor(k);
    return `<a class="row" href="#/ex/${encodeURIComponent(k)}">
      <span class="r-main"><span class="r-title">${esc(exerciseInfo(k).name)}</span>
      <span class="sub num">${last ? perfText(last.sets, sl?.max) : 'nessun dato'}</span></span>${I.chev}</a>`;
  }).join('');
  return `<section class="page">
    <div class="top"><a class="icon-btn" href="#/" aria-label="Home">${I.back}</a><div style="flex:1"></div></div>
    <h1 class="h1">Esercizi</h1>
    <div class="stack">${rows}</div>
  </section>`;
}

function viewExercise(key) {
  const info = exerciseInfo(key);
  const sl = slotFor(key);
  const bySession = new Map();
  for (const s of all('sets')) {
    if (s.exercise_key !== key) continue;
    if (!bySession.has(s.session_id)) bySession.set(s.session_id, []);
    bySession.get(s.session_id).push(s);
  }
  const hist = [...bySession].map(([sid, sets]) => ({ sess: get('sessions', sid), sets: sets.sort((a, b) => a.set_index - b.set_index) }))
    .filter((h) => h.sess).sort((a, b) => Date.parse(b.sess.started_at) - Date.parse(a.sess.started_at));
  const rows = hist.map((h, i) => {
    const prev = hist[i + 1];
    const jump = prev && Math.max(...h.sets.map((x) => +x.kg || 0)) > Math.max(...prev.sets.map((x) => +x.kg || 0));
    return `<a class="h-row ${jump ? 'h-jump' : ''}" href="#/s/${h.sess.id}">
      <span class="h-date">${fmtDate(h.sess.started_at)}<br><span class="h-tpl">${esc(h.sess.template_name)}</span></span>
      <span class="h-val">${perfText(h.sets, sl?.max)}</span>
    </a>`;
  }).join('');
  const note = get('exercise_notes', key)?.note;
  return `<section class="page">
    <div class="top"><a class="icon-btn" href="javascript:history.back()" aria-label="Indietro">${I.back}</a><div style="flex:1"></div></div>
    <div class="stack" style="gap:4px">
      <h1 class="h1" style="font-size:36px">${esc(info.name)}</h1>
      <span class="sub">${sl ? `${sl.sets} × ${sl.min}-${sl.max} · ${RIR[sl.rir ?? 0].toLowerCase()}` : 'Non presente nel programma attivo'}${info.unilateral ? ' · unilaterale, reps destro/sinistro' : ''}</span>
    </div>
    <div class="section">
      <div class="label">Storico</div>
      <div class="hist">${rows || '<div class="empty">Nessuna serie registrata.</div>'}</div>
    </div>
    <div class="section">
      <div class="top"><span class="label">Note</span><button class="link-btn" data-act="exnote" data-k="${esc(key)}">${note ? 'Modifica' : 'Aggiungi'}</button></div>
      ${note ? `<div class="note mine">${esc(note)}</div>` : ''}
    </div>
  </section>`;
}

function viewSessions() {
  const rows = sessionsDesc().map((s) => {
    const n = setsOf(s.id).length;
    return `<a class="row" href="#/s/${s.id}">
      <span class="r-main"><span class="r-title">${esc(s.template_name)}</span>
      <span class="sub">${fmtDate(s.started_at)} · ${s.ended_at ? duration(s.started_at, s.ended_at) : 'in corso'} · ${n} serie</span></span>${I.chev}</a>`;
  }).join('');
  return `<section class="page">
    <div class="top"><a class="icon-btn" href="#/" aria-label="Home">${I.back}</a><div style="flex:1"></div></div>
    <h1 class="h1">Sedute</h1>
    <div class="stack">${rows || '<div class="empty">Nessuna seduta.</div>'}</div>
  </section>`;
}

function viewSettings() {
  const u = currentUser();
  const st = syncState();
  const stTxt = { local: 'Solo locale', idle: 'Sincronizzato', syncing: 'Sincronizzazione…', offline: 'Offline, riprovo appena c\'è rete', error: `Errore: ${st.error}` }[st.status];
  const p = activeProgram();
  const programs = all('programs').sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  return `<section class="page">
    <div class="top"><a class="icon-btn" href="#/" aria-label="Home">${I.back}</a><div style="flex:1"></div></div>
    <h1 class="h1">Impostazioni</h1>

    <div class="section">
      <div class="label">Account e sync</div>
      ${u ? `
        <div class="row" style="cursor:default"><span class="r-main"><span class="r-title">${esc(u.email)}</span>
          <span class="sub">${esc(stTxt)}${st.last ? ` · ultimo ${fmtTime(st.last)}` : ''}</span></span>${syncDot()}</div>
        <div class="dlg-actions">
          <button class="btn small outline" data-act="syncnow">Sincronizza ora</button>
          <button class="btn small outline" data-act="logout">Esci</button>
        </div>` : `
        <div class="msg">I dati restano sul telefono. Accedi per il backup su Supabase: ricevi un link via mail, aprilo da questo telefono.</div>
        <form class="stack" data-form="login">
          <input class="input" type="email" name="email" placeholder="email" autocomplete="email" required>
          <button class="btn small primary" type="submit">Invia link di accesso</button>
        </form>`}
      ${ui.authMsg ? `<div class="msg ${ui.authErr ? 'err' : ''}">${esc(ui.authMsg)}</div>` : ''}
    </div>

    <div class="section">
      <div class="label">Programma</div>
      ${programs.map((x) => `<button class="row" data-act="activate" data-id="${x.id}">
        <span class="r-main"><span class="r-title">${esc(x.name)}</span><span class="sub">${x.data.templates.map((t) => esc(t.name)).join(' · ')}</span></span>
        ${x.id === p.id ? '<span class="pill accent">Attivo</span>' : ''}</button>`).join('')}
      <label class="btn small outline" style="cursor:pointer">Importa programma (JSON)<input type="file" accept="application/json,.json" data-file="program" hidden></label>
    </div>

    <div class="section">
      <div class="label">Export</div>
      <div class="dlg-actions">
        <button class="btn small outline" data-act="csv">CSV serie</button>
        <button class="btn small outline" data-act="json">Backup JSON</button>
      </div>
      <button class="link-btn" data-act="tplexport" style="align-self:flex-start">Scarica il programma attivo come modello JSON</button>
    </div>
  </section>`;
}

// ---------- render ----------
function route() {
  const h = location.hash || '#/';
  let m;
  if ((m = h.match(/^#\/s\/([\w-]+)/))) return viewSession(m[1]);
  if ((m = h.match(/^#\/ex\/(.+)$/))) return viewExercise(decodeURIComponent(m[1]));
  if (h.startsWith('#/ex')) return viewExercises();
  if (h.startsWith('#/sessions')) return viewSessions();
  if (h.startsWith('#/settings')) return viewSettings();
  return viewHome();
}
let pending = false;
function render() {
  // non ridisegna mentre stai scrivendo in un campo
  const a = document.activeElement;
  if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') && $app.contains(a)) { pending = true; return; }
  pending = false;
  $app.innerHTML = route();
}
document.addEventListener('focusout', () => setTimeout(() => { if (pending) render(); }, 0));
window.addEventListener('hashchange', () => { ui.authMsg = ''; render(); window.scrollTo(0, 0); });

// ---------- azioni ----------
function sessionCtx() {
  const m = (location.hash || '').match(/^#\/s\/([\w-]+)/);
  if (!m) return null;
  const s = get('sessions', m[1]);
  if (!s) return null;
  const tpl = templateOf(s);
  const slots = [...tpl.slots];
  for (const x of setsOf(s.id)) if (!slots.some((sl) => sl.ex === x.exercise_key)) slots.push({ ex: x.exercise_key, sets: 0, min: null, max: null, rir: 0 });
  const idx = Math.min(ui.exIdx[s.id] ?? 0, slots.length - 1);
  return { s, slots, idx, slot: slots[idx], info: exerciseInfo(slots[idx].ex) };
}

function readEditorInputs() {
  const ed = ui.editor;
  if (!ed) return;
  for (const inp of $app.querySelectorAll('.step-in')) {
    const f = inp.dataset.f;
    ed[f] = f === 'kg' ? parseKg(inp.value) : parseInt0(inp.value);
  }
}

$app.addEventListener('input', (e) => {
  const inp = e.target.closest('.step-in');
  if (inp && ui.editor) { const f = inp.dataset.f; ui.editor[f] = f === 'kg' ? parseKg(inp.value) : parseInt0(inp.value); }
});
$app.addEventListener('focusin', (e) => { if (e.target.classList.contains('step-in')) e.target.select(); });

$app.addEventListener('submit', async (e) => {
  const f = e.target.closest('[data-form="login"]');
  if (!f) return;
  e.preventDefault();
  const email = f.email.value.trim();
  document.activeElement?.blur();
  try {
    await login(email);
    ui.authMsg = `Link inviato a ${email}. Aprilo da questo telefono.`; ui.authErr = false;
  } catch (err) { ui.authMsg = err.message; ui.authErr = true; }
  render();
});

$app.addEventListener('change', async (e) => {
  const inp = e.target.closest('[data-file="program"]');
  if (!inp || !inp.files[0]) return;
  try {
    const json = JSON.parse(await inp.files[0].text());
    const data = json.data || json;
    if (!Array.isArray(data.templates) || !data.exercises) throw new Error('Formato non valido: servono "exercises" e "templates"');
    for (const t of data.templates) for (const sl of t.slots) if (!data.exercises[sl.ex]) throw new Error(`Esercizio "${sl.ex}" usato in ${t.name} ma non definito`);
    const name = json.name || `Programma ${new Date().toLocaleDateString('it-IT')}`;
    for (const p of all('programs')) if (p.active) await save('programs', { ...p, active: false });
    await save('programs', { id: uuid(), name, data, active: true, created_at: now(), deleted_at: null });
    alert(`${name} importato e attivo.`);
  } catch (err) { alert(`Import fallito: ${err.message}`); }
  render();
});

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const stamp = () => new Date().toISOString().slice(0, 10);

function exportCsv() {
  const num = (n) => (n == null ? '' : String(n).replace('.', ','));
  const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const lines = [['data', 'seduta', 'esercizio', 'serie', 'kg', 'reps', 'reps_d', 'reps_s', 'rir'].join(';')];
  for (const s of sessionsDesc().reverse()) {
    const sets = setsOf(s.id);
    const idxByEx = {};
    for (const x of sets) {
      idxByEx[x.exercise_key] = (idxByEx[x.exercise_key] || 0) + 1;
      lines.push([s.started_at.slice(0, 10), q(s.template_name), q(x.exercise_name), idxByEx[x.exercise_key], num(x.kg), num(x.reps), num(x.reps_d), num(x.reps_s), RIR[x.rir ?? 0]].join(';'));
    }
  }
  download(`gymtracker-serie-${stamp()}.csv`, '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
}
function exportJson() {
  const strip = (rows) => rows.map(({ _dirty, _seed, ...r }) => r);
  const out = { exported_at: now(), programs: strip([...mem.programs.values()]), sessions: strip([...mem.sessions.values()]), sets: strip([...mem.sets.values()]), exercise_notes: strip([...mem.exercise_notes.values()]) };
  download(`gymtracker-backup-${stamp()}.json`, JSON.stringify(out, null, 2), 'application/json');
}

$app.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;

  if (act === 'start') return startSession(el.dataset.k);
  if (act === 'syncnow') { await syncNow(); return render(); }
  if (act === 'logout') { if (await confirmDlg('Esci dall\'account? I dati restano sul telefono.', 'Esci')) await logout(); return render(); }
  if (act === 'csv') return exportCsv();
  if (act === 'json') return exportJson();
  if (act === 'tplexport') { const p = activeProgram(); return download(`programma-${stamp()}.json`, JSON.stringify({ name: p.name, data: p.data }, null, 2), 'application/json'); }
  if (act === 'activate') {
    const id = el.dataset.id;
    for (const p of all('programs')) if (p.active !== (p.id === id)) await save('programs', { ...p, active: p.id === id });
    return render();
  }
  if (act === 'exnote') {
    const k = el.dataset.k;
    const cur = get('exercise_notes', k);
    const v = await noteDlg(exerciseInfo(k).name, cur?.note || '');
    if (v != null) await save('exercise_notes', { exercise_key: k, note: v, deleted_at: null });
    return render();
  }

  const ctx = sessionCtx();
  if (!ctx) return;
  const { s, slots, idx, slot, info } = ctx;

  if (act === 'ex') { ui.exIdx[s.id] = +el.dataset.i; ui.editor = null; render(); return window.scrollTo(0, 0); }
  if (act === 'step') {
    readEditorInputs();
    const f = el.dataset.f; const d = +el.dataset.d;
    const ed = ui.editor;
    const cur = ed[f] ?? (f === 'kg' ? 0 : slot.min ?? 0);
    ed[f] = Math.max(0, Math.round((cur + d) * 100) / 100);
    const inp = $app.querySelector(`.step-in[data-f="${f}"]`);
    if (inp) inp.value = f === 'kg' ? fmtKg(ed[f]) : ed[f];
    return;
  }
  if (act === 'rir') { readEditorInputs(); ui.editor.rir = +el.dataset.v; return render(); }
  if (act === 'extra') { ui.editor = { ...defaultEditor(s.id, slot, info), extra: true }; return render(); }
  if (act === 'noextra') { ui.editor = null; return render(); }
  if (act === 'editset') {
    const x = get('sets', el.dataset.id);
    if (ui.editor?.editingId === x.id) { ui.editor = null; return render(); }
    ui.editor = { sid: s.id, exKey: slot.ex, editingId: x.id, kg: x.kg, reps: x.reps, reps_d: x.reps_d, reps_s: x.reps_s, rir: x.rir ?? 0 };
    return render();
  }
  if (act === 'logset' || act === 'saveset') {
    readEditorInputs();
    const ed = ui.editor;
    const bad = info.unilateral ? (ed.reps_d == null && ed.reps_s == null) : ed.reps == null;
    if (bad) return alert('Inserisci le ripetizioni');
    const fields = {
      kg: ed.kg, rir: ed.rir ?? 0,
      reps: info.unilateral ? null : ed.reps,
      reps_d: info.unilateral ? ed.reps_d : null,
      reps_s: info.unilateral ? ed.reps_s : null
    };
    if (act === 'saveset') {
      await save('sets', { ...get('sets', ed.editingId), ...fields });
    } else {
      const logged = setsOf(s.id, slot.ex);
      await save('sets', {
        id: uuid(), session_id: s.id, exercise_key: slot.ex, exercise_name: info.name,
        set_index: logged.length + 1, done_at: now(), deleted_at: null, ...fields
      });
      if (s.ended_at) await save('sessions', { ...s }); // tocca la sessione per il sync
    }
    ui.editor = null;
    return render();
  }
  if (act === 'delset') {
    const x = get('sets', ui.editor.editingId);
    if (!(await confirmDlg('Eliminare questa serie?', 'Elimina', true))) return;
    await del('sets', x);
    // rinumera le serie rimanenti
    let i = 1;
    for (const y of setsOf(s.id, slot.ex)) { if (y.set_index !== i) await save('sets', { ...y, set_index: i }); i++; }
    ui.editor = null;
    return render();
  }
  if (act === 'note') {
    const cur = get('exercise_notes', slot.ex);
    const v = await noteDlg(info.name, cur?.note || '');
    if (v != null) await save('exercise_notes', { exercise_key: slot.ex, note: v, deleted_at: null });
    return render();
  }
  if (act === 'end') {
    const missing = slots.filter((sl) => setsOf(s.id, sl.ex).length < sl.sets).length;
    if (missing && !(await confirmDlg(`${missing} esercizi non completati. Termino lo stesso?`, 'Termina'))) return;
    return endSession(s);
  }
  if (act === 'delsession') {
    if (!(await confirmDlg('Eliminare questa seduta e tutte le sue serie?', 'Elimina', true))) return;
    for (const x of setsOf(s.id)) await del('sets', x);
    await del('sessions', s);
    return go('#/sessions');
  }
});

// ---------- avvio ----------
async function boot() {
  await openDb();
  if (!mem.programs.size) {
    // seed locale: non dirty e con data vecchia, così un programma già sul server vince sempre
    await put('programs', { ...SEED_PROGRAM, active: true, created_at: '2026-07-01T00:00:00.000Z', updated_at: '2026-07-01T00:00:00.000Z', deleted_at: null, _seed: 1 }, { dirty: false, touch: false });
  }
  onChange(() => render());
  onSync(() => { if (/^#\/(settings)?$/.test(location.hash || '#/') || !location.hash) render(); });
  render();
  try { await initSync(); } catch (e) { console.warn('sync non disponibile', e); }
  render();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}
boot();
