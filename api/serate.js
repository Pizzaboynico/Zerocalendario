// Endpoint minimale per sincronizzare i dati del calendario tra dispositivi.
// Salva un unico file JSON su Vercel Blob (piano gratuito, accesso privato)
// con tutte le serate. Protetto da un token condiviso (env var SYNC_TOKEN)
// per evitare che chiunque trovi l'URL possa leggere o sovrascrivere i dati.
const { put, get } = require('@vercel/blob');

const BLOB_PATH = 'calendario-zero/serate.json';

async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

module.exports = async function handler(req, res) {
  const expectedToken = process.env.SYNC_TOKEN;
  if (expectedToken) {
    const token = req.headers['x-sync-token'];
    if (token !== expectedToken) {
      res.status(401).json({ error: 'Codice di accesso mancante o errato.' });
      return;
    }
  }

  if (req.method === 'GET') {
    try {
      const result = await get(BLOB_PATH, { access: 'private' });
      if (!result || result.statusCode !== 200 || !result.stream) {
        res.status(200).json({ dayTexts: {}, updatedAt: null });
        return;
      }
      const text = await streamToString(result.stream);
      const data = JSON.parse(text);
      res.status(200).json(data);
    } catch (e) {
      // Nessuna serata salvata ancora: risposta vuota invece di errore.
      res.status(200).json({ dayTexts: {}, updatedAt: null });
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body || '{}');
      const payload = { dayTexts: body.dayTexts || {}, updatedAt: new Date().toISOString() };
      await put(BLOB_PATH, JSON.stringify(payload), {
        access: 'private',
        contentType: 'application/json',
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      res.status(200).json({ ok: true, updatedAt: payload.updatedAt });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
    return;
  }

  res.status(405).json({ error: 'Metodo non supportato.' });
};
