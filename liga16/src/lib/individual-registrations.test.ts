import {describe,it,expect} from 'vitest';
import {groupRegistrationCandidates,identifyIndividualRegistrations,type IndividualRegistrationRow} from './individual-registrations';
const row=(id:string,user:string,pair='pair-a',tournament='t-a')=>({id,user_id:user,pair_id:pair,tournament_id:tournament,category_id:'cat',status:'paid',payment_method:'cash',amount_cents:50000,paid_at:null,created_at:'2026-10-28'} as IndividualRegistrationRow);
describe('individual registration identity',()=>{
 it('keeps both individual payments for the same pair without latest-wins',()=>{
  const rows=identifyIndividualRegistrations([row('r-a','u-a'),row('r-b','u-b')],[{id:'p-a',user_id:'u-a',display_name:'Ana'},{id:'p-b',user_id:'u-b',display_name:'Bea'}]);
  expect(rows.map(r=>r.id)).toEqual(['r-a','r-b']);expect(rows.map(r=>r.player_id)).toEqual(['p-a','p-b']);
 });
 it('keeps player identity with a different partner and tournament, no payment copy',()=>{
  const records=[row('r-a','u-a'),{...row('r-next','u-a','different-pair','t-next'),status:'payment_pending',amount_cents:null} as IndividualRegistrationRow];
  const rows=identifyIndividualRegistrations(records,[{id:'p-a',user_id:'u-a',display_name:'Ana'}]);
  expect(rows[0].player_id).toBe(rows[1].player_id);expect(rows[1].amount_cents).toBeNull();expect(rows[1].status).toBe('payment_pending');
 });
 it('does not invent records for tournaments a player did not enter',()=>{
  expect(identifyIndividualRegistrations([], [{id:'p-a',user_id:'u-a',display_name:'Ana'}])).toEqual([]);
 });
 it('does not bind identity by name, pair membership or an ambiguous auth link',()=>{
  const unknown=identifyIndividualRegistrations([row('r-a','unknown')],[{id:'p-a',user_id:null,display_name:'Ana'}])[0];
  expect(unknown.identity_status).toBe('unlinked');expect(unknown.player_id).toBeNull();
  const ambiguous=identifyIndividualRegistrations([row('r-a','u-a')],[{id:'p-a',user_id:'u-a',display_name:'Ana'},{id:'p-other',user_id:'u-a',display_name:'Ana'}])[0];
  expect(ambiguous.identity_status).toBe('ambiguous');expect(ambiguous.player_id).toBeNull();
 });
});

describe('one payment unit per player and tournament',()=>{
 it('flags category duplicates without summing or choosing latest payment',()=>{
  const records=[row('old','u-a'),{...row('new','u-a'),category_id:'another-category',amount_cents:70000}];
  const groups=groupRegistrationCandidates(identifyIndividualRegistrations(records,[{id:'p-a',user_id:'u-a',display_name:'Ana'}]));
  expect(groups).toHaveLength(1);expect(groups[0].needsReview).toBe(true);
  expect(groups[0].records.map(r=>r.amount_cents)).toEqual([50000,70000]);
 });
 it('does not combine the same persons payments across tournaments',()=>{
  const groups=groupRegistrationCandidates(identifyIndividualRegistrations([row('a','u-a'),row('b','u-a','different','next')],[{id:'p-a',user_id:'u-a',display_name:'Ana'}]));
  expect(groups).toHaveLength(2);expect(groups.every(g=>!g.needsReview)).toBe(true);
 });
 it('does not fabricate a second entry or payment for a pair partner',()=>{
  const groups=groupRegistrationCandidates(identifyIndividualRegistrations([row('a','u-a')],[{id:'p-a',user_id:'u-a',display_name:'Ana'},{id:'p-b',user_id:'u-b',display_name:'Bea'}]));
  expect(groups).toHaveLength(1);expect(groups[0].records[0].player_id).toBe('p-a');
 });
});
