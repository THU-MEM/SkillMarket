import { useEffect, useMemo, useState } from 'react'
import { entries, entryById, tags } from './registry'
import Starfield from './Starfield'
import type { EntryType, RegistryEntry } from './types'

const REPOSITORY_URL = 'https://github.com/THU-MEM/SkillMarket'
const CONTRIBUTING_URL = `${REPOSITORY_URL}/blob/main/CONTRIBUTING.md`

const typeMeta: Record<EntryType, { label: string; plural: string; symbol: string; description: string }> = {
  skill: {
    label: '技能',
    plural: '技能',
    symbol: '技',
    description: '为 AI 助手提供专注、可重复执行的专业工作流。',
  },
  agent: {
    label: '智能体',
    plural: '智能体',
    symbol: '智',
    description: '围绕明确目标配置，能够自主协作的智能伙伴。',
  },
  prompt: {
    label: '提示词',
    plural: '提示词',
    symbol: '提',
    description: '经过设计、可重复使用的高质量指令模板。',
  },
}

const tagLabels: Record<string, string> = {
  accessibility: '无障碍',
  architecture: '架构',
  community: '社区',
  'code-review': '代码审查',
  'decision-making': '决策',
  dependencies: '依赖管理',
  'developer-tools': '开发工具',
  documentation: '文档',
  frontend: '前端',
  github: 'GitHub',
  maintenance: '维护',
  quality: '质量',
  release: '发布',
  security: '安全',
  triage: '问题分诊',
}

const displayTag = (tag: string) => tagLabels[tag] ?? tag

type Route =
  | { page: 'home' }
  | { page: 'detail'; id: string }
  | { page: 'submit' }

function readRoute(): Route {
  const path = window.location.hash.replace(/^#\/?/, '')
  if (path === 'submit') return { page: 'submit' }
  if (path.startsWith('item/')) return { page: 'detail', id: decodeURIComponent(path.slice(5)) }
  return { page: 'home' }
}

function useRoute() {
  const [route, setRoute] = useState<Route>(readRoute)

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(readRoute())
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  return route
}

function Logo() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span />
    </span>
  )
}

function Header() {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <a className="brand" href="#/" aria-label="SkillMarket 首页">
          <Logo />
          <span>SkillMarket</span>
        </a>
        <nav aria-label="主导航">
          <a href="#/">发现</a>
          <a href={CONTRIBUTING_URL}>参与贡献</a>
          <a className="button button-small" href="#/submit">
            发布内容
          </a>
        </nav>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="shell footer-inner">
        <div>
          <a className="brand footer-brand" href="#/">
            <Logo />
            <span>SkillMarket</span>
          </a>
          <p>面向开放社区的 AI 工作流能力市场。</p>
        </div>
        <div className="footer-links">
          <a href={REPOSITORY_URL}>GitHub</a>
          <a href={CONTRIBUTING_URL}>贡献指南</a>
          <a href={`${REPOSITORY_URL}/blob/main/LICENSE`}>Apache-2.0</a>
        </div>
      </div>
    </footer>
  )
}

function TypeBadge({ type }: { type: EntryType }) {
  const meta = typeMeta[type]
  return (
    <span className={`type-badge type-${type}`}>
      <span aria-hidden="true">{meta.symbol}</span>
      {meta.label}
    </span>
  )
}

function Tag({ children }: { children: string }) {
  return <span className="tag">{displayTag(children)}</span>
}

function EntryCard({ entry }: { entry: RegistryEntry }) {
  return (
    <article className={`entry-card card-${entry.type}`}>
      <a className="card-link" href={`#/item/${encodeURIComponent(entry.id)}`}>
        <span className="visually-hidden">查看 {entry.name}</span>
      </a>
      <div className="card-topline">
        <TypeBadge type={entry.type} />
        {entry.isExample && <span className="example-badge">官方示例</span>}
      </div>
      <div>
        <h3>{entry.name}</h3>
        <p>{entry.description}</p>
      </div>
      <div className="tag-list" aria-label="标签">
        {entry.tags.slice(0, 3).map((tag) => (
          <Tag key={tag}>{tag}</Tag>
        ))}
      </div>
      <div className="card-meta">
        <span>作者：{entry.author.name}</span>
        <span>v{entry.version}</span>
      </div>
    </article>
  )
}

function HeroSkillCard({ entry, index }: { entry: RegistryEntry; index: number }) {
  return (
    <a className="hero-skill-card" href={`#/item/${encodeURIComponent(entry.id)}`}>
      <span className="hero-skill-index">0{index + 1}</span>
      <span className="hero-skill-body">
        <span className="hero-skill-meta">
          <TypeBadge type={entry.type} />
          <span>v{entry.version}</span>
        </span>
        <strong>{entry.name}</strong>
        <small>{entry.description}</small>
        <span className="hero-skill-tags">
          {entry.tags.slice(0, 3).map((tag) => (
            <i key={tag}>{displayTag(tag)}</i>
          ))}
        </span>
      </span>
      <span className="hero-skill-arrow" aria-hidden="true">↗</span>
    </a>
  )
}

function CategoryCard({
  type,
  count,
  onChoose,
}: {
  type: EntryType
  count: number
  onChoose: (type: EntryType) => void
}) {
  const meta = typeMeta[type]
  return (
    <button className={`category-card category-${type}`} type="button" onClick={() => onChoose(type)}>
      <span className="category-symbol" aria-hidden="true">
        {meta.symbol}
      </span>
      <span>
        <strong>{meta.plural}</strong>
        <small>{meta.description}</small>
      </span>
      <span className="category-count">{count}</span>
    </button>
  )
}

function Catalog() {
  const [query, setQuery] = useState('')
  const [type, setType] = useState<EntryType | 'all'>('all')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [sort, setSort] = useState<'newest' | 'oldest' | 'name'>('newest')
  const featuredSkills = entries.filter((entry) => entry.type === 'skill').slice(0, 2)

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return entries
      .filter((entry) => type === 'all' || entry.type === type)
      .filter((entry) => selectedTags.every((tag) => entry.tags.includes(tag)))
      .filter((entry) => {
        if (!normalizedQuery) return true
        return [entry.name, entry.description, entry.author.name, ...entry.tags]
          .join(' ')
          .toLocaleLowerCase()
          .includes(normalizedQuery)
      })
      .sort((left, right) => {
        if (sort === 'name') return left.name.localeCompare(right.name)
        const direction = sort === 'newest' ? -1 : 1
        return direction * left.updatedAt.localeCompare(right.updatedAt)
      })
  }, [query, selectedTags, sort, type])

  const hasFilters = query !== '' || type !== 'all' || selectedTags.length > 0
  const reset = () => {
    setQuery('')
    setType('all')
    setSelectedTags([])
    setSort('newest')
  }
  const chooseCategory = (nextType: EntryType) => {
    setType(nextType)
    document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })
  }
  const toggleTag = (tag: string) => {
    setSelectedTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    )
  }

  return (
    <>
      <section className="hero">
        <Starfield />
        <div className="hero-grid" aria-hidden="true" />
        <div className="shell hero-inner">
          <div className="hero-copy">
            <div className="eyebrow"><span /> 开源 · 透明 · 社区共建</div>
            <h1>让优秀的 AI 能力，<em>被更多人发现。</em></h1>
            <p>
              汇聚可复用的技能、智能体与提示词。每个条目都有清晰版本、开放源码，
              并通过 GitHub 社区协作持续演进。
            </p>
            <div className="hero-actions">
              <a
                className="button"
                href="#catalog"
                onClick={(event) => {
                  event.preventDefault()
                  document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })
                }}
              >
                浏览全部内容
              </a>
              <a className="button button-ghost" href="#/submit">
                发布你的作品 <span aria-hidden="true">→</span>
              </a>
            </div>
            <div className="trust-row">
              <span><i aria-hidden="true">✓</i> 开放元数据</span>
              <span><i aria-hidden="true">✓</i> 社区共同审阅</span>
              <span><i aria-hidden="true">✓</i> 无需注册账号</span>
            </div>
          </div>
          <aside className="hero-showcase" aria-label="精选技能">
            <div className="hero-showcase-heading">
              <div>
                <span>FEATURED SKILLS</span>
                <h2>精选技能</h2>
              </div>
              <button type="button" onClick={() => chooseCategory('skill')}>查看全部</button>
            </div>
            <div className="hero-skill-list">
              {featuredSkills.map((entry, index) => (
                <HeroSkillCard key={entry.id} entry={entry} index={index} />
              ))}
            </div>
            <p><span aria-hidden="true">◆</span> 所有条目均由仓库文件驱动，公开可追溯</p>
          </aside>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="hero-campus-line" aria-hidden="true">
          <span>THU · MEM</span>
          <i />
          <span>OPEN SOURCE</span>
          </div>
      </section>

      <section className="category-section shell" aria-labelledby="categories-heading">
        <div className="section-heading">
          <div>
            <span className="section-kicker">按类型探索</span>
            <h2 id="categories-heading">为不同的 AI 工作方式而生</h2>
          </div>
          <p>从一项专业能力、一位智能伙伴，或一段开箱即用的提示词开始。</p>
        </div>
        <div className="category-grid">
          {(Object.keys(typeMeta) as EntryType[]).map((entryType) => (
            <CategoryCard
              key={entryType}
              type={entryType}
              count={entries.filter((entry) => entry.type === entryType).length}
              onChoose={chooseCategory}
            />
          ))}
        </div>
      </section>

      <section className="catalog-section" id="catalog" aria-labelledby="catalog-heading">
        <div className="shell">
          <div className="section-heading catalog-heading">
            <div>
              <span className="section-kicker">开放目录</span>
              <h2 id="catalog-heading">发现社区优质内容</h2>
            </div>
            <p>基于透明元数据浏览，每个官方示例均有清晰标记。</p>
          </div>

          <div className="search-row">
            <label className="search-box">
              <span className="visually-hidden">搜索内容</span>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m16 16 5 5" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索名称、描述、作者或标签…"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} aria-label="清空搜索">×</button>
              )}
            </label>
            <label className="sort-select">
              <span>排序</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
                <option value="newest">最近更新</option>
                <option value="oldest">最早更新</option>
                <option value="name">名称 A–Z</option>
              </select>
            </label>
          </div>

          <div className="catalog-layout">
            <aside className="filters" aria-label="目录筛选">
              <div className="filter-heading">
                <strong>筛选</strong>
                {hasFilters && <button type="button" onClick={reset}>全部清空</button>}
              </div>
              <fieldset>
                <legend>类型</legend>
                <label>
                  <input type="radio" name="type" checked={type === 'all'} onChange={() => setType('all')} />
                  <span>全部内容</span><small>{entries.length}</small>
                </label>
                {(Object.keys(typeMeta) as EntryType[]).map((entryType) => (
                  <label key={entryType}>
                    <input
                      type="radio"
                      name="type"
                      checked={type === entryType}
                      onChange={() => setType(entryType)}
                    />
                    <span>{typeMeta[entryType].plural}</span>
                    <small>{entries.filter((entry) => entry.type === entryType).length}</small>
                  </label>
                ))}
              </fieldset>
              <fieldset>
                <legend>标签</legend>
                <div className="tag-options">
                  {tags.map((tag) => (
                    <label key={tag}>
                      <input
                        type="checkbox"
                        checked={selectedTags.includes(tag)}
                        onChange={() => toggleTag(tag)}
                      />
                      <span>{displayTag(tag)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </aside>

            <div className="results">
              <div className="results-bar">
                <p aria-live="polite">
                  共 <strong>{results.length}</strong> 个结果
                </p>
                {selectedTags.length > 0 && (
                  <div className="active-filters">
                    {selectedTags.map((tag) => (
                      <button key={tag} type="button" onClick={() => toggleTag(tag)}>
                        {displayTag(tag)} <span aria-hidden="true">×</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {results.length > 0 ? (
                <div className="entry-grid">
                  {results.map((entry) => <EntryCard key={entry.id} entry={entry} />)}
                </div>
              ) : (
                <div className="empty-state">
                  <span aria-hidden="true">⌕</span>
                  <h3>没有匹配的内容</h3>
                  <p>试试更宽泛的关键词，或清空当前筛选条件。</p>
                  <button className="button" type="button" onClick={reset}>清空筛选</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="community-cta shell">
        <div>
          <span className="section-kicker">共建开放生态</span>
          <h2>有值得分享的作品？</h2>
          <p>只需添加一个 JSON 文件、运行校验并发起 Pull Request，无需厂商账号或私有 API。</p>
        </div>
        <a className="button button-light" href="#/submit">发布到 SkillMarket <span aria-hidden="true">→</span></a>
      </section>
    </>
  )
}

function CodeBlock({ children }: { children: string }) {
  return <pre className="code-block"><code>{children}</code></pre>
}

function DetailPage({ id }: { id: string }) {
  const entry = entryById.get(id)

  useEffect(() => {
    document.title = entry ? `${entry.name} · SkillMarket` : '内容未找到 · SkillMarket'
    return () => { document.title = 'SkillMarket — 开放的 AI 能力市场' }
  }, [entry])

  if (!entry) {
    return (
      <main id="main-content" className="not-found shell">
        <span>404</span>
        <h1>没有找到这个内容</h1>
        <p>它可能已被移动，或当前链接不完整。</p>
        <a className="button" href="#/">浏览全部内容</a>
      </main>
    )
  }

  const sourceUrl = entry.repository ?? entry.url!
  return (
    <main id="main-content" className="detail-page">
      <div className="detail-hero">
        <div className="shell">
          <a className="back-link" href="#/"><span aria-hidden="true">←</span> 返回内容目录</a>
          <div className="detail-title-row">
            <div className={`detail-icon type-${entry.type}`} aria-hidden="true">
              {typeMeta[entry.type].symbol}
            </div>
            <div>
              <div className="card-topline">
                <TypeBadge type={entry.type} />
                {entry.isExample && <span className="example-badge">官方示例</span>}
              </div>
              <h1>{entry.name}</h1>
              <p>{entry.description}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="shell detail-layout">
        <article className="detail-content">
          {entry.isExample && (
            <div className="notice">
              <strong>这是一个 SkillMarket 官方示例。</strong>
              它用于展示目录格式，并不冒充独立的第三方项目。
            </div>
          )}

          <section>
            <h2>如何使用</h2>
            <p>{entry.usage.instructions}</p>
            {entry.usage.example && (
              <>
                <h3>使用示例</h3>
                <CodeBlock>{entry.usage.example}</CodeBlock>
              </>
            )}
          </section>

          {entry.type === 'skill' && (
            <section>
              <h2>安装方式</h2>
              <CodeBlock>{entry.installation.command}</CodeBlock>
              {entry.installation.notes && <p>{entry.installation.notes}</p>}
            </section>
          )}

          {entry.type === 'agent' && (
            <section>
              <h2>配置方式</h2>
              <p>{entry.setup.instructions}</p>
              <h3>使用要求</h3>
              <ul>{entry.setup.requirements.map((requirement) => <li key={requirement}>{requirement}</li>)}</ul>
            </section>
          )}

          {entry.type === 'prompt' && (
            <section>
              <h2>提示词模板</h2>
              <CodeBlock>{entry.prompt.template}</CodeBlock>
              <h3>模板变量</h3>
              <div className="variable-list">
                {entry.prompt.variables.map((variable) => (
                  <div key={variable.name}>
                    <code>{variable.name}</code>
                    <span>{variable.description}</span>
                    <small>{variable.required ? '必填' : '选填'}</small>
                  </div>
                ))}
              </div>
            </section>
          )}
        </article>

        <aside className="detail-sidebar">
          <a className="button source-button" href={sourceUrl}>
            在 GitHub 查看{entry.repository ? '源码' : '说明'}
            <span aria-hidden="true">↗</span>
          </a>
          <dl>
            <div><dt>作者</dt><dd>{entry.author.url ? <a href={entry.author.url}>{entry.author.name}</a> : entry.author.name}</dd></div>
            <div><dt>版本</dt><dd>{entry.version}</dd></div>
            <div><dt>许可证</dt><dd>{entry.license}</dd></div>
            <div><dt>更新时间</dt><dd><time dateTime={entry.updatedAt}>{new Date(`${entry.updatedAt}T00:00:00Z`).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}</time></dd></div>
          </dl>
          <div className="sidebar-tags">
            <strong>标签</strong>
            <div className="tag-list">{entry.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</div>
          </div>
        </aside>
      </div>
    </main>
  )
}

function SubmitPage() {
  useEffect(() => {
    document.title = '发布内容 · SkillMarket'
    return () => { document.title = 'SkillMarket — 开放的 AI 能力市场' }
  }, [])

  return (
    <main id="main-content" className="submit-page">
      <section className="submit-hero">
        <div className="shell">
          <span className="section-kicker">开放发布</span>
          <h1>与社区分享你的优秀作品</h1>
          <p>SkillMarket 是一个由文件驱动的开放目录。每个条目透明、可追溯，并通过 GitHub Pull Request 共同审阅。</p>
        </div>
      </section>
      <div className="shell submit-content">
        <div className="steps">
          <div><span>1</span><strong>选择内容类型</strong><p>选择最能准确描述你作品的目录分类。</p></div>
          <div><span>2</span><strong>添加一个 JSON 文件</strong><p>遵循数据规范，并使用唯一的 kebab-case ID 作为文件名。</p></div>
          <div><span>3</span><strong>校验并发起 PR</strong><p>运行本地检查，说明你的作品并提交社区审阅。</p></div>
        </div>
        <div className="publish-grid">
          {(Object.keys(typeMeta) as EntryType[]).map((type) => {
            const folder = `${type}s`
            return (
              <article key={type} className={`publish-card category-${type}`}>
                <span className="category-symbol" aria-hidden="true">{typeMeta[type].symbol}</span>
                <h2>发布{typeMeta[type].label}</h2>
                <p>{typeMeta[type].description}</p>
                <a
                  className="button"
                  href={`${REPOSITORY_URL}/new/main/registry/${folder}?filename=your-${type}.json`}
                >
                  创建{typeMeta[type].label}文件 <span aria-hidden="true">↗</span>
                </a>
              </article>
            )
          })}
        </div>
        <div className="contribution-help">
          <div>
            <span aria-hidden="true">?</span>
            <div><h2>请先阅读贡献指南</h2><p>了解全部字段、完整示例、校验命令和 Pull Request 检查清单。</p></div>
          </div>
          <a className="button button-ghost-dark" href={CONTRIBUTING_URL}>打开 CONTRIBUTING.md <span aria-hidden="true">→</span></a>
        </div>
      </div>
    </main>
  )
}

export default function App() {
  const route = useRoute()

  return (
    <>
      <Header />
      {route.page === 'detail' ? (
        <DetailPage id={route.id} />
      ) : route.page === 'submit' ? (
        <SubmitPage />
      ) : (
        <main id="main-content"><Catalog /></main>
      )}
      <Footer />
    </>
  )
}
