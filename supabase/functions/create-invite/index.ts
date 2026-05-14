import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { trip_id, email } = await req.json()
  if (!trip_id || !email) {
    return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400, headers: cors })
  }

  // Create invite record
  const token = crypto.randomUUID()
  const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { error: insertErr } = await supabase
    .from('trip_invites')
    .insert({ trip_id, email, token, expires_at })

  if (insertErr) {
    return new Response(JSON.stringify({ error: insertErr.message }), { status: 500, headers: cors })
  }

  const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:5173'
  const redirectTo = `${siteUrl}?token=${token}`

  // Use Supabase Auth invite — sends email via your Supabase SMTP settings
  const { error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo,
  })

  // If user already exists, inviteUserByEmail errors — fall back to a magic link
  if (inviteErr) {
    const { error: magicErr } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo },
    })
    if (magicErr) {
      return new Response(JSON.stringify({ error: magicErr.message }), { status: 500, headers: cors })
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
})
