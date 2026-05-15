# autopilot-yt-app — System Design

## 1. Summary

`autopilot-yt-app` is the operator dashboard for autopilot.yt, a faceless YouTube automation pipeline. It is a single-page React 19 application built with Vite 8 (`package.json:14-29`), with no router, no state library, and no shared API client — every page consumes the `autopilot-lambda` HTTP API directly with `fetch`. UI is styled inline (CSS-in-JS via React `style` props) against a dark theme (deep purple `#7c3aed` / electric blue `#4f46e5` on near-black `#060612`, Space Mono for numerics, DM Sans for body — loaded via Google Fonts in `src/App.jsx:18-30`).

It is built with `vite build` and deployed to GitHub Pages via `gh-pages -d dist` (`package.json:11-12`), served under the subpath `/autopilot-yt-app/` (`vite.config.js:6`). The production URL is `tessbuild.com/autopilot-yt-app`.

## 2. Architecture

```
                                              ┌────────────────────────────────────┐
                                              │  autopilot-lambda (API Gateway)     │
                                              │  https://u6qf98w3ye.execute-api…    │
  ┌──────────────────────────────┐            │                                    │
  │  Browser (autopilot-yt-app)  │            │  GET  /api/autopilot/jobs           │
  │                              │            │  GET  /api/autopilot/jobs/{id}      │
  │  ┌────────────────────────┐  │            │  POST /api/autopilot/jobs/{id}/{approve,reject}
  │  │ <App>  tab state       │  │            │  GET  /api/autopilot/topics         │
  │  │   ├─ dashboard         │──┼──fetch────▶│  POST /api/autopilot/topics/...     │
  │  │   ├─ channels  (stub)  │  │  x-app-key │  POST /api/autopilot/script         │
  │  │   ├─ topics            │  │            │  POST /api/autopilot/script/check   │
  │  │   ├─ create            │  │            │  POST /api/autopilot/voice          │
  │  │   ├─ shorts            │  │            │  POST /api/autopilot/voice/preview  │
  │  │   ├─ queue     (stub)  │  │            │  POST /api/autopilot/visuals-...    │
  │  │   ├─ review            │  │            │  POST /api/autopilot/presign(-upload)│
  │  │   ├─ voices    (stub)  │  │            │  POST /api/autopilot/assemble       │
  │  │   └─ analytics (stub)  │  │            │  POST /api/autopilot/shorts/...     │
  │  └────────────────────────┘  │            └────────────────────────────────────┘
  │                              │
  │  Direct browser calls:       │            ┌───────────────────────────┐
  │   ──Pexels stock video──────▶│───────────▶│ api.pexels.com (browser)  │
  │   ──S3 presigned PUT────────▶│───────────▶│ s3://tessbuilds-assets    │
  │   ──S3 presigned GET (audio)│◀───────────│   (presigned via Lambda)  │
  │                              │            └───────────────────────────┘
  │  localStorage:               │
  │   voiceId, voiceSettings,    │
  │   voiceSpeed, shortsVoiceId, │
  │   shortsVoiceSettings        │
  └──────────────────────────────┘
```

The Pexels search runs in the browser by design — Pexels rate-limits AWS Lambda egress IPs aggressively, so the dashboard fetches the video URL, downloads the MP4 blob client-side, then uploads it to S3 via a presigned URL issued by Lambda (`src/pages/CreateVideo.jsx:371-449`, `src/pages/Shorts.jsx:259-317`). This keeps the AWS IP off Pexels entirely.

## 3. Pages

Routing is a flat `activeTab` `useState` in `src/App.jsx:14`, switched via the sidebar buttons in `src/components/Sidebar.jsx:4-14`. There is no React Router; URL never changes. Nine tabs are wired, of which four are stubs.

### Dashboard — `src/pages/Dashboard.jsx`

Operator landing page. Fetches `/api/autopilot/jobs` and `/api/autopilot/topics?status=pending_review` in parallel on mount and on a 30s interval (`Dashboard.jsx:156-178`). Renders a 4-up stat row, a pipeline sparkline (jobs grouped by `stage` against the canonical 8-stage order), a channel list (rendered from `CHANNELS` in `constants.js`), a recent-jobs feed (5 most recent), and a stage legend. Clicking a job row opens `JobDetailModal` (`src/components/JobDetailModal.jsx`), which lazily presigns the script, audio, and per-clip visual S3 keys.

Notable: the "Channels" stat card is hardcoded to `4` (`Dashboard.jsx:236`), but `CHANNELS` has 5 entries.

### Topics — `src/pages/Topics.jsx`

Topic review queue. Loads `/api/autopilot/topics?status=pending_review` on mount (`Topics.jsx:103-119`). Renders cards grouped by channel with hook, "why this works" rationale, and search-volume badge. Per-card and bulk actions:
- `POST /api/autopilot/topics/{id}/approve` (`Topics.jsx:149-164`)
- `POST /api/autopilot/topics/{id}/reject` with `{reason}` (`Topics.jsx:166-182`)
- `POST /api/autopilot/topics/generate` with `{candidate_count: 10}` (`Topics.jsx:204-219`)

Optimistic local mutation on success — flips the topic's `status` in component state, then reloads on regenerate. Toast notifications via timed state. Filters by channel, source (trending/evergreen), and search volume.

Includes a 11-entry `MOCK_TOPICS` constant (`Topics.jsx:6-18`) re-exported from `src/constants.js:77`. The live page does not render `MOCK_TOPICS` — it is only imported by the unused `Sidebar` badge counter via `PENDING_TOPICS_COUNT` (`constants.js:79`).

### Create — `src/pages/CreateVideo.jsx`

The full 5-stage pipeline driver. Single page, scrollable, with a `PipelineStep` stepper across the top (`CreateVideo.jsx:45-69`, `522-526`). State machine driven by `step` (0–5) and stage-completion flags. A `jobId` is generated client-side once via `crypto.randomUUID()` and reused across the entire flow (`CreateVideo.jsx:218`).

Stages, each fire-and-poll:

1. **Script** — `POST /api/autopilot/script` with `{job_id, channel_id, topic, duration, visual_style}`, then poll `GET /api/autopilot/jobs/{id}` every 5s up to 24 times (120s ceiling) for `stage == 'script_done'` (`CreateVideo.jsx:242-295`). Optional `POST /api/autopilot/script/check` for a quality score (`CreateVideo.jsx:173-188`).
2. **Voice** — `POST /api/autopilot/voice` with the full voice payload (see §6), poll every 10s up to 18 times (180s) until `audio_duration > 0`. On success, presigns the voiceover S3 key for in-browser playback (`CreateVideo.jsx:298-369`). Live preview button uses `POST /api/autopilot/voice/preview` (`CreateVideo.jsx:190-211`).
3. **Visuals** — browser-side Pexels pipeline (see §5). Calls `POST /api/autopilot/visuals-keywords` for Claude-picked keywords, then per-clip: Pexels search → blob download → `POST /api/autopilot/presign-upload` → `PUT` to S3 → `POST /api/autopilot/visuals-save` with the asset map (`CreateVideo.jsx:372-450`).
4. **Assemble** — `POST /api/autopilot/assemble`, poll every 10s up to 25 times (250s) until `stage in ['pending_review', 'assembled']` (`CreateVideo.jsx:453-502`).
5. **Publish** — **UI-only**. The "Publish to YouTube" button calls `addToQueue()`, which just sets a 3-second confirmation toast (`CreateVideo.jsx:504-507`, `1008-1014`). No backend call. The `step >= 5` branch is never reachable through normal use because nothing advances `step` past 4 (`CreateVideo.jsx:981-1024`).

Voice settings sliders (stability/similarity/style/speed) and a 5-preset row sit above the topic input (`CreateVideo.jsx:553-632`). Voice and speed state is persisted to localStorage (see §6).

### Shorts — `src/pages/Shorts.jsx`

Parallel pipeline for vertical 1080×1920 Shorts. Channel is hardcoded to `ch_005` (`Shorts.jsx:5`). Two modes:

- **New Topic** — `POST /api/autopilot/shorts/script` with `{topic, duration}` (`Shorts.jsx:182-188`).
- **From Video** — picks a completed long-form job and calls `POST /api/autopilot/shorts/from-job` with `{source_job_id, duration}` to extract the most-shocking-fact moment (`Shorts.jsx:172-179`). Source job list comes from `/api/autopilot/jobs` filtered to those with scripts on non-`ch_005` channels (`Shorts.jsx:147-162`).

After the script returns, runs voice → visuals → assemble in the same fire-and-poll pattern as Create, but with shorter audio polls (5s × 18 = 90s) and a `searchPexelsVertical` helper that requests `orientation=portrait` and prefers `height >= 1080` (`Shorts.jsx:42-55`). Has its own voice-settings UI with the same preset row and slider widget; ignores the global voice settings, persists to its own localStorage keys (`shortsVoiceId`, `shortsVoiceSettings`). Includes a "voice approval" gate — visuals/assemble are hidden until the user clicks "✅ Sounds Good" on the audio preview (`Shorts.jsx:581-598`).

Has its own duplicated `VOICE_DEFAULTS`, `SLIDER_LABELS`, and `VOICE_PRESETS` constants (`Shorts.jsx:17-39`) — copies of the ones in `CreateVideo.jsx:21-43`. The Shorts presets do not have a `speed` field.

### Review Queue — `src/pages/ReviewQueue.jsx`

Human-in-the-loop approval. Loads `/api/autopilot/jobs` on mount + every 30s (`ReviewQueue.jsx:244-266`), filters to `stage in ['pending_review','assembled','approved']`.

- **PendingCard** (`ReviewQueue.jsx:27-186`): renders the assembled MP4 (presigned via `POST /api/autopilot/presign`), hook-highlighted script (first two sentences highlighted yellow), a "human touch" sentence input that ships to `POST /api/autopilot/jobs/{id}/approve` as `{personal_line}`, and approve/reject buttons. Reject uses `window.prompt('Why are you rejecting this video?')` for the reason (`ReviewQueue.jsx:67`).
- **ApprovedCard** (`ReviewQueue.jsx:189-236`): compact row with a "⬇ Download" button that presigns on click.

Optimistic UI: card state flips to `'approved'`/`'rejected'` immediately on a 2xx, before the next 30s poll reconciles.

### Sidebar — `src/components/Sidebar.jsx`

Fixed left nav, 230px. Tabs, channel quick-list (live channels only), and a mock API health panel (`API_HEALTH` in `constants.js:68-75` is static — Claude/ElevenLabs/FAL/YouTube/Lambda/S3 latencies are hardcoded numbers). Independently polls `/api/autopilot/jobs` every 30s to compute the Review Queue badge count (`Sidebar.jsx:24-39`). Queue and Topics badges read from static mock data, not the API.

### Channels / Queue / Voices / Analytics — stubs

`src/pages/Channels.jsx`, `Queue.jsx`, `Voices.jsx`, `Analytics.jsx` are all stub components rendering `<h1>X</h1><p>This is the X page.</p>` (`Channels.jsx:1-8`, etc.). They are the ones App.jsx mounts (`App.jsx:35-41`).

Rich implementations for these four pages exist in `src/pages/Pages.jsx:1-269` (with mock data wiring, charts, channel cards, etc.) and are re-exported from `src/pages/index.js:1-6`, but no file imports `Pages.jsx` or `pages/index.js`. They are dead code.

## 4. Shared infrastructure

### API client — none

There is no central client. Each consumer defines its own `apiFetchJson` (`Dashboard.jsx:21-35`, `CreateVideo.jsx:117-131`, `Topics.jsx:23-37`) or `api` (`Shorts.jsx:57-66`) helper, all roughly identical:

```js
async function apiFetchJson(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options);
  let data = {}; try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(data.error || data.message || `Request failed: ${res.status}`);
  return data;
}
```

`Sidebar.jsx`, `JobDetailModal.jsx`, and `ReviewQueue.jsx` use raw `fetch` directly. The `x-app-key` header is set per-call from `API_KEY` in `constants.js` — every consumer is responsible for adding it. Some helpers default it in (`Shorts.jsx:60`); others omit it on calls where the backend currently accepts unauthenticated requests (e.g., `Shorts.jsx` script/voice paths).

### Constants — `src/constants.js`

- `API_BASE`, `API_KEY`, `PEXELS_API_KEY` — read from `import.meta.env.VITE_API_BASE` / `VITE_API_KEY` / `VITE_PEXELS_API_KEY` (`constants.js:3-8`).
- `CHANNELS` — 5-element array with id, name, niche, avatar emoji, and mock counters (videos/subs/revenue/etc.) (`constants.js:10-16`). These mock counters are rendered by the dead `Pages.jsx` and Dashboard's channel list.
- `VOICES` — per-channel default voice (id pulled from `VITE_VOICE_*` env vars) (`constants.js:20-26`).
- `VOICE_LIBRARY` — 7 ElevenLabs voice IDs hardcoded for the Create-page voice dropdown (`constants.js:30-38`). Two of these (`21m00Tcm4TlvDq8ikWAM` Rachel, `JBFqnCBsd6RMkjVDRZzb` George) are not bound to any channel.
- `PIPELINE_STAGES` — color/label/order map for the 9 canonical stages (`constants.js:40-50`).
- `QUEUE`, `ANALYTICS_DATA`, `API_HEALTH`, `PENDING_TOPICS_COUNT` — pure mock data for the unmounted `Pages.jsx` views and the Sidebar badge counters.
- `MOCK_TOPICS` re-exported from `pages/Topics.jsx:6-18`.

### UI primitives — `src/components/ui.jsx`

A flat module of 9 styled-inline components: `PulsingDot`, `ProgressBar`, `Badge`, `Card`, `SectionLabel`, `PageHeader`, `Button` (6 variants: primary/secondary/success/warning/danger/ghost), `Spinner`, `StatCard`, `Select`, `Input`. All styling is inline `style={{ ... }}` — no CSS files, no Tailwind, no styled-components. Tokens are inlined per-component (e.g., `#7c3aed` for primary).

### Auth

Single shared API key in the `x-app-key` header, baked into the build from `VITE_API_KEY` at `vite build` time. No per-user auth, no login screen, no session. Anyone with the deployed JS bundle can read the key. The Pexels key (`VITE_PEXELS_API_KEY`) and ElevenLabs voice IDs (`VITE_VOICE_*`) are similarly bundled into the client.

## 5. Pipeline data flow (frontend view)

The canonical 5-stage create flow from the UI's perspective (`src/pages/CreateVideo.jsx`, with the Shorts variant in `src/pages/Shorts.jsx`):

```
USER ACTION                FRONTEND DOES                       BACKEND                       UI ADVANCES
────────────────────────   ─────────────────────────────────   ──────────────────────────    ────────────
Type topic, click          POST /script {job_id,…}             Script Lambda → DynamoDB      Step 0 → poll
"Generate Script"          then poll /jobs/{id} every 5s × 24  stage=script_done             then Step 1

Adjust sliders,            POST /voice/preview                 voice-preview Lambda          inline <audio>
click "▶ Preview"          (sync, returns presigned URL)       → ElevenLabs → S3             player

Click "Generate            POST /voice {job_id,…}              autopilot-voice-worker        Step 2 → poll
Voiceover"                 then poll /jobs/{id} every 10s × 18 (async)→ ElevenLabs → S3      then Step 3
                           then POST /presign for playback     stage=voice_done

Click "Generate Visuals"   GET /jobs/{id} → audio_duration     —                             progress text
                           POST /visuals-keywords (Claude)     visuals-keywords Lambda
                           loop: Pexels search (browser) →     api.pexels.com (browser)
                                 fetch blob (browser) →        Pexels CDN (browser)
                                 POST /presign-upload →        presign Lambda
                                 PUT blob to S3 (browser)      s3://tessbuilds-assets
                           POST /visuals-save {assets}         visuals-save → DynamoDB       Step 4

Click "Assemble Video"     POST /assemble {job_id}             autopilot-assembler Lambda    Step 5 (in spirit)
                           then poll /jobs/{id} every 10s × 25 → Shotstack → S3              "Check Review Queue"
                                                               stage=pending_review

(operator switches tab)    Review Queue polls /jobs            —                             PendingCard renders
                                                                                             video + script

Click "✅ Approve"         POST /jobs/{id}/approve             approve Lambda → DynamoDB     optimistic
                           {personal_line}                     stage=approved                green badge
```

YouTube publish is not wired (see §3, Create stage 5).

## 6. State persistence (localStorage)

| Key                     | Written by                | What survives a refresh                                       |
|-------------------------|---------------------------|---------------------------------------------------------------|
| `voiceId`               | `CreateVideo.jsx:150-152` | Last-selected voice on the Create page                        |
| `voiceSettings`         | `CreateVideo.jsx:154-156` | Stability/similarity/style slider values (JSON)               |
| `voiceSpeed`            | `CreateVideo.jsx:163-165` | Speed slider value (number)                                   |
| `shortsVoiceId`         | `Shorts.jsx:85-87`        | Last-selected voice on Shorts page                            |
| `shortsVoiceSettings`   | `Shorts.jsx:89-91`        | Shorts slider values (JSON)                                   |

Per-session (lost on refresh): `topic`, `script`, `jobId`, `channelId`, `voiceStatus`, `assembleStatus`, all preview/asset URLs, and the entire pipeline step state. Refreshing mid-flow loses the job context — the operator must check the Queue or Review Queue to find the in-progress `job_id`.

`voiceSettings` is read on mount with a fallback ladder: stored JSON → `VOICE_DEFAULTS[localStorage.voiceId]` → hardcoded `{0.70, 0.85, 0.62}` (`CreateVideo.jsx:141-148`). The `handleVoiceChange` callback resets the settings to the new voice's defaults on every voice change (`CreateVideo.jsx:236-239`). The Shorts page does the same (`Shorts.jsx:93-96`).

**Known sync risks:**
- `channelId` is **not** persisted. Switching channels mid-session does not currently reset `voiceId`, so the operator can end up with `channelId=ch_001` (True Crime) and `voiceId=onwK4e9ZLuTAKqWW03F9` (Daniel, the Finance voice) — neither the UI nor the backend re-binds. The backend voice worker now reads `voice_id` from the request body if present (see autopilot-lambda voice-worker), so the UI's selection wins, but the dropdown can drift out of sync with the channel header.
- `voiceSettings` carries across channel switches the same way. The new `handleVoiceChange` resets settings only when the *voice* changes, not the *channel*.

The `voice` payload submitted to `/api/autopilot/voice` is intentionally double-keyed to bridge two backend conventions — flat `stability`/`similarity`/`style` and nested `voice_settings.{stability, similarity_boost, style, use_speaker_boost}` (`CreateVideo.jsx:310-326`, `Shorts.jsx:208-222`). The voice worker prefers the nested form.

## 7. Build and deploy

- **Build**: `npm run build` → `vite build` → `dist/` (`package.json:8`).
- **Output**: `dist/index.html`, `dist/assets/*.js`, `dist/assets/*.css`, plus copied `public/favicon.svg` and `public/icons.svg`.
- **Base path**: `/autopilot-yt-app/` (`vite.config.js:6`). All asset URLs in the built bundle are prefixed with this — required because the site is served from `tessbuild.com/autopilot-yt-app/`, not the root.
- **Deploy**: `npm run deploy` → `gh-pages -d dist` (`package.json:11-12`), which pushes `dist/` to the `gh-pages` branch on origin. There is no GitHub Actions workflow; deploy is manual from a developer machine. `predeploy` re-runs `vite build` first.

### Required env vars (build time)

All are `VITE_*` and therefore **baked into the JS bundle** at build time — they are visible to anyone who downloads the site. Listed by source file:

| Env var                  | Read in                            | Notes                                                       |
|--------------------------|------------------------------------|-------------------------------------------------------------|
| `VITE_API_BASE`          | `constants.js:3`                   | Lambda API Gateway URL                                      |
| `VITE_API_KEY`           | `constants.js:4`                   | Shared `x-app-key` for the backend                          |
| `VITE_PEXELS_API_KEY`    | `constants.js:8`                   | Sent as `Authorization` header from the browser to Pexels    |
| `VITE_VOICE_ARNOLD`      | `constants.js:21`                  | ElevenLabs voice ID, used as `ch_001` default                |
| `VITE_VOICE_ERIC`        | `constants.js:22`                  | `ch_002` default                                             |
| `VITE_VOICE_ADAM`        | `constants.js:23`                  | `ch_003` default                                             |
| `VITE_VOICE_DANIEL`      | `constants.js:24`                  | `ch_004` default                                             |
| `VITE_VOICE_CHARLIE`     | `constants.js:25`                  | `ch_005` default                                             |
| `VITE_VOICE_RACHEL`      | (set in `.env`, no current reader) | Listed in `.env` but `constants.js` does not import it. The Rachel voice ID is hardcoded in `VOICE_LIBRARY` (`constants.js:33`). |

A `src/constants.example.js` exists as the public stand-in for `src/constants.js` (the latter is gitignored), but it only documents `API_BASE`/`API_KEY`/`PEXELS_API_KEY` — it is out of date relative to the current `import.meta.env` reads.

## 8. Surface-level observations

- **No routing library.** Tab state is a `useState` on the root component. Pros: zero dependency cost. Cons: no deep links, refresh always lands on Dashboard, no browser-back navigation between tabs. URLs are static.
- **No global state.** `localStorage` is the only cross-page persistence. Every page re-fetches from the API on mount. There is no React context, no Redux, no Zustand, no React Query — and no cache between tab switches. Switching from Dashboard to Review Queue re-runs `/api/autopilot/jobs`.
- **No shared API client.** Three near-identical `apiFetchJson` implementations and one `api` variant (Shorts) exist in parallel. Adding a base-URL or auth-header change requires touching 4 files. A single `src/api.js` module would cost ~30 lines.
- **Browser-side Pexels is deliberate.** Lambda egress IPs are heavily rate-limited by Pexels; doing the search and download in the browser keeps AWS off Pexels entirely. The cost is the `VITE_PEXELS_API_KEY` ending up in the client bundle.
- **Fire-and-poll for long jobs.** Script, voice, and assemble all use the same pattern: trigger Lambda → poll `/jobs/{id}` every N seconds for a stage transition. Decouples the UI from Lambda cold starts and 30s API Gateway timeouts. Polling intervals (5s/10s) and ceilings (120s/180s/250s) are hardcoded per-stage in each page.
- **Pages.jsx is dead code.** The rich Queue/Voices/Channels/Analytics implementations in `src/pages/Pages.jsx` and the barrel file `src/pages/index.js` are not imported anywhere. App.jsx mounts the four stub files (`Queue.jsx`, `Voices.jsx`, `Channels.jsx`, `Analytics.jsx`) instead. Either revive `Pages.jsx` or delete it.
- **`src/pages/constants_tmp.js` exists and is empty.** Zero bytes, unreferenced. Leftover scratch file.
- **README is the Vite template.** `README.md` is unchanged from `npm create vite@latest`. There is no project-specific README.
- **Frontend/backend channel drift.** `CHANNELS` in `src/constants.js:10-16` does not match `AUTOPILOT_CHANNELS` in `autopilot-lambda/lambda_function.py`:
  - `ch_002` frontend name `"Strategic Pulse Intel"` vs backend `"War Watch"`.
  - The legacy `QUEUE` mock data references `"Mind Unlocked"` for `ch_002` — a third name.
  - Mock `videos`/`subs`/`revenue` counters in `CHANNELS` are stale fixtures and feed into the dead `Pages.jsx` channel cards.
- **Voice-defaults drift.** Per-voice-id defaults in `CreateVideo.jsx:21-29` are keyed by ElevenLabs voice ID. Per-channel defaults in the backend `CHANNEL_CONFIG` (autopilot-lambda) are keyed by channel ID. The two tables aren't directly comparable, but they encode overlapping intent and drift independently — for example, the Daniel voice (`onwK4e9ZLuTAKqWW03F9`) carries `stability=0.75` in the frontend but `ch_004` (which defaults to Daniel) carries `voice_stability=0.38` in the backend.
- **Voice settings duplicated across pages.** `VOICE_DEFAULTS`, `SLIDER_LABELS`, `VOICE_PRESETS` are defined twice — once in `CreateVideo.jsx:21-43` and once in `Shorts.jsx:17-39`. Shorts' presets omit `speed`.
- **Sidebar mock data.** `API_HEALTH`, `PENDING_TOPICS_COUNT`, and the `QUEUE`-derived active-job count in the sidebar are static. The sidebar's API health lights are not real probes. Only the Review Queue badge does an actual API call.
- **YouTube publish is not implemented.** The "Publish to YouTube" button in `CreateVideo.jsx:1008-1014` and `step >= 5` UI gate are stubs — they show a "✅ Scheduled!" toast and never reach the YouTube API. The backend `scripts/oauth_setup.py` handles per-channel OAuth token storage in SSM, but no frontend code reads it or POSTs a publish call.
- **OAuth credentials history.** `src/constants.js` was committed in the initial commit (`44933ac`), then later added to `.gitignore` in commit `36b5de1` ("chore: gitignore OAuth credentials and env files"). The initial-commit constants likely contained hardcoded `VITE_API_KEY` / `VITE_PEXELS_API_KEY` values that were since rotated. `.gitignore` now blocks `src/constants.js`, `.env`, `client_secret.json`, `client_secret*.json`, `token_*.json`.
- **OAuth backup files.** `scripts/oauth_setup.py:93-96` writes `token_{channel_id}.json` to the current working directory as a local backup of refresh tokens, in addition to the SSM put. None of these files are present in the repo right now (verified with `find`), and `.gitignore` blocks the pattern, but the script will recreate them at the cwd next time it runs. If `scripts/oauth_setup.py` is run from the repo root, the file lands at the repo root; if it's run from `scripts/`, it lands in `scripts/`. Worth either removing the local-backup step or always writing to `~/.autopilot/` outside the repo.
- **`client_secret.json` lookup path.** `scripts/oauth_setup.py:46-55` searches `./client_secret.json`, `scripts/client_secret.json`, and `~/client_secret.json`. None currently on disk in the repo, but the first two are inside the repo tree — `.gitignore` covers them, but the safer option is `~/client_secret.json` only.
- **Bundle contains secrets.** Because `VITE_*` env vars are inlined at build time, `dist/assets/*.js` on `gh-pages` contains the current `VITE_API_KEY`, `VITE_PEXELS_API_KEY`, and all five ElevenLabs voice IDs. Anyone who views the site can read them. The backend `x-app-key` is effectively public; treat it as a fingerprint, not a secret. Same for Pexels — it is rate-limit attribution, not auth.
