(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.OpsDeckNetwork = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  function boundedFetch(fetcher, timeoutMs = 8000) {
    return async (input, options = {}) => {
      const controller = new AbortController();
      const source = options.signal || input?.signal;
      const abort = () => controller.abort(source?.reason);
      if (source?.aborted) abort();
      else source?.addEventListener("abort", abort, { once: true });
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetcher(input, { ...options, signal: controller.signal });
      } finally {
        clearTimeout(timer);
        source?.removeEventListener("abort", abort);
      }
    };
  }
  return { boundedFetch };
});
