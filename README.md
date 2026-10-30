# zeroto-ui-test

A small **static site** (Vite, no framework) for testing ZeroTo's static-site hosting, and a front end for the
[`zeroto-test-app`](https://github.com/ManyamSanjayKumarReddy/zeroto-test-app) API and its managed database.

Pages: **Home** (build info + API, database and bucket status), **Notes** (add/delete notes stored in the database), **Files** (save, list, open and delete text files in a bucket), **About**.
It has client-side routing, a hashed JS/CSS bundle, an icon, and `robots.txt`.

## Deploy it
New deployment → this repo, branch `main`. Leave **Build** on *Automatic* and everything else empty.
The build log says `This is a static site — copying its files (no container needed)` and the deployment's Overview shows **Type: Static site**
(no CPU / memory / port; Logs says there are none).

## Test 1 — it is served
Open the URL: the Home page shows *Site name*, *Built at*, and *API: not set* with a setup hint.

## Test 2 — a build variable
Variables → add `VITE_SITE_NAME` = `My first site`, **Used by: Build**, redeploy. The new name appears in the header and title.
(A variable set to *Running app* does nothing here — a website's values are fixed while it is built. Anything built in is visible to visitors.)

## Test 3 — single-page routing
Open `/notes` directly and reload; it still shows the site (not a 404). `/nothing` shows the site's own "Page not found".

## Test 4 — the API and the database
1. Deploy [`zeroto-test-app`](https://github.com/ManyamSanjayKumarReddy/zeroto-test-app) (branch `no-dockerfile`), create a managed database and link it to the app (its README, Test 6), redeploy the app.
2. Back here: Variables → `VITE_API_URL` = the app's URL (`https://…`, no trailing slash), **Used by: Build**, redeploy this site.
3. **Home** shows the app *reachable* and *Connected to app as app*. **Notes**: add a note, reload, it is still there.
4. Pause the database in ZeroTo: Notes shows a "not available" message; Start it, and the notes are back.

## Test 4b — a bucket
1. In [`zeroto-test-app`](https://github.com/ManyamSanjayKumarReddy/zeroto-test-app) create a bucket and link it to the app (its README, Test 9), redeploy the app. (`VITE_API_URL` is the same as above; no rebuild is needed unless you changed it.)
2. **Home** now has a *Bucket* row: the bucket's name, how many files and how much space they use. Before linking it says *not linked*.
3. **Files**: save `notes/hello.txt` with some text. It appears in the list (under the `notes/` folder), and in the bucket's Files screen in ZeroTo.
4. **Open** shows the text in a new tab (a link made for that one file); **Delete** removes it. The folder disappears when it is empty.
5. Unlink the bucket (and redeploy the app): Files shows a "not linked" message and Home says *not linked*; Notes still works.

## Test 5 — rollback
Releases tab → roll back to the first release and reload: the earlier name/build time is back, served from the stored copy of that release.

## Test 6 — the backend is asleep
ZeroTo stops an idle app after about 5 minutes and removes its container after about 10; the next visitor wakes it.
Leave both apps alone for ~12 minutes, then open this site's **Notes** (or Home). You should see **"Waking up the backend…"** for a few
to ~30 seconds, and then the notes appear — no error, no refresh needed. (The site asks the app's `/health` until it answers,
then makes the real call.) Reloading right after, the page is instant: the app is awake.

## Test 7 — caching and safety (with curl)
```
curl -I https://<your-site>/                  # cache-control: no-cache (HTML is always revalidated)
curl -I https://<your-site>/assets/<file>.js  # cache-control: public, max-age=31536000, immutable
curl -s -o /dev/null -w '%{http_code}\n' https://<your-site>/.env       # 400 (hidden files are never served)
curl -s -o /dev/null -w '%{http_code}\n' https://<your-site>/package.json   # the site (single-page fallback), not the file — sources aren't published
```

Locally: `npm install`, copy `.env.example` to `.env`, `npm run dev`.
