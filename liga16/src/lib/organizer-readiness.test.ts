import {describe,it,expect,vi} from 'vitest';
import {requireOrganizerBackend} from './organizer-readiness';
describe('organizer release gate before writes',()=>{
 it('does not block existing admin flow',async()=>{await expect(requireOrganizerBackend('admin')).resolves.toBeUndefined();});
 it('lets organizer writes through once the reviewed release is live',async()=>{
  const write=vi.fn();await (async()=>{await requireOrganizerBackend('organizer');write();})();expect(write).toHaveBeenCalled();
 });
 it('blocks organizer while the reviewed release is not ready',async()=>{
  const write=vi.fn();await expect((async()=>{await requireOrganizerBackend('organizer',{available:false});write();})()).rejects.toThrow('No se guardó');expect(write).not.toHaveBeenCalled();
 });
 it('does not invent or probe production capabilities',async()=>{await expect(requireOrganizerBackend('organizer',{available:false})).rejects.toThrow('revisión');});
});
