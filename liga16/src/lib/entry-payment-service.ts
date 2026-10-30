import {pendingCreates,rememberCreate,forgetCreate,type PendingCreate} from './create-journal';
import {supabase} from './supabase';
import type {PaymentOperation} from './payment-operation';
export const entryPaymentRelease={available:true};
export interface EntryPayment {
 entry_id:string; status:'payment_pending'|'payment_review'|'paid'|'cancelled'|'refunded';
 payment_method:'cash'|'transfer'|'stripe'|'mercado_pago'|null; amount_cents:number|null; paid_at:string|null; revision:number;
}
export interface IndividualEntryRecord {
 id:string; tournament_id:string; player_id:string; created_at:string; payment:EntryPayment;
}
export async function listEntryPayments(tournamentId?:string):Promise<IndividualEntryRecord[]> {
 if (!entryPaymentRelease.available) return [];
 if (!supabase) throw new Error('No hay conexión');
 let query=supabase.from('tournament_entries').select('id,tournament_id,player_id,created_at,entry_payments(entry_id,status,payment_method,amount_cents,paid_at,revision)');
 if(tournamentId) query=query.eq('tournament_id',tournamentId);
 const {data,error}=await query;if(error)throw error;
 return (data??[]).map(row=>{
  const raw=row.entry_payments as unknown;
  const payment=(Array.isArray(raw)?raw.length===1?raw[0]:null:raw) as EntryPayment|null;
  if(!payment || payment.entry_id!==row.id) throw new Error('La inscripción no tiene un pago único confirmado');
  return {id:row.id,tournament_id:row.tournament_id,player_id:row.player_id,created_at:row.created_at,payment};
 });
}
export async function recordEntryPayment(eid:string,data:Pick<EntryPayment,'status'|'payment_method'|'amount_cents'>,operation:PaymentOperation):Promise<EntryPayment>{
 if(!entryPaymentRelease.available || !supabase)throw new Error('La edición segura de pagos aún no está habilitada. No se cambió el pago.');
 if(!operation.requestId || !Number.isInteger(operation.expectedRevision)||operation.expectedRevision<0)throw new Error('Falta revisión o clave de operación');
 const {data:receipt,error}=await supabase.rpc('record_entry_payment',{eid,expected_revision:operation.expectedRevision,request_id:operation.requestId,next_status:data.status,method:data.payment_method,amount:data.amount_cents});
 if(error)throw error;
 if(!receipt||receipt.entry_id!==eid||receipt.revision!==operation.expectedRevision+1)throw new Error('No se confirmó el recibo; reintenta los mismos datos.');
 return receipt as EntryPayment;
}

export async function ensureTournamentEntry(tournamentId:string,playerId:string):Promise<void>{
 if(!entryPaymentRelease.available)return;
 if(!supabase)throw new Error('No hay conexión');
 const {data,error}=await supabase.rpc('ensure_tournament_entry',{tid:tournamentId,pid:playerId});
 if(error)throw error;
 if(!data||data.tournament_id!==tournamentId||data.player_id!==playerId||!data.id)throw new Error('No se confirmó la inscripción individual');
}

async function sendCreate(operation:PendingCreate):Promise<Record<string,unknown>>{
 if(!supabase)throw new Error('No hay conexión');
 const {tid,requestId,kind,payload}=operation;
 const {data,error}=await supabase.rpc('create_entry_resource',{tid,request_id:requestId,kind,payload});
 if(error)throw error;
 if(!data?.id || (kind==='pair'&&data.tournament_id!==tid) || (kind==='player'&&data.display_name!==(payload as {display_name?:string}).display_name?.trim()))throw new Error('No se confirmó el alta; reintenta los mismos datos');
 return data;
}
async function createActor(){
 if(!entryPaymentRelease.available||!supabase)throw new Error('El alta segura aún no está habilitada');
 const {data,error}=await supabase.auth.getUser();if(error)throw error;if(!data.user)throw new Error('Inicia sesión');return data.user.id;
}
let createQueue:Promise<unknown>=Promise.resolve();
export function createEntryResource(tid:string,requestId:string,kind:'player'|'pair',payload:object):Promise<unknown>{
 const run=async()=>{
 const actor=await createActor();const operation={tid,requestId,kind,payload};
 rememberCreate(localStorage,actor,operation);
 const result=await sendCreate(operation);forgetCreate(localStorage,actor,requestId);return result;
 };
 const result=createQueue.then(run);createQueue=result.catch(()=>undefined);return result;
}
export async function recoverPendingCreates():Promise<{kind:string;id:string}[]>{
 if(!entryPaymentRelease.available)return [];
 const actor=await createActor();const results=[];
 for(const operation of pendingCreates(localStorage,actor)){
  const result=await sendCreate(operation);forgetCreate(localStorage,actor,operation.requestId);results.push({kind:operation.kind,id:String(result.id)});
 }
 return results;
}
