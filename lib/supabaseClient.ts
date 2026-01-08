'use client';

import { createClient } from '@supabase/supabase-js';

// ブラウザ側では anon key のみ使用（service_role は絶対に使用しない）
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// セッション管理を有効化（リロードしてもログイン状態を維持）
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});



