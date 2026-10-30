export interface PendingCreate {tid:string;requestId:string;kind:'player'|'pair';payload:object}
export interface JournalStore {getItem:(key:string)=>string|null;setItem:(key:string,value:string)=>void;removeItem:(key:string)=>void}
const key=(actor:string)=>`liga16.pending-create.v1.${actor}`;
export function pendingCreates(store:JournalStore,actor:string):PendingCreate[]{
 const raw=store.getItem(key(actor));if(!raw)return [];
 const value=JSON.parse(raw);if(!Array.isArray(value))throw new Error('Revisa el alta pendiente antes de continuar');return value;
}
export function rememberCreate(store:JournalStore,actor:string,operation:PendingCreate){
 const existing=pendingCreates(store,actor);
 const same=existing.find(x=>x.requestId===operation.requestId);
 if(same&&JSON.stringify(same)!==JSON.stringify(operation))throw new Error('La operación pendiente tiene otros datos');
 if(existing.some(x=>x.requestId!==operation.requestId))throw new Error('Recupera primero el alta pendiente antes de crear otra');
 store.setItem(key(actor),JSON.stringify([operation])); // storage failure aborts BEFORE network
}
export function forgetCreate(store:JournalStore,actor:string,requestId:string){
 const left=pendingCreates(store,actor).filter(x=>x.requestId!==requestId);
 if(left.length)store.setItem(key(actor),JSON.stringify(left));else store.removeItem(key(actor));
}
