// ============================================================
// supabase.ts — Supabase client singleton for the Expo app.
// Uses AsyncStorage for session persistence so the user stays
// logged in across app restarts.
// ============================================================

import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://isqxuchcmmabjosxjawt.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzcXh1Y2hjbW1hYmpvc3hqYXd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NjA2MTIsImV4cCI6MjA5MjQzNjYxMn0.qVVgJWxkXfD6AYUghJWOaAf66_DwsI8CxibDnv1MZXY';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[supabase] EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY is missing. ' +
    'Auth and online features will not work.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Expo doesn't use URL-based auth redirects
    // On web, Supabase uses Navigator.locks to serialize auth token writes.
    // When init() and onAuthStateChange race during OAuth callback, both compete
    // for the same lock and the 10 s timeout fires. Since AsyncStorage on web
    // is backed by synchronous localStorage (no cross-tab races to guard), we
    // skip the lock entirely on web.
    ...(Platform.OS === 'web' && {
      lock: (_name: string, _acquireTimeout: number, fn: () => Promise<unknown>) => fn(),
    }),
  },
});
