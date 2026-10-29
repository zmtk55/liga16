import type { PaymentMethod, RegistrationStatus } from '@/types';

/** One stored registration is one record. Never pick a pair's latest payer. */
export interface IndividualRegistrationRow {
  payment_revision?: number;
  id: string;
  tournament_id: string;
  category_id: string | null;
  pair_id: string | null;
  user_id: string;
  status: RegistrationStatus;
  payment_method: PaymentMethod;
  amount_cents: number | null;
  paid_at: string | null;
  created_at: string;
}
export interface RegistrationPerson {
  id: string;
  user_id: string | null;
  display_name: string;
}
export function identifyIndividualRegistrations(
  records: IndividualRegistrationRow[], profiles: RegistrationPerson[],
) {
  const byUser = new Map<string, RegistrationPerson[]>();
  for (const p of profiles) if (p.user_id) byUser.set(p.user_id,[...(byUser.get(p.user_id) ?? []),p]);
  return records.map(r=>{
    const matches=byUser.get(r.user_id) ?? [];
    const profile=matches.length===1 ? matches[0] : null;
    return {...r, player_id:profile?.id ?? null, player_name:profile?.display_name ?? null,
      identity_status:matches.length===1 ? 'linked' as const : matches.length>1 ? 'ambiguous' as const : 'unlinked' as const};
  });
}

/** Review candidates only. Never total, merge or select a winning monetary record. */
export function groupRegistrationCandidates(
  rows: ReturnType<typeof identifyIndividualRegistrations>,
) {
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    // Unlinked rows stay separate: even equal names/accounts cannot invent a player ID.
    const key=row.player_id ? `${row.tournament_id}:${row.player_id}` : `unresolved:${row.id}`;
    groups.set(key,[...(groups.get(key) ?? []),row]);
  }
  return [...groups.entries()].map(([key,records])=>({key,records,
    needsReview:records.length!==1 || records.some(r=>r.identity_status!=='linked'),
  }));
}
