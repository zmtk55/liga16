import {it,expect} from 'vitest';
import {pendingCreates,rememberCreate,forgetCreate,type JournalStore} from './create-journal';
function store(){const map=new Map<string,string>();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>{map.set(k,v)},removeItem:k=>{map.delete(k)}} as JournalStore;}
const op={tid:'t',requestId:'same',kind:'player' as const,payload:{display_name:'Ana'}};
it('reload recovers original key and payload without received ID',()=>{const s=store();rememberCreate(s,'a',op);expect(pendingCreates(s,'a')).toEqual([op]);expect(()=>rememberCreate(s,'a',{...op,requestId:'new'})).toThrow('Recupera');forgetCreate(s,'a','same');expect(pendingCreates(s,'a')).toEqual([]);});
it('pending create cannot cross authenticated actors',()=>{const s=store();rememberCreate(s,'a',op);expect(pendingCreates(s,'b')).toEqual([]);});
it('changed payload cannot replace an unresolved operation',()=>{const s=store();rememberCreate(s,'a',op);expect(()=>rememberCreate(s,'a',{...op,payload:{display_name:'Otra'}})).toThrow('otros datos');});
it('storage unavailable aborts before send can be attempted',()=>{const s=store();s.setItem=()=>{throw Error('storage blocked')};expect(()=>rememberCreate(s,'a',op)).toThrow('storage blocked');});
