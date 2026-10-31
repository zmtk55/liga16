import {it,expect,vi} from 'vitest';
vi.mock('./supabase',()=>({supabase:null}));
vi.mock('./data',()=>({db:{}}));
const createEntryResource=vi.hoisted(()=>vi.fn(async(_t:string,_r:string,_k:string,payload:{display_name:string})=>({id:'new',display_name:payload.display_name})));
vi.mock('./entry-payment-service',async(importOriginal)=>{
 const m=await importOriginal<typeof import('./entry-payment-service')>();
 return {...m,createEntryResource};
});
import {resolveTournamentPlayer} from './players';
import type {PlayerProfile} from '@/types';
const players=[{id:'a',display_name:'Ana'},{id:'b',display_name:'Ana'}] as PlayerProfile[];
it('name alone without operation key is rejected',async()=>{await expect(resolveTournamentPlayer('Ana',undefined,players,'t',true)).rejects.toThrow('Falta clave de alta');});
it('name alone creates a new resource, never selects the first homonym',async()=>{
 const p=await resolveTournamentPlayer('Ana',undefined,players,'t',true,undefined,'op1');
 expect(p?.id).toBe('new');
 expect(createEntryResource).toHaveBeenCalledWith('t','op1','player',{display_name:'Ana'});
});
it('an explicit no-account player ID selects the correct homonym',async()=>{await expect(resolveTournamentPlayer('Ana','b',players,'t',true)).resolves.toBe(players[1]);});
it('changed name invalidates selected identity',async()=>{await expect(resolveTournamentPlayer('Otra','b',players,'t',true)).rejects.toThrow('seleccionar');});
it('stale missing ID is not replaced with similar name',async()=>{await expect(resolveTournamentPlayer('Ana','gone',players,'t',true)).rejects.toThrow('seleccionar');});
