import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { badgesOf, BADGE_CATS } from '../lib/xp.js'
import Icon from '../components/Icon.jsx'
import { Segmented } from '../components/ui.jsx'
import { BadgeArt, openBadge, tierColor } from '../components/Gamify.jsx'

const CAT_NAME = { milestones: 'Milestones', streaks: 'Streaks', records: 'Records', strength: 'Strength', habits: 'Habits' }
const fmtN = v => (v >= 1000 ? Math.round(v).toLocaleString('en') : Math.round(v * 10) / 10)

// Every badge, grouped, earned or with its progress. A tap opens the badge (components/Gamify.jsx).
export default function Badges() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const [filter, setFilter] = useState('all')
  const all = badgesOf(S)
  const earned = all.filter(b => b.earned).length
  const groups = BADGE_CATS.map(cat => {
    const list = all.filter(b => b.cat === cat)
    const items = list.filter(b => filter === 'all' || (filter === 'earned' ? b.earned : !b.earned))
    return { cat, count: list.filter(b => b.earned).length + ' / ' + list.length, items }
  }).filter(g => g.items.length)

  return <div className="narrow gx">
    <div style={{ marginTop: 8 }}><button className="iconbtn" onClick={() => nav(-1)} aria-label={t('Back')}><Icon name="chevronLeft" /></button></div>
    <div className="row between" style={{ alignItems: 'flex-end' }}>
      <h1 style={{ fontSize: 34, lineHeight: 1.06, fontWeight: 700, letterSpacing: '-.028em', margin: 0 }}>{t('Badges')}</h1>
      <div className="cnd gx-meta" style={{ fontSize: 15, fontWeight: 600 }}><span style={{ color: 'var(--label)', fontSize: 22 }}>{earned}</span> / {all.length}</div>
    </div>
    <Segmented value={filter} onChange={setFilter}
      options={[{ value: 'all', label: t('All') }, { value: 'earned', label: t('Earned') }, { value: 'locked', label: t('Locked') }]} />
    {groups.map(g => <div key={g.cat} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="gx-sec" style={{ padding: '0 4px' }}><span className="cnd gx-kicker">{t(CAT_NAME[g.cat]).toUpperCase()}</span><span className="cnd r" style={{ fontSize: 13 }}>{g.count}</span></div>
      <div className="gx-badges">
        {g.items.map(b => <button key={b.key} className={'gx-badge' + (b.earned ? '' : ' locked')} onClick={() => openBadge(b)}>
          <BadgeArt b={b} size={76} />
          <div className="n">{t(b.name)}</div>
          {!b.earned && b.need > 1 && <div className="gx-bar"><div style={{ width: b.pct + '%' }} /></div>}
          <span className="cnd s" style={{ color: b.earned ? (b.tier === 'gold' ? 'var(--gx-gold)' : b.tier === 'bronze' ? 'var(--gx-orange)' : tierColor(b.tier)) : 'var(--label-3)' }}>
            {b.earned ? t(b.tier[0].toUpperCase() + b.tier.slice(1)).toUpperCase() : b.need === 1 ? t('Locked').toUpperCase() : fmtN(b.have) + ' / ' + fmtN(b.need)}
          </span>
        </button>)}
      </div>
    </div>)}
    {!groups.length && <div className="card small muted">{filter === 'earned' ? t('No badges yet. Finish a workout to start earning them.') : t('Every badge is earned.')}</div>}
  </div>
}
