// Pool Standings (Maker) — Scriptable iOS Widget
//
// Single pool  → paste one pool's JSON → add as Medium widget
// Multiple pools → paste all-pools JSON array → add as Large widget
//
// In the maker app:
//   "📲 Widget"     → copies active pool config  (Medium)
//   "📲 All Pools"  → copies all pools config     (Large)

const ODDS_API   = "https://script.google.com/macros/s/AKfycbyeMYsFI6sVfRnuPJgX_6-Ev9qr7dosfnpD-T-s9UtmMoQ03fjfHy6wuY3AJ63wU2wY/exec"
const NHL_WORKER = "https://lucky-forest-af32.gamache-m.workers.dev"
const POOL_URL   = "https://gamachem-arch.github.io/playoff-pool-maker/"

// ── parse parameter ──────────────────────────────────────
let paramRaw = args.widgetParameter || ""
let pools = []   // always an array internally
let isMulti = false

try {
  let parsed = JSON.parse(paramRaw)
  if (Array.isArray(parsed)) {
    pools = parsed
    isMulti = true
  } else if (parsed && parsed.players) {
    pools = [parsed]
  }
} catch(e) {}

// no config → show setup instructions
if (!pools.length) {
  let w = new ListWidget()
  w.backgroundColor = new Color("#0f172a")
  w.setPadding(16, 18, 16, 18)
  let t = w.addText("📲 Tap to configure")
  t.textColor = Color.white()
  t.font = Font.boldSystemFont(13)
  w.addSpacer(6)
  let s = w.addText('Open the pool app → tap "📲 Widget" or "📲 All Pools" in standings → paste the copied JSON as this widget\'s Parameter.')
  s.textColor = new Color("#94a3b8")
  s.font = Font.systemFont(11)
  Script.setWidget(w)
  if (config.runsInApp) await w.presentMedium()
  Script.complete()
  return
}

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
const ACCENT = ["#60a5fa","#f472b6","#a78bfa","#fb923c","#34d399","#fbbf24"]

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

function rankColor(i) {
  return [C.gold, C.silver, C.bronze, C.muted][i] ?? C.muted
}

function calcStandings(pool, oddsMap) {
  return pool.players.map((p, i) => ({
    name:  p.name,
    total: p.teams.reduce((s, t) => s + pct(oddsMap[t.toUpperCase()]), 0),
    alive: p.teams.filter(t => pct(oddsMap[t.toUpperCase()]) >= 0.1),
    color: p.color || ACCENT[i % ACCENT.length],
  })).sort((a, b) => b.total - a.total)
}

function etNow() { return new Date(Date.now() - 4 * 3600 * 1000) }

function isToday(utcStr) {
  if (!utcStr) return false
  let gET = new Date(new Date(utcStr).getTime() - 4 * 3600 * 1000)
  let now = etNow()
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

// ── shared: add games section to widget ──────────────────
function addGamesSection(w, showGames, todayGames) {
  if (todayGames.length === 0) {
    let ng = w.addText("No games today")
    ng.textColor = C.muted
    ng.font = Font.systemFont(10)
    return
  }
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
    gt.font = Font.systemFont(isMulti ? 10 : 11)
    gt.minimumScaleFactor = 0.8
    gt.lineLimit = 1

    if (i < count - 1) w.addSpacer(3)
  }
  if (showGames.length > 2) {
    w.addSpacer(2)
    let more = w.addText(`+${showGames.length - 2} more`)
    more.textColor = C.muted
    more.font = Font.systemFont(9)
  }
}

// ── medium widget (single pool) ──────────────────────────
function buildMedium(w, pool, oddsMap, showGames, todayGames) {
  w.setPadding(16, 18, 16, 18)
  let table = calcStandings(pool, oddsMap)

  // header
  let hdr = w.addStack()
  hdr.layoutHorizontally()
  hdr.centerAlignContent()
  let ico = hdr.addText("🏒"); ico.font = Font.systemFont(13)
  hdr.addSpacer(4)
  let ttl = hdr.addText((pool.title || "Playoff Pool").toUpperCase())
  ttl.textColor = C.text; ttl.font = Font.boldSystemFont(12); ttl.textOpacity = 0.85
  ttl.lineLimit = 1; ttl.minimumScaleFactor = 0.7
  hdr.addSpacer()
  let timeStr = etNow().toLocaleTimeString("en-CA", { hour:"numeric", minute:"2-digit", hour12:true, timeZone:"America/Toronto" })
  let upd = hdr.addText(timeStr); upd.textColor = C.muted; upd.font = Font.systemFont(10)

  w.addSpacer(7)

  // standings
  for (let i = 0; i < table.length; i++) {
    let s = table[i]
    let row = w.addStack(); row.layoutHorizontally(); row.centerAlignContent()
    let badge = row.addStack()
    badge.backgroundColor = rankColor(i); badge.cornerRadius = 3; badge.setPadding(1,5,1,5)
    let rk = badge.addText(String(i+1)); rk.textColor = new Color("#0f172a"); rk.font = Font.boldSystemFont(11)
    row.addSpacer(7)
    let nm = row.addText(s.name); nm.textColor = C.text; nm.font = Font.semiboldSystemFont(12); nm.lineLimit = 1
    row.addSpacer(4)
    let tm = row.addText(s.alive.length ? s.alive.join(" · ") : "—")
    tm.textColor = C.muted; tm.font = Font.systemFont(10); tm.minimumScaleFactor = 0.7; tm.lineLimit = 1
    row.addSpacer()
    let pt = row.addText(s.total.toFixed(1) + "%")
    pt.textColor = i === 0 ? new Color(s.color) : C.text; pt.font = Font.boldSystemFont(13)
    if (i < table.length - 1) w.addSpacer(4)
  }

  w.addSpacer(7)
  let div = w.addStack(); div.backgroundColor = C.border; div.size = new Size(0, 1)
  w.addSpacer(6)
  addGamesSection(w, showGames, todayGames)
  w.addSpacer()
}

// ── large widget (multiple pools) ───────────────────────
function buildLarge(w, allPools, oddsMap, showGames, todayGames) {
  w.setPadding(14, 16, 14, 16)

  // header
  let hdr = w.addStack(); hdr.layoutHorizontally(); hdr.centerAlignContent()
  let ico = hdr.addText("🏒"); ico.font = Font.systemFont(12)
  hdr.addSpacer(4)
  let ttl = hdr.addText("PLAYOFF POOLS")
  ttl.textColor = C.text; ttl.font = Font.boldSystemFont(11); ttl.textOpacity = 0.85
  hdr.addSpacer()
  let timeStr = etNow().toLocaleTimeString("en-CA", { hour:"numeric", minute:"2-digit", hour12:true, timeZone:"America/Toronto" })
  let upd = hdr.addText(timeStr); upd.textColor = C.muted; upd.font = Font.systemFont(10)

  w.addSpacer(6)

  for (let pi = 0; pi < allPools.length; pi++) {
    let pool = allPools[pi]
    let table = calcStandings(pool, oddsMap)

    // pool name label
    let poolLabel = w.addText((pool.title || "Pool").toUpperCase())
    poolLabel.textColor = C.muted; poolLabel.font = Font.boldSystemFont(9)
    w.addSpacer(3)

    // standings rows — compact
    for (let i = 0; i < table.length; i++) {
      let s = table[i]
      let row = w.addStack(); row.layoutHorizontally(); row.centerAlignContent()

      // rank badge
      let badge = row.addStack()
      badge.backgroundColor = rankColor(i); badge.cornerRadius = 3; badge.setPadding(1,4,1,4)
      let rk = badge.addText(String(i+1)); rk.textColor = new Color("#0f172a"); rk.font = Font.boldSystemFont(10)
      row.addSpacer(5)

      // name
      let nm = row.addText(s.name); nm.textColor = C.text; nm.font = Font.semiboldSystemFont(11); nm.lineLimit = 1

      row.addSpacer(3)

      // alive teams
      let tm = row.addText(s.alive.length ? s.alive.join(" · ") : "—")
      tm.textColor = C.muted; tm.font = Font.systemFont(9); tm.minimumScaleFactor = 0.65; tm.lineLimit = 1

      row.addSpacer()

      // pct
      let pt = row.addText(s.total.toFixed(1) + "%")
      pt.textColor = i === 0 ? new Color(s.color) : C.text; pt.font = Font.boldSystemFont(11)

      if (i < table.length - 1) w.addSpacer(3)
    }

    // divider between pools (not after last)
    if (pi < allPools.length - 1) {
      w.addSpacer(6)
      let div = w.addStack(); div.backgroundColor = C.border; div.size = new Size(0, 1)
      w.addSpacer(5)
    }
  }

  // games
  w.addSpacer(6)
  let div2 = w.addStack(); div2.backgroundColor = C.border; div2.size = new Size(0, 1)
  w.addSpacer(5)
  addGamesSection(w, showGames, todayGames)
  w.addSpacer()
}

// ── main ─────────────────────────────────────────────────
let [oddsMap, allGames] = await Promise.all([fetchOdds(), fetchGames()])
let todayGames    = allGames.filter(g => isToday(g.startUTC))
let liveGames     = todayGames.filter(g => ["LIVE","CRIT"].includes(g.state))
let upcomingGames = todayGames.filter(g => ["FUT","PRE"].includes(g.state))
let finalGames    = todayGames.filter(g => ["OFF","FINAL"].includes(g.state))
let showGames = liveGames.length ? liveGames : upcomingGames.length ? upcomingGames : finalGames

let w = new ListWidget()
w.backgroundColor = C.bg
w.url = (pools[0] && pools[0].url) || POOL_URL

if (isMulti) {
  buildLarge(w, pools, oddsMap, showGames, todayGames)
} else {
  buildMedium(w, pools[0], oddsMap, showGames, todayGames)
}

Script.setWidget(w)
if (config.runsInApp) {
  isMulti ? await w.presentLarge() : await w.presentMedium()
}
Script.complete()
