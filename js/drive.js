// Google Drive: entra na conta do Dan (OAuth, só leitura), lista pastas e baixa arquivos sob demanda.
// Precisa de um "ID do cliente OAuth" criado no Google Cloud (o README explica). Sem ele, o botão só orienta.
// Observação: esta parte conversa com serviços do Google e só pode ser testada com o ID real.

const GIS = 'https://accounts.google.com/gsi/client';
const SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const API = 'https://www.googleapis.com/drive/v3/files';
const FOLDER = 'application/vnd.google-apps.folder';

let gisLoading = null;
function loadGIS() {
  if (window.google && window.google.accounts && window.google.accounts.oauth2) return Promise.resolve();
  if (!gisLoading) {
    gisLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = GIS;
      s.async = true;
      s.onload = resolve;
      s.onerror = () => { gisLoading = null; reject(new Error('Não consegui carregar o login do Google (internet ou bloqueador).')); };
      document.head.appendChild(s);
    });
  }
  return gisLoading;
}

export async function getToken(clientId) {
  await loadGIS();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (r) => (r.error ? reject(new Error(r.error_description || r.error)) : resolve(r.access_token)),
      error_callback: (e) => reject(new Error(e && e.type === 'popup_closed' ? 'Login cancelado.' : 'Não consegui entrar: ' + ((e && e.type) || 'erro')))
    });
    client.requestAccessToken({ prompt: '' });
  });
}

// auth: o token do login (string) ou { key } pra pasta pública lida só pelo link.
async function api(auth, url) {
  const pub = auth && typeof auth === 'object' && auth.key;
  const r = await fetch(pub ? url + (url.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(auth.key) : url, pub ? {} : { headers: { Authorization: 'Bearer ' + auth } });
  if (r.status === 401) throw new Error('Sessão do Drive expirou. Conecte de novo.');
  if (pub && (r.status === 403 || r.status === 404)) {
    const why = await r.text().catch(() => '');
    if (/API key not valid|keyInvalid|API_KEY_INVALID/i.test(why)) throw new Error('A chave do Google não é válida.');
    if (/has not been used|is disabled|accessNotConfigured|SERVICE_DISABLED/i.test(why)) throw new Error('A Google Drive API não está ativada no projeto da chave.');
    if (/referer|referrer/i.test(why)) throw new Error('A chave não aceita este endereço. Confira as restrições de site da chave.');
    throw new Error('NAO_PUBLICO');
  }
  if (r.status === 403) throw new Error('Sem permissão nessa pasta ou limite do Google atingido.');
  if (r.status === 404) throw new Error('Pasta não encontrada. Confira o link e se a conta tem acesso.');
  if (!r.ok) throw new Error('Erro do Drive (' + r.status + ').');
  return r;
}

async function page(token, folderId, pageToken) {
  const q = encodeURIComponent("'" + folderId + "' in parents and trashed=false");
  const fields = encodeURIComponent('nextPageToken,files(id,name,mimeType,size)');
  let url = API + '?q=' + q + '&fields=' + fields + '&pageSize=1000&orderBy=name&supportsAllDrives=true&includeItemsFromAllDrives=true';
  if (pageToken) url += '&pageToken=' + encodeURIComponent(pageToken);
  return (await api(token, url)).json();
}

// Um nível: pastas e arquivos (pro navegador de pastas do diálogo).
export async function listChildren(token, folderId) {
  const out = [];
  let pt;
  do {
    const j = await page(token, folderId, pt);
    out.push(...j.files);
    pt = j.nextPageToken;
  } while (pt);
  return out.map((f) => ({ id: f.id, name: f.name, mime: f.mimeType, size: Number(f.size) || 0, isFolder: f.mimeType === FOLDER }));
}

// O que o link aponta: pasta ou arquivo, com nome.
export async function meta(auth, id) {
  const r = await api(auth, API + '/' + encodeURIComponent(id) + '?fields=id,name,mimeType,size&supportsAllDrives=true');
  const f = await r.json();
  return { id: f.id, name: f.name, mime: f.mimeType, size: Number(f.size) || 0, isFolder: f.mimeType === FOLDER };
}

export async function folderName(token, id) {
  if (id === 'root') return 'Meu Drive';
  const r = await api(token, API + '/' + encodeURIComponent(id) + '?fields=name&supportsAllDrives=true');
  return (await r.json()).name;
}

// Lista tudo dentro da pasta, recursivo (até 5 níveis), pronto pra Library.add().
export async function listTree(token, folderId, base, depth = 0, out = []) {
  for (const f of await listChildren(token, folderId)) {
    if (f.isFolder) { if (depth < 5) await listTree(token, f.id, base + f.name + '/', depth + 1, out); }
    else if (!f.mime.startsWith('application/vnd.google-apps')) out.push({ name: f.name, path: base + f.name, size: f.size, mime: f.mime, driveId: f.id });
  }
  return out;
}

export async function downloadFile(token, id, name, mime, onProgress) {
  const r = await api(token, API + '/' + encodeURIComponent(id) + '?alt=media&supportsAllDrives=true');
  const total = Number(r.headers.get('content-length')) || 0;
  if (!r.body || !total) return new File([await r.blob()], name, { type: mime });
  const reader = r.body.getReader();
  const parts = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    got += value.length;
    if (onProgress) onProgress(got / total);
  }
  return new File(parts, name, { type: mime });
}
