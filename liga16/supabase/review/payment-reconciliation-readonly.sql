-- Solo diagnóstico. No suma, fusiona, borra ni modifica pagos. No exporta auth emails.
BEGIN READ ONLY;
WITH linked AS (
 SELECT r.id,r.tournament_id,r.category_id,r.pair_id,r.user_id,r.status,r.amount_cents,
   p.id AS player_id
 FROM public.registrations r LEFT JOIN public.player_profiles p ON p.user_id=r.user_id
), candidates AS (
 SELECT tournament_id,player_id,count(*) AS rows,
   array_agg(id ORDER BY id) AS source_registration_ids,
   array_agg(DISTINCT category_id) AS category_ids,
   array_agg(DISTINCT status::text) AS states,
   array_agg(DISTINCT amount_cents) AS recorded_amounts
 FROM linked WHERE player_id IS NOT NULL GROUP BY tournament_id,player_id
)
SELECT * FROM candidates WHERE rows>1 ORDER BY rows DESC,tournament_id,player_id;
SELECT count(*) AS unlinked_registration_count
FROM public.registrations r LEFT JOIN public.player_profiles p ON p.user_id=r.user_id
WHERE p.id IS NULL;
-- Una pareja tiene dos jugadores; contar registros identificados, NO deducir pagos.
SELECT p.tournament_id,p.id AS pair_id,
  (p.player1_id IS NOT NULL)::int+(p.player2_id IS NOT NULL)::int AS linked_pair_players,
  count(r.id) AS registration_rows
FROM public.pairs p LEFT JOIN public.registrations r ON r.pair_id=p.id
GROUP BY p.tournament_id,p.id,p.player1_id,p.player2_id
ORDER BY p.tournament_id,p.id;
ROLLBACK;
