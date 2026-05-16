ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS wild_owned boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.purchase_wild()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coins integer;
  v_owned boolean;
BEGIN
  SELECT total_coins, wild_owned
    INTO v_coins, v_owned
    FROM public.profiles
   WHERE id = auth.uid()
   FOR UPDATE;

  IF v_owned THEN
    RETURN 'already_owned';
  END IF;

  IF v_coins < 200 THEN
    RETURN 'insufficient_coins';
  END IF;

  UPDATE public.profiles
     SET total_coins = total_coins - 200,
         wild_owned = true
   WHERE id = auth.uid();

  RETURN 'ok';
END;
$$;

GRANT EXECUTE ON FUNCTION public.purchase_wild() TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.consume_wild()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owned boolean;
BEGIN
  SELECT wild_owned
    INTO v_owned
    FROM public.profiles
   WHERE id = auth.uid()
   FOR UPDATE;

  IF v_owned IS DISTINCT FROM true THEN
    RETURN 'not_owned';
  END IF;

  UPDATE public.profiles
     SET wild_owned = false
   WHERE id = auth.uid();

  RETURN 'ok';
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_wild() TO authenticated;
