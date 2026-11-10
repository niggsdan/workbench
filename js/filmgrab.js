// Acervo do Film Grab ao vivo, pela API pública do site (WordPress). Só texto: título, link e ficha técnica.
// Nenhuma imagem do Film Grab é baixada ou guardada; os stills abrem no próprio site.

const API = 'https://film-grab.com/wp-json/wp/v2/';
const ROLE = { '!Directors': 'dir', '!DPs': 'dp', '!ASPECT': 'aspect', '!Country': 'country', '!Production Designer': 'pd', '!Costume Designer': 'costume' };
const cats = new Map(); // id -> { name, parent }

const decode = (s) => { const t = document.createElement('textarea'); t.innerHTML = s; return t.value; };

async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('o Film Grab respondeu ' + r.status);
  return { data: await r.json(), total: +(r.headers.get('x-wp-total') || 0) };
}

async function loadCats(ids) {
  const need = [...new Set(ids)].filter((id) => !cats.has(id));
  for (let i = 0; i < need.length; i += 100) {
    const { data } = await getJson(API + 'categories?per_page=100&_fields=id,name,parent&include=' + need.slice(i, i + 100).join(','));
    for (const c of data) cats.set(c.id, { name: decode(c.name), parent: c.parent });
  }
}

// Ficha a partir das categorias do post: direção, ano, fotografia, proporção, país, arte, figurino.
async function details(posts) {
  const ids = posts.flatMap((p) => p.categories || []);
  await loadCats(ids);
  await loadCats([...new Set(ids.map((id) => (cats.get(id) || {}).parent).filter(Boolean))]);
  return posts.map((p) => {
    const f = { dir: [], dp: [], aspect: [], country: [], pd: [], costume: [], year: '' };
    for (const id of p.categories || []) {
      const c = cats.get(id); if (!c) continue; const parent = (cats.get(c.parent) || {}).name || '';
      if (ROLE[parent]) f[ROLE[parent]].push(c.name);
      else if (/^\d{4}s$/.test(parent) && /^\d{4}$/.test(c.name)) f.year = c.name;
    }
    const j = (a) => a.join(' e ');
    return { fgId: p.id, name: decode(p.title.rendered), url: p.link, dir: j(f.dir), dp: j(f.dp), aspect: j(f.aspect), country: j(f.country), pd: j(f.pd), costume: j(f.costume), year: f.year };
  });
}

// q vazio = acervo em ordem alfabética. page começa em 1.
export async function browse(q, page = 1) {
  const base = API + 'posts?_fields=id,title,link,categories&per_page=50&page=' + page;
  const url = q ? base + '&search=' + encodeURIComponent(q) : base + '&orderby=title&order=asc';
  const { data, total } = await getJson(url);
  return { items: await details(data), total };
}
