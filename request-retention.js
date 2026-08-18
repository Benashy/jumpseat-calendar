(function attachRequestRetention(globalScope) {
  "use strict";

  const MILLISECONDS_IN_DAY = 24 * 60 * 60 * 1000;

  function isIsoDate(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day;
  }

  function retentionCutoffIso(nowMs = Date.now(), retentionDays = 7) {
    if (!Number.isFinite(nowMs) || !Number.isInteger(retentionDays) || retentionDays < 0) return null;

    const now = new Date(nowMs);
    const todayUtcMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return new Date(todayUtcMs - (retentionDays * MILLISECONDS_IN_DAY)).toISOString().slice(0, 10);
  }

  function partitionRequests(requests, options = {}) {
    const source = Array.isArray(requests) ? requests : [];
    const cutoff = retentionCutoffIso(options.nowMs, options.retentionDays ?? 7);
    if (!cutoff) return { retained: [...source], expired: [] };

    return source.reduce((result, request) => {
      const date = request?.date;
      const destination = isIsoDate(date) && date < cutoff ? result.expired : result.retained;
      destination.push(request);
      return result;
    }, { retained: [], expired: [] });
  }

  const api = {
    isIsoDate,
    partitionRequests,
    retentionCutoffIso,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    globalScope.OpsDeckRetention = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
