import { useEffect, useMemo, useState } from 'react'
import { entries, entryById, tags } from './registry'
import type { EntryType, RegistryEntry } from './types'

const REPOSITORY_URL = 'https://github.com/THU-MEM/SkillMarket'
const CONTRIBUTING_URL = `${REPOSITORY_URL}/blob/main/CONTRIBUTING.md`

const typeMeta: Record<EntryType, { label: string; plural: string; symbol: string; description: string }> = {
  skill: {
    label: 'Skill',
    plural: 'Skills',
    symbol: 'S',
    description: 'Focused capabilities that give an AI assistant a repeatable workflow.',
  },
  agent: {
    label: 'Agent',
    plural: 'Agents',
    symbol: 'A',
    description: 'Purpose-built collaborators configured to pursue a defined outcome.',
  },
  prompt: {
    label: 'Prompt',
    plural: 'Prompts',
    symbol: 'P',
    description: 'Reusable instructions designed for consistent, high-quality results.',
  },
}

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
        <a className="brand" href="#/" aria-label="SkillMarket home">
          <Logo />
          <span>SkillMarket</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#/">Browse</a>
          <a href={CONTRIBUTING_URL}>Contribute</a>
          <a className="button button-small" href="#/submit">
            Submit a listing
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
          <p>Open building blocks for thoughtful AI workflows.</p>
        </div>
        <div className="footer-links">
          <a href={REPOSITORY_URL}>GitHub</a>
          <a href={CONTRIBUTING_URL}>Contributing</a>
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
  return <span className="tag">{children}</span>
}

function EntryCard({ entry }: { entry: RegistryEntry }) {
  return (
    <article className={`entry-card card-${entry.type}`}>
      <a className="card-link" href={`#/item/${encodeURIComponent(entry.id)}`}>
        <span className="visually-hidden">View {entry.name}</span>
      </a>
      <div className="card-topline">
        <TypeBadge type={entry.type} />
        {entry.isExample && <span className="example-badge">Example</span>}
      </div>
      <div>
        <h3>{entry.name}</h3>
        <p>{entry.description}</p>
      </div>
      <div className="tag-list" aria-label="Tags">
        {entry.tags.slice(0, 3).map((tag) => (
          <Tag key={tag}>{tag}</Tag>
        ))}
      </div>
      <div className="card-meta">
        <span>by {entry.author.name}</span>
        <span>v{entry.version}</span>
      </div>
    </article>
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
        <div className="hero-grid" aria-hidden="true" />
        <div className="shell hero-inner">
          <div className="eyebrow"><span /> Community-powered registry</div>
          <h1>Find the right building block for your next AI workflow.</h1>
          <p>
            Discover transparent, versioned Skills, Agents, and Prompts. Every listing is
            open source and reviewed through GitHub.
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
              Explore the market
            </a>
            <a className="button button-ghost" href="#/submit">Publish your work <span aria-hidden="true">→</span></a>
          </div>
          <div className="trust-row">
            <span><i aria-hidden="true">✓</i> Open metadata</span>
            <span><i aria-hidden="true">✓</i> Community reviewed</span>
            <span><i aria-hidden="true">✓</i> No account required</span>
          </div>
        </div>
      </section>

      <section className="category-section shell" aria-labelledby="categories-heading">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Explore by type</span>
            <h2 id="categories-heading">Built for every way of working</h2>
          </div>
          <p>Start with a capability, a collaborator, or a ready-to-use instruction.</p>
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
              <span className="section-kicker">The registry</span>
              <h2 id="catalog-heading">Discover community tools</h2>
            </div>
            <p>Browse metadata-first listings. Example entries are clearly labeled.</p>
          </div>

          <div className="search-row">
            <label className="search-box">
              <span className="visually-hidden">Search listings</span>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m16 16 5 5" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name, description, author, or tag…"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} aria-label="Clear search">×</button>
              )}
            </label>
            <label className="sort-select">
              <span>Sort by</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
                <option value="newest">Recently updated</option>
                <option value="oldest">Oldest updated</option>
                <option value="name">Name A–Z</option>
              </select>
            </label>
          </div>

          <div className="catalog-layout">
            <aside className="filters" aria-label="Catalog filters">
              <div className="filter-heading">
                <strong>Filters</strong>
                {hasFilters && <button type="button" onClick={reset}>Clear all</button>}
              </div>
              <fieldset>
                <legend>Type</legend>
                <label>
                  <input type="radio" name="type" checked={type === 'all'} onChange={() => setType('all')} />
                  <span>All listings</span><small>{entries.length}</small>
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
                <legend>Tags</legend>
                <div className="tag-options">
                  {tags.map((tag) => (
                    <label key={tag}>
                      <input
                        type="checkbox"
                        checked={selectedTags.includes(tag)}
                        onChange={() => toggleTag(tag)}
                      />
                      <span>{tag}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </aside>

            <div className="results">
              <div className="results-bar">
                <p aria-live="polite">
                  <strong>{results.length}</strong> {results.length === 1 ? 'listing' : 'listings'}
                </p>
                {selectedTags.length > 0 && (
                  <div className="active-filters">
                    {selectedTags.map((tag) => (
                      <button key={tag} type="button" onClick={() => toggleTag(tag)}>
                        {tag} <span aria-hidden="true">×</span>
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
                  <h3>No listings match those filters</h3>
                  <p>Try a broader search or clear your active filters.</p>
                  <button className="button" type="button" onClick={reset}>Clear filters</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="community-cta shell">
        <div>
          <span className="section-kicker">Built in the open</span>
          <h2>Have something useful to share?</h2>
          <p>Add one JSON file, run the validator, and open a pull request. No vendor account or private API required.</p>
        </div>
        <a className="button button-light" href="#/submit">Publish to SkillMarket <span aria-hidden="true">→</span></a>
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
    document.title = entry ? `${entry.name} · SkillMarket` : 'Listing not found · SkillMarket'
    return () => { document.title = 'SkillMarket — Skills, Agents & Prompts' }
  }, [entry])

  if (!entry) {
    return (
      <main id="main-content" className="not-found shell">
        <span>404</span>
        <h1>That listing is not in the registry.</h1>
        <p>It may have moved or the link may be incomplete.</p>
        <a className="button" href="#/">Browse all listings</a>
      </main>
    )
  }

  const sourceUrl = entry.repository ?? entry.url!
  return (
    <main id="main-content" className="detail-page">
      <div className="detail-hero">
        <div className="shell">
          <a className="back-link" href="#/"><span aria-hidden="true">←</span> Back to catalog</a>
          <div className="detail-title-row">
            <div className={`detail-icon type-${entry.type}`} aria-hidden="true">
              {typeMeta[entry.type].symbol}
            </div>
            <div>
              <div className="card-topline">
                <TypeBadge type={entry.type} />
                {entry.isExample && <span className="example-badge">Example listing</span>}
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
              <strong>This is a SkillMarket example.</strong>
              It demonstrates the registry format and does not claim to be an independent third-party project.
            </div>
          )}

          <section>
            <h2>How to use it</h2>
            <p>{entry.usage.instructions}</p>
            {entry.usage.example && (
              <>
                <h3>Example</h3>
                <CodeBlock>{entry.usage.example}</CodeBlock>
              </>
            )}
          </section>

          {entry.type === 'skill' && (
            <section>
              <h2>Installation</h2>
              <CodeBlock>{entry.installation.command}</CodeBlock>
              {entry.installation.notes && <p>{entry.installation.notes}</p>}
            </section>
          )}

          {entry.type === 'agent' && (
            <section>
              <h2>Setup</h2>
              <p>{entry.setup.instructions}</p>
              <h3>Requirements</h3>
              <ul>{entry.setup.requirements.map((requirement) => <li key={requirement}>{requirement}</li>)}</ul>
            </section>
          )}

          {entry.type === 'prompt' && (
            <section>
              <h2>Prompt template</h2>
              <CodeBlock>{entry.prompt.template}</CodeBlock>
              <h3>Variables</h3>
              <div className="variable-list">
                {entry.prompt.variables.map((variable) => (
                  <div key={variable.name}>
                    <code>{variable.name}</code>
                    <span>{variable.description}</span>
                    <small>{variable.required ? 'Required' : 'Optional'}</small>
                  </div>
                ))}
              </div>
            </section>
          )}
        </article>

        <aside className="detail-sidebar">
          <a className="button source-button" href={sourceUrl}>
            View {entry.repository ? 'source' : 'instructions'} on GitHub
            <span aria-hidden="true">↗</span>
          </a>
          <dl>
            <div><dt>Author</dt><dd>{entry.author.url ? <a href={entry.author.url}>{entry.author.name}</a> : entry.author.name}</dd></div>
            <div><dt>Version</dt><dd>{entry.version}</dd></div>
            <div><dt>License</dt><dd>{entry.license}</dd></div>
            <div><dt>Updated</dt><dd><time dateTime={entry.updatedAt}>{new Date(`${entry.updatedAt}T00:00:00Z`).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })}</time></dd></div>
          </dl>
          <div className="sidebar-tags">
            <strong>Tags</strong>
            <div className="tag-list">{entry.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</div>
          </div>
        </aside>
      </div>
    </main>
  )
}

function SubmitPage() {
  useEffect(() => {
    document.title = 'Submit a listing · SkillMarket'
    return () => { document.title = 'SkillMarket — Skills, Agents & Prompts' }
  }, [])

  return (
    <main id="main-content" className="submit-page">
      <section className="submit-hero">
        <div className="shell">
          <span className="section-kicker">Publish in the open</span>
          <h1>Share your work with the community.</h1>
          <p>SkillMarket is a file-based registry. Every listing is transparent, versioned, and reviewed through a GitHub pull request.</p>
        </div>
      </section>
      <div className="shell submit-content">
        <div className="steps">
          <div><span>1</span><strong>Choose a type</strong><p>Pick the registry folder that best describes what you built.</p></div>
          <div><span>2</span><strong>Add one JSON file</strong><p>Follow the schema and use your unique, kebab-case id as the filename.</p></div>
          <div><span>3</span><strong>Validate and open a PR</strong><p>Run the local checks, explain your listing, and submit it for review.</p></div>
        </div>
        <div className="publish-grid">
          {(Object.keys(typeMeta) as EntryType[]).map((type) => {
            const folder = `${type}s`
            return (
              <article key={type} className={`publish-card category-${type}`}>
                <span className="category-symbol" aria-hidden="true">{typeMeta[type].symbol}</span>
                <h2>Publish a {typeMeta[type].label}</h2>
                <p>{typeMeta[type].description}</p>
                <a
                  className="button"
                  href={`${REPOSITORY_URL}/new/main/registry/${folder}?filename=your-${type}.json`}
                >
                  Create {typeMeta[type].label} file <span aria-hidden="true">↗</span>
                </a>
              </article>
            )
          })}
        </div>
        <div className="contribution-help">
          <div>
            <span aria-hidden="true">?</span>
            <div><h2>Read the contribution guide first</h2><p>See every field, complete examples, validation commands, and the pull request checklist.</p></div>
          </div>
          <a className="button button-ghost-dark" href={CONTRIBUTING_URL}>Open CONTRIBUTING.md <span aria-hidden="true">→</span></a>
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
