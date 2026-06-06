# Persönliches Dashboard

Eine Sammlung kleiner HTML-Apps, die direkt im Browser laufen und eine gemeinsame Navigation nutzen.

## Eigene Kopie deployen

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FRowanThistlebrooke%2FYTdashh1)

Ein Klick → Vercel meldet dich an, kopiert das Repo in dein GitHub-Konto und deployed es. Nach kurzer Zeit hast du eine Live-URL.

## Nutzung

Du kannst jede `.html`-Datei direkt im Browser öffnen. Kein Build, keine Installation.

| Datei | Bedeutung |
|---|---|
| [index.html](index.html) | Ziele, Tagesring und To-do-Liste — die Startseite |
| [health.html](health.html) | Supplement- und Daily-Stack-Tracker |
| [po-water.html](po-water.html) | Wasser-Tracker |
| [finance.html](finance.html) | Finanzen |
| [gym.html](gym.html) | Gym-Tracker für Progression |
| [topbar.js](topbar.js) | Gemeinsame Navigation, die automatisch in die Seiten eingefügt wird |

Jede App speichert Daten im Browser unter `localStorage`. Mit Supabase-Sync laufen die Daten zusätzlich über die Cloud.

## Cloud-Sync einrichten

Supabase-Sync braucht zwei öffentliche Browser-Werte:

- Project URL: `https://zsngolrittdtyqhgdwxi.supabase.co`
- Publishable Key: in Supabase unter **Project Settings -> API** kopieren

Beide Werte hier eintragen:

- `sync.js`: `SUPABASE_URL`, `SUPABASE_KEY`
- `topbar.js`: `TOPBAR_SUPABASE_URL`, `TOPBAR_SUPABASE_KEY`
- `gym.html`: `SUPABASE_URL`, `SUPABASE_KEY`

Die Datenbank für `app_state` und der Storage-Bucket `progress-photos` wurden bereits im Supabase-Projekt `meine app` angelegt. Wenn du später ein anderes Supabase-Projekt nutzt, musst du die SQL-Blöcke aus `SQL` und `Gym fix 2` dort erneut ausführen.

## Neu bauen

[BUILD_DASHBOARD.md](BUILD_DASHBOARD.md) enthält den ursprünglichen Prompt für `index.html`.
