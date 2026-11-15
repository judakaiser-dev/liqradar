# LIQRADAR v18 — Bereitstellung

LIQRADAR ist eine reine **Statische Web-App** (PWA): kein Server, keine Datenbank,
keine API-Schlüssel nötig. Die Kursdaten holt sich die App im Browser direkt von
der öffentlichen Bybit-API; alle Einstellungen liegen lokal auf dem Gerät.

## Dieser Ordner (dist) ist die fertige App

Einfach den **gesamten Inhalt dieses Ordners** auf einen beliebigen statischen
Host hochladen, z. B.:

- **Netlify**: app.netlify.com/drop → Ordner per Drag & Drop reinziehen
- **Vercel**: vercel.com → „Add New Project" → diesen Ordner
- **Cloudflare Pages**, **GitHub Pages**, eigener Webserver: Dateien ins Web-Root

Wichtig: Die App läuft auch in einem **Unterverzeichnis** (alle Pfade sind relativ),
z. B. `https://example.com/liqradar/`. Keine Server-Rewrites nötig (Hash-Routing).

## Enthaltene Dateien

- `index.html` — Einstieg (enthält Start-Wächter mit Selbstreparatur)
- `assets/` — JavaScript + CSS (gebündelt, gehasht)
- `fonts/` — Schriften lokal (Inter, JetBrains Mono — keine Google-Fonts nötig)
- `icons/` — App-Icons + iOS-Startbilder
- `manifest.webmanifest` — PWA-Manifest (Home-Bildschirm)
- `sw.js` — Service Worker (Offline-Cache)

## Nach dem Hochladen

1. HTTPS-Adresse öffnen (Face-ID-Sperre braucht HTTPS)
2. Auf iPhone/iPad: Teilen → „Zum Home-Bildschirm"
3. Fertig — die App läuft unabhängig und speichert alles lokal

## Neu bauen (nur bei Änderungen am Quellcode)

```
npm install
npm run build     # Ergebnis liegt in dist/
```
