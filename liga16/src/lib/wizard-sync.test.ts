import { describe, expect, it, vi } from "vitest";
import { syncWizard, type WizardTeam } from "./wizard-sync";
import type { DataProvider } from "./data/provider";
import type { CategoryValue } from "./categories";
import type { Match, Pair, TournamentCategory } from "@/types";
function fixture() {
 const cats = [{id:"c", tournament_id:"t", name:"5ta", category:"5ta", sex:"F", max_pairs:16, price_cents:500, min_level:2, max_level:5, registered_pairs:1}] as TournamentCategory[];
 const pairs = [{id:"p", tournament_id:"t", category_id:"c", name:"Las palas", player1_id:"ana", player2_id:"bea", group_name:"Grupo A", seed:2}] as Pair[];
 const matches: Match[] = [];
 const db = {
  getTournamentCategories: vi.fn(async()=>cats), getTournamentPairs:vi.fn(async()=>pairs), listMatchesByTournament:vi.fn(async()=>matches),
  createTournamentCategory:vi.fn(async(data)=>{const row={...data,id:"new-c"};cats.push(row);return row;}),
  updateTournamentCategory:vi.fn(async(id,data)=>{Object.assign(cats.find(c=>c.id===id)!,data);return cats.find(c=>c.id===id)!;}), deleteTournamentCategory:vi.fn(async()=>{}),
  createPair:vi.fn(async(data)=>{const row={...data,id:"new-p"};pairs.push(row);return row;}),
  updatePair:vi.fn(async(id,data)=>{Object.assign(pairs.find(p=>p.id===id)!,data);return pairs.find(p=>p.id===id)!;}),deletePair:vi.fn(async()=>true),updateMatch:vi.fn(async()=>null),
 };
 const categories: CategoryValue[]=[{id:"row",persistedId:"c",label:"5ta",sex:"F",division:"5ta",max_pairs:16}];
 const teams:WizardTeam[]=[{id:"p",categoryKey:"row",name:"Las palas",player1:"ana",player2:"bea",division:"5ta",sex:"F",group:"Grupo A",logo:null}];
 const player=vi.fn(async(name:string)=>({id:name}));
 const run=(save=true)=>syncWizard(db as unknown as DataProvider,"t",categories,teams,save,999,player,async(url)=>url);
 const addMatch=(status="scheduled")=>matches.push({id:"m",category_name:"5ta",tournament_id:"t",round:"Grupo A · J1",court_name:null,scheduled_at:null,winner:null,side_a:{pair_id:"p",pair_name:"Las palas"},side_b:{pair_id:"q",pair_name:"Rival"},sets:[],status:status as Match["status"]} as Match);
 return {db,categories,teams,cats,pairs,matches,player,run,addMatch};
}
describe("wizard sync por ID",()=>{
 it("no vuelve a subir escudo cuando falla guardar pareja",async()=>{const f=fixture();f.teams[0].logo="data:image/png;base64,fixture";const upload=vi.fn(async(url:string)=>url.startsWith("data:")?"https://fixture.invalid/crest.png":url);f.db.updatePair.mockRejectedValueOnce(Error("revoked"));const run=()=>syncWizard(f.db as unknown as DataProvider,"t",f.categories,f.teams,true,999,f.player,upload);await expect(run()).rejects.toThrow("revoked");expect(f.teams[0].logo).toBe("https://fixture.invalid/crest.png");await run();expect(upload.mock.calls.filter(c=>c[0].startsWith("data:"))).toHaveLength(1);});
 it("renombra pareja y cambia jugadores sin crear duplicado ni perder grupo/seed",async()=>{const f=fixture();f.teams[0].name="Nuevo nombre";f.teams[0].player2="carla";await f.run();expect(f.db.updatePair).toHaveBeenCalledWith("p",expect.objectContaining({name:"Nuevo nombre",player2_id:"carla"}));expect(f.db.createPair).not.toHaveBeenCalled();expect(f.pairs[0]).toMatchObject({seed:2,group_name:"Grupo A"});});
 it("renombra categoría in situ y conserva precio y campos no editados",async()=>{const f=fixture();f.categories[0].label="Open";await f.run(false);expect(f.db.deleteTournamentCategory).not.toHaveBeenCalled();expect(f.db.createTournamentCategory).not.toHaveBeenCalled();expect(f.cats[0]).toMatchObject({id:"c",name:"Open",category:"5ta",max_pairs:16,min_level:2,price_cents:500});});
 it("nueva categoría guarda división y cupo y enlaza pareja al ID nuevo",async()=>{const f=fixture();f.categories.push({id:"fresh",label:"Suma 9",sex:"M",division:"6ta",max_pairs:12});f.teams[0].categoryKey="fresh";await f.run();expect(f.db.createTournamentCategory).toHaveBeenCalledWith(expect.objectContaining({category:"6ta",max_pairs:12}));expect(f.db.updatePair).toHaveBeenCalledWith("p",expect.objectContaining({category_id:"new-c"}));});
 it("retirar pareja sin partidos la elimina y no toca las demás",async()=>{const f=fixture();f.teams.length=0;await f.run();expect(f.db.deletePair).toHaveBeenCalledWith("p");});
 it.each(["scheduled","live","finished"])("no retira una pareja con partido %s",async(status)=>{const f=fixture();f.addMatch(status);f.teams.length=0;await expect(f.run()).rejects.toThrow("tiene partidos");expect(f.db.deletePair).not.toHaveBeenCalled();expect(f.db.updateTournamentCategory).not.toHaveBeenCalled();});
 it("bloquea cambiar integrantes con partidos",async()=>{const f=fixture();f.addMatch();f.teams[0].player1="otra";await expect(f.run()).rejects.toThrow("integrantes");expect(f.db.updatePair).not.toHaveBeenCalled();});
 it("bloquea categoría con partidos antes de escribir",async()=>{const f=fixture();f.addMatch();f.categories.push({id:"other",label:"Otra",sex:"F"});f.teams[0].categoryKey="other";await expect(f.run()).rejects.toThrow("categoría");expect(f.db.createTournamentCategory).not.toHaveBeenCalled();});
 it("no borra categorías que tienen parejas",async()=>{const f=fixture();f.categories.length=0;await expect(f.run(false)).rejects.toThrow("parejas o partidos");expect(f.db.deleteTournamentCategory).not.toHaveBeenCalled();});
 it("renombrar categoría con resultados actualiza solo etiqueta del partido",async()=>{const f=fixture();f.addMatch("finished");f.categories[0].label="Open";await f.run(false);expect(f.db.updateMatch).toHaveBeenCalledWith("m",{category_name:"Open"});});
 it("fallo de directorio no reemplaza jugadores por null ni continúa",async()=>{const f=fixture();f.player.mockRejectedValueOnce(new Error("red"));await expect(f.run()).rejects.toThrow("red");expect(f.db.updatePair).not.toHaveBeenCalled();expect(f.db.updateTournamentCategory).not.toHaveBeenCalled();});
 it("reintentar tras fallo conserva IDs creados y no duplica",async()=>{const f=fixture();f.categories.push({id:"fresh",label:"Nueva",sex:"F"});f.teams.push({...f.teams[0],id:undefined,name:"Nueva pareja"});f.db.deletePair.mockRejectedValueOnce(new Error("red"));f.pairs.push({...f.pairs[0],id:"remove"});await expect(f.run()).rejects.toThrow("red");await f.run();expect(f.db.createTournamentCategory).toHaveBeenCalledTimes(1);expect(f.db.createPair).toHaveBeenCalledTimes(1);});
});
it('entry failure retries same pair and explicit player IDs, never copies price into payment',async()=>{
 const f=fixture();f.teams[0].id=undefined;f.pairs.length=0;
 const entry=vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(Error('entry failed')).mockResolvedValue(undefined);
 const run=()=>syncWizard(f.db as unknown as DataProvider,'t',f.categories,f.teams,true,999,f.player,async u=>u,entry);
 await expect(run()).rejects.toThrow('entry failed');expect(f.teams[0].id).toBe('new-p');expect(f.teams[0].player1Id).toBe('ana');
 await run();expect(f.db.createPair).toHaveBeenCalledTimes(1);expect(entry.mock.calls.every(c=>c.length===2)).toBe(true);
});

it('keeps first pair-create operation after unknown response, replay never creates a second pair',async()=>{
 const f=fixture();f.teams[0].id=undefined;f.pairs.length=0;let commits=0;let stored:Pair|null=null;
 const create=vi.fn(async(data:Parameters<DataProvider['createPair']>[0],_key:string)=>{if(!stored){stored={...data,id:'committed'} as Pair;commits++;throw Error('response lost');}return stored;});
 const run=()=>syncWizard(f.db as unknown as DataProvider,'t',f.categories,f.teams,true,999,f.player,async u=>u,undefined,create);
 await expect(run()).rejects.toThrow('response lost');const key=f.teams[0].pairOperation;await run();expect(commits).toBe(1);expect(create.mock.calls[1][1]).toBe(key);expect(f.teams[0].id).toBe('committed');
});
