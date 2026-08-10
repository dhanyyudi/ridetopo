export function debounce<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return ((...args: never[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

export function throttle<T extends (...args: never[]) => void>(fn: T, minIntervalMs: number): T {
  let lastCall = 0;
  return ((...args: never[]) => {
    const now = Date.now();
    if (now - lastCall >= minIntervalMs) {
      lastCall = now;
      fn(...args);
    }
  }) as T;
}
