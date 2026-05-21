-- ============================================================
-- 018_reset_all_profile_coins.sql
-- Reset every player wallet to zero and stop auto-seeding new
-- profiles with 10,000 coins.
-- ============================================================

alter table public.profiles
  alter column total_coins set default 0;

update public.profiles
   set total_coins = 0
 where total_coins <> 0;
