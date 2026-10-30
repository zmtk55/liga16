import {describe,it,expect,vi} from 'vitest';
import {createOnce,type CreatedIdentity} from './retryable-create';
describe('partial tournament creation',()=>{
 it('coalesces concurrent pre-render requests',async()=>{const saved={current:null};const create=vi.fn(async()=>({id:'a',slug:'a'}));const [a,b]=await Promise.all([createOnce(saved,create),createOnce(saved,create)]);expect(a).toEqual(b);expect(create).toHaveBeenCalledTimes(1);});
 it('retains successful identity when cover fails before React renders',async()=>{
  const saved:{current:CreatedIdentity|null}={current:null};const create=vi.fn().mockResolvedValue({id:'a',slug:'a'});
  const cover=vi.fn().mockRejectedValueOnce(Error('denied')).mockResolvedValue(undefined);
  const save=async()=>{const t=await createOnce(saved,create);await cover(t.id);return t;};
  await expect(save()).rejects.toThrow('denied');expect(saved.current?.id).toBe('a');await expect(save()).resolves.toEqual({id:'a',slug:'a'});expect(create).toHaveBeenCalledTimes(1);
 });
 it('does not cache failed insert',async()=>{const saved={current:null};const create=vi.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValue({id:'a',slug:'a'});await expect(createOnce(saved,create)).rejects.toThrow();await createOnce(saved,create);expect(create).toHaveBeenCalledTimes(2);});
});
