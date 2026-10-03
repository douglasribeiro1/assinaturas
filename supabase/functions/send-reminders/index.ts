import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { formatISO, fromEpochDay, parseISO, toEpochDay } from './date.ts'
import { occurrencesBetween } from './occurrences.ts'
import type { Subscription } from './types.ts'

// Called daily by pg_cron. Auth: x-cron-secret must match app_config.cron_secret.
// VAPID keys and the cron secret live in app_config (RLS on, no policies).
const TZ = 'America/Sao_Paulo'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

function todayInTz(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date()) // YYYY-MM-DD
}

const money = (cents: number, cur: string) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: cur }).format(cents / 100)

Deno.serve(async (req) => {
  const { data: cfgRows, error: cfgErr } = await admin.from('app_config').select('key,value')
  if (cfgErr) return new Response(cfgErr.message, { status: 500 })
  const cfg = Object.fromEntries(cfgRows.map((r) => [r.key, r.value]))
  if (!cfg.cron_secret || req.headers.get('x-cron-secret') !== cfg.cron_secret) {
    return new Response('forbidden', { status: 403 })
  }
  webpush.setVapidDetails('mailto:noreply@assinaturas.app', cfg.vapid_public, cfg.vapid_private)

  const pub = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: subs, error } = await pub
    .from('subscriptions')
    .select('*')
    .eq('status', 'active')
    .is('deleted_at', null)
  if (error) return new Response(error.message, { status: 500 })
  const { data: endpoints, error: pErr } = await pub.from('push_subscriptions').select('*')
  if (pErr) return new Response(pErr.message, { status: 500 })

  const today = parseISO(todayInTz())
  let sent = 0
  let removed = 0
  for (const row of subs) {
    const target = formatISO(fromEpochDay(toEpochDay(today) + row.remind_days_before))
    const s: Subscription = {
      id: row.id, name: row.name, amountCents: row.amount_cents, currency: row.currency,
      cycle: row.cycle, cycleInterval: row.cycle_interval, anchorDate: row.anchor_date,
      status: row.status, endsOn: row.ends_on,
    }
    if (!occurrencesBetween(s, target, target).length) continue

    const when = row.remind_days_before === 0 ? 'hoje' : row.remind_days_before === 1 ? 'amanhã' : `em ${row.remind_days_before} dias`
    const payload = JSON.stringify({
      title: `${row.name} cobra ${when}`,
      body: money(row.amount_cents, row.currency),
      tag: `${row.id}-${target}`,
    })
    for (const ep of endpoints.filter((e) => e.user_id === row.user_id)) {
      try {
        await webpush.sendNotification({ endpoint: ep.endpoint, keys: { p256dh: ep.p256dh, auth: ep.auth } }, payload)
        sent++
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) {
          await pub.from('push_subscriptions').delete().eq('id', ep.id)
          removed++
        } else console.error('push failed', code)
      }
    }
  }
  return Response.json({ sent, removed })
})
