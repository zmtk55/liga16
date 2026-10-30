import {useEffect,useState} from 'react';
import {Link} from 'react-router';
import {useAuth} from '@/contexts/AuthContext';
import {tournamentEntryService,type EntryPreview} from '@/lib/tournament-entry-service';
import {Button} from '@/components/ui/button';
import {formatMoney} from '@/lib/format';

export function IndividualEntry({tournamentId,onClose}:{tournamentId:string;onClose:()=>void}){
 const {user}=useAuth();
 const [entry,setEntry]=useState<EntryPreview|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState<string|null>(null);
 const [loadAttempt,setLoadAttempt]=useState(0);
 useEffect(()=>{
  let active=true;
  setEntry(null);setError(null);
  if(user&&tournamentEntryService.available) tournamentEntryService.load(tournamentId).then(e=>{if(active)setEntry(e)}).catch(e=>{if(active)setError(e.message)});
  return()=>{active=false};
 },[tournamentId,user,loadAttempt]);
 async function enter(){
  setBusy(true);setError(null);
  try{setEntry(await tournamentEntryService.enter(tournamentId));}catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 return <div className="space-y-4 text-sm">
  {!user ? <Button asChild><Link to="/login">Iniciar sesión</Link></Button> : !tournamentEntryService.available ?
   <p>Registro individual pendiente de habilitar.</p> : entry ? <>
    {entry.simulated&&<p className="text-xs text-muted-foreground">Prueba local · datos y tarifa simulados</p>}
    <div className="rounded-lg border p-3"><p className="font-semibold">{entry.playerName}</p><p className="mt-1 text-muted-foreground">Inscripción individual a este torneo</p></div>
    {entry.entered ? <div role="status" className="rounded-lg bg-muted p-3"><p className="font-semibold">Ya estás inscrito</p><p className="mt-1">{entry.paymentStatus==="paid"?"Pago registrado":entry.paymentStatus==="refunded"?"Pago reembolsado":entry.paymentStatus==="cancelled"?"Inscripción cancelada":"Pago pendiente"}{entry.amountCents==null?'':` · ${formatMoney(entry.amountCents,entry.currency)}`}</p></div> : <p>Un pago por jugador y torneo{entry.amountCents==null?' · Importe por confirmar':` · ${formatMoney(entry.amountCents,entry.currency)}`}</p>}
    <p className="text-xs text-muted-foreground">Tu compañero se inscribe por separado. La categoría no se compra.</p>
    {!entry.entered&&<Button className="w-full" onClick={enter} disabled={busy}>{busy?'Inscribiendo…':'Inscribirme'}</Button>}
   </> : !error ? <p>Cargando tu inscripción…</p> : null}
  {error&&<div className="space-y-2"><p role="alert" className="text-destructive">{error}</p>{!entry&&<Button variant="outline" className="w-full" onClick={()=>setLoadAttempt(n=>n+1)}>Reintentar</Button>}</div>}
  <Button variant="outline" className="w-full" onClick={onClose}>Cerrar</Button>
 </div>;
}
