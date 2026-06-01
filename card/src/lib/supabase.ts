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

// On web, AsyncStorage is NOT backed by localStorage — it's in-memory, so it is
// wiped by every full-page navigation. That broke OAuth (the PKCE code_verifier
// vanished during the Google redirect → code exchange failed → user stayed
// anonymous) and broke session persistence (every reload created a fresh
// anonymous session → /signup flood + 429s). Use real localStorage on web.
const webAuthStorage =
  typeof window !== 'undefined' && window.localStorage ? window.localStorage : undefined;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS === 'web' ? webAuthStorage : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // We finalize OAuth manually (createSessionFromUrl), not via URL auto-detect.
    // PKCE: provider returns ?code= in the query (not tokens in the #hash). Far more robust on web —
    // implicit-flow #hash tokens were silently dropped on the callback, leaving the client anonymous
    // even though the server logged a successful login. createSessionFromUrl() exchanges the code via
    // /token. Works on native too (Expo Go lacks WebCrypto and falls back to a `plain` challenge,
    // which GoTrue accepts → /token 200, confirmed in logs).
    flowType: 'pkce',
    // On web, Supabase uses Navigator.locks to serialize auth token writes.
    // When init() and onAuthStateChange race during OAuth callback, both compete
    // for the same lock and the 10 s timeout fires. Since AsyncStorage on web
    // is backed by synchronous localStorage (no cross-tab races to guard), we
    // skip the lock entirely on web.
    ...(Platform.OS === 'web' && {
      lock: <R,>(_name: string, _acquireTimeout: number, fn: () => Promise<R>) => fn(),
    }),
  },
});
