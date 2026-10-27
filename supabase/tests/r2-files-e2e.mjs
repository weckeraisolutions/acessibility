// End-to-end test of the r2-files Edge Function against the staging project.
// Uses the synthetic authors from synthetic-data.sql. Their test passwords are
// generated on first run and kept only in the gitignored .env.migration.local.
// Run: node supabase/tests/r2-files-e2e.mjs
import crypto from 'node:crypto';
import fs from 'node:fs';

const REF = 'mkuehietgxativuwmqkq';
const SUPABASE_URL = `https://${REF}.supabase.co`;
const ENV_FILE = '.env.migration.local';
const USERS = {
  A: { id: '5e5e0000-0000-4000-8000-00000000000a', email: 'autor-a@synthetic.invalid', project: '5e5e0000-0000-4000-8000-0000000001a1', page: '5e5e0000-0000-4000-8000-0000000002a1' },
  B: { id: '5e5e0000-0000-4000-8000-00000000000b', email: 'autor-b@synthetic.invalid', project: '5e5e0000-0000-4000-8000-0000000001b1' },
};

const readEnv = (file) => Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const env = readEnv(ENV_FILE);
const publishable = readEnv('.env.staging.local').VITE_SUPABASE_PUBLISHABLE_KEY.replace(/"/g, '');

const keys = await (await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys?reveal=true`, { headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}` } })).json();
const service = keys.find((k) => k.type === 'secret' || k.name === 'service_role').api_key;

async function ensurePassword(label) {
  const name = `SYNTHETIC_${label}_PASSWORD`;
  let pw = readEnv(ENV_FILE)[name];
  if (!pw) {
    pw = crypto.randomBytes(24).toString('base64url');
    fs.appendFileSync(ENV_FILE, `\n${name}=${pw}`);
  }
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${USERS[label].id}`, {
    method: 'PUT', headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: pw }),
  });
  if (!res.ok) throw new Error(`set password ${label}: HTTP ${res.status}`);
  const login = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: publishable, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: USERS[label].email, password: pw }),
  });
  const data = await login.json();
  if (!data.access_token) throw new Error(`login ${label}: HTTP ${login.status}`);
  return data.access_token;
}

const jwt = { A: await ensurePassword('A'), B: await ensurePassword('B') };
const call = (who, body) => fetch(`${SUPABASE_URL}/functions/v1/r2-files`, {
  method: 'POST', headers: { apikey: publishable, Authorization: `Bearer ${jwt[who]}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
}).then(async (r) => ({ status: r.status, body: await r.json() }));

const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

const samples = [
  { kind: 'pdf', type: 'application/pdf', name: 'livro teste.pdf', bytes: 300_000 },
  { kind: 'page-image', type: 'image/png', name: 'página 1.png', bytes: 120_000 },
  { kind: 'audiobook-audio', type: 'audio/mpeg', name: 'página 1.mp3', bytes: 250_000 },
  { kind: 'videobook', type: 'video/mp4', name: 'capítulo 1.mp4', bytes: 1_500_000 },
];

const uploaded = [];
for (const s of samples) {
  const body = crypto.randomBytes(s.bytes);
  const create = await call('A', { action: 'create-upload', project_id: USERS.A.project, page_id: s.kind.startsWith('page') ? USERS.A.page : undefined, kind: s.kind, file_name: s.name, content_type: s.type, size_bytes: s.bytes, checksum_sha256: sha(body) });
  if (create.status !== 200) { check(`${s.kind}: pedir envio`, false, `HTTP ${create.status} ${create.body.error}`); continue; }
  const put = await fetch(create.body.upload_url, { method: 'PUT', headers: create.body.upload_headers, body });
  check(`${s.kind}: enviar ao R2`, put.ok, `HTTP ${put.status}`);
  const done = await call('A', { action: 'complete-upload', file_id: create.body.file_id });
  check(`${s.kind}: confirmar envio`, done.status === 200 && done.body.file?.status === 'uploaded', `HTTP ${done.status}`);
  const dl = await call('A', { action: 'create-download', file_id: create.body.file_id });
  const got = dl.status === 200 ? Buffer.from(await (await fetch(dl.body.url)).arrayBuffer()) : Buffer.alloc(0);
  check(`${s.kind}: baixar e comparar`, sha(got) === sha(body), `${got.length} bytes`);
  uploaded.push({ ...s, id: create.body.file_id, key: done.body.file?.object_key });
}

const first = uploaded[0];
if (first) {
  const other = await call('B', { action: 'create-download', file_id: first.id });
  check('B não baixa arquivo de A', other.status === 404, `HTTP ${other.status}`);
  const otherDel = await call('B', { action: 'delete', file_id: first.id });
  check('B não apaga arquivo de A', otherDel.status === 404, `HTTP ${otherDel.status}`);
  const direct = await fetch(`https://3bdef424c4e7123b6024e95b70e6adc7.r2.cloudflarestorage.com/accessibility-studio-files/${first.key}`);
  check('link direto sem assinatura é recusado', direct.status === 400 || direct.status === 401 || direct.status === 403, `HTTP ${direct.status}`);
}

const intoB = await call('A', { action: 'create-upload', project_id: USERS.B.project, kind: 'pdf', file_name: 'x.pdf', content_type: 'application/pdf', size_bytes: 10, checksum_sha256: sha(Buffer.alloc(10)) });
check('A não envia para projeto de B', intoB.status === 404, `HTTP ${intoB.status}`);

const badType = await call('A', { action: 'create-upload', project_id: USERS.A.project, kind: 'pdf', file_name: 'x.exe', content_type: 'application/x-msdownload', size_bytes: 10, checksum_sha256: sha(Buffer.alloc(10)) });
check('tipo de arquivo proibido é recusado', badType.status === 400, `HTTP ${badType.status}`);

const declared = crypto.randomBytes(1000);
const tamper = await call('A', { action: 'create-upload', project_id: USERS.A.project, kind: 'pdf', file_name: 'troca.pdf', content_type: 'application/pdf', size_bytes: 1000, checksum_sha256: sha(declared) });
if (tamper.status === 200) {
  const put = await fetch(tamper.body.upload_url, { method: 'PUT', headers: tamper.body.upload_headers, body: crypto.randomBytes(1000) });
  check('R2 recusa conteúdo diferente do declarado', !put.ok, `HTTP ${put.status}`);
  await call('A', { action: 'delete', file_id: tamper.body.file_id });
}

for (const f of uploaded) {
  const del = await call('A', { action: 'delete', file_id: f.id });
  check(`${f.kind}: apagar`, del.status === 200);
}
if (first) {
  const gone = await call('A', { action: 'create-download', file_id: first.id });
  check('arquivo apagado não pode mais ser baixado', gone.status === 404, `HTTP ${gone.status}`);
}

const thumb = Buffer.from('thumb');
const pending = await call('A', { action: 'create-upload', project_id: USERS.A.project, kind: 'page-thumbnail', file_name: 't.webp', content_type: 'image/webp', size_bytes: thumb.length, checksum_sha256: sha(thumb) });
await fetch(pending.body.upload_url, { method: 'PUT', headers: pending.body.upload_headers, body: thumb });
const purge = await call('A', { action: 'purge-project', project_id: USERS.A.project });
check('limpar arquivos do projeto', purge.status === 200 && purge.body.deleted >= 1, `${purge.body.deleted} removido(s)`);

console.log(results.join('\n'));
console.log(`\n${results.filter((r) => r.startsWith('PASS')).length}/${results.length} aprovados`);
