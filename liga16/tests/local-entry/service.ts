import type {TournamentEntryService} from '../../src/lib/tournament-entry-service';
async function request(tournamentId:string,method='GET'){
 const response=await fetch(`/__fixture/entry?tournament=${encodeURIComponent(tournamentId)}`,{method});
 const result=await response.json();if(!response.ok)throw Error(result.error);return result;
}
export const tournamentEntryService:TournamentEntryService={available:true,load:id=>request(id),enter:id=>request(id,'POST')};
