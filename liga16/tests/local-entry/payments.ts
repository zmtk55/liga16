// Synthetic entries only. Never imported by product build.
export const entryPaymentRelease={available:true};
export async function listEntryPayments(){return [
 {id:'e0',player_id:'p0',tournament_id:'t1',created_at:'2026-10-28',payment:{entry_id:'e0',status:'paid',payment_method:'cash',amount_cents:50000,paid_at:'2026-10-28',revision:1}},
 {id:'e2',player_id:'p7',tournament_id:'t1',created_at:'2026-10-28',payment:{entry_id:'e2',status:'payment_pending',payment_method:null,amount_cents:null,paid_at:null,revision:0}},
 {id:'e1',player_id:'p1',tournament_id:'t1',created_at:'2026-10-28',payment:{entry_id:'e1',status:'payment_pending',payment_method:'transfer',amount_cents:null,paid_at:null,revision:0}},
 ];}
export async function recordEntryPayment(){throw new Error('Escrituras de pago bloqueadas en fixture visual');}
export async function ensureTournamentEntry(){throw new Error('Escrituras de alta bloqueadas en fixture visual');}

export async function createEntryResource(){throw new Error('Escrituras bloqueadas en fixture visual');}

export async function recoverPendingCreates(){return [];}
