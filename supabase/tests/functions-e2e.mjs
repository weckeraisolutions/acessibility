// End-to-end checks of the AI Edge Functions on the staging project.
// Security checks always run; provider checks run with --providers once the
// AI keys are stored in Supabase secrets.
// Run: node supabase/tests/functions-e2e.mjs [--providers]
import crypto from 'node:crypto';
import fs from 'node:fs';

const REF = 'mkuehietgxativuwmqkq';
const SUPABASE_URL = `https://${REF}.supabase.co`;
const A = { id: '5e5e0000-0000-4000-8000-00000000000a', email: 'autor-a@synthetic.invalid', project: '5e5e0000-0000-4000-8000-0000000001a1', page: '5e5e0000-0000-4000-8000-0000000002a1', page2: '5e5e0000-0000-4000-8000-0000000002a2', narration: '5e5e0000-0000-4000-8000-0000000004a1' };
const B = { id: '5e5e0000-0000-4000-8000-00000000000b', email: 'autor-b@synthetic.invalid', project: '5e5e0000-0000-4000-8000-0000000001b1', page: '5e5e0000-0000-4000-8000-0000000002b1' };

const readEnv = (file) => Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const env = readEnv('.env.migration.local');
const publishable = readEnv('.env.staging.local').VITE_SUPABASE_PUBLISHABLE_KEY.replace(/"/g, '');
const mgmt = (path, init = {}) => fetch(`https://api.supabase.com/v1/projects/${REF}${path}`, { ...init, headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
const sql = async (query) => (await mgmt('/database/query', { method: 'POST', body: JSON.stringify({ query }) })).json();

async function login(user, pwName) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: publishable, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: env[pwName] }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`login failed (${res.status}); run r2-files-e2e.mjs first to create test passwords`);
  return data.access_token;
}
const jwtA = await login(A, 'SYNTHETIC_A_PASSWORD');
const jwtB = await login(B, 'SYNTHETIC_B_PASSWORD');

const call = (fn, jwt, body) => fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
  method: 'POST',
  headers: { apikey: publishable, 'Content-Type': 'application/json', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
  body: JSON.stringify(body),
}).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);

// --- Security ---
for (const fn of ['extract-text', 'generate-audio', 'detect-video-regions', 'get-elevenlabs-voices', 'preview-elevenlabs-voice', 'validate-audiodesc', 'r2-files']) {
  const r = await call(fn, null, {});
  check(`${fn}: sem login é recusado`, r.status === 401, `HTTP ${r.status}`);
}
let r = await call('validate-audiodesc', jwtA, { text: 'teste', page_id: A.page });
check('validate-audiodesc: usuário comum não chama direto', r.status === 401, `HTTP ${r.status}`);
r = await call('generate-audio', jwtA, { page_id: B.page, project_id: A.project, text: 'oi', mode: 'audiobook' });
check('generate-audio: página de outro usuário via projeto próprio', r.status === 403, `HTTP ${r.status}`);
r = await call('generate-audio', jwtA, { page_id: A.page, project_id: A.project, text: 'oi', mode: 'audiobook', narration_id: A.narration, skip_page_update: true });
check('generate-audio: narração de outra página', r.status === 403, `HTTP ${r.status}`);
r = await call('generate-audio', jwtA, { page_id: B.page, project_id: B.project, text: 'oi', mode: 'audiobook' });
check('generate-audio: projeto de outro usuário', r.status === 403, `HTTP ${r.status}`);
r = await call('extract-text', jwtA, { page_id: B.page, image_url: 'https://example.com/x.png', mode: 'audiobook' });
check('extract-text: página de outro usuário', r.status === 403, `HTTP ${r.status}`);
r = await call('extract-text', jwtA, { page_id: A.page, image_url: 'https://evil.example/x.png', mode: 'audiobook' });
check('extract-text: imagem de outro site é recusada', r.status === 400, `HTTP ${r.status}`);
r = await call('detect-video-regions', jwtA, { page_id: B.page, image_url: 'https://example.com/x.png', audiobook_text: 'x', audio_duration_seconds: 1 });
check('detect-video-regions: página de outro usuário', r.status === 403, `HTTP ${r.status}`);

// B uploads an image; A must not be able to use it through its own page.
const png = fs.readFileSync(process.argv.find((a) => a.endsWith('.png')) ?? 'supabase/tests/fixtures/pagina-teste.png');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
async function uploadImage(jwt, project, page) {
  const c = await call('r2-files', jwt, { action: 'create-upload', project_id: project, page_id: page, kind: 'page-image', file_name: 'pagina.png', content_type: 'image/png', size_bytes: png.length, checksum_sha256: sha(png) });
  await fetch(c.body.upload_url, { method: 'PUT', headers: c.body.upload_headers, body: png });
  await call('r2-files', jwt, { action: 'complete-upload', file_id: c.body.file_id });
  return c.body.file_id;
}
const imageB = await uploadImage(jwtB, B.project, B.page);
r = await call('extract-text', jwtA, { page_id: A.page, image_file_id: imageB, mode: 'audiobook' });
check('extract-text: imagem R2 de outro usuário é recusada', r.status === 400, `HTTP ${r.status}`);
await call('r2-files', jwtB, { action: 'purge-project', project_id: B.project });

// --- Providers (AI keys required) ---
if (process.argv.includes('--providers')) {
  const imageA = await uploadImage(jwtA, A.project, A.page);
  r = await call('extract-text', jwtA, { page_id: A.page, image_file_id: imageA, mode: 'audiobook', book_type: 'general' });
  check('extract-text: lê imagem do R2 e gera texto', r.status === 200 && r.body.success === true, `HTTP ${r.status} ${r.body.error ?? ''}`);

  r = await call('detect-video-regions', jwtA, { page_id: A.page, image_file_id: imageA, audiobook_text: 'Era uma vez uma ilha.', audio_duration_seconds: 4 });
  check('detect-video-regions: lê imagem do R2', r.status === 200 && r.body.success === true, `HTTP ${r.status} ${r.body.error ?? ''}`);

  r = await call('get-elevenlabs-voices', jwtA, {});
  check('get-elevenlabs-voices: lista vozes', r.status === 200 && Array.isArray(r.body.voices) && r.body.voices.length > 0, `${r.body.voices?.length ?? 0} vozes`);
  const voiceId = r.body.voices?.[0]?.voice_id ?? r.body.voices?.[0]?.id;
  if (voiceId) {
    const prev = await fetch(`${SUPABASE_URL}/functions/v1/preview-elevenlabs-voice`, { method: 'POST', headers: { apikey: publishable, Authorization: `Bearer ${jwtA}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ voice_id: voiceId }) });
    check('preview-elevenlabs-voice: devolve áudio', prev.ok, `HTTP ${prev.status}`);
  }

  const gen = () => call('generate-audio', jwtA, { page_id: A.page, project_id: A.project, page_number: 1, text: 'Era uma vez uma ilha onde cada pedra contava uma história.', voice: 'Zephyr', mode: 'audiobook', elevenlabs_voice_id: voiceId });
  const g1 = await gen();
  check('generate-audio: gera e grava no R2', g1.status === 200 && g1.body.success && /^r2:/.test(g1.body.audio_ref ?? ''), `HTTP ${g1.status} ${g1.body.error ?? ''} ${g1.body.engine ?? ''}`);
  if (g1.status === 200) {
    const audio = await fetch(g1.body.audio_url);
    check('generate-audio: link temporário toca o áudio', audio.ok && (await audio.arrayBuffer()).byteLength > 1000, `HTTP ${audio.status}`);
    const page = await sql(`select audiobook_audio_url, audiobook_status from public.pages where id='${A.page}'`);
    check('generate-audio: página guarda referência r2', page[0]?.audiobook_audio_url === g1.body.audio_ref && page[0]?.audiobook_status === 'audio_generated');
    const g2 = await gen();
    const count = await sql(`select count(*)::int n from public.file_objects where page_id='${A.page}' and kind='audiobook-audio' and narration_id is null`);
    check('generate-audio: repetir substitui o áudio anterior', g2.status === 200 && count[0]?.n === 1, `${count[0]?.n} arquivo(s)`);
    const dl = await call('r2-files', jwtB, { action: 'create-download', file_id: g2.body.audio_file_id });
    check('generate-audio: outro usuário não baixa o áudio', dl.status === 404, `HTTP ${dl.status}`);
  }

  r = await call('generate-audio', jwtA, { page_id: A.page2, project_id: A.project, narration_id: A.narration, skip_page_update: true, page_number: 2, text: 'A menina Lia escutava as pedras.', voice: 'Kore', mode: 'audiobook', elevenlabs_voice_id: voiceId });
  check('generate-audio: narração extra grava no R2', r.status === 200 && r.body.success, `HTTP ${r.status} ${r.body.error ?? ''} ${r.body.engine ?? ''}`);
  r = await call('generate-audio', jwtA, { page_id: A.page, project_id: A.project, page_number: 1, text: 'Teste de voz premium.', mode: 'audiodesc', use_elevenlabs: true, elevenlabs_voice_id: voiceId });
  check('generate-audio: ElevenLabs direto grava no R2', r.status === 200 && r.body.success && /^r2:/.test(r.body.audio_ref ?? ''), `HTTP ${r.status} ${r.body.error ?? ''}`);

  // Dual validation path: extract-text calls validate-audiodesc internally for enterprise projects.
  await sql(`update public.projects set enable_dual_validation = true where id='${A.project}'; update public.profiles set plan = 'enterprise' where id='${A.id}'`);
  r = await call('extract-text', jwtA, { page_id: A.page, image_file_id: imageA, mode: 'audiodesc', book_type: 'general', narration_text: 'Era uma vez uma ilha.' });
  const val = await sql(`select audiodesc_validated from public.pages where id='${A.page}'`);
  check('extract-text + validate-audiodesc: validação dupla interna', r.status === 200 && val[0]?.audiodesc_validated === true, `HTTP ${r.status} validated=${val[0]?.audiodesc_validated}`);
  await sql(`update public.projects set enable_dual_validation = false where id='${A.project}'; update public.profiles set plan = 'free' where id='${A.id}'`);

  await call('r2-files', jwtA, { action: 'purge-project', project_id: A.project });
  await sql(`update public.pages set audiobook_audio_url = null, audiobook_status = 'pending', audiodesc_audio_url = null, audiodesc_status = 'pending', audiodesc_validated = false where project_id='${A.project}'`);
}

console.log(results.join('\n'));
console.log(`\n${results.filter((x) => x.startsWith('PASS')).length}/${results.length} aprovados`);
