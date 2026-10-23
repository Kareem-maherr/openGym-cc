import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { todayISO } from '../lib/format.js'
import { t, dateLocale } from '../lib/i18n.js'
import { playerOf, recentXp, RANKS, SET_XP, PR_XP, STREAK_XP } from '../lib/xp.js'
import Icon from '../components/Icon.jsx'
import { LevelHex, XpSegs, Hex, fmtXp } from '../components/Gamify.jsx'
import { tappable } from '../lib/use-sheet-keyboard.js'

// Profile = the player card at full size, lifetime numbers, recent XP, the rank ladder and how
// XP is earned. It holds the tab bar's fifth slot, so the exercise library is reached from here.
export default function Profile() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const p = playerOf(S, todayISO())
  const hist = recentXp(S, 8)
  const avg = hist.length ? Math.round(hist.reduce((n, h) => n + h.xp, 0) / hist.length) : 0
  const top = Math.max(1, ...hist.map(h => h.xp))
  const rankName = r => t(r.name) + (r.tier ? ' ' + r.tier : '')
  const first = S.workouts.reduce((m, w) => (w.d && (!m || w.d < m) ? w.d : m), null)
  const since = first ? new Date(first + 'T12:00:00').toLocaleDateString(dateLocale(), { month: 'short', year: 'numeric' }) : null

  const lifetime = [
    { l: t('Workouts'), v: p.workouts, icon: 'star', color: 'var(--blue)' },
    { l: t('Personal records'), v: p.prs, icon: 'bolt', color: 'var(--orange)' },
    { l: t('Best streak'), v: p.bestStreak + ' ' + t('wk'), icon: 'flame', color: 'var(--pink)' },
    { l: t('Total XP'), v: fmtXp(p.total), icon: 'chartLine', color: 'var(--yellow)' },
  ]
  const rules = [
    { l: t('Each completed set'), v: '+' + SET_XP, icon: 'check', color: 'var(--green)' },
    { l: t('Each personal record'), v: '+' + PR_XP, icon: 'bolt', color: 'var(--orange)' },
    { l: t('Streak bonus, per week'), v: '+' + STREAK_XP, icon: 'flame', color: 'var(--pink)' },
    { l: t('Quests and badges'), v: '+50 – 500', icon: 'star', color: 'var(--blue)' },
  ]

  return <div className="narrow gx">
    <div className="hdr" style={{ marginBottom: 6 }}>
      <div><h1>{t('Profile')}</h1></div>
      <button className="iconbtn" onClick={() => nav('/settings')} aria-label={t('Settings')}><Icon name="gear" /></button>
    </div>

    <div className="gx-hero gx-centered">
      <LevelHex lvl={p.lvl} size={92} />
      <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', marginTop: 12 }}>{user?.name || 'openGym'}</div>
      <div className="cnd gx-kicker gx-acc" style={{ fontSize: 13, marginTop: 2 }}>{(rankName(p.rank) + (since ? ' · ' + t('since {0}', since) : '')).toUpperCase()}</div>
      <XpSegs cur={p.cur} max={p.max} />
      <div className="gx-xprow cnd gx-meta"><span><span className="gx-gold">{fmtXp(p.cur)}</span> / {fmtXp(p.max)} XP</span><span>{t('{0} XP to {1}', fmtXp(p.next.xp), rankName(p.next.rank))}</span></div>
    </div>

    <div className="gx-tiles two">
      {lifetime.map(s => <div key={s.l} className="gx-tile">
        <div className="h"><Icon name={s.icon} style={{ color: s.color, fontSize: 14 }} />{s.l}</div>
        <div className="v cnd">{s.v}</div>
      </div>)}
    </div>

    <div className="card">
      <div className="row between" style={{ alignItems: 'baseline' }}>
        <span className="cnd gx-kicker">{t('XP · last {0} sessions', hist.length || 8).toUpperCase()}</span>
        {hist.length > 0 && <span className="cnd gx-gold" style={{ fontSize: 14, fontWeight: 600 }}>{t('avg {0}', fmtXp(avg))}</span>}
      </div>
      {hist.length ? <div className="gx-hist">
        {hist.map((h, i) => <div key={h.id ?? i} title={fmtXp(h.xp) + ' XP'}>
          <div className={'b' + (i === hist.length - 1 ? ' last' : '')} style={{ height: Math.max(4, h.xp / top * 80) }} />
          <span>{Number(h.d.slice(8))}</span>
        </div>)}
      </div> : <div className="small muted" style={{ marginTop: 10 }}>{t('Finish a workout to start earning XP.')}</div>}
    </div>

    <div className="gx-sec"><span className="cnd gx-kicker">{t('Rank ladder').toUpperCase()}</span></div>
    <div className="gx-list">
      {RANKS.map((r, i) => {
        const cur = i === p.rank.index, past = i < p.rank.index
        return <div key={r.key} className="gx-li" style={{ opacity: cur || past ? 1 : 0.55, padding: '11px 0' }}>
          <Hex size={30} rim={r.color} fill={r.color} />
          <div className="grow">
            <div style={{ fontWeight: cur ? 700 : 400 }}>{t(r.name)}</div>
            <div className="s">{r.hi === Infinity ? t('Level {0}+', r.lo) : t('Levels {0}–{1}', r.lo, r.hi)}</div>
          </div>
          <span className="cnd" style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.12em', color: cur ? 'var(--gx-acc)' : 'var(--label-3)' }}>{cur ? t('You').toUpperCase() : past ? t('Cleared').toUpperCase() : ''}</span>
        </div>
      })}
    </div>

    <div className="gx-sec"><span className="cnd gx-kicker">{t('How XP works').toUpperCase()}</span></div>
    <div className="gx-list">
      {rules.map(r => <div key={r.l} className="gx-li" style={{ padding: '11px 0' }}>
        <span className="sq" style={{ width: 30, height: 30, borderRadius: 8, background: `color-mix(in srgb,${r.color} 16%,transparent)`, color: r.color }}><Icon name={r.icon} /></span>
        <span className="grow">{r.l}</span>
        <span className="cnd gx-gold" style={{ fontSize: 15, fontWeight: 600 }}>{r.v}</span>
      </div>)}
    </div>

    <div className="gx-list">
      <div className="gx-li tap" {...tappable(() => nav('/badges'))}>
        <span className="sq" style={{ background: 'color-mix(in srgb,var(--yellow) 16%,transparent)', color: 'var(--gx-gold)' }}><Icon name="trophy" /></span>
        <span className="grow" style={{ fontSize: 17 }}>{t('Badges')}</span>
        <span className="muted">{p.badges}</span>
        <Icon name="chevronRight" className="chev" />
      </div>
      <div className="gx-li tap" {...tappable(() => nav('/library'))}>
        <span className="sq" style={{ background: 'var(--acc-soft)', color: 'var(--gx-acc)' }}><Icon name="dumbbell" /></span>
        <span className="grow" style={{ fontSize: 17 }}>{t('Exercises')}</span>
        <Icon name="chevronRight" className="chev" />
      </div>
    </div>
  </div>
}
