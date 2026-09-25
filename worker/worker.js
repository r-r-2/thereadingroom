/* Guest recommendation relay for The Reading Room.
 *
 * The room is a static site, so anonymous guests cannot write to GitHub.
 * This Worker accepts `POST { t, a, by, why, isbn?, cover? }` from the room,
 * runs the abuse checks below, and files a `recommendation` issue in the
 * repo on the guest's behalf. Adding the `approved` label to that issue
 * lets .github/workflows/shelve-recommendation.yml commit it to guestbook.js.
 *
 * Bindings (see wrangler.toml):
 *   GUEST_KV      KV namespace — per-IP counters + duplicate keys
 *   RATE_LIMITER  Workers rate-limit binding — short burst limit
 * Secrets:
 *   GITHUB_TOKEN  fine-grained PAT, this repo only, Issues: read & write
 *   IP_SALT       any long random string; IPs are stored only as salted hashes
 * Vars:
 *   REPO             "owner/name"
 *   ALLOWED_ORIGINS  comma-separated list of page origins allowed to post
 *   MAX_PER_IP       lifetime cap per IP (default 20)
 *   MAX_OPEN         stop accepting when this many issues are waiting (default 100)
 */

const DEFAULT_MAX_PER_IP = 20;
const DEFAULT_MAX_OPEN = 100;
const DUP_TTL_S = 30 * 24 * 3600;      // one guest, one copy of a book, per 30 days
const OPEN_COUNT_TTL_S = 5 * 60;       // how long to trust the cached open count
const LABEL = 'recommendation';

const LIMITS = { t: 120, a: 80, by: 40, why: 400 };
const URL_RE = /(https?:\/\/|www\.)/i;
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = originAllowed(origin, env);
    const cors = corsHeaders(allowed ? origin : '');

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method === 'GET') {
      return json({ ok: true, service: 'reading-room-guestbook' }, 200, cors);
    }
    if (request.method !== 'POST') {
      return json({ error: 'method' }, 405, cors);
    }
    if (!allowed) {
      return json({ error: 'origin', message: 'This origin may not post here.' }, 403, cors);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'invalid', message: 'Body must be JSON.' }, 400, cors);
    }

    // Honeypot: real guests never see this field.
    if (body.website) {
      return json({ error: 'invalid', message: 'Rejected.' }, 400, cors);
    }

    const entry = validate(body);
    if (entry.error) {
      return json({ error: 'invalid', message: entry.error }, 400, cors);
    }

    const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
    const ipKey = await sha256(`${env.IP_SALT || ''}|${ip}`);
    const maxPerIp = Number(env.MAX_PER_IP) || DEFAULT_MAX_PER_IP;

    // Burst limit — a handful per minute at most.
    if (env.RATE_LIMITER) {
      const { success } = await env.RATE_LIMITER.limit({ key: ipKey });
      if (!success) {
        return json({ error: 'burst', message: 'Slow down — try again in a minute.' }, 429, cors);
      }
    }

    // Lifetime cap per IP.
    const countKey = `ip:${ipKey}`;
    const used = Number(await env.GUEST_KV.get(countKey)) || 0;
    if (used >= maxPerIp) {
      return json({
        error: 'limit',
        message: `You've left ${maxPerIp} books already — thank you!`,
        remaining: 0
      }, 429, cors);
    }

    // Same guest, same book.
    const dupKey = `dup:${await sha256(`${ipKey}|${entry.t.toLowerCase()}|${entry.a.toLowerCase()}`)}`;
    if (await env.GUEST_KV.get(dupKey)) {
      return json({ error: 'duplicate', message: 'You already left that one.' }, 409, cors);
    }

    // Flood guard — cap the number of issues waiting for review.
    const maxOpen = Number(env.MAX_OPEN) || DEFAULT_MAX_OPEN;
    const open = await openCount(env);
    if (open >= maxOpen) {
      return json({ error: 'full', message: 'The table is full for now — please come back later.' }, 503, cors);
    }

    const issue = await createIssue(env, entry);
    if (!issue.ok) {
      return json({ error: 'github', message: 'Could not reach GitHub. Please try again.' }, 502, cors);
    }

    await Promise.all([
      env.GUEST_KV.put(countKey, String(used + 1)),
      env.GUEST_KV.put(dupKey, '1', { expirationTtl: DUP_TTL_S }),
      env.GUEST_KV.put('meta:open', String(open + 1), { expirationTtl: OPEN_COUNT_TTL_S })
    ]);

    return json({ number: issue.number, remaining: maxPerIp - used - 1 }, 200, cors);
  }
};

/* ---------------------------------------------------------------- */

function originAllowed(origin, env) {
  if (!origin) return false;
  const list = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  for (const pattern of list) {
    if (pattern === origin) return true;
    // "http://localhost:*" style wildcard on the port
    if (pattern.endsWith(':*')) {
      const base = pattern.slice(0, -2);
      if (origin === base || origin.startsWith(base + ':')) return true;
    }
  }
  return false;
}

function corsHeaders(origin) {
  const h = {
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
  if (origin) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers }
  });
}

function clean(v, max) {
  if (typeof v !== 'string') return '';
  return v.replace(CONTROL_RE, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function validate(body) {
  const t = clean(body.t, LIMITS.t);
  const a = clean(body.a, LIMITS.a);
  const by = clean(body.by, LIMITS.by);
  const why = clean(body.why, LIMITS.why);
  if (!t) return { error: 'Title is required.' };
  if (!a) return { error: 'Author is required.' };
  if (!by) return { error: 'Your name is required.' };
  for (const [k, v] of Object.entries({ t, a, by, why })) {
    if (URL_RE.test(v)) return { error: `Please leave links out of the ${k === 't' ? 'title' : k === 'a' ? 'author' : k === 'by' ? 'name' : 'note'}.` };
  }

  let isbn = clean(body.isbn, 20).replace(/[^0-9Xx]/g, '');
  if (isbn && !/^(\d{9}[\dXx]|\d{13})$/.test(isbn)) return { error: 'That ISBN does not look right.' };
  isbn = isbn.toUpperCase();

  let cover = clean(body.cover, 200);
  if (cover && !/^https:\/\/covers\.openlibrary\.org\/b\/(id|isbn|olid)\/[A-Za-z0-9_-]+-[SML]\.jpg$/.test(cover)) {
    return { error: 'Cover must be an Open Library cover URL.' };
  }

  return { t, a, by, why, isbn, cover };
}

async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function gh(env, path, init = {}) {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'reading-room-guestbook',
      ...(init.headers || {})
    }
  });
}

async function openCount(env) {
  const cached = await env.GUEST_KV.get('meta:open');
  if (cached != null) return Number(cached) || 0;
  try {
    const q = encodeURIComponent(`repo:${env.REPO} is:issue is:open label:${LABEL}`);
    const r = await gh(env, `/search/issues?q=${q}&per_page=1`);
    if (!r.ok) return 0;
    const data = await r.json();
    const n = Number(data.total_count) || 0;
    await env.GUEST_KV.put('meta:open', String(n), { expirationTtl: OPEN_COUNT_TTL_S });
    return n;
  } catch {
    return 0;
  }
}

async function createIssue(env, e) {
  const date = new Date().toLocaleString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  const payload = { t: e.t, a: e.a, by: e.by, why: e.why, isbn: e.isbn, cover: e.cover, date };
  const lines = [
    `**${e.t}** by ${e.a}`,
    `Left by **${e.by}**`,
    '',
    e.why ? `> ${e.why}` : '_No note._',
    '',
    e.isbn ? `ISBN: ${e.isbn}` : '',
    e.cover ? `Cover: ${e.cover}` : '',
    '',
    'Add the `approved` label to shelve this book on the guest table. Close without it to decline.',
    '',
    '<!-- rr-guest -->',
    '```json',
    JSON.stringify(payload, null, 2),
    '```'
  ].filter((l, i, arr) => !(l === '' && arr[i - 1] === ''));

  try {
    const r = await gh(env, `/repos/${env.REPO}/issues`, {
      method: 'POST',
      body: JSON.stringify({
        title: `Recommend: ${e.t} — ${e.a}`,
        body: lines.join('\n'),
        labels: [LABEL]
      })
    });
    if (!r.ok) return { ok: false };
    const data = await r.json();
    return { ok: true, number: data.number };
  } catch {
    return { ok: false };
  }
}
