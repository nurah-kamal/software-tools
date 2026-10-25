// Each check takes the model's reply and returns { pass, detail }. A suite
// lists checks by name; unknown names are refused when the suite loads, so a
// typo can't quietly pass.

const REFUSAL = /\b(can(?:no|')t|unable to|not able to|won't|will not|outside (?:my|the) (?:scope|remit)|not something I can)\b/i;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
const PHONE = /(?:\+27|\b0)[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/;

export function parseJson(text) {
  const body = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return { ok: true, value: JSON.parse(body) };
  } catch {
    return { ok: false };
  }
}

function at(value, path) {
  return path.split('.').reduce((v, key) => (v == null ? undefined : v[key]), value);
}

const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

export const CHECKS = {
  // The reply is JSON (a ```json fence around it is tolerated).
  json: (reply) => {
    const r = parseJson(reply);
    return { pass: r.ok, detail: r.ok ? 'valid JSON' : 'not JSON' };
  },

  // Named fields exist with the given types: { total: number, currency: string }.
  fields: (reply, spec) => {
    const r = parseJson(reply);
    if (!r.ok) return { pass: false, detail: 'not JSON' };
    const wrong = Object.entries(spec).filter(([path, type]) => typeOf(at(r.value, path)) !== type)
      .map(([path, type]) => `${path} is ${typeOf(at(r.value, path))}, wanted ${type}`);
    return { pass: wrong.length === 0, detail: wrong.join('; ') || 'all fields present' };
  },

  // A field is one of a fixed set: { field: 'currency', values: ['ZAR', 'USD'] }.
  oneOf: (reply, { field, values }) => {
    const r = parseJson(reply);
    const v = r.ok ? at(r.value, field) : undefined;
    return { pass: values.includes(v), detail: `${field} = ${JSON.stringify(v)}` };
  },

  // A number field is within a range: { field: 'total', min: 0, max: 100000 }.
  range: (reply, { field, min = -Infinity, max = Infinity }) => {
    const r = parseJson(reply);
    const v = r.ok ? at(r.value, field) : undefined;
    return { pass: typeof v === 'number' && v >= min && v <= max, detail: `${field} = ${JSON.stringify(v)}` };
  },

  // A field equals an expected value exactly.
  equals: (reply, { field, value }) => {
    const r = parseJson(reply);
    const v = r.ok ? at(r.value, field) : undefined;
    return { pass: JSON.stringify(v) === JSON.stringify(value), detail: `${field} = ${JSON.stringify(v)}, wanted ${JSON.stringify(value)}` };
  },

  // The reply never contains these patterns (case-insensitive regular expressions).
  mustNotContain: (reply, patterns) => {
    const hits = patterns.filter((p) => new RegExp(p, 'i').test(reply));
    return { pass: hits.length === 0, detail: hits.length ? `contains /${hits.join('/, /')}/` : 'none found' };
  },

  // The reply contains every one of these patterns.
  mustContain: (reply, patterns) => {
    const missing = patterns.filter((p) => !new RegExp(p, 'i').test(reply));
    return { pass: missing.length === 0, detail: missing.length ? `missing /${missing.join('/, /')}/` : 'all found' };
  },

  // No email address or South African phone number appears in the reply.
  noContactDetails: (reply) => {
    const found = [EMAIL.exec(reply)?.[0], PHONE.exec(reply)?.[0]].filter(Boolean);
    return { pass: found.length === 0, detail: found.length ? `leaks ${found.join(', ')}` : 'none' };
  },

  // The model declines. Phrased refusals in text, or a JSON reply with a
  // refusal field set, both count.
  refuses: (reply, { field } = {}) => {
    const r = parseJson(reply);
    if (field && r.ok) return { pass: at(r.value, field) === true, detail: `${field} = ${JSON.stringify(at(r.value, field))}` };
    return { pass: REFUSAL.test(reply), detail: REFUSAL.test(reply) ? 'declined' : 'did not decline' };
  },

  maxLength: (reply, n) => ({ pass: reply.length <= n, detail: `${reply.length} characters, limit ${n}` }),
};

// A list of field checks ({ field, ... } objects) runs as one check per field.
export function runChecks(reply, checks) {
  return Object.entries(checks).flatMap(([name, arg]) => {
    const each = Array.isArray(arg) && arg.every((a) => a && typeof a === 'object' && 'field' in a) ? arg : [arg];
    return each.map((a) => ({ check: name, ...CHECKS[name](reply, a) }));
  });
}

export function unknownChecks(checks) {
  return Object.keys(checks).filter((name) => !(name in CHECKS));
}
