const nativeFetch = globalThis.fetch;

if (typeof nativeFetch === 'function') {
  globalThis.fetch = async (...args) => {
    let response;
    let lastError;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        response = await nativeFetch(...args);
        if (![429, 500, 502, 503, 504].includes(response.status)) return response;
        if (response.status === 429) {
          const probeText = await response.clone().text().catch(() => '');
          if (/(INFERENCE_CAP_ERROR|Daily free limit reached|daily.*limit|quota.*exhaust)/i.test(probeText)) {
            if (attempt === 0) {
              try { await response.arrayBuffer(); } catch {}
              await new Promise(resolve => setTimeout(resolve, 5000));
              continue;
            }
            return response;
          }
        }
        if (attempt < 3) {
          try { await response.arrayBuffer(); } catch {}
          await new Promise(resolve => setTimeout(resolve, 1200 * (attempt + 1)));
          continue;
        }
        return response;
      } catch (error) {
        lastError = error;
        if (attempt >= 3 || error?.name === 'AbortError') throw error;
        await new Promise(resolve => setTimeout(resolve, 1200 * (attempt + 1)));
      }
    }
    if (response) return response;
    throw lastError || new Error('qidu transient fetch retry exhausted');
  };
}
