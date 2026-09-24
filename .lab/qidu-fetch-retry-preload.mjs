const nativeFetch = globalThis.fetch;
let nextModelRequestAt = 0;
const minModelGapMs = Math.max(0, Number(process.env.QIDU_MODEL_GAP_MS || 20000));

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const isModelCompletion = args => {
  const target = typeof args?.[0] === 'string' ? args[0] : String(args?.[0]?.url || '');
  return /\/chat\/completions(?:\?|$)/.test(target);
};

if (typeof nativeFetch === 'function') {
  globalThis.fetch = async (...args) => {
    let response;
    let lastError;
    const modelCall = isModelCompletion(args);
    for (let attempt = 0; attempt < 4; attempt++) {
      if (modelCall && minModelGapMs > 0) {
        const wait = Math.max(0, nextModelRequestAt - Date.now());
        if (wait > 0) await sleep(wait);
        nextModelRequestAt = Date.now() + minModelGapMs;
      }
      try {
        response = await nativeFetch(...args);
        if (![429, 500, 502, 503, 504].includes(response.status)) return response;
        if (response.status === 429) {
          const probeText = await response.clone().text().catch(() => '');
          const hardQuota = /(INFERENCE_CAP_ERROR|Daily free limit reached|daily.*limit|quota.*exhaust|insufficient_quota|quota_exceeded|配额已用尽)/i.test(probeText);
          if (hardQuota) return response;
          if (attempt < 3) {
            try { await response.arrayBuffer(); } catch {}
            await sleep(Math.max(minModelGapMs, 12000 * (attempt + 1)));
            continue;
          }
          return response;
        }
        if (attempt < 3) {
          try { await response.arrayBuffer(); } catch {}
          await sleep(1800 * (attempt + 1));
          continue;
        }
        return response;
      } catch (error) {
        lastError = error;
        if (attempt >= 3 || error?.name === 'AbortError') throw error;
        await sleep(1800 * (attempt + 1));
      }
    }
    if (response) return response;
    throw lastError || new Error('qidu transient fetch retry exhausted');
  };
}
