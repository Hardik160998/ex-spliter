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

  const { token, user_id } = await req.json()
  if (!token || !user_id) {
    return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400, headers: cors })
  }

  const { data: invite, error: invErr } = await supabase
    .from('trip_invites')
    .select('*')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .is('used_at', null)
    .single()

  if (invErr || !invite) {
    return new Response(JSON.stringify({ error: 'Invalid or expired invite' }), { status: 400, headers: cors })
  }

  // Get user email to set as display_name
  const { data: { user } } = await supabase.auth.admin.getUserById(user_id)

  // Add member if not already in trip
  const { data: existing } = await supabase
    .from('trip_members')
    .select('id')
    .eq('trip_id', invite.trip_id)
    .eq('user_id', user_id)
    .single()

  if (!existing) {
    await supabase.from('trip_members').insert({
      trip_id: invite.trip_id,
      user_id,
      role: 'contributor',
      display_name: user?.email ?? user_id.slice(0, 8),
    })
  }

  // Mark invite as used
  await supabase.from('trip_invites').update({ used_at: new Date().toISOString() }).eq('id', invite.id)

  return new Response(JSON.stringify({ trip_id: invite.trip_id }), {
    headers: { ...cors, 'Content-Type': 'application/json' }
  })
})
