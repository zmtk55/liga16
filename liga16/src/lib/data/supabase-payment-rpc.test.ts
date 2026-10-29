import {describe,it,expect,vi,beforeEach,afterEach} from 'vitest';
Object.defineProperty(globalThis,'localStorage',{value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},configurable:true});
const rpc=vi.hoisted(()=>vi.fn());
vi.mock('../supabase',()=>({supabase:{rpc,auth:{getUser:async()=>({data:{user:{id:'actor'}},error:null})}}}));
import {createEntryResource,entryPaymentRelease,recordEntryPayment} from '../entry-payment-service';
import {supabaseProvider as db} from './supabase';
beforeEach(()=>{entryPaymentRelease.available=true;rpc.mockReset();});
afterEach(()=>{entryPaymentRelease.available=false;});
const operation={requestId:'same-op',expectedRevision:2};
const payload={status:'paid' as const,payment_method:'cash' as const,amount_cents:100};
describe('mandatory server entry payment command',()=>{
 it('legacy is always history only even when entries enabled',async()=>{await expect(db.updateRegistrationPayment('r',payload,operation)).rejects.toThrow('historial');expect(rpc).not.toHaveBeenCalled();});
 it('release disabled makes no request',async()=>{entryPaymentRelease.available=false;await expect(recordEntryPayment('r',payload,operation)).rejects.toThrow('habilitada');expect(rpc).not.toHaveBeenCalled();});
 it('requires revision and request key before network access',async()=>{await expect(recordEntryPayment('r',payload,{requestId:'',expectedRevision:2})).rejects.toThrow('clave');expect(rpc).not.toHaveBeenCalled();});
 it('propagates conflict instead of retrying with latest revision',async()=>{rpc.mockResolvedValue({data:null,error:Error('conflict')});await expect(recordEntryPayment('r',payload,operation)).rejects.toThrow('conflict');expect(rpc).toHaveBeenCalledTimes(1);});
 it('retries lost response with identical mandatory operation',async()=>{rpc.mockRejectedValueOnce(Error('network')).mockResolvedValueOnce({data:{entry_id:'r',revision:3},error:null});await expect(recordEntryPayment('r',payload,operation)).rejects.toThrow('network');await recordEntryPayment('r',payload,operation);expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);expect(rpc.mock.calls[0][1]).toMatchObject({request_id:'same-op',expected_revision:2,amount:100});});
 it('rejects wrong identity or revision receipt',async()=>{rpc.mockResolvedValue({data:{entry_id:'other',revision:3},error:null});await expect(recordEntryPayment('r',payload,operation)).rejects.toThrow('recibo');});
});

it('creation retry keeps the exact operation and resource payload after lost first reply',async()=>{
 const body={name:'Pair',player1_id:'p1',player2_id:'p2'};
 rpc.mockRejectedValueOnce(Error('lost')).mockResolvedValueOnce({data:{id:'same',tournament_id:'t'},error:null});
 await expect(createEntryResource('t','op','pair',body)).rejects.toThrow('lost');
 await expect(createEntryResource('t','op','pair',body)).resolves.toMatchObject({id:'same'});
 expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
});
