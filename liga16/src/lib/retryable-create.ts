export interface CreatedIdentity { id: string; slug: string }
const pending = new WeakMap<object, Promise<CreatedIdentity>>();
/** Retain identity before later work fails; coalesce clicks before a React render. */
export async function createOnce<T extends CreatedIdentity>(
  saved: {current: T | null}, create: () => Promise<T>,
): Promise<T> {
  if (saved.current) return saved.current;
  const active = pending.get(saved);
  if (active) return active as Promise<T>;
  const request = Promise.resolve().then(create).then(result => {
    saved.current = result;
    return result;
  });
  pending.set(saved, request);
  try { return await request; }
  finally { pending.delete(saved); }
}
