import { put, head, BlobNotFoundError } from '@vercel/blob';
import { readFile, writeFile } from 'node:fs/promises';

const KEY = 'taconazo/state.json';
const LOCAL_FILE = process.env.TACONAZO_LOCAL_FILE; // solo per provare in locale senza Blob

const emptyState = () => ({ cost: 90, players: [], matches: [] });

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function load() {
  if (LOCAL_FILE) {
    try {
      return JSON.parse(await readFile(LOCAL_FILE, 'utf8'));
    } catch {
      return emptyState();
    }
  }
  try {
    const meta = await head(KEY);
    const res = await fetch(`${meta.url}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Lettura dati fallita (${res.status})`);
    return await res.json();
  } catch (err) {
    if (err instanceof BlobNotFoundError) return emptyState();
    throw err;
  }
}

async function save(state) {
  const body = JSON.stringify(state);
  if (LOCAL_FILE) return writeFile(LOCAL_FILE, body);
  await put(KEY, body, {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
  });
}

const newId = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36);

// Saldo di partenza (in euro) per chi arriva da un conteggio fatto altrove.
function parseOpening(value) {
  if (value === undefined || value === null || value === '') return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || Math.abs(n) > 10000) throw new HttpError(400, 'Saldo iniziale non valido');
  return Math.round(n * 100) / 100;
}

const ACTIONS = {
  addPlayer(state, { name, opening }) {
    const clean = String(name ?? '').trim().replace(/\s+/g, ' ');
    if (!clean) throw new HttpError(400, 'Scrivi un nome');
    if (clean.length > 30) throw new HttpError(400, 'Nome troppo lungo');
    const startBalance = parseOpening(opening);
    const existing = state.players.find((p) => p.name.toLowerCase() === clean.toLowerCase());
    if (existing?.active) throw new HttpError(400, 'Esiste già un giocatore con questo nome');
    if (existing) {
      existing.active = true;
      existing.opening = startBalance;
    } else {
      state.players.push({ id: newId(), name: clean, active: true, opening: startBalance });
    }
  },

  setOpening(state, { id, opening }) {
    const player = state.players.find((p) => p.id === id);
    if (!player) throw new HttpError(404, 'Giocatore non trovato');
    player.opening = parseOpening(opening);
  },

  // Il giocatore resta nello storico: lo nascondiamo soltanto dalle nuove partite.
  removePlayer(state, { id }) {
    const player = state.players.find((p) => p.id === id);
    if (!player) throw new HttpError(404, 'Giocatore non trovato');
    player.active = false;
  },

  addMatch(state, { date, payerId, playerIds }) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) throw new HttpError(400, 'Data non valida');
    const known = new Set(state.players.map((p) => p.id));
    const players = [...new Set(Array.isArray(playerIds) ? playerIds : [])];
    if (players.length === 0) throw new HttpError(400, 'Seleziona chi ha giocato');
    if (!players.every((id) => known.has(id))) throw new HttpError(400, 'Giocatore sconosciuto');
    if (!known.has(payerId)) throw new HttpError(400, 'Seleziona chi ha pagato');
    state.matches.push({ id: newId(), date, payerId, playerIds: players });
  },

  deleteMatch(state, { id }) {
    const before = state.matches.length;
    state.matches = state.matches.filter((m) => m.id !== id);
    if (state.matches.length === before) throw new HttpError(404, 'Partita non trovata');
  },
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') return res.status(200).json(await load());

    if (req.method === 'POST') {
      const { action, ...args } = req.body ?? {};
      if (!Object.hasOwn(ACTIONS, action)) throw new HttpError(400, 'Azione non valida');
      const state = await load();
      ACTIONS[action](state, args);
      await save(state);
      return res.status(200).json(state);
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Metodo non consentito' });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    console.error(err);
    return res.status(500).json({ error: 'Errore del server, riprova' });
  }
}
