# VINILI — archivio interattivo

Prima versione React + Vite + Supabase. Le istruzioni in italiano sono nel file `LEGGIMI.txt`.

## Avvio
```bash
npm install
npm run dev
```

Configurazione frontend in `.env.local` (URL e publishable key Supabase). Non inserire mai chiavi segrete nel client.

Prima dell'utilizzo condiviso, applicare una sola volta lo script `supabase/fix_security_and_profiles.sql` dal Supabase SQL Editor.
