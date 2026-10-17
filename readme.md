# Taconazo · Cassa partite

Tool minimale per la squadra: a ogni partita si pagano 90 €, si segna **chi ha giocato** e **chi ha pagato**, e l'app mostra i saldi e a chi tocca pagare la prossima.

- Frontend: una sola pagina statica (`public/index.html`), tema giallo-blu.
- Backend: una funzione serverless (`api/state.js`) che salva tutto in un file JSON su [Vercel Blob](https://vercel.com/docs/vercel-blob).
- Nessun login: chiunque abbia il link può modificare i dati.

## Come funziona il saldo

Per ogni partita la quota di ciascun giocatore è `90 € / numero di giocatori`. Il saldo di un giocatore è
`(partite pagate × 90 €) − somma delle sue quote`. Chi ha il saldo più basso è il prossimo a pagare.

## Deploy su Vercel

1. Importa questo repo su Vercel (nessuna configurazione di build necessaria).
2. Crea uno store **Blob** (Storage → Create → Blob) e collegalo al progetto: Vercel aggiunge da solo `BLOB_READ_WRITE_TOKEN`.
3. Rideploya.

## Provarlo in locale

```sh
npm install
TACONAZO_LOCAL_FILE=./state.local.json vercel dev
```

Con `TACONAZO_LOCAL_FILE` i dati finiscono in un file locale invece che su Blob.
