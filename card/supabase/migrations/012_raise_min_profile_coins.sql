ALTER TABLE public.profiles
  ALTER COLUMN total_coins SET DEFAULT 10000;

UPDATE public.profiles
   SET total_coins = 10000
 WHERE total_coins < 10000;
