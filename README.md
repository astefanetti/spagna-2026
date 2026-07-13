# Roadbook Spagna 2026

Van, Bizzarone → Paesi Baschi → Cantabria → Bardenas Reales → rientro. 17 luglio – 3 agosto 2026. Due adulti, le bambine, Daisy 🐶.

## Struttura del progetto

```
docs/
├── 00-introduzione.md          # panoramica del viaggio e della rotta
├── 01-preparazione.md          # cosa fare/comprare prima di partire
├── 02-logistica-van.md         # acqua, batterie, camper service
├── 03-gestione-scorte.md       # strategia spesa e scorte
├── giorni/                     # 01.md ... 18.md, una giornata per file
├── allegati/                   # checklist generale, ristoranti, aree camper
└── appendici/                  # numeri utili

app/                            # la PWA (l'app da usare sul telefono)
```

## L'app (PWA)

Dentro `app/` c'è un'app web installabile sul telefono che legge i file di `docs/` e mostra: la giornata di oggi in evidenza, tutte le giornate con dashboard/cronoprogramma/checklist spuntabili, e le pagine di supporto (preparazione, logistica, checklist generale, ristoranti, aree camper, numeri utili). Le checklist e i campi da compilare (bilanci, appunti) si salvano sul telefono, anche offline.

Non usa librerie esterne: tutto il rendering markdown è fatto da uno script incluso (`app/js/markdown.js`), così l'app funziona anche senza rete una volta installata.

### Anteprima in locale

```
cd app
python3 -m http.server 8000
```

poi apri `http://localhost:8000` dal computer, oppure dal telefono se è sulla stessa rete Wi-Fi (`http://<ip-del-computer>:8000`).

### Installarla sul telefono come app

Un service worker (per l'uso offline e l'icona in home screen) richiede che l'app sia servita via **https** (o `http://localhost`). Il modo più semplice è pubblicarla gratis con **GitHub Pages**:

1. Crea un repository GitHub per questo progetto (se non l'hai già fatto) e fai push.
2. In *Settings → Pages*, scegli come source la cartella `app/` sul branch principale (o pubblica il contenuto di `app/` su un branch `gh-pages`).
3. Apri l'URL pubblicato dal telefono, poi "Aggiungi a schermata Home" (Safari/Chrome).

Alternative altrettanto valide: [Netlify Drop](https://app.netlify.com/drop) (trascini la cartella `app/` e ottieni un link https in pochi secondi) o Vercel.

### Aggiornare i contenuti

Dopo aver modificato un file in `docs/giorni/`, `docs/00-03-*.md`, `docs/allegati/` o `docs/appendici/`, rigenera i dati dell'app:

```
cd app/tools
python3 build_data.py
```

(serve `pyyaml`: `pip install pyyaml --break-system-packages` se manca). Rigenera `app/data/days.json` e `app/data/pages.json`. Poi ripubblica come sopra.

> Nota: nella cartella `app/tools/data/` è rimasta una copia dei dati creata durante un test iniziale (per un errore di percorso, ora corretto) — non è usata dall'app e si può ignorare o eliminare manualmente.

### Rigenerare le icone

```
cd app/tools
python3 generate_icons.py
```

## mkdocs

Il progetto include anche una configurazione minima di [mkdocs](https://www.mkdocs.org) (`mkdocs.yml`) per un'eventuale versione "sito di documentazione" della guida. Al momento l'app in `app/` è pensata come strumento principale da usare in viaggio.
