import {describe,it,expect,vi} from 'vitest';
import {savePendingCover, type PendingCoverUpload} from './pending-cover';
describe('cover retries',()=>{
 it('reuses a completed upload after a database failure',async()=>{
  const pending:{current:PendingCoverUpload|null}={current:null};
  const upload=vi.fn().mockResolvedValue('https://fixture.invalid/cover.jpg');
  const save=vi.fn().mockRejectedValueOnce(Error('db failed')).mockResolvedValueOnce(null);
  await expect(savePendingCover('data:one','a',pending,upload,save)).rejects.toThrow('db failed');
  expect(await savePendingCover('data:one','a',pending,upload,save)).toBe('https://fixture.invalid/cover.jpg');
  expect(upload).toHaveBeenCalledTimes(1);expect(save).toHaveBeenCalledTimes(2);
 });
 it('does not cache failed uploads or save a made-up URL',async()=>{
  const pending={current:null};const upload=vi.fn().mockRejectedValue(Error('upload failed'));const save=vi.fn();
  await expect(savePendingCover('data:one','a',pending,upload,save)).rejects.toThrow('upload failed');
  expect(pending.current).toBe(null);expect(save).not.toHaveBeenCalled();
 });
 it('invalidates cache when the selected file or tournament changes',async()=>{
  const pending:{current:PendingCoverUpload|null}={current:null};const upload=vi.fn().mockResolvedValue('fixture');const save=vi.fn();
  await savePendingCover('data:one','a',pending,upload,save);
  await savePendingCover('data:two','a',pending,upload,save);
  await savePendingCover('data:two','b',pending,upload,save);
  expect(upload).toHaveBeenCalledTimes(3);
 });
});
