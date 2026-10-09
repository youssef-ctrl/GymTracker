# GymTracker

Logbook personale per palestra. PWA statica (GitHub Pages), dati local-first in IndexedDB, sync su Supabase.

## Struttura

- `index.html`, `css/app.css`, `js/app.js`: UI (home, seduta, storico esercizi, sedute, impostazioni)
- `js/db.js`: store locale IndexedDB, soft delete, flag `_dirty`
- `js/sync.js`: push delle righe dirty e pull delle righe più nuove (last-write-wins su `updated_at`)
- `js/program.js`: Mesociclo 1 (seed)
- `js/config.js`: URL progetto e chiave publishable di Supabase
- `supabase/schema.sql`: tabelle, RLS, grant
- `sw.js`: cache dell'app shell per l'uso offline. **Alza `VERSION` a ogni deploy.**

## Setup

1. Esegui `supabase/schema.sql` nell'SQL editor di Supabase.
2. GitHub: Settings → Pages → Deploy from a branch → `main` / root.
3. Supabase → Authentication → URL Configuration: Site URL e Redirect URL = `https://youssef-ctrl.github.io/GymTracker/`.
4. Apri l'URL da Chrome sul telefono → Installa app. Impostazioni → accedi con la mail.
5. Dopo il primo login: Authentication → disattiva le nuove registrazioni.

## Nuovo mesociclo

Impostazioni → "Scarica il programma attivo come modello JSON", modificalo, poi "Importa programma". Le chiavi degli esercizi (`chest-press`, ...) legano lo storico tra mesocicli: se l'esercizio è lo stesso, tieni la stessa chiave.
