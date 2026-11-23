/**
 * CHPLAYER — CÓPIA COMENTADA PARA ESTUDO
 * Servidor Supabase em Deno. Recebe webhooks Hotmart, ativa licenças, limita downloads, envia e-mails e atende salas. Os segredos vêm do ambiente do servidor.
 * Fluxo e dependências: docs/architecture.md.
 * Comentários desta cópia não alteram a versão publicada.
 */
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const emailPattern = /^[^\s@<>]+@[^\s@<>]+$/;
const revocations = new Set(['PURCHASE_REFUNDED', 'PURCHASE_CHARGEBACK', 'PURCHASE_CANCELED']);
const encoder = new TextEncoder();

/**
 * makeToken — Gera um token aleatório criptograficamente seguro.
 * Entradas: nenhuma declarada.
 * Operações presentes no corpo: replaceAll, btoa, String.fromCharCode, crypto.getRandomValues.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function makeToken() {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
    .replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

/**
 * digest — Calcula o hash SHA-256 usado no armazenamento/comparação de tokens.
 * Entradas: text.
 * Operações presentes no corpo: digest, encoder.encode, join, Array.from, padStart, byte.toString.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
async function digest(text) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * sameSecret — Compara os hashes do segredo recebido e esperado.
 * Entradas: received; expected.
 * Operações presentes no corpo: Promise.all, digest, a.charCodeAt, b.charCodeAt.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
async function sameSecret(received, expected) {
  if (!expected || !received) return false;
  const [a, b] = await Promise.all([digest(received), digest(expected)]);
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

/**
 * bodyText — Lê o corpo da requisição impondo limite de bytes.
 * Entradas: request; limit.
 * Operações presentes no corpo: getReader, reader.read, decoder.decode, reader.cancel.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
async function bodyText(request, limit) {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) return text + decoder.decode();
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new SyntaxError('Corpo da requisição excede o limite.');
    }
    text += decoder.decode(value, { stream: true });
  }
}

/**
 * createHandler — Cria o roteador HTTP com ambiente e cliente de rede injetáveis.
 * Entradas: env; send = fetch.
 * Operações presentes no corpo: Response.json, send, JSON.stringify, AbortSignal.timeout, console.error, response.json, sameSecret, get, respond, JSON.parse.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
export function createHandler(env, send = fetch) {
  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };
  const respond = (status, body = {}) => Response.json(body, {
    status, headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS' },
  });

  /**
 * rpc — Chama uma função SQL chplayer_* pela API do Supabase.
 * Entradas: name; args.
 * Operações presentes no corpo: send, JSON.stringify, AbortSignal.timeout, console.error, response.json.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
async function rpc(name, args) {
    const response = await send(`${env.SUPABASE_URL}/rest/v1/rpc/chplayer_${name}`, {
      method: 'POST', headers, body: JSON.stringify(args), signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      console.error('chplayer_database_error', name, response.status);
      throw new Error('Operação no banco indisponível.');
    }
    if (name !== 'revoke') return response.json();
  }

  /**
 * hotmart — Valida o webhook e processa a mudança de estado da compra.
 * Entradas: request.
 * Operações presentes no corpo: sameSecret, get, respond, JSON.parse, bodyText, String, revocations.has, test, rpc, emailPattern.test.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
async function hotmart(request) {
    if (!(await sameSecret(request.headers.get('x-hotmart-hottok'), env.HOTMART_HOTTOK))) {
      return respond(403);
    }
    const event = JSON.parse(await bodyText(request, 128 * 1024));
    if (event?.version !== '2.0.0') return respond(400);
    const data = event.data;
    if (!env.HOTMART_PRODUCT_ID) return respond(503);
    if (String(data?.product?.id) !== env.HOTMART_PRODUCT_ID) return respond(200);
    if (event.event !== 'PURCHASE_APPROVED' && !revocations.has(event.event)) return respond(200);
    const transaction = data?.purchase?.transaction;
    if (typeof transaction !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(transaction)) return respond(400);
    const order_id = `hotmart:${transaction}`;
    if (revocations.has(event.event)) {
      await rpc('revoke', { order_id });
      return respond(200);
    }
    const email = data?.buyer?.email;
    if (typeof email !== 'string' || email.length > 254 || !emailPattern.test(email)) return respond(400);
    if (!env.BREVO_API_KEY || !env.BREVO_SENDER_EMAIL || !env.CHPLAYER_DOWNLOAD_PAGE) return respond(503);
    const link = makeToken();
    const key = makeToken();
    const delivery = await rpc('purchase', {
      order_id, buyer_email: email, link_token: link, license_key: key,
      link_digest: await digest(link), license_digest: await digest(key),
    });
    if (!delivery) return respond(200);

    const page = new URL(env.CHPLAYER_DOWNLOAD_PAGE);
    if (page.protocol !== 'https:') return respond(503);
    page.hash = delivery.link;
    const emailResponse = await send('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        sender: { name: 'CHPlayer', email: env.BREVO_SENDER_EMAIL },
        subject: 'Seu acesso ao CHPlayer',
        headers: { idempotencyKey: delivery.id },
        textContent: `Baixe o CHPlayer: ${page.href}\nChave de ativação: ${delivery.key}\n\nO link permite dois downloads. A chave ativa um aparelho por vez.`,
        messageVersions: [{ to: [{ email: delivery.email }] }],
      }),
    });
    if (!emailResponse.ok) {
      const error = await emailResponse.json().catch(() => null);
      console.error('chplayer_email_error', emailResponse.status, /^[a-z_]+$/i.test(error?.code ?? '') ? error.code : 'unknown');
      if (error?.code !== 'duplicate_parameter' || !/idempotency/i.test(error?.message ?? '')) return respond(503);
    }
    const cleared = await send(`${env.SUPABASE_URL}/rest/v1/chplayer_orders?id=eq.${encodeURIComponent(order_id)}&mail_id=eq.${delivery.id}`, {
      method: 'PATCH', headers, signal: AbortSignal.timeout(8000),
      body: JSON.stringify({ pending_email: null, pending_link: null, pending_key: null }),
    });
    return respond(cleared.ok ? 200 : 503);
  }

  /**
 * download — Autoriza o download e busca o APK no bucket privado.
 * Entradas: request.
 * Operações presentes no corpo: get, bodyText, tokenPattern.test, respond, digest, rpc, send, cancel.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
async function download(request) {
    const token = new URLSearchParams(await bodyText(request, 512)).get('token') ?? '';
    if (!tokenPattern.test(token)) return respond(400);
    const hash = await digest(token);
    if (!(await rpc('access', { action: 'available', digest: hash }))) return respond(403);
    const apk = await send(`${env.SUPABASE_URL}/storage/v1/object/authenticated/chplayer-apk/CHPlayer.apk`, {
      headers, signal: request.signal,
    });
    if (!apk.ok || !apk.body) return respond(503);
    try {
      if (await rpc('access', { action: 'download', digest: hash })) {
        return new Response(apk.body, { headers: {
          'Content-Type': 'application/vnd.android.package-archive',
          'Content-Disposition': 'attachment; filename="CHPlayer.apk"',
          'Cache-Control': 'no-store',
        } });
      }
    } catch (error) {
      await apk.body.cancel();
      throw error;
    }
    await apk.body.cancel();
    return respond(403);
  }

  return async (request) => {
    if (request.method === 'OPTIONS') return respond(200);
    const route = new URL(request.url).pathname.split('/').at(-1);
    if (request.method === 'GET' && route === 'health') return respond(200, { ok: true });
    if (request.method !== 'POST') return respond(404);
    try {
      if (route === 'hotmart') return await hotmart(request);
      if (route === 'download') return await download(request);
      if (route === 'installation') return respond(200, { token: makeToken() });
      if (route === 'room') {
        const { token, code, command, movie, seconds, playing, name, text } =
          JSON.parse(await bodyText(request, 4096)) ?? {};
        if (typeof token !== 'string' || !tokenPattern.test(token)) return respond(400);
        if (!['create', 'read', 'sync', 'message'].includes(command)) return respond(400);
        const invite = command === 'create' ? makeToken() : code;
        if (typeof invite !== 'string' || !tokenPattern.test(invite)) return respond(400);
        let payload = {};
        if (command === 'create') {
          if (typeof movie !== 'string' || !movie || movie.length > 200) return respond(400);
          payload = { movie };
        } else if (command === 'sync') {
          if (!Number.isFinite(seconds) || seconds < 0 || seconds > 86400 ||
              typeof playing !== 'boolean') return respond(400);
          payload = { seconds, playing };
        } else if (command === 'message') {
          if (typeof name !== 'string' || !name.trim() || name.length > 32 ||
              typeof text !== 'string' || !text.trim() || text.length > 400) return respond(400);
          payload = { name: name.trim(), text: text.trim() };
        }
        const room = await rpc('room', { command, invite, member: await digest(token), payload });
        return room ? respond(200, { ...room, code: invite }) : respond(404);
      }
      if (route !== 'activate' && route !== 'status') return respond(404);
      const { token, key } = JSON.parse(await bodyText(request, 512)) ?? {};
      if (typeof token !== 'string' || !tokenPattern.test(token)) return respond(400);
      if (route === 'activate' && (typeof key !== 'string' || !tokenPattern.test(key))) return respond(400);
      const args = route === 'activate'
        ? { action: route, digest: await digest(key), device: await digest(token) }
        : { action: route, digest: await digest(token) };
      return respond(await rpc('access', args) ? 200 : 403);
    } catch (error) {
      return respond(error instanceof SyntaxError ? 400 : 503);
    }
  };
}

if (typeof Deno !== 'undefined') Deno.serve(createHandler(Deno.env.toObject()));
