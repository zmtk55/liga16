export interface EntryPreview {
  playerName: string;
  entered: boolean;
  amountCents: number | null;
  currency: string;
  simulated: boolean;
  paymentStatus?:string;
}
export interface TournamentEntryService {
  available: boolean;
  load: (tournamentId: string) => Promise<EntryPreview>;
  enter: (tournamentId: string) => Promise<EntryPreview>;
}
import {supabase} from './supabase';
import {entryPaymentRelease} from './entry-payment-service';
async function loadIndividual(tournamentId:string):Promise<EntryPreview>{
 if(!entryPaymentRelease.available||!supabase)throw new Error('Inscripción individual aún no disponible');
 const {data:auth,error:authError}=await supabase.auth.getUser();if(authError)throw authError;if(!auth.user)throw new Error('Inicia sesión');
 const {data:profiles,error:profileError}=await supabase.from('player_profiles').select('id,display_name').eq('user_id',auth.user.id);
 if(profileError)throw profileError;if(profiles?.length!==1)throw new Error('Revisa la identidad de tu perfil antes de inscribirte');
 const {data:entries,error}=await supabase.from('tournament_entries').select('id,entry_payments(status,amount_cents)').eq('tournament_id',tournamentId).eq('player_id',profiles[0].id);
 if(error)throw error;if(entries&&entries.length>1)throw new Error('Inscripción ambigua');
 // No category/pair price. Currency is read from this tournament only.
 const {data:t,error:tError}=await supabase.from('tournaments').select('currency').eq('id',tournamentId).single();if(tError)throw tError;
 const raw=entries?.[0]?.entry_payments as unknown;
 const payment=(Array.isArray(raw)?raw.length===1?raw[0]:null:raw) as {status:string;amount_cents:number|null}|null;
 if(entries?.length&&!payment)throw new Error('Pago no confirmado');
 return {playerName:profiles[0].display_name,entered:entries?.length===1,amountCents:payment?.amount_cents??null,currency:t.currency,simulated:false,paymentStatus:payment?.status};
}
/** Coordinated cutover uses the same release gate as manager entries. Never toggled here. */
export const tournamentEntryService: TournamentEntryService = {
 get available(){return entryPaymentRelease.available;},
 load:loadIndividual,
 async enter(tournamentId){
  if(!entryPaymentRelease.available||!supabase)throw new Error('Inscripción individual aún no disponible');
  const {data,error}=await supabase.rpc('enter_my_tournament',{tid:tournamentId});if(error)throw error;
  if(!data?.id||data.tournament_id!==tournamentId)throw new Error('No se confirmó la inscripción; reintenta');
  const result=await loadIndividual(tournamentId);if(!result.entered)throw new Error("El alta no se pudo confirmar; reintenta");return result;
 },
};
