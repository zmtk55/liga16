import {describe,it,expect,vi,beforeEach} from 'vitest';
const state=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('./supabase',()=>({supabase:{rpc:state.rpc}}));
import {findUsersByEmail,listOrganizers,setOrganizerRole,setTournamentOrganizer} from './organizer-admin';
beforeEach(()=>{vi.clearAllMocks();state.rpc.mockResolvedValue({data:null,error:null});});
describe('organizer admin rpc client',()=>{
 it('rejects short email searches without calling the server',async()=>{
  await expect(findUsersByEmail('ab')).rejects.toThrow('3 caracteres');
  await expect(findUsersByEmail('  ')).rejects.toThrow('3 caracteres');
  expect(state.rpc).not.toHaveBeenCalled();
 });
 it('searches with the trimmed email',async()=>{
  state.rpc.mockResolvedValue({data:[{id:'u1',email:'ana@x.com',role:'player'}],error:null});
  await expect(findUsersByEmail('  ana@x.com ')).resolves.toEqual([{id:'u1',email:'ana@x.com',role:'player'}]);
  expect(state.rpc).toHaveBeenCalledWith('admin_find_users_by_email',{p_email:'ana@x.com'});
 });
 it('returns empty list when nothing matches',async()=>{
  state.rpc.mockResolvedValue({data:null,error:null});
  await expect(findUsersByEmail('nadie@x.com')).resolves.toEqual([]);
 });
 it('propagates the admin-only denial',async()=>{
  state.rpc.mockResolvedValue({data:null,error:Error('Solo el administrador')});
  await expect(findUsersByEmail('ana@x.com')).rejects.toThrow('Solo el administrador');
 });
 it('lists organizers',async()=>{
  state.rpc.mockResolvedValue({data:[{id:'u1',email:'org@x.com'}],error:null});
  await expect(listOrganizers()).resolves.toEqual([{id:'u1',email:'org@x.com'}]);
  expect(state.rpc).toHaveBeenCalledWith('admin_list_organizers');
 });
 it('grants the role and returns the resulting role',async()=>{
  state.rpc.mockResolvedValue({data:'organizer',error:null});
  await expect(setOrganizerRole('u1',true)).resolves.toBe('organizer');
  expect(state.rpc).toHaveBeenCalledWith('admin_set_organizer_role',{p_user:'u1',p_make:true});
 });
 it('revokes the role',async()=>{
  state.rpc.mockResolvedValue({data:'player',error:null});
  await expect(setOrganizerRole('u1',false)).resolves.toBe('player');
  expect(state.rpc).toHaveBeenCalledWith('admin_set_organizer_role',{p_user:'u1',p_make:false});
 });
 it('surfaces the still-has-tournaments refusal',async()=>{
  state.rpc.mockResolvedValue({data:null,error:Error('todavía organiza 2 torneo(s)')});
  await expect(setOrganizerRole('u1',false)).rejects.toThrow('todavía organiza');
 });
 it('assigns a tournament',async()=>{
  await setTournamentOrganizer('t1','u1');
  expect(state.rpc).toHaveBeenCalledWith('admin_set_tournament_organizer',{p_tournament:'t1',p_user:'u1'});
 });
 it('unassigns a tournament with null',async()=>{
  await setTournamentOrganizer('t1',null);
  expect(state.rpc).toHaveBeenCalledWith('admin_set_tournament_organizer',{p_tournament:'t1',p_user:null});
 });
 it('propagates assignment errors',async()=>{
  state.rpc.mockResolvedValue({data:null,error:Error('Primero dale el rol')});
  await expect(setTournamentOrganizer('t1','u1')).rejects.toThrow('Primero dale el rol');
 });
});
