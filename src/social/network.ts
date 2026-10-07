// A stalled connection must eventually expose retry instead of leaving a message pending forever.
export const fetchWithTimeout: typeof fetch = async (input, init) => {
  const controller = new AbortController();
  const originalSignal = init?.signal ?? (typeof Request !== 'undefined' && input instanceof Request ? input.signal : null);
  const abort = () => controller.abort();
  if (originalSignal?.aborted) controller.abort();
  else originalSignal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 15000);
  try { return await fetch(input, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timeout); originalSignal?.removeEventListener('abort', abort); }
};
