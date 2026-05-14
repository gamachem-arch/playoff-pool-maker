# NHL Playoff Tracker / Pool Maker

A full-featured NHL playoff tracker and pool manager — built as a single-file PWA (Progressive Web App). Installs to your home screen on iOS and Android, no App Store required.

**Live app:** https://gamachem-arch.github.io/playoff-pool-maker/
**Landing page:** https://gamachem-arch.github.io/nhl-playoff-tracker/

---

## Features

### Playoff Tracker
- **Live win probabilities** — real-time cup odds from MoneyPuck, updated throughout every game
- **Series tracker** — every playoff matchup with odds history sparklines (dual-line, team vs team)
- **Tonight's games** — live scores, pulsing dot on active games, tap for full analysis
- **Playoff bracket** — full bracket with pool player colours and series progress
- **Scoring leaders** — top scorers across all playoff teams with headshots and stat tabs (PTS · HITS · BLK · TK · GV · PD)
- **Rich player cards** — tap any scorer for situational stats, ice time, shot types, physical stats

### Live Game Analysis Overlay
Tap any live game row for a full-screen overlay:
- Win probability chart (SVG, blue line + gradient fill, goal dots, period dividers)
- Team stats — win game %, win series %, cup %
- Game control bars — Zone Control + Shot Quality with team logos
- Shot map — full SVG rink with xGoals-weighted dots, away (orange) vs home (blue)
- Scoring summary — per goal: time, scorer, assists, Δwin%
- Replay slider (completed games) — scrub win% chart + game control bars frame by frame
- Auto-refreshes every 30s during live games

### Pool Mode
- Create a pool with any number of players — each picks teams in a draft
- Share a single link — recipients get a personalized view (their card highlighted)
- Pool standings with cup% sparklines per player
- Pool-coloured team highlights throughout the app
- Personalization — tap your standing card to set your colour; saved in localStorage
- 📲 Widget button — copies pool config for Scriptable iOS widget (Medium or Large)

### PWA / Install
- Full-screen PWA install overlay on first mobile visit (iOS: Add to Home Screen steps; Android: one-tap install)
- Shared pool `#pool=BASE64` hash preserved so "Add to Home Screen" captures the full pool URL
- Guided 7-step product tour fires on first load (keyed per pool via localStorage)

---

## Architecture

Single self-contained HTML file (`index.html`). No build step, no dependencies, no server.

- **Data:** Google Apps Script proxy → MoneyPuck + NHL API (avoids CORS)
- **State:** `_poolState` / `_makerState` global cache; localStorage for pools + preferences
- **Fonts:** Barlow Condensed (headings) + Inter (body), self-hosted as woff2 in `/fonts/`
- **Icons:** NHL CDN (`assets.nhle.com/logos/nhl/svg/TEAM_light.svg`)

### Key functions
| Function | Purpose |
|---|---|
| `doRender()` | Full re-render of standings, series, tonight, leaders |
| `showLiveGameOverlayMaker()` | Opens live game analysis overlay |
| `buildBracket()` | Builds full playoff bracket SVG/HTML |
| `buildOnTheClock()` | Tonight's games pill |
| `buildLeadersRow()` | Scoring leaders strip |
| `showPlayerCard()` | Rich player stat overlay |
| `initTour()` / `startTour()` | Guided onboarding tour |

### Apps Script endpoints
| Action | Returns |
|---|---|
| `?action=odds` | Live cup odds for all playoff teams |
| `?action=history` | Daily snapshot history (Sheet4) |
| `?action=games` | All playoff games + series |
| `?action=mpGame&id=X&season=Y` | Live game data from MoneyPuck CSV + NHL PBP |
| `?action=scoringLeaders&category=X` | Top scorers by category |
| `?action=playerStats&id=X` | Full player stat breakdown |
| `?action=teamPhysicals&away=X&home=Y` | Physical stats for both teams |

---

## Push Workflow

```bash
# 1. Check file size — must be >100KB
wc -c index.html

# 2. Get current SHA
curl -s -H "Authorization: token TOKEN" \
  "https://api.github.com/repos/gamachem-arch/playoff-pool-maker/contents/index.html" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['sha'])"

# 3. Push
CONTENT=$(base64 -i index.html)
curl -s -X PUT -H "Authorization: token TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.github.com/repos/gamachem-arch/playoff-pool-maker/contents/index.html" \
  -d "{\"message\":\"your message\",\"content\":\"$CONTENT\",\"sha\":\"SHA_HERE\"}"
```

---

## 2027 Season Roadmap

### Player Pool Mode
Pick 1 player per playoff team instead of teams. Points-based standings. Top 10 scorers per team as draft options (already fetched via scoring leaders API). Commissioner assigns picks live on a group call, shares link when done.

### Tracker-Only Mode (no pool)
A standalone NHL playoff tracker for users who aren't running a pool. Main view renders without requiring a pool — standings section hidden or replaced with a "create a pool" prompt. Requires architectural changes to decouple the render layer from pool state.

### 3-Tour Onboarding System
Three distinct first-run experiences based on entry point:
- **Tour A — Just following the playoffs** (organic/landing page): tracker-focused tour, no pool steps. Requires Tracker-Only Mode above.
- **Tour B — Running a pool** (organic/landing page): full tour with demo pool preloaded, ends with "Create your real pool" prompt.
- **Tour C — Shared pool link** (existing behaviour): pool already loaded, existing tour unchanged.

Entry detection: `#pool=BASE64` hash → Tour C. No hash + first visit → "What brings you here?" welcome card → Tour A or B.

> Note: Tour A/B were prototyped in May 2026 but reverted — the app's render layer needs to support poolless state before the tours can work cleanly. Architecture-first, then tours.

### Distribution
- Landing page live at `gamachem-arch.github.io/nhl-playoff-tracker` (self-hosted fonts, lazy images)
- Presented by [HockeyBangers](https://hockeybangers.substack.com) newsletter + X
- Android Play Store via PWA (Bubblewrap) — $25 one-time
- Custom domain (e.g. `nhlplayofftracker.com`) + Netlify/Cloudflare Pages for faster CDN

---

## Local Dev

```bash
python3 -m http.server 8080 --directory "/Users/michel/Downloads/POOL APP"
# open http://localhost:8080/maker-index.html
```
