import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { levelOf, xpAtLevel, levelCost, rankOf, nextRank, xpLedger, sessionXp, questsOf, badgesOf, missionXp, playerOf, SET_XP, PR_XP, STREAK_XP, DAILY_SETS } from './xp.js'

const set = (w = 50, extra = {}) => ({ w, r: 8, done: true, ...extra })
let n = 0
const workout = (d, { sets = 10, prs = [], ex = 'x', w = 50, warmups = 0, start } = {}) => ({
  id: 'w' + (++n), d, start: start ?? new Date(d + 'T18:00:00').getTime(), vol: 0, prs,
  entries: [{ id: ex, sets: [...Array.from({ length: warmups }, () => set(20, { phase: 'warmup' })), ...Array.from({ length: sets }, () => set(w))] }],
})
const state = (workouts, extra = {}) => ({ unit: 'kg', workouts, routines: [], week: {}, ...extra })

describe('levels', () => {
  it('starts every level at the sum of the costs before it', () => {
    expect(xpAtLevel(1)).toBe(0)
    expect(xpAtLevel(2)).toBe(levelCost(1))
    expect(xpAtLevel(5)).toBe(levelCost(1) + levelCost(2) + levelCost(3) + levelCost(4))
  })
  it('reads a total as level, progress into it and that level\'s cost', () => {
    expect(levelOf(0)).toMatchObject({ lvl: 1, cur: 0, max: 400 })
    expect(levelOf(399)).toMatchObject({ lvl: 1, cur: 399 })
    expect(levelOf(400)).toMatchObject({ lvl: 2, cur: 0, max: 600 })
    expect(levelCost(14)).toBe(3000)
  })
})

describe('ranks', () => {
  it('splits a rank into three tiers, III up to I', () => {
    expect(rankOf(1).label).toBe('Rookie III')
    expect(rankOf(5).label).toBe('Rookie I')
    expect(rankOf(6).label).toBe('Iron III')
    expect(rankOf(14).label).toBe('Iron I')
    expect(rankOf(15).label).toBe('Steel III')
    expect(rankOf(40).label).toBe('Legend')
    expect(rankOf(99).label).toBe('Legend')
  })
  it('counts the XP to the next tier, not the next level', () => {
    const r = nextRank(xpAtLevel(14) + 100)
    expect(r.rank.label).toBe('Steel III')
    expect(r.xp).toBe(xpAtLevel(15) - xpAtLevel(14) - 100)
  })
})

describe('xpLedger', () => {
  it('pays per work set and per PR, and not for warm-ups', () => {
    const w = workout('2026-09-01', { sets: 5, warmups: 3, prs: ['x'] })
    const { rows } = xpLedger(state([w]))
    expect(rows[0].sets).toBe(5)
    const by = k => rows[0].parts.find(p => p.key === k)?.xp
    expect(by('sets')).toBe(5 * SET_XP)
    expect(by('prs')).toBe(PR_XP)
  })

  it('pays the streak bonus from the second consecutive week, and stops at a gap', () => {
    const S = state([workout('2026-08-31'), workout('2026-09-07'), workout('2026-09-21')])
    const { rows } = xpLedger(S)
    expect(rows.map(r => r.streak)).toEqual([1, 2, 1])
    expect(rows[1].parts.find(p => p.key === 'streak').xp).toBe(2 * STREAK_XP)
    expect(rows[2].parts.find(p => p.key === 'streak')).toBeUndefined()
  })

  it('completes a daily quest once, in the workout that crosses it', () => {
    const S = state([workout('2026-09-01', { sets: 10 }), workout('2026-09-01', { sets: 10 }), workout('2026-09-01', { sets: 10 })])
    const quests = xpLedger(S).rows.map(r => r.parts.filter(p => p.quest === 'daySets').length)
    expect(quests).toEqual([0, 1, 0])
  })

  it('reads the log in date order, however it is stored', () => {
    const a = workout('2026-09-10'), b = workout('2026-09-01')
    expect(xpLedger(state([a, b])).rows.map(r => r.w.id)).toEqual([b.id, a.id])
  })

  it('unlocks a badge in the workout that earns it, and pays its XP there', () => {
    const S = state([workout('2026-09-01'), workout('2026-09-02', { prs: ['x', 'y'] })])
    const L = xpLedger(S)
    expect(L.earned.pr2day).toEqual({ d: '2026-09-02', id: S.workouts[1].id })
    expect(L.rows[1].parts.some(p => p.badge === 'pr2day')).toBe(true)
    expect(L.rows[0].parts.some(p => p.badge === 'pr2day')).toBe(false)
    expect(L.rows[0].parts.some(p => p.badge === 'w1')).toBe(true)
  })

  it('holds a pound log against the kg lift thresholds', () => {
    const lb = state([workout('2026-09-01', { ex: '0032', w: 335, sets: 1 })], { unit: 'lb' })
    const kgLog = state([workout('2026-09-01', { ex: '0032', w: 145, sets: 1 })])
    expect(xpLedger(lb).earned.dead150).toBeTruthy()
    expect(xpLedger(kgLog).earned.dead150).toBeUndefined()
  })

  it('counts early and late starts by the hour the workout began', () => {
    const at = (d, h) => ({ ...workout(d), start: new Date(d + 'T' + String(h).padStart(2, '0') + ':30:00').getTime() })
    const { stats } = xpLedger(state([at('2026-09-01', 6), at('2026-09-02', 21), at('2026-09-03', 12)]))
    expect(stats).toMatchObject({ early: 1, late: 1 })
  })

  it('is empty for an empty log', () => {
    expect(xpLedger(state([]))).toMatchObject({ rows: [], total: 0 })
    expect(playerOf(state([]), '2026-09-01')).toMatchObject({ lvl: 1, cur: 0, workouts: 0 })
  })
})

describe('sessionXp', () => {
  it('reports the level before and after the workout', () => {
    const S = state([workout('2026-09-01', { sets: 30 })])
    const s = sessionXp(S, S.workouts[0].id)
    expect(s.before.lvl).toBe(1)
    expect(s.xp).toBe(s.after.total)
    expect(s.after.lvl).toBeGreaterThan(1)
  })
  it('is null for a workout that is not in the log', () => {
    expect(sessionXp(state([]), 'nope')).toBeNull()
  })
})

describe('questsOf', () => {
  it('reads today and this week, capped at the need', () => {
    const S = state([workout('2026-09-01', { sets: 20, prs: ['x'] }), workout('2026-08-25')])
    const q = Object.fromEntries(questsOf(S, '2026-09-01').map(x => [x.key, x]))
    expect(q.daySets).toMatchObject({ have: DAILY_SETS, done: true, pct: 100 })
    expect(q.dayPr.done).toBe(true)
    expect(q.weekTrain).toMatchObject({ have: 1, need: 3, done: false })
  })
  it('asks for as many sessions a week as the plan has training days', () => {
    const S = state([], { routines: [{ id: 'a', ex: [] }], week: { 1: ['a'], 3: ['a'], 5: 'gone' } })
    expect(questsOf(S, '2026-09-01').find(q => q.key === 'weekTrain').need).toBe(2)
  })
})

describe('badgesOf / missionXp', () => {
  it('lists progress for locked badges and the date for earned ones', () => {
    const S = state([workout('2026-09-01', { prs: ['x'] })])
    const b = Object.fromEntries(badgesOf(S).map(x => [x.key, x]))
    expect(b.w1).toMatchObject({ earned: true, earnedOn: '2026-09-01' })
    expect(b.pr25).toMatchObject({ earned: false, have: 1, pct: 4 })
  })
  it('has art for every badge', () => {
    for (const b of badgesOf(state([]))) expect(existsSync(new URL('../xp-art/' + b.art + '.webp', import.meta.url))).toBe(true)
  })
  it('prices a routine day by its planned sets', () => {
    const r = { ex: [{ sets: 3 }, { sets: 4 }] }
    expect(missionXp(state([]), [r], '2026-09-01')).toEqual({ sets: 7, xp: 7 * SET_XP })
  })
})
