import {describe,it,expect,vi,beforeEach} from 'vitest';
const state=vi.hoisted(()=>({data:[] as {id:string}[]|null,error:null as unknown}));
const query=vi.hoisted(()=>({delete:vi.fn(),update:vi.fn(),eq:vi.fn(),select:vi.fn()}));
vi.mock('../supabase',()=>({supabase:{from:vi.fn(()=>query)}}));
import {supabaseProvider as db} from './supabase';
beforeEach(()=>{state.data=[];state.error=null;query.delete.mockReturnValue(query);query.update.mockReturnValue(query);query.eq.mockReturnValue(query);query.select.mockImplementation(()=>Promise.resolve({data:state.data,error:state.error}));});
describe('provider acknowledges writes rather than trusting no error',()=>{
 const deletes=[['tournament',()=>db.deleteTournament('slug')],['pair',()=>db.deletePair('id')],['category',()=>db.deleteTournamentCategory('id')],['match',()=>db.deleteMatchById('id')],['court',()=>db.deleteCourt('id')],['player',()=>db.deletePlayer('id')],['team',()=>db.deleteTeam('slug')],['news',()=>db.deleteNews('id')],['sponsor',()=>db.deleteSponsor('id')]] as const;
 it.each(deletes)('%s filtered delete is not success',async(_,fn)=>{await expect(fn()).rejects.toThrow('No se confirmó');expect(query.select).toHaveBeenCalledWith('id');});
 it('payment remains blocked before reviewed server release, with no unsafe fallback',async()=>{await expect(db.updateRegistrationPayment('id',{status:'paid'},{requestId:'op',expectedRevision:0})).rejects.toThrow('solo historial');expect(query.update).not.toHaveBeenCalled();});
 it('schedule reports false for zero-row update',async()=>{await expect(db.saveTournamentScheduleConfig('id',{days:[],hours:[],courtNames:[],minutesPerMatch:60})).resolves.toBe(false);});
 it('duration reports false for zero-row update',async()=>{await expect(db.saveMatchDuration('id',60)).resolves.toBe(false);});
 it('schedule accepts only exact returned ID',async()=>{state.data=[{id:'id'}];await expect(db.saveTournamentScheduleConfig('id',{days:[],hours:[],courtNames:[],minutesPerMatch:60})).resolves.toBe(true);});
 it('delete propagates server failure',async()=>{state.error=Error('network');await expect(db.deleteTournament('slug')).rejects.toThrow('network');});
});
