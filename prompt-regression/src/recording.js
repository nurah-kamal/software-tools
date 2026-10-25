import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

// Replies are saved with their token counts and latency, under a hash of the
// model and prompt, so a run can be replayed and costed again without a key.
export const hashOf = (model, prompt) => createHash('sha256').update(`${model}\n${prompt}`).digest('hex');

export function readReplies(path) {
  const replies = new Map();
  if (!existsSync(path)) return replies;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (line.trim()) {
      const r = JSON.parse(line);
      replies.set(r.hash, r);
    }
  }
  return replies;
}

export function recording(client, path, { resume = false } = {}) {
  const saved = resume ? readReplies(path) : new Map();
  return {
    async complete(req) {
      const hash = hashOf(req.model, req.prompt);
      const hit = saved.get(hash);
      if (hit) return { ...hit, replayed: true };
      const reply = await client.complete(req);
      appendFileSync(path, JSON.stringify({ hash, ...reply }) + '\n');
      return reply;
    },
  };
}

export function replayClient(path) {
  const saved = readReplies(path);
  if (!saved.size) throw new Error(`No recording at ${path}`);
  return {
    async complete({ model, prompt }) {
      const hit = saved.get(hashOf(model, prompt));
      if (!hit) throw new Error(`${model}: no recorded reply for this prompt`);
      return hit;
    },
  };
}
