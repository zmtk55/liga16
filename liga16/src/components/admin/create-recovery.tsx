import {useEffect,useState} from 'react';
import {recoverPendingCreates} from '@/lib/entry-payment-service';
import {Button} from '@/components/ui/button';
type RecoveryState={status:'recovered';kinds:string[]}|{status:'failed';detail:string};
export function CreateRecovery({actorId}:{actorId:string|undefined}){
 const [state,setState]=useState<RecoveryState|null>(null);
 function show(rows:{kind:string;id:string}[]){if(rows.length)setState({status:'recovered',kinds:rows.map(r=>r.kind)});}
 function fail(error:Error){setState({status:'failed',detail:error.message});}
 useEffect(()=>{if(!actorId)return;let active=true;recoverPendingCreates().then(rows=>{if(active)show(rows)}).catch(error=>{if(active)fail(error)});return()=>{active=false};},[actorId]);
 if(!state)return null;
 if(state.status==='recovered'){
  const what=state.kinds.map(k=>k==='player'?'el jugador':'la pareja').join(' y ');
  return <div role="status" className="border-b bg-muted p-3 text-sm">{`Alta recuperada sin duplicar: ${what} ya quedó registrado. Selecciona el registro existente en la lista.`}</div>;
 }
 return <div role="alert" className="border-b bg-muted p-3 text-sm">{`Alta pendiente sin confirmar. No crees otra. ${state.detail} `}<Button variant="outline" size="sm" onClick={()=>recoverPendingCreates().then(show).catch(fail)}>Reintentar recuperación</Button></div>;
}
