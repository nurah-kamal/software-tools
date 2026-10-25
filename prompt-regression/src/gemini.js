const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// One plain-text request. Returns the reply with the token counts the API
// reports and how long the call took, which is what the cost is worked out from.
export function geminiClient({
  apiKey,
  minIntervalMs = 4000,
  maxRetries = 4,
  timeoutMs = 90_000,
  maxWaitMs = 10 * 60_000,
  onRetry = () => {},
  fetchImpl = fetch,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  now = () => performance.now(),
} = {}) {
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set. Put it in .env (see .env.example).');
  let last = -Infinity;

  async function complete({ model, prompt }) {
    const body = { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0 } };
    for (let attempt = 0; ; attempt++) {
      const wait = last + minIntervalMs - now();
      if (wait > 0) await sleep(wait);
      last = now();

      const started = now();
      let res;
      try {
        res = await fetchImpl(`${BASE}/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (e) {
        const status = e.name === 'TimeoutError' ? 'timed out' : 'network error';
        if (attempt < maxRetries) { onRetry({ model, status, waitMs: 5000 }); await sleep(5000); continue; }
        throw new Error(`${model}: ${status}`);
      }
      const json = await res.json().catch(() => ({}));
      const latencyMs = Math.round(now() - started);

      if (res.ok) {
        const parts = json.candidates?.[0]?.content?.parts ?? [];
        const u = json.usageMetadata ?? {};
        return {
          text: parts.filter((p) => !p.thought).map((p) => p.text ?? '').join('').trim(),
          model: json.modelVersion ?? model,
          usage: { input: u.promptTokenCount ?? 0, output: u.candidatesTokenCount ?? 0, thinking: u.thoughtsTokenCount ?? 0 },
          latencyMs,
        };
      }
      // Only the status goes into an error; the API's message can echo the request.
      const status = `${res.status} ${json.error?.status ?? ''}`.trim();
      if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
        const ms = retryDelay(json) ?? 2 ** attempt * 5000;
        if (ms > maxWaitMs) {
          const err = new Error(`${model}: daily quota used up; it resets in about ${Math.ceil(ms / 3_600_000)} hours. Run again with --resume then.`);
          err.stop = true;
          throw err;
        }
        onRetry({ model, status, waitMs: ms });
        await sleep(ms);
        continue;
      }
      throw new Error(`${model}: request failed, ${status}`);
    }
  }

  return { complete };
}

function retryDelay(json) {
  const info = json.error?.details?.find((d) => d['@type']?.endsWith('RetryInfo'));
  const m = /^(\d+(?:\.\d+)?)s$/.exec(info?.retryDelay ?? '');
  return m ? Math.ceil(Number(m[1]) * 1000) + 500 : null;
}
