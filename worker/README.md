# Guestbook relay

A Cloudflare Worker (free tier) that lets anonymous visitors leave a book
recommendation without a GitHub account. It validates the submission,
enforces the abuse limits, and files a `recommendation` issue in this repo.
Adding the `approved` label to that issue makes
`.github/workflows/shelve-recommendation.yml` commit it to `guestbook.js`.

The room cannot read GitHub secrets. Secrets stay in **Settings → Secrets
and variables → Actions**. `.github/workflows/deploy-guestbook-worker.yml`
pushes them to Cloudflare when you run it (or when `worker/**` lands on
`main`). You do not need `wrangler secret put`.

The shelving Action uses the built-in `GITHUB_TOKEN`. Do not add a secret
for that.

## Deploy (once)

### 1. Cloudflare

Create a free Cloudflare account. In the dashboard, copy your **Account
ID** (Workers & Pages → Overview, right sidebar).

Create a token: profile → API Tokens → **Edit Cloudflare Workers**
template (Account.Cloudflare Workers Scripts:Edit, Account.Workers KV
Storage:Edit). That is `CLOUDFLARE_API_TOKEN`.

### 2. KV namespace

On your laptop, once:

```sh
npx wrangler@4 login
npx wrangler@4 kv namespace create GUEST_KV
```

Copy the printed `id`. That is `GUEST_KV_ID`.

### 3. GitHub PAT

GitHub → Settings → Developer settings → Fine-grained tokens → Generate:

- Resource owner: the account that owns this repo
- Repository access: **Only select repositories** → this repo
- Permissions → Repository → **Issues: Read and write**. Nothing else.

That is `GUEST_GITHUB_TOKEN`.

### 4. Paste secrets

Repo → Settings → Secrets and variables → Actions.

**Secrets**

| Name | Value |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token from step 1 |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID from step 1 |
| `GUEST_GITHUB_TOKEN` | fine-grained PAT from step 3 |
| `IP_SALT` | any long random string, e.g. `openssl rand -hex 32` |

**Variable** (or a secret — either works)

| Name | Value |
| --- | --- |
| `GUEST_KV_ID` | KV `id` from step 2 |

### 5. Labels

Create `recommendation` and `approved` under Issues → Labels. (The
relay can create `recommendation` on first use, but `approved` must
exist so you can click it.)

### 6. Run the workflow

Actions → **Deploy guestbook worker** → Run workflow.

The log prints something like
`https://reading-room-guestbook.<you>.workers.dev`. Paste that into
`GUEST_RELAY_URL` near the top of the guest table section in
`reading-room.html` and commit. Later pushes to `worker/**` on `main`
redeploy on their own.

Rotate a token by editing the secret and running the workflow again.

## Abuse limits (all in `worker.js`)

| Guard | Setting |
| --- | --- |
| Lifetime cap per IP | `MAX_PER_IP` (20). IPs stored only as `sha256(IP_SALT + ip)`. |
| Burst | 3 posts / minute / IP via the Workers rate-limit binding |
| Origin | only `ALLOWED_ORIGINS` |
| Fields | title ≤120, author ≤80, name ≤40, note ≤400; no links; ISBN 10/13; cover must be an Open Library URL |
| Duplicate | same IP + title + author within 30 days → 409 |
| Flood | stop at `MAX_OPEN` (100) open issues → 503 |
| Honeypot | hidden `website` field must be empty |

## Local test

```sh
npx wrangler@4 dev            # http://localhost:8787
```

Then in another shell:

```sh
curl -i -X POST http://localhost:8787 \
  -H 'Origin: http://localhost:8000' -H 'Content-Type: application/json' \
  -d '{"t":"Dune","a":"Frank Herbert","by":"Ana","why":"Sand. Politics. Worms."}'
```

`wrangler dev` needs the secrets too; put them in `worker/.dev.vars`
(ignored by git):

```
GITHUB_TOKEN=github_pat_...
IP_SALT=anything-long
```
