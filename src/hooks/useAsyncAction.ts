import { useState, useCallback, useRef } from 'react';

/**
 * Tracks in-flight async operations by key to prevent double-clicks.
 *
 * Usage:
 *   const { run, isPending } = useAsyncAction();
 *
 *   const handleDelete = (id: string) => run(`delete:${id}`, async () => {
 *     await fetch(`/api/items/${id}`, { method: 'DELETE' });
 *     toast.success('Deleted');
 *   });
 *
 *   <button disabled={isPending(`delete:${id}`)} onClick={() => handleDelete(id)}>
 *     {isPending(`delete:${id}`) ? 'Deleting…' : 'Delete'}
 *   </button>
 */
export function useAsyncAction() {
  const [pending, setPending] = useState<Set<string>>(new Set());
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  const run = useCallback(async (key: string, fn: () => Promise<void>) => {
    if (pendingRef.current.has(key)) return;
    setPending(prev => new Set(prev).add(key));
    try {
      await fn();
    } finally {
      setPending(prev => { const next = new Set(prev); next.delete(key); return next; });
    }
  }, []);

  const isPending = useCallback((key: string) => pending.has(key), [pending]);

  return { run, isPending };
}
