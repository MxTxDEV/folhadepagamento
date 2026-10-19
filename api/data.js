import { get, put } from '@vercel/blob';
import { createHash, timingSafeEqual } from 'node:crypto';

const FILE = 'folha/dados.json';

function autorizado(req) {
  const senha = process.env.APP_PASSWORD;
  if (!senha) return false;
  const h = s => createHash('sha256').update(String(s)).digest();
  return timingSafeEqual(h(req.headers['x-senha'] || ''), h(senha));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!autorizado(req)) return res.status(401).json({ erro: 'senha inválida' });

  if (req.method === 'GET') {
    const r = await get(FILE, { access: 'private', useCache: false });
    if (!r || r.statusCode !== 200) return res.status(200).json(null);
    return res.status(200).send(await new Response(r.stream).text());
  }

  if (req.method === 'PUT') {
    const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const s = JSON.parse(body);
    // exige o formato com empresas (evita que uma aba antiga sobrescreva os dados)
    if (!s || !Array.isArray(s.empresas)) return res.status(409).json({ erro: 'versão antiga da página — recarregue' });
    const opts = { access: 'private', allowOverwrite: true, addRandomSuffix: false, contentType: 'application/json' };
    await put(FILE, body, opts);
    // cópia diária de segurança
    await put(`folha/backups/${new Date().toISOString().slice(0, 10)}.json`, body, opts);
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).end();
}
