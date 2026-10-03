# Mapa podróży

Wspólna mapa: gdzie byliśmy (kraje, miejsca, podróże ze zdjęciami) i dokąd
chcemy pojechać (restauracje, hotele, atrakcje — dodawane z wyszukiwarki
Google Maps). Dane w Supabase, strona na GitHub Pages.

## Stos

- React + TypeScript (Vite), bez backendu — przeglądarka rozmawia z Supabase
- Supabase: logowanie (Google / link e-mail), Postgres z RLS, Storage na zdjęcia, realtime
- Google Maps JavaScript API + Places API (New)

## Konfiguracja (jednorazowo)

1. **Supabase** — nowy projekt, potem:
   - *SQL Editor* → wklej i uruchom [`supabase/schema.sql`](supabase/schema.sql) (można uruchamiać ponownie)
   - *Authentication → URL Configuration*: Site URL = adres strony, w *Redirect URLs* dodaj też `http://localhost:5173/**`
   - *Authentication → Providers → Google*: włącz i wpisz Client ID/Secret z Google Cloud
     (OAuth client typu „Web application”, redirect URI: `https://<projekt>.supabase.co/auth/v1/callback`)
2. **Google Cloud** — włącz *Maps JavaScript API* i *Places API (New)*, utwórz klucz API
   i ogranicz go (*Website restrictions*) do adresu strony i `http://localhost:5173/*`.
3. **Lokalnie** — `cp .env.example .env.local`, uzupełnij, potem `npm install && npm run dev`.
4. **GitHub** — *Settings → Pages → Source: GitHub Actions*; w *Settings → Secrets and variables →
   Actions → Variables* dodaj `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_MAPS_API_KEY`
   (opcjonalnie `VITE_GOOGLE_MAP_ID`). Każdy push na `main` buduje i publikuje stronę.

Wszystkie te wartości są publiczne z założenia (trafiają do przeglądarki). Dane chroni RLS
w Supabase — każdy wiersz należy do „mapy” i widzą go tylko jej członkowie. Nigdy nie
umieszczaj tu klucza `service_role`.

## Wspólna mapa

Pierwsza osoba zakłada mapę, potem *Ustawienia → Utwórz zaproszenie* i wysyła link
(jednorazowy, ważny 7 dni). Druga osoba loguje się swoim kontem i dołącza.
Zmiany jednej osoby pojawiają się u drugiej na żywo.

## Dane

- `places` — miejsce ze statusem `visited` (byliśmy) albo `wishlist` (chcemy), kategorią, krajem z Google
- `trips` — podróże z datami; odwiedzone miejsca można do nich przypisać
- `extra_countries` — kraje dodane ręcznie; odwiedzone kraje = te z miejsc + ręczne
- `photos` — zdjęcia (prywatny bucket `photos`, ścieżka `<space_id>/…`)

Granice krajów: Natural Earth 1:110m (domena publiczna), `public/countries-110m.geojson`.
