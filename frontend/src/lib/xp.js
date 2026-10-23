// XP, levels, ranks, quests and badges — all derived from S.workouts, never stored. Nothing here
// is written into the synced state, so two devices, an import or an edited past workout always
// agree on the same level: it is a reading of the log, the way the streak is.
//
// One pass over the log in date order (xpLedger) is the whole engine. Each workout earns
//   · SET_XP per completed work set (warm-ups don't count),
//   · PR_XP per personal record it set (w.prs, as the finish flow wrote it),
//   · STREAK_XP per week of the training streak it extends, capped at STREAK_CAP weeks,
//   · a quest's XP when this workout is the one that completes it,
//   · a badge's XP when this workout is the one that unlocks it.
import { workSetsDone, bestWeightForEntry } from './history.js'
import { weekKey, weekStartOf, isoOf } from './format.js'

export const SET_XP = 15
export const PR_XP = 150
export const STREAK_XP = 10
export const STREAK_CAP = 26

// What one level costs: 400 for level 1 → 2, 200 more for each level after it.
export const levelCost = lvl => 200 + 200 * lvl
// Total XP at which `lvl` starts.
export const xpAtLevel = lvl => 200 * (lvl - 1) + 100 * (lvl - 1) * lvl

export function levelOf(total) {
  let lvl = 1
  while (xpAtLevel(lvl + 1) <= total) lvl++
  const cur = total - xpAtLevel(lvl)
  return { lvl, cur, max: levelCost(lvl), total }
}

// The ladder, lowest first. Each rank but the last splits its levels into three tiers, III → I.
export const RANKS = [
  { key: 'rookie', name: 'Rookie', lo: 1, hi: 5, color: 'var(--label-2)' },
  { key: 'iron', name: 'Iron', lo: 6, hi: 14, color: '#8e8e93' },
  { key: 'steel', name: 'Steel', lo: 15, hi: 24, color: 'var(--teal)' },
  { key: 'titan', name: 'Titan', lo: 25, hi: 39, color: 'var(--yellow)' },
  { key: 'legend', name: 'Legend', lo: 40, hi: Infinity, color: 'var(--orange)' },
]
const TIERS = ['III', 'II', 'I']

export function rankOf(lvl) {
  const i = RANKS.findIndex(r => lvl >= r.lo && lvl <= r.hi)
  const r = RANKS[i]
  const tier = r.hi === Infinity ? '' : TIERS[Math.floor((lvl - r.lo) * 3 / (r.hi - r.lo + 1))]
  return { ...r, index: i, tier, label: tier ? r.name + ' ' + tier : r.name }
}

// The next level whose rank label differs from this one's, and the XP still to go to reach it.
export function nextRank(total) {
  const { lvl } = levelOf(total)
  const now = rankOf(lvl).label
  let n = lvl + 1
  while (rankOf(n).label === now) n++
  return { lvl: n, rank: rankOf(n), xp: xpAtLevel(n) - total }
}

// ---- quests ------------------------------------------------------------------------------------

export const DAILY_SETS = 15
export const WEEKLY_SETS = 60
// Days a week the plan asks for: weekdays with a routine on them, or 3 with no fixed week.
export function weeklyTarget(S) {
  const days = Object.values(S?.week || {}).filter(ids => [].concat(ids || []).some(id => (S.routines || []).some(r => r.id === id))).length
  return Math.min(7, days || 3)
}

export const QUESTS = [
  { key: 'daySets', kind: 'daily', xp: 50, color: 'var(--green)', icon: 'check' },
  { key: 'dayPr', kind: 'daily', xp: 100, color: 'var(--orange)', icon: 'bolt' },
  { key: 'weekTrain', kind: 'weekly', xp: 150, color: 'var(--blue)', icon: 'flame' },
  { key: 'weekSets', kind: 'weekly', xp: 120, color: 'var(--pink)', icon: 'barbell' },
]
const questNeed = (S, key) => key === 'daySets' ? DAILY_SETS : key === 'dayPr' ? 1 : key === 'weekTrain' ? weeklyTarget(S) : WEEKLY_SETS

// ---- badges ------------------------------------------------------------------------------------

const LB = 2.20462
// Lift thresholds are set in kg; a pound log is held against the same load.
const kg = (S, v) => (S?.unit === 'lb' ? v / LB : v)
const BENCH = ['0025']
const SQUAT = ['0043', '3593', '1436', '1435']
const DEADLIFT = ['0032', '0117']
const best = (st, ids) => Math.max(0, ...ids.map(id => st.best[id] || 0))

// The twelve illustrated badges (src/xp-art/<art>.webp, cut from assets/badges/Badge Collection.png).
// [category, key, art, name, tier, icon, description, have(stats), need, xp]
export const BADGES = [
  ['milestones', 'w1', 'set-sail', 'Set Sail', 'bronze', 'star', 'Finish your first workout.', s => s.workouts, 1, 25],
  ['milestones', 'w100', 'hero-training', 'Hero Training', 'gold', 'star', 'Finish 100 workouts.', s => s.workouts, 100, 250],
  ['milestones', 'sets1000', 'survivor', 'Survivor', 'silver', 'compact', 'Complete 1,000 sets.', s => s.sets, 1000, 150],
  ['streaks', 'streak4', 'lone-wolf', 'Lone Wolf', 'bronze', 'flame', 'Train 4 weeks in a row.', s => s.bestStreak, 4, 50],
  ['streaks', 'streak12', 'long-ride', 'Long Ride', 'gold', 'flame', 'Keep a 12-week training streak.', s => s.bestStreak, 12, 200],
  ['streaks', 'streak26', 'carved-in-stone', 'Carved in Stone', 'elite', 'crown', 'Keep a 26-week training streak.', s => s.bestStreak, 26, 500],
  ['records', 'pr2day', 'augmented', 'Augmented', 'silver', 'bolt', 'Set two personal records in one workout.', s => s.maxPrs, 2, 75],
  ['records', 'pr25', 'beyond-the-walls', 'Beyond the Walls', 'gold', 'bolt', 'Set 25 personal records.', s => s.prs, 25, 200],
  ['strength', 'vol9000', 'over-9000', 'Over 9000', 'gold', 'steps', 'Move 9,000 kg (19,850 lb) in a single workout.', s => s.maxVol, 9000, 200],
  ['strength', 'dead150', 'kaiju', 'Kaiju', 'elite', 'legs', 'Deadlift 150 kg (330 lb) for a rep.', s => s.deadlift, 150, 400],
  ['habits', 'early10', 'first-light', 'First Light', 'silver', 'sunrise', 'Finish 10 workouts started before 8 am.', s => s.early, 10, 100],
  ['habits', 'late10', 'night-shift', 'Night Shift', 'silver', 'moon', 'Finish 10 workouts started after 8 pm.', s => s.late, 10, 100],
].map(([cat, key, art, name, tier, icon, desc, have, need, xp]) => ({ cat, key, art, name, tier, icon, desc, have, need, xp }))

export const BADGE_CATS = ['milestones', 'streaks', 'records', 'strength', 'habits']
export const TIER_COLOR = { bronze: 'var(--orange)', silver: '#aeaeb2', gold: 'var(--yellow)', elite: 'var(--teal)' }

// ---- the ledger --------------------------------------------------------------------------------

const chrono = (a, b) => ((a.d || '') < (b.d || '') ? -1 : (a.d || '') > (b.d || '') ? 1 : (a.start || 0) - (b.start || 0))

// Consecutive training weeks ending at `key`, counted from the set of weeks with a workout.
function streakAt(weeks, key) {
  let n = 0
  const d = new Date(key + 'T12:00:00')
  while (weeks.has(isoOf(d))) { n++; d.setDate(d.getDate() - 7) }
  return n
}

/**
 * Every workout's XP, oldest first, plus the running totals and badge unlocks.
 * Returns { rows: [{ w, sets, prs, streak, parts: [{ key, xp, … }], xp, total }], stats, earned }
 * where earned maps a badge key to { d, id } of the workout that unlocked it.
 */
export function xpLedger(S) {
  const ws = weekStartOf(S)
  const list = [...(S?.workouts || [])].filter(w => w && w.d).sort(chrono)
  const weeks = new Set(list.map(w => weekKey(w.d, ws)))
  const stats = { workouts: 0, sets: 0, prs: 0, maxPrs: 0, bestStreak: 0, tonnes: 0, maxVol: 0, early: 0, late: 0, best: {}, bench: 0, squat: 0, deadlift: 0 }
  const day = {}, week = {}, done = new Set(), earned = {}
  const rows = []
  let total = 0
  for (const w of list) {
    const sets = workSetsDone(w)
    const prs = Array.isArray(w.prs) ? w.prs.length : 0
    const wk = weekKey(w.d, ws)
    const streak = streakAt(weeks, wk)
    const parts = []
    if (sets) parts.push({ key: 'sets', n: sets, xp: sets * SET_XP })
    if (prs) parts.push({ key: 'prs', n: prs, xp: prs * PR_XP })
    if (streak > 1) parts.push({ key: 'streak', n: streak, xp: Math.min(streak, STREAK_CAP) * STREAK_XP })

    const D = (day[w.d] ||= { sets: 0, prs: 0 })
    const W = (week[wk] ||= { sets: 0, train: 0 })
    D.sets += sets; D.prs += prs; W.sets += sets; W.train++
    const progress = { daySets: D.sets, dayPr: D.prs, weekTrain: W.train, weekSets: W.sets }
    for (const q of QUESTS) {
      const id = q.key + ':' + (q.kind === 'daily' ? w.d : wk)
      if (!done.has(id) && progress[q.key] >= questNeed(S, q.key)) {
        done.add(id)
        parts.push({ key: 'quest', quest: q.key, xp: q.xp })
      }
    }

    stats.workouts++
    stats.sets += sets
    stats.prs += prs
    stats.maxPrs = Math.max(stats.maxPrs, prs)
    stats.bestStreak = Math.max(stats.bestStreak, streak)
    const vol = kg(S, Number(w.vol) || 0)
    stats.tonnes += vol / 1000
    stats.maxVol = Math.max(stats.maxVol, vol)
    const hour = w.start ? new Date(w.start).getHours() : null
    if (hour != null && hour < 8) stats.early++
    if (hour != null && hour >= 20) stats.late++
    for (const e of w.entries || []) {
      const t = Number(bestWeightForEntry(e)) || 0
      if (t > (stats.best[e.id] || 0)) stats.best[e.id] = t
    }
    stats.bench = kg(S, best(stats, BENCH))
    stats.squat = kg(S, best(stats, SQUAT))
    stats.deadlift = kg(S, best(stats, DEADLIFT))
    for (const b of BADGES) {
      if (!earned[b.key] && b.have(stats) >= b.need) {
        earned[b.key] = { d: w.d, id: w.id }
        parts.push({ key: 'badge', badge: b.key, xp: b.xp })
      }
    }

    const xp = parts.reduce((n, p) => n + p.xp, 0)
    total += xp
    rows.push({ w, sets, prs, streak, parts, xp, total })
  }
  return { rows, stats, earned, total }
}

// ---- views of the ledger -----------------------------------------------------------------------

/** The player card: level, rank and lifetime numbers. */
export function playerOf(S, today) {
  const L = xpLedger(S)
  const level = levelOf(L.total)
  const month = (today || '').slice(0, 7)
  return {
    ...level,
    rank: rankOf(level.lvl),
    next: nextRank(L.total),
    workouts: L.stats.workouts,
    prs: L.stats.prs,
    prsMonth: L.rows.filter(r => r.w.d.slice(0, 7) === month).reduce((n, r) => n + r.prs, 0),
    bestStreak: L.stats.bestStreak,
    badges: Object.keys(L.earned).length,
    ledger: L,
  }
}

/** What one saved workout earned, and the level before and after it. Null when it isn't logged. */
export function sessionXp(S, workoutId) {
  const L = xpLedger(S)
  const i = L.rows.findIndex(r => r.w.id === workoutId)
  if (i < 0) return null
  const row = L.rows[i]
  const before = levelOf(row.total - row.xp)
  const after = levelOf(row.total)
  return {
    ...row,
    before, after,
    rankBefore: rankOf(before.lvl), rankAfter: rankOf(after.lvl),
    badges: row.parts.filter(p => p.key === 'badge').map(p => BADGES.find(b => b.key === p.badge)),
  }
}

/** The four quests as they stand on `today`: progress, need and whether each is complete. */
export function questsOf(S, today) {
  const ws = weekStartOf(S)
  const wk = weekKey(today, ws)
  const todays = (S?.workouts || []).filter(w => w && w.d === today)
  const weeks = (S?.workouts || []).filter(w => w && w.d && weekKey(w.d, ws) === wk)
  const have = {
    daySets: todays.reduce((n, w) => n + workSetsDone(w), 0),
    dayPr: todays.reduce((n, w) => n + (Array.isArray(w.prs) ? w.prs.length : 0), 0),
    weekTrain: weeks.length,
    weekSets: weeks.reduce((n, w) => n + workSetsDone(w), 0),
  }
  return QUESTS.map(q => {
    const need = questNeed(S, q.key)
    const h = Math.min(have[q.key], need)
    return { ...q, have: h, need, pct: Math.round(h / need * 100), done: h >= need }
  })
}

/** Every badge with its progress and, once earned, when. */
export function badgesOf(S) {
  const L = xpLedger(S)
  return BADGES.map(b => {
    const have = b.have(L.stats)
    const e = L.earned[b.key]
    return { ...b, have: Math.min(have, b.need), pct: Math.round(Math.min(1, have / b.need) * 100), earned: !!e, earnedOn: e?.d || null, earnedIn: e?.id ?? null }
  })
}

/** The XP of the last `n` sessions, oldest first. */
export function recentXp(S, n = 8) {
  return xpLedger(S).rows.slice(-n).map(r => ({ d: r.w.d, xp: r.xp, id: r.w.id }))
}

/** A fair guess at what a routine day is worth before it starts: its sets, plus the streak bonus
 *  it would keep alive. Quests and records are left out — they are not promised. */
export function missionXp(S, routines, today) {
  const sets = (routines || []).reduce((n, r) => n + (r.ex || []).reduce((m, x) => m + (Number(x?.sets) || 0), 0), 0)
  const ws = weekStartOf(S)
  const weeks = new Set((S?.workouts || []).filter(w => w && w.d).map(w => weekKey(w.d, ws)))
  weeks.add(weekKey(today, ws))
  const streak = streakAt(weeks, weekKey(today, ws))
  return { sets, xp: sets * SET_XP + (streak > 1 ? Math.min(streak, STREAK_CAP) * STREAK_XP : 0) }
}

/** Hours until the daily quests reset (local midnight). */
export function hoursToReset(now = new Date()) {
  const mid = new Date(now); mid.setHours(24, 0, 0, 0)
  return Math.max(1, Math.ceil((mid - now) / 3600000))
}
