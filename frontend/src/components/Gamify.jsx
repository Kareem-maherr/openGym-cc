// The pieces the XP screens share: the level hexagon, the ten-segment XP bar, a badge's art
// and the sheet a badge opens. The numbers all come from lib/xp.js.
import Icon from './Icon.jsx'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { fmtDate } from '../lib/format.js'
import { TIER_COLOR } from '../lib/xp.js'

export const fmtXp = n => Math.round(n).toLocaleString('en')

// A hexagon with a coloured rim. `size` is the width; the height follows the hexagon.
export function Hex({ size = 68, rim = 'var(--gx-acc)', fill = 'var(--gx-hex-in)', children, className = '', style }) {
  return <div className={'gx-hex ' + className} style={{ width: size, height: Math.round(size * 1.12), background: rim, ...style }}>
    <div className="gx-hex-in" style={{ background: fill }}>{children}</div>
  </div>
}

export function LevelHex({ lvl, size = 68 }) {
  return <Hex size={size} className="gx-lvl">
    <span className="cnd gx-lvl-l" style={{ fontSize: Math.max(10, size * 0.15) }}>{t('LVL')}</span>
    <span className="cnd gx-lvl-n" style={{ fontSize: size * 0.5 }}>{lvl}</span>
  </Hex>
}

// Ten segments, the partial one half-lit once it is a third of the way along.
export function XpSegs({ cur, max }) {
  const f = max ? Math.min(1, cur / max) * 10 : 0
  const full = Math.floor(f), part = f % 1
  return <div className="gx-segs" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={cur}>
    {Array.from({ length: 10 }, (_, i) => <div key={i} style={{ '--i': i }} className={i < full ? 'on' : i === full && part > 0.3 ? 'half' : ''} />)}
  </div>
}

export const tierColor = tier => TIER_COLOR[tier] || 'var(--label-2)'

// The badge art (src/xp-art/*.webp), keyed by file name. A locked badge shows the same art in
// grey with a small lock on its rim, so you can see what you are working towards.
const ART = Object.fromEntries(Object.entries(import.meta.glob('../xp-art/*.webp', { eager: true, import: 'default' }))
  .map(([path, url]) => [path.split('/').pop().replace('.webp', ''), url]))

export function BadgeArt({ b, size = 64 }) {
  return <div className={'gx-art' + (b.earned ? '' : ' locked')} style={{ width: size, height: size }}>
    <img src={ART[b.art]} alt="" width={size} height={size} decoding="async" draggable="false" />
    {!b.earned && <Icon name="lock" />}
  </div>
}

const fmtN = v => (v >= 1000 ? Math.round(v).toLocaleString('en') : Math.round(v * 10) / 10)

export function openBadge(b) {
  useUI.getState().openSheet(close => <div className="gx-badge-sheet">
    <BadgeArt b={b} size={132} />
    <div className="cnd gx-kicker" style={{ color: b.earned ? tierColor(b.tier) : 'var(--label-2)', marginTop: 14 }}>
      {(t(b.tier[0].toUpperCase() + b.tier.slice(1)) + (b.earned ? '' : ' · ' + t('locked'))).toUpperCase()}
    </div>
    <div className="gx-title">{t(b.name)}</div>
    <div className="muted" style={{ marginTop: 6 }}>{t(b.desc)}</div>
    <div style={{ margin: '18px auto 0', maxWidth: 280 }}>
      {!b.earned && <div className="gx-bar"><div style={{ width: b.pct + '%' }} /></div>}
      <div className="row between cnd gx-meta" style={{ marginTop: 8 }}>
        <span>{b.earned ? t('Earned {0}', fmtDate(b.earnedOn, true)) : `${b.pct}% · ${fmtN(b.have)} / ${fmtN(b.need)}`}</span>
        <span className="gx-gold">+{b.xp} XP</span>
      </div>
    </div>
    <button className="btn plain" style={{ width: '100%', marginTop: 20 }} onClick={close}><span>{t('Close')}</span></button>
  </div>)
}
