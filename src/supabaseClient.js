import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  document.body.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:sans-serif;background:#f8fafc">
      <div style="background:white;border:1px solid #e2e8f0;border-radius:16px;padding:32px;max-width:400px;text-align:center">
        <div style="font-size:40px;margin-bottom:16px">⚠️</div>
        <h2 style="color:#1e293b;margin:0 0 8px">Missing Configuration</h2>
        <p style="color:#64748b;font-size:14px;margin:0">
          Add <strong>VITE_SUPABASE_URL</strong> and <strong>VITE_SUPABASE_ANON_KEY</strong> to your <code>.env.local</code> file and restart the dev server.
        </p>
      </div>
    </div>
  `
  throw new Error('Missing Supabase env vars')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
