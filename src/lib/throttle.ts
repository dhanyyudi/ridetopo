/**
 * Serialised rate gate.
 *
 * Each caller claims the next free slot before it awaits, so requests that
 * arrive together queue one interval apart instead of all firing the moment
 * their individual waits elapse.
 */
export function createRateLimiter(minIntervalMs: number): () => Promise<void> {
  let nextSlot = 0;

  return async () => {
    const now = Date.now();
    const slot = Math.max(now, nextSlot);
    nextSlot = slot + minIntervalMs;
    if (slot > now) {
      await new Promise((resolve) => setTimeout(resolve, slot - now));
    }
  };
}
