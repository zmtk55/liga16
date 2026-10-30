import { describe, expect, it } from 'vitest';
import { canManageTournament, sessionRole } from './access';

describe('role source', () => {
  it('defaults to player and rejects unknown or malformed claims', () => {
    for (const value of [undefined, {}, {role:'root'}, {role: true}, {role:['admin']}]) {
      expect(sessionRole(value)).toBe('player');
    }
  });
  it('uses app metadata, not an editable fallback', () => {
    expect(sessionRole({role: 'organizer'})).toBe('organizer');
    expect(sessionRole({role: 'admin'})).toBe('admin');
    expect(sessionRole({user_metadata: {role: 'admin'}})).toBe('player');
  });
});

describe('tournament management hints', () => {
  it('keeps global administration including ownerless legacy rows', () => {
    expect(canManageTournament({id:'admin',role:'admin'},{organizer_id:null})).toBe(true);
    expect(canManageTournament({id:'admin',role:'admin'},{organizer_id:'b'})).toBe(true);
  });
  it('allows organizers only their own rows', () => {
    expect(canManageTournament({id:'a',role:'organizer'},{organizer_id:'a'})).toBe(true);
    expect(canManageTournament({id:'a',role:'organizer'},{organizer_id:'b'})).toBe(false);
    expect(canManageTournament({id:'a',role:'organizer'},{organizer_id:null})).toBe(false);
  });
  it('denies anonymous and non-organizers even if an owner field matches', () => {
    expect(canManageTournament(null,{organizer_id:null})).toBe(false);
    for (const role of ['player','captain','club','sponsor'] as const) {
      expect(canManageTournament({id:'a',role},{organizer_id:'a'})).toBe(false);
    }
  });
});
