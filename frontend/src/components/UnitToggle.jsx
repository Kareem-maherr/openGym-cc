// kg ⇄ lb in one tap, from wherever weights are typed. The switch converts every stored weight
// at once (useStore setUnit → lib/units.js convertStateUnit), the running session included, so
// the rows on screen redraw in the new unit straight away. Settings still offers the label-only
// switch for a profile that was logged in the other unit all along.
import { useStore } from '../store/useStore.js'
import { Segmented } from './ui.jsx'

export default function UnitToggle({ className = '' }) {
  const unit = useStore(s => s.S.unit) || 'kg'
  const setUnit = useStore(s => s.setUnit)
  return <Segmented className={'unit-seg ' + className}
    options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]}
    value={unit} onChange={v => { if (v !== unit) setUnit(v) }} />
}
