// Pool Standings (Maker) — Scriptable iOS Widget
// Medium size recommended. Tap opens the maker app.
//
// Setup:
//   1. In the maker app, tap "📲 Widget" in the standings section → copies config JSON
//   2. Paste into Scriptable as a new script
//   3. Add a Medium widget → Script = this file → Parameter = paste the copied JSON

const ODDS_API = "https://script.google.com/macros/s/AKfycbyeMYsFI6sVfRnuPJgX_6-Ev9qr7dosfnpD-T-s9UtmMoQ03fjfHy6wuY3AJ63wU2wY/exec"
const NHL_WORKER = "https://lucky-forest-af32.gamache-m.workers.dev"

// ── load pool config from widget parameter ───────────────
let poolConfig = null
try {
  let raw = args.widgetParameter || args.queryParameters?.config || ""
  if (raw) poolConfig = JSON.parse(raw)
} catch(e) {}

// fallback placeholder shown when no param is set
if (!poolConfig || !poolConfig.players || !poolConfig.players.length) {
  let w = new ListWidget()
  w.backgroundColor = new Color("#0f172a")
  w.setPadding(16, 18, 16, 18)
  let t = w.addText("📲 Tap to configure")
  t.textColor = Color.white()
  t.font = Font.boldSystemFont(13)
  w.addSpacer(6)
  let s = w.addText("Open the maker app → tap 📲 Widget in standings → paste the copied JSON as this widget's Parameter.")
  s.textColor = new Color("#94a3b8")
  s.font = Font.systemFont(11)
  Script.setWidget(w)
  if (config.runsInApp) await w.presentMedium()
  Script.complete()
  return
}

const POOL_TITLE = poolConfig.title || "Playoff Pool"
const POOL_URL   = poolConfig.url   || "https://gamachem-arch.github.io/playoff-pool-maker/"
const PLAYERS    = poolConfig.players  // [{name, abbrev, teams:[]}]

// ── colors ───────────────────────────────────────────────
const C = {
  bg:     new Color("#0f172a"),
  text:   Color.white(),
  muted:  new Color("#94a3b8"),
  green:  new Color("#34d399"),
  gold:   new Color("#fbbf24"),
  silver: new Color("#cbd5e1"),
  bronze: new Color("#c07a3a"),
  red:    new Color("#f87171"),
  border: new Color("#334155"),
}

// Player accent colors (cycles if more than 4)
const ACCENT_COLORS = ["#60a5fa","#f472b6","#a78bfa","#fb923c","#34d399","#fbbf24"]

// ── data fetching ────────────────────────────────────────
async function fetchOdds() {
  try {
    let req = new Request(ODDS_API + "?t=" + Date.now())
    req.timeoutInterval = 10
    let data = await req.loadJSON()
    let map = {}
    for (let [k, v] of Object.entries(data)) {
      let team = k.toUpperCase().trim()
      if (typeof v === "string") map[team] = v
      else if (v && v.cup) map[team] = v.cup
    }
    return map
  } catch(e) { return {} }
}

async function fetchGames() {
  try {
    let req = new Request(NHL_WORKER + "?action=nhl&t=" + Date.now())
    req.timeoutInterval = 10
    let data = await req.loadJSON()
    let games = []
    for (let day of (data.gamesByDate || [])) {
      for (let g of (day.games || [])) {
        if (g.gameType !== 3) continue
        games.push({
          away:       g.awayTeam.abbrev,
          home:       g.homeTeam.abbrev,
          awayScore:  g.awayTeam.score ?? null,
          homeScore:  g.homeTeam.score ?? null,
          state:      g.gameState,
          startUTC:   g.startTimeUTC,
          period:     g.periodDescriptor?.number ?? null,
          periodType: g.periodDescriptor?.periodType ?? "REG",
        })
      }
    }
    return games
  } catch(e) { return [] }
}

// ── helpers ──────────────────────────────────────────────
function pct(s) { return parseFloat(String(s || 0).replace("%","")) || 0 }

function standings(oddsMap) {
  return PLAYERS.map((p, i) => ({
    name:   p.name,
    abbrev: (p.abbrev || p.name.substring(0,3)).toUpperCase(),
    total:  p.teams.reduce((s, t) => s + pct(oddsMap[t.toUpperCase()]), 0),
    alive:  p.teams.filter(t => pct(oddsMap[t.toUpperCase()]) >= 0.1),
    color:  p.color || ACCENT_COLORS[i % ACCENT_COLORS.length],
  }))
  .sort((a, b) => b.total - a.total)
}

function etNow() { return new Date(Date.now() - 4 * 3600 * 1000) }

function isToday(utcStr) {
  if (!utcStr) return false
  let gET  = new Date(new Date(utcStr).getTime() - 4 * 3600 * 1000)
  let now  = etNow()
  return gET.getUTCFullYear() === now.getUTCFullYear()
      && gET.getUTCMonth()    === now.getUTCMonth()
      && gET.getUTCDate()     === now.getUTCDate()
}

function fmtTime(utcStr) {
  let et = new Date(new Date(utcStr).getTime() - 4 * 3600 * 1000)
  let h = et.getUTCHours(), m = et.getUTCMinutes()
  let ap = h >= 12 ? "PM" : "AM"
  h = h % 12 || 12
  return `${h}:${m.toString().padStart(2,"0")} ${ap} ET`
}

function fmtPeriod(g) {
  if (!g.period) return "LIVE"
  if (g.periodType === "OT") return "OT"
  if (g.periodType === "SO") return "SO"
  return `P${g.period}`
}

function rankColor(i) {
  return [C.gold, C.silver, C.bronze, C.muted][i] ?? C.muted
}

// ── widget build ─────────────────────────────────────────
async function buildWidget() {
  let [oddsMap, allGames] = await Promise.all([fetchOdds(), fetchGames()])
  let table = standings(oddsMap)
  let todayGames = allGames.filter(g => isToday(g.startUTC))

  let liveGames    = todayGames.filter(g => ["LIVE","CRIT"].includes(g.state))
  let upcomingGames= todayGames.filter(g => ["FUT","PRE"].includes(g.state))
  let finalGames   = todayGames.filter(g => ["OFF","FINAL"].includes(g.state))
  let showGames = liveGames.length ? liveGames
                : upcomingGames.length ? upcomingGames
                : finalGames

  let w = new ListWidget()
  w.backgroundColor = C.bg
  w.setPadding(16, 18, 16, 18)
  w.url = POOL_URL

  // ── header ──
  let hdr = w.addStack()
  hdr.layoutHorizontally()
  hdr.centerAlignContent()

  let ico = hdr.addText("🏒")
  ico.font = Font.systemFont(13)
  hdr.addSpacer(4)

  let title = hdr.addText(POOL_TITLE.toUpperCase())
  title.textColor = C.text
  title.font = Font.boldSystemFont(12)
  title.textOpacity = 0.85
  title.lineLimit = 1
  title.minimumScaleFactor = 0.7

  hdr.addSpacer()

  let timeStr = etNow().toLocaleTimeString("en-CA", {
    hour: "numeric", minute: "2-digit", hour12: true,
    timeZone: "America/Toronto"
  })
  let updText = hdr.addText(timeStr)
  updText.textColor = C.muted
  updText.font = Font.systemFont(10)

  w.addSpacer(7)

  // ── standings rows ──
  for (let i = 0; i < table.length; i++) {
    let s = table[i]

    let row = w.addStack()
    row.layoutHorizontally()
    row.centerAlignContent()
    row.spacing = 0

    // rank badge
    let badge = row.addStack()
    badge.backgroundColor = rankColor(i)
    badge.cornerRadius = 3
    badge.setPadding(1, 5, 1, 5)
    let rankT = badge.addText(String(i + 1))
    rankT.textColor = new Color("#0f172a")
    rankT.font = Font.boldSystemFont(11)

    row.addSpacer(7)

    // name
    let nameT = row.addText(s.name)
    nameT.textColor = C.text
    nameT.font = Font.semiboldSystemFont(12)
    nameT.lineLimit = 1

    row.addSpacer(4)

    // alive teams
    let teamsStr = s.alive.length ? s.alive.join(" · ") : "—"
    let teamsT = row.addText(teamsStr)
    teamsT.textColor = C.muted
    teamsT.font = Font.systemFont(10)
    teamsT.minimumScaleFactor = 0.7
    teamsT.lineLimit = 1

    row.addSpacer()

    // cup total — use player's color for leader, else white
    let pctColor = i === 0 ? new Color(s.color) : C.text
    let pctT = row.addText(s.total.toFixed(1) + "%")
    pctT.textColor = pctColor
    pctT.font = Font.boldSystemFont(13)

    if (i < table.length - 1) w.addSpacer(4)
  }

  w.addSpacer(7)

  // ── thin divider ──
  let divRow = w.addStack()
  divRow.backgroundColor = C.border
  divRow.size = new Size(0, 1)

  w.addSpacer(6)

  // ── tonight's games ──
  if (todayGames.length === 0) {
    let ng = w.addText("No games today")
    ng.textColor = C.muted
    ng.font = Font.systemFont(10)
  } else {
    let count = Math.min(showGames.length, 2)
    for (let i = 0; i < count; i++) {
      let g = showGames[i]
      let isLive  = ["LIVE","CRIT"].includes(g.state)
      let isFinal = ["OFF","FINAL"].includes(g.state)

      let row = w.addStack()
      row.layoutHorizontally()
      row.centerAlignContent()
      row.spacing = 4

      if (isLive) {
        let dot = row.addText("●")
        dot.textColor = C.red
        dot.font = Font.systemFont(7)
      }

      let line
      if (isFinal)     line = `${g.away} ${g.awayScore} – ${g.home} ${g.homeScore}  FINAL`
      else if (isLive) line = `${g.away} ${g.awayScore} – ${g.home} ${g.homeScore}  ${fmtPeriod(g)}`
      else             line = `${g.away} vs ${g.home}  ${fmtTime(g.startUTC)}`

      let gt = row.addText(line)
      gt.textColor = isLive ? C.text : C.muted
      gt.font = Font.systemFont(11)
      gt.minimumScaleFactor = 0.8
      gt.lineLimit = 1

      if (i < count - 1) w.addSpacer(3)
    }

    if (showGames.length > 2) {
      w.addSpacer(2)
      let more = w.addText(`+${showGames.length - 2} more game${showGames.length - 2 > 1 ? "s" : ""}`)
      more.textColor = C.muted
      more.font = Font.systemFont(9)
    }
  }

  w.addSpacer()
  return w
}

// ── run ──────────────────────────────────────────────────
let widget = await buildWidget()
Script.setWidget(widget)
if (config.runsInApp) await widget.presentMedium()
Script.complete()
