# Persönliches Dashboard

Eine Sammlung kleiner HTML-Apps mit gemeinsamer Navigation. Der Fitnessbereich ist jetzt direkt als Next.js-App aus `New Project 8` integriert.

## Eigene Kopie deployen

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FRowanThistlebrooke%2FYTdashh1)

Ein Klick → Vercel meldet dich an, kopiert das Repo in dein GitHub-Konto und deployed es. Nach kurzer Zeit hast du eine Live-URL.

## Nutzung

Für die reinen HTML-Seiten reicht weiterhin ein Browser. Für den neuen Fitnessbereich muss das Projekt als App laufen, weil Workout-Login, Speichern und Supabase über kleine Server-Funktionen gehen.

```bash
npm install
npm run dev
```

Danach im Browser `http://localhost:3000` öffnen.

| Datei | Bedeutung |
|---|---|
| [index.html](index.html) | Ziele, Tagesring und To-do-Liste — die Startseite |
| [health.html](health.html) | Supplement- und Daily-Stack-Tracker |
| [po-water.html](po-water.html) | Wasser-Tracker |
| [finance.html](finance.html) | Finanzen |
| [gym.html](gym.html) | Weiterleitung zum integrierten Fitnessbereich |
| [topbar.js](topbar.js) | Gemeinsame Navigation, die automatisch in die Seiten eingefügt wird |

Jede App speichert Daten im Browser unter `localStorage`. Mit Supabase-Sync laufen die Daten zusätzlich über die Cloud.

## Cloud-Sync

Supabase-Sync ist für dieses Projekt bereits eingetragen. Die App nutzt diese öffentlichen Browser-Werte:

- Project URL: `https://zsngolrittdtyqhgdwxi.supabase.co`
- Publishable Key: in Supabase unter **Project Settings -> API** kopieren

Diese Dateien verwenden die Werte:

- `sync.js`: `SUPABASE_URL`, `SUPABASE_KEY`
- `topbar.js`: `TOPBAR_SUPABASE_URL`, `TOPBAR_SUPABASE_KEY`
- Fitness-App: `.env.local` mit `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_PASSCODE` und `COOKIE_SECRET`

Die Datenbank für `app_state` und der Storage-Bucket `progress-photos` wurden bereits im Supabase-Projekt `meine app` angelegt. Wenn du später ein anderes Supabase-Projekt nutzt, musst du die SQL-Blöcke aus `SQL` und `Gym fix 2` dort erneut ausführen.

## Neu bauen

[BUILD_DASHBOARD.md](BUILD_DASHBOARD.md) enthält den ursprünglichen Prompt für `index.html`.
