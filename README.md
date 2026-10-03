# Assinaturas

PWA para saber quanto ainda vai ser cobrado de assinaturas até o fim do mês.

- `web/` — app Vue 3 + Vite + TS (offline-first com Dexie e fila de sync). `npm install && npm run dev | test | build`.
- `supabase/migrations/` — schema Postgres + RLS.
- `supabase/functions/send-reminders/` — Edge Function de lembretes (Web Push), chamada todo dia às 12:00 UTC por pg_cron. Os arquivos `date.ts`, `occurrences.ts` e `types.ts` são cópias de `web/src/engine/`; recopie ao mudar o motor.
- Arquivos na raiz (`index.html`, `app.js`, …) — versão antiga em JS puro, mantida até o novo app substituí-la.

## Configuração

1. `cp web/.env.example web/.env` e preencha `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_VAPID_PUBLIC_KEY`.
2. **Login com Google** (manual): no Google Cloud Console crie um OAuth Client ID (Web) com redirect `https://<ref>.supabase.co/auth/v1/callback`; no Supabase, Authentication → Providers → Google, cole Client ID/Secret; em URL Configuration adicione a URL do app (e `http://localhost:5173`) em Site URL / Redirect URLs.
3. **Lembretes**: as chaves VAPID e o segredo do cron ficam na tabela `public.app_config` (RLS ligada, sem policies; só a service role lê). A chave pública VAPID precisa ser a mesma de `VITE_VAPID_PUBLIC_KEY`.
4. **Deploy** (Vercel/Netlify): root directory `web`, build `npm run build`, output `dist`, com as três variáveis `VITE_*`.
