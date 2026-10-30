/** Retain an uploaded cover across retries if the database save fails afterwards. */
export interface PendingCoverUpload { source: string; tournamentId: string; publicUrl: string }
export async function savePendingCover(
  source: string, tournamentId: string,
  pending: { current: PendingCoverUpload | null },
  upload: (source: string, tournamentId: string) => Promise<string>,
  save: (publicUrl: string) => Promise<unknown>,
): Promise<string> {
  if (!pending.current || pending.current.source !== source || pending.current.tournamentId !== tournamentId) {
    const publicUrl = await upload(source, tournamentId);
    pending.current = { source, tournamentId, publicUrl };
  }
  const url = pending.current.publicUrl;
  await save(url);
  // Keep the cache even after success: repeated retries cannot upload another object.
  // A new source or tournament invalidates it. Never delete the prior saved cover here.
  return url;
}
