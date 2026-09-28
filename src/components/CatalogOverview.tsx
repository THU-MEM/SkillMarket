import type { EntryType, RegistryEntry } from '../types'
import { catalogMetrics } from './catalogMetrics'

const labels: Record<EntryType, string> = { skill: '技能', agent: '智能体', prompt: '提示词' }
export default function CatalogOverview({ entries, type, onType }: {
  entries: RegistryEntry[]; type: EntryType | 'all'; onType: (type: EntryType) => void
}) {
  const { counts, samples } = catalogMetrics(entries)
  const max = Math.max(1, ...samples.map(sample => sample.total))
  const points = samples.map((sample, index) => ({ ...sample, x: 28 + index * 132, y: 77 - sample.total / max * 47 }))
  const line = points.map(point => `${point.x},${point.y}`).join(' ')
  return <section className="catalog-overview" aria-label="全目录概览">
    <div className="overview-summary"><h2>全目录概览 <span>不随筛选变化</span></h2>
      <div className="overview-total" aria-label={`全目录 ${counts.total} 个资源`}><strong>{counts.skill}</strong><span>个技能</span><span className="overview-separator">/</span><b>{counts.total}</b><span>个资源</span></div>
      <div className="overview-types" aria-label="按资源类型筛选">{(['skill', 'agent', 'prompt'] as const).map(key => <button type="button" key={key} aria-pressed={type === key} onClick={() => onType(key)}><span>{labels[key]}</span><b>{counts[key]}</b></button>)}</div>
    </div>
    <figure className="catalog-chart"><figcaption>目录资源数量 <span>历史采样 → 当前</span></figcaption>
      <svg viewBox="0 0 320 108" role="img" aria-label={`历史采样，非安装量或活跃量；2026-08-06：6 个资源；2026-08-07：6 个资源；当前：${counts.total} 个资源。按观测点等距展示，不代表连续增长。`}>
        <path className="chart-baseline" d="M28 77H292"/>
        <polygon className="chart-area" points={`28,77 ${line} 292,77`}/>
        <polyline className="chart-line" points={line}/>
        {points.map(point => <g key={point.date}><circle cx={point.x} cy={point.y} r="3"/><text x={point.x} y={point.y - 10} textAnchor="middle">{point.total}</text><text className="chart-date" x={point.x} y="99" textAnchor="middle">{point.date === '当前' ? '当前' : point.date.slice(5)}</text></g>)}
      </svg>
    </figure>
  </section>
}
