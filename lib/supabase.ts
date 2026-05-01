import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hzmbhabxkglwsjbuszrm.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Client para uso público (frontend)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Client con service role (solo backend/cron jobs)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// ML API config
export const ML_CONFIG = {
  clientId: process.env.ML_CLIENT_ID || '5204519764158196',
  clientSecret: process.env.ML_CLIENT_SECRET || '',
  redirectUri: process.env.ML_REDIRECT_URI || 'https://lupaprecios.com/api/auth/callback',
  apiBase: 'https://api.mercadolibre.com',
  authUrl: 'https://auth.mercadolibre.com.ar/authorization'
}
