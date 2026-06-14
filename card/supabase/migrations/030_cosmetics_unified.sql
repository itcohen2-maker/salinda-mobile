-- 030_cosmetics_unified.sql
-- Premium cosmetics economy — unified catalog + ownership for dice skins,
-- premium card backs, and premium tables. (League badges are earned, not bought.)
--
-- D1 (Unified cosmetics DB): ONE catalog table (public.cosmetics) and ONE ownership
--   table (public.cosmetic_inventory) serve every cosmetic kind.
-- D2 (No retroactive punishment): purchases are permanent and idempotent. Ownership
--   is never revoked; re-buying a owned item is a no-op, never a double charge.
-- D3 (Server UTC time): every timestamp uses Postgres now() (UTC), never client time.

-- ── Catalog: server-authoritative id → kind + price. ──
CREATE TABLE IF NOT EXISTS public.cosmetics (
  id         text PRIMARY KEY,
  kind       text NOT NULL,                 -- 'dice_skin' | 'card_back' | 'table'
  price      integer NOT NULL DEFAULT 0 CHECK (price >= 0),
  created_at timestamptz NOT NULL DEFAULT now()    -- UTC (D3)
);

-- ── Unified ownership across ALL cosmetic kinds. ──
CREATE TABLE IF NOT EXISTS public.cosmetic_inventory (
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cosmetic_id text NOT NULL REFERENCES public.cosmetics(id),
  acquired_at timestamptz NOT NULL DEFAULT now(),  -- UTC (D3)
  PRIMARY KEY (user_id, cosmetic_id)
);

ALTER TABLE public.cosmetics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cosmetic_inventory ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'cosmetics_select_all') THEN
    CREATE POLICY cosmetics_select_all ON public.cosmetics FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'cosmetic_inventory_select_own') THEN
    CREATE POLICY cosmetic_inventory_select_own ON public.cosmetic_inventory
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- Active selections (one column per kind; null/'classic' = the free default).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_dice_skin       text NOT NULL DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS active_card_back_image text NOT NULL DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS active_premium_table   text NOT NULL DEFAULT 'classic';

-- ── Seed the catalog (idempotent). Prices in Salinda coins. ──
-- All purchasable cosmetics. Tables (basic + premium) are deduplicated here as a
-- SINGLE catalog so there is one source of truth for table pricing/ownership.
INSERT INTO public.cosmetics (id, kind, price) VALUES
  ('dice_solid_gold',    'dice_skin', 300),
  ('dice_neon_matrix',   'dice_skin', 400),
  ('dice_ancient_stone', 'dice_skin', 350),
  ('cardback_common',    'card_back', 150),
  ('cardback_rare',      'card_back', 300),
  ('cardback_epic',      'card_back', 500),
  ('poker_red',          'table',     20),
  ('poker_gold',         'table',     20),
  ('poker_blue',         'table',     20),
  ('table_executive',    'table',     400),
  ('table_cyber_grid',   'table',     450),
  ('table_cosmic',       'table',     600)
ON CONFLICT (id) DO UPDATE SET kind = EXCLUDED.kind, price = EXCLUDED.price;

-- ── Unified purchase RPC. ──
-- D2: already-owned → 'already_owned', NO charge, NO clawback. Atomic coin deduct.
CREATE OR REPLACE FUNCTION public.purchase_cosmetic(p_cosmetic_id text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_price    integer;
  v_coins    integer;
  v_is_admin boolean;
BEGIN
  IF v_uid IS NULL THEN RETURN 'error'; END IF;
  SELECT price INTO v_price FROM public.cosmetics WHERE id = p_cosmetic_id;
  IF v_price IS NULL THEN RETURN 'invalid'; END IF;
  IF EXISTS (SELECT 1 FROM public.cosmetic_inventory
             WHERE user_id = v_uid AND cosmetic_id = p_cosmetic_id) THEN
    RETURN 'already_owned';
  END IF;
  -- Admin God Mode: bypass the coin check + deduction entirely (free unlock).
  v_is_admin := EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = v_uid);
  IF NOT v_is_admin THEN
    SELECT total_coins INTO v_coins FROM public.profiles WHERE id = v_uid FOR UPDATE;
    IF v_coins IS NULL OR v_coins < v_price THEN RETURN 'insufficient_coins'; END IF;
    UPDATE public.profiles SET total_coins = total_coins - v_price WHERE id = v_uid;
  END IF;
  INSERT INTO public.cosmetic_inventory (user_id, cosmetic_id)
    VALUES (v_uid, p_cosmetic_id) ON CONFLICT DO NOTHING;
  RETURN 'ok';
END; $$;
GRANT EXECUTE ON FUNCTION public.purchase_cosmetic(text) TO authenticated, anon;

-- ── Generic equip RPC: must own the item (or pick the free 'classic'). ──
CREATE OR REPLACE FUNCTION public.set_active_cosmetic(p_kind text, p_id text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN 'error'; END IF;
  IF p_kind NOT IN ('dice_skin', 'card_back', 'table') THEN RETURN 'invalid'; END IF;
  IF p_id <> 'classic' AND NOT EXISTS (
    SELECT 1 FROM public.cosmetic_inventory WHERE user_id = v_uid AND cosmetic_id = p_id
  ) THEN
    RETURN 'not_owned';
  END IF;
  IF p_kind = 'dice_skin' THEN
    UPDATE public.profiles SET active_dice_skin = p_id WHERE id = v_uid;
  ELSIF p_kind = 'card_back' THEN
    UPDATE public.profiles SET active_card_back_image = p_id WHERE id = v_uid;
  ELSE
    UPDATE public.profiles SET active_premium_table = p_id WHERE id = v_uid;
  END IF;
  RETURN 'ok';
END; $$;
GRANT EXECUTE ON FUNCTION public.set_active_cosmetic(text, text) TO authenticated, anon;

-- ── Tables stay on the proven table_skins_owned / active_table_skin path (so live
--    gameplay rendering is unchanged), but pricing + the valid-id list now come
--    from the unified catalog — adding the premium tables with correct per-table
--    prices and de-duplicating the basic ones into the same catalog. ──
CREATE OR REPLACE FUNCTION public.purchase_table_skin(skin_id text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_coins    integer;
  v_owned    text[];
  v_price    integer;
  v_is_admin boolean;
BEGIN
  -- Catalog is the single source of truth for which tables exist + their price.
  SELECT price INTO v_price FROM public.cosmetics WHERE id = skin_id AND kind = 'table';
  IF v_price IS NULL THEN RETURN 'invalid_skin'; END IF;

  SELECT total_coins, table_skins_owned INTO v_coins, v_owned
    FROM public.profiles WHERE id = auth.uid() FOR UPDATE;

  IF skin_id = ANY(v_owned) THEN RETURN 'already_owned'; END IF;     -- D2: no double charge

  -- Admin God Mode: bypass the coin check + deduction (free unlock for testing).
  v_is_admin := EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid());
  IF NOT v_is_admin THEN
    IF v_coins IS NULL OR v_coins < v_price THEN RETURN 'insufficient_coins'; END IF;
    UPDATE public.profiles SET total_coins = total_coins - v_price WHERE id = auth.uid();
  END IF;

  UPDATE public.profiles
     SET table_skins_owned = array_append(table_skins_owned, skin_id)
   WHERE id = auth.uid();
  RETURN 'ok';
END; $$;
GRANT EXECUTE ON FUNCTION public.purchase_table_skin(text) TO authenticated, anon;

-- Broaden set_active_skin's table_skin branch to accept ANY catalogued table the
-- player owns (card_back / table_theme branches are unchanged from migration 004/005).
CREATE OR REPLACE FUNCTION public.set_active_skin(kind text, theme_id text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_themes_owned text[];
  v_table_skins_owned text[];
  valid_themes text[] := ARRAY['classic', 'royal', 'forest', 'ocean'];
BEGIN
  IF kind NOT IN ('card_back', 'table_theme', 'table_skin') THEN RETURN 'invalid'; END IF;

  SELECT themes_owned, table_skins_owned INTO v_themes_owned, v_table_skins_owned
    FROM public.profiles WHERE id = auth.uid() FOR UPDATE;

  IF kind = 'card_back' THEN
    IF NOT (theme_id = ANY(valid_themes)) OR NOT (theme_id = ANY(v_themes_owned)) THEN RETURN 'not_owned'; END IF;
    UPDATE public.profiles SET active_card_back = theme_id WHERE id = auth.uid();
    RETURN 'ok';
  END IF;

  IF kind = 'table_theme' THEN
    IF NOT (theme_id = ANY(valid_themes)) OR NOT (theme_id = ANY(v_themes_owned)) THEN RETURN 'not_owned'; END IF;
    UPDATE public.profiles SET active_table_theme = theme_id WHERE id = auth.uid();
    RETURN 'ok';
  END IF;

  -- table_skin
  IF theme_id = 'none' THEN
    UPDATE public.profiles SET active_table_skin = NULL WHERE id = auth.uid();
    RETURN 'ok';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cosmetics WHERE id = theme_id AND kind = 'table')
     OR NOT (theme_id = ANY(v_table_skins_owned)) THEN
    RETURN 'not_owned';
  END IF;
  UPDATE public.profiles SET active_table_skin = theme_id WHERE id = auth.uid();
  RETURN 'ok';
END; $$;
GRANT EXECUTE ON FUNCTION public.set_active_skin(text, text) TO authenticated, anon;
