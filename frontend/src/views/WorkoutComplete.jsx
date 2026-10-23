import { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { setsDone, bestWeightForEntry } from '../lib/history.js'
import { fmtDur, fmtVol, fmtNum } from '../lib/format.js'
import { t, exerciseNameFor, exerciseNameClass } from '../lib/i18n.js'
import { EXIDX } from '../lib/exercises.js'
import { loadOfWorkouts } from '../lib/muscles.js'
import { sessionXp, levelOf, rankOf, badgesOf, weeklyTarget, QUESTS, SET_XP, PR_XP, STREAK_XP, DAILY_SETS, WEEKLY_SETS } from '../lib/xp.js'
import { LastAndNext, CardioDone } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import BodyMap from '../components/BodyMap.jsx'
import WorkoutMediaSection from '../components/WorkoutMedia.jsx'
import { Hex, BadgeArt, openBadge, fmtXp } from '../components/Gamify.jsx'

const COUNT_MS = 1700
const reduced = () => { try { return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches } catch { return false } }

// The XP counting up from 0, eased out. Starts again when `run` changes.
function useCountUp(run) {
  const [a, setA] = useState(() => (reduced() ? 1 : 0))
  const raf = useRef(0)
  useEffect(() => {
    if (reduced()) { setA(1); return }
    const t0 = performance.now()
    const step = now => {
      const p = Math.min(1, (now - t0) / COUNT_MS)
      setA(1 - Math.pow(1 - p, 3))
      if (p < 1) raf.current = requestAnimationFrame(step)
    }
    setA(0)
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [run])
  return a
}

const QUEST_LABEL = {
  daySets: q => t('Complete {0} sets', q),
  dayPr: () => t('Beat a personal record'),
  weekTrain: q => t('Train {0}× this week', q),
  weekSets: q => t('Log {0} sets this week', q),
}

// What a finished workout earned: the XP, the level it moved, the records and badges it brought.
// The finish flow lands here (sheets.jsx doFinishWorkout); Home's "Mission complete" opens it
// again for today's session. Below the reward sits what the old summary sheet showed.
export default function WorkoutComplete() {
  const { id } = useParams()
  const nav = useNavigate()
  const loc = useLocation()
  const S = useStore(s => s.S)
  const [run, setRun] = useState(0)
  const a = useCountUp(run)
  const w = S.workouts.find(x => String(x.id) === id)
  if (!w) return <Navigate to="/home" replace />
  const sx = sessionXp(S, w.id)
  if (!sx) return <Navigate to="/home" replace />
  const e1prs = loc.state?.e1prs || []

  const gained = Math.round(sx.xp * a)
  const now = levelOf(sx.before.total + gained)
  const leveled = now.lvl > sx.before.lvl
  const rank = rankOf(now.lvl)
  const rankName = r => t(r.name) + (r.tier ? ' ' + r.tier : '')
  const rankUp = sx.rankAfter.label !== sx.rankBefore.label

  const all = badgesOf(S)
  const rows = sx.parts.map(p => {
    if (p.key === 'sets') return { icon: 'check', color: 'var(--green)', label: t('Sets completed: {0}', p.n), sub: t('{0} XP per set', SET_XP), xp: p.xp }
    if (p.key === 'prs') return { icon: 'bolt', color: 'var(--orange)', label: t('New personal records: {0}', p.n), sub: t('{0} XP per record', PR_XP), xp: p.xp }
    if (p.key === 'streak') return { icon: 'flame', color: 'var(--pink)', label: t('{0}-week streak bonus', p.n), sub: t('{0} XP per streak week', STREAK_XP), xp: p.xp }
    if (p.key === 'quest') {
      const q = QUESTS.find(x => x.key === p.quest)
      const need = { daySets: DAILY_SETS, dayPr: 1, weekTrain: weeklyTarget(S), weekSets: WEEKLY_SETS }[q.key]
      return { icon: 'star', color: 'var(--blue)', label: t('Quest: {0}', QUEST_LABEL[q.key](need)), sub: q.kind === 'daily' ? t('Daily quest') : t('Weekly quest'), xp: p.xp }
    }
    const b = all.find(x => x.key === p.badge)
    return { icon: b.icon, color: 'var(--yellow)', label: t('Badge: {0}', t(b.name)), sub: t(b.tier[0].toUpperCase() + b.tier.slice(1)), xp: p.xp }
  })

  const records = (w.prs || []).map(exId => {
    const e = w.entries.find(x => x.id === exId)
    const top = e ? bestWeightForEntry(e) : 0
    const reps = e ? Math.max(0, ...e.sets.filter(s => s.done && Number(s.w) === top).map(s => Number(s.r) || 0)) : 0
    return { id: exId, v: top ? fmtNum(top) + ' ' + S.unit + (reps ? ' × ' + reps : '') : '' }
  })
  const unlocked = sx.badges.map(b => all.find(x => x.key === b.key))

  return <div className="narrow gx">
    <div className="row between" style={{ marginTop: 8 }}>
      <button className="iconbtn" onClick={() => nav('/home')} aria-label={t('Close')}><Icon name="xmark" /></button>
      {!reduced() && <button className="btn ghost sm dim" onClick={() => setRun(r => r + 1)}><span>{t('Replay')}</span></button>}
    </div>

    <div style={{ textAlign: 'center', padding: '6px 0 2px' }}>
      <div className="cnd gx-kicker gx-acc" style={{ letterSpacing: '.16em' }}>{t('Workout complete').toUpperCase()}</div>
      <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-.025em', marginTop: 2 }}>{w.name || t('Workout')}</div>
      <div className="cnd gx-big">+{fmtXp(gained)}</div>
      <div className="cnd gx-kicker" style={{ fontSize: 13 }}>{t('XP earned').toUpperCase()}</div>
    </div>

    <div className="gx-hero" style={{ padding: 16 }}>
      <div className="row" style={{ gap: 12 }}>
        <Hex size={52}><span className="cnd" style={{ fontSize: 26, fontWeight: 700 }}>{now.lvl}</span></Hex>
        <div style={{ flex: 1 }}>
          <div className="cnd gx-kicker gx-acc">{rankName(rank).toUpperCase()}</div>
          <div className="cnd gx-meta" style={{ fontSize: 14, marginTop: 2 }}><span className="gx-gold">{fmtXp(now.cur)}</span> / {fmtXp(now.max)} XP</div>
        </div>
      </div>
      <div className="gx-bar thick" style={{ marginTop: 12 }}><div style={{ width: (now.cur / now.max * 100) + '%' }} /></div>
    </div>

    {leveled && <div className="gx-levelup">
      <span className="gx-ic"><Icon name="arrowUp" /></span>
      <div style={{ flex: 1 }}>
        <div className="cnd" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.16em', opacity: .7 }}>{(rankUp ? t('Level up · rank up') : t('Level up')).toUpperCase()}</div>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.02em' }}>{t('Level {0}', sx.after.lvl)} · {rankName(sx.rankAfter)}</div>
      </div>
    </div>}

    {rows.length > 0 && <div className="gx-list">
      {rows.map((r, i) => <div key={i} className="gx-li">
        <span className="sq" style={{ background: `color-mix(in srgb,${r.color} 16%,transparent)`, color: r.color }}><Icon name={r.icon} /></span>
        <div className="grow"><div>{r.label}</div><div className="s">{r.sub}</div></div>
        <span className="cnd v gx-gold">+{fmtXp(r.xp)}</span>
      </div>)}
    </div>}

    {(records.length > 0 || e1prs.length > 0) && <>
      <div className="gx-sec"><span className="cnd gx-kicker">{t('New records').toUpperCase()}</span></div>
      <div className="gx-list">
        {records.map(r => <div key={r.id} className="gx-li">
          <Icon name="trophy" style={{ fontSize: 20, color: 'var(--gx-orange)' }} />
          <div className={'grow ' + exerciseNameClass(EXIDX[r.id])}>{EXIDX[r.id] ? exerciseNameFor(EXIDX[r.id]) : r.id}</div>
          <span className="cnd v">{r.v}</span>
        </div>)}
        {e1prs.map(p => <div key={p.id} className="gx-li">
          <Icon name="chartLine" style={{ fontSize: 20, color: 'var(--gx-acc)' }} />
          <div className="grow"><div className={exerciseNameClass(EXIDX[p.id])}>{EXIDX[p.id] ? exerciseNameFor(EXIDX[p.id]) : p.id}</div><div className="s">{t('Best estimated 1RM:')}</div></div>
          <span className="cnd v">{fmtNum(p.est)} {S.unit}</span>
        </div>)}
      </div>
    </>}

    {unlocked.length > 0 && <>
      <div className="gx-sec"><span className="cnd gx-kicker">{t('Badges unlocked').toUpperCase()}</span></div>
      <div className="gx-list">
        {unlocked.map(b => <div key={b.key} className="gx-li tap" onClick={() => openBadge(b)}>
          <BadgeArt b={b} size={44} />
          <div className="grow"><div style={{ fontSize: 17, fontWeight: 600 }}>{t(b.name)}</div><div className="s">{t(b.desc)}</div></div>
          <Icon name="chevronRight" className="chev" />
        </div>)}
      </div>
    </>}

    <div className="gx-tiles">
      <div className="gx-tile"><div className="v cnd" style={{ fontSize: 20 }}>{fmtDur(w.end - w.start)}</div><div className="l">{t('Duration')}</div></div>
      <div className="gx-tile"><div className="v cnd" style={{ fontSize: 20 }}>{setsDone(w)}</div><div className="l">{t('Sets')}</div></div>
      <div className="gx-tile"><div className="v cnd" style={{ fontSize: 20 }}>{fmtVol(w.vol || 0, S.unit)}</div><div className="l">{t('Volume')}</div></div>
    </div>

    <div className="card">
      <h4 className="sec" style={{ marginTop: 0 }}>{t('What you just trained')}</h4>
      <BodyMap load={loadOfWorkouts([w])} body={S.body} />
      <div style={{ height: 14 }} />
      <LastAndNext st={S} w={w} />
      <CardioDone st={S} w={w} />
      <WorkoutMediaSection w={w} hint />
    </div>

    <button className="gx-go" style={{ height: 52, borderRadius: 14 }} onClick={() => nav('/home')}>{t('Collect & finish')}</button>
  </div>
}
