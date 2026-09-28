import { useEffect, useMemo, useRef, useState } from 'react'
import { HeroUIProvider, Button, Card, Chip } from '@heroui/react'
import { readTheme, saveTheme, applyTheme } from './theme'
import type { Theme } from './theme'
import { entries, entryById, tags } from './registry'
import Icon from './Icon'
import SkipLink from './components/SkipLink'
import { clientLabels, displayTag, filterEntries, platformMethods } from './components/catalog'
import type { Platform, Sort } from './components/catalog'
import { catalogHash, readCatalogState } from './components/catalogState'
import type { CatalogState } from './components/catalogState'
import CatalogOverview from './components/CatalogOverview'
import type { EntryType, Installation, InstallScope, RegistryEntry, SkillEntry } from './types'

const REPO = 'https://github.com/THU-MEM/SkillMarket'
const CONTRIBUTING = `${REPO}/blob/main/CONTRIBUTING.md`
const typeLabels: Record<EntryType, string> = { skill: '技能', agent: '智能体', prompt: '提示词' }
const scopeLabels: Record<InstallScope, string> = { project: '当前项目', user: '当前用户', interactive: '安装时选择' }
const platformLabels: Record<Platform, string> = { macos: 'macOS', windows: 'Windows', linux: 'Linux', web: 'Web' }
const statusLabels = { official: '官方方式', maintainer: '维护者脚本', community: '社区工具' }
type Route = { page: 'home' | 'guides' | 'submit' | 'missing' } | { page: 'detail'; id: string; client?: string }
function readRoute(): Route {
  const hash = typeof window === 'undefined' ? '' : window.location.hash.replace(/^#\/?/, '')
  const [path, query = ''] = hash.split('?')
  if (!path) return { page: 'home' }
  if (path === 'guides' || path === 'submit') return { page: path }
  if (path.startsWith('item/')) {
    try { return { page: 'detail', id: decodeURIComponent(path.slice(5)), client: new URLSearchParams(query).get('client') ?? undefined } }
    catch { return { page: 'missing' } }
  }
  return { page: 'missing' }
}
function useRoute() {
  const [route, setRoute] = useState(readRoute)
  useEffect(() => {
    let previousPath = window.location.hash.split('?')[0]
    const change = () => {
      setRoute(readRoute())
      const path = window.location.hash.split('?')[0]
      if (path !== previousPath) window.scrollTo({ top: 0, behavior: 'instant' })
      previousPath = path
    }
    window.addEventListener('hashchange', change)
    return () => window.removeEventListener('hashchange', change)
  }, [])
  return route
}
function Header({ page, theme, toggleTheme }: { page: Route['page']; theme: Theme; toggleTheme: () => void }) {
  return <header className="site-header"><div className="shell header-inner">
    <a className="brand" href="#/" aria-label="清工技能市场 首页"><span className="brand-mark"><Icon name="skill" size={22} /></span><span>清工技能市场</span></a>
    <nav aria-label="主导航">
      <a className="nav-explore" href="#/" aria-current={page === 'home' ? 'page' : undefined}>探索</a>
      <a href="#/guides" aria-current={page === 'guides' ? 'page' : undefined}><Icon name="book" /><span>安装指南</span></a>
      <a className="icon-button" href={REPO} aria-label="GitHub 仓库" title="GitHub 仓库"><Icon name="github" /></a>
      <Button isIconOnly variant="light" className="theme-toggle" aria-label={theme === 'light' ? '切换到深色主题' : '切换到明亮主题'} onPress={toggleTheme}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">{theme === 'light' ? <path d="M21 13a9 9 0 0 1-10-10 9 9 0 1 0 10 10Z" /> : <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/></>}</svg></Button>
      <Button as="a" color="primary" href="#/submit" className="publish-button" startContent={<Icon name="plus" />}><span>发布</span></Button>
    </nav>
  </div></header>
}
function EntryCard({ entry, state }: { entry: RegistryEntry; state: CatalogState }) {
  return <Card as="article" shadow="sm" className="entry-card"><a href={catalogHash(state, `item/${encodeURIComponent(entry.id)}`)} className="entry-link">
    <span className="entry-symbol" title={typeLabels[entry.type]}><Icon name={entry.type} size={24} /><span className="visually-hidden">{typeLabels[entry.type]}</span></span>
    <div className="entry-body"><div className="entry-title"><h2>{entry.name}</h2>{entry.isExample && <Chip size="sm" variant="flat" className="example-chip">示例</Chip>}</div>
      <p>{entry.description}</p>
      <div className="entry-bottom"><div className="tag-list">{entry.tags.slice(0, 3).map(tag => <span key={tag}>{displayTag(tag)}</span>)}</div><span className="entry-version">v{entry.version}</span></div>
      <span className="entry-action">{entry.type === 'skill' ? '查看安装' : '使用说明'}<Icon name="arrow" size={15} /></span>
    </div>
  </a><a className="entry-source icon-button" href={entry.source.sourceUrl} aria-label={`查看 ${entry.id} 的 GitHub 源码`} title="查看 GitHub 源码"><Icon name="github" size={18} /></a></Card>
}
function Catalog() {
  const [state, setState] = useState(() => readCatalogState(typeof window === 'undefined' ? '' : window.location.hash, tags))
  const { query, type, selectedTags, sort } = state
  useEffect(() => {
    const restore = () => setState(readCatalogState(window.location.hash, tags))
    window.addEventListener('hashchange', restore)
    return () => window.removeEventListener('hashchange', restore)
  }, [])
  const update = (patch: Partial<CatalogState>) => {
    const next = { ...state, ...patch }
    setState(next)
    window.location.hash = catalogHash(next)
  }
  const setQuery = (query: string) => update({ query })
  const setType = (type: EntryType | 'all') => update({ type })
  const setSort = (sort: Sort) => update({ sort })
  const results = useMemo(() => filterEntries(entries, query, type, selectedTags, sort), [query, type, selectedTags, sort])
  const reset = () => update({ query: '', type: 'all', selectedTags: [], sort: 'newest' })
  const toggleTag = (tag: string) => update({ selectedTags: selectedTags.includes(tag) ? selectedTags.filter(t => t !== tag) : [...selectedTags, tag] })
  const filtered = query || type !== 'all' || selectedTags.length > 0
  return <main id="main-content" className="shell catalog-page">
    <div className="page-heading"><div><span className="eyebrow">EXPLORE / 开放能力目录</span><h1>让好方法，成为你的能力。</h1><p>发现可复用的技能、智能体与提示词，从这里开始。</p></div><a className="inline-link" href="#/guides">第一次使用？<Icon name="arrow" size={16}/></a></div>
    <div className="explore-layout"><aside className="filter-rail"><span className="rail-label">浏览目录</span>
    <div className="type-tabs" role="group" aria-label="类型">{(['all', 'skill', 'agent', 'prompt'] as const).map(t => <Button variant={type === t ? 'flat' : 'light'} color={type === t ? 'primary' : 'default'} type="button" key={t} aria-pressed={type === t} onPress={() => setType(t)}><Icon name={t === 'all' ? 'filter' : t} size={18} /><span>{t === 'all' ? '全部内容' : typeLabels[t]}</span><small>{t === 'all' ? entries.length : entries.filter(e => e.type === t).length}</small></Button>)}</div>
    <details className="tag-filter" open><summary><Icon name="filter" size={16}/>标签筛选</summary><div className="tag-options">{tags.map(tag => <Button size="sm" variant="flat" type="button" key={tag} aria-pressed={selectedTags.includes(tag)} onPress={() => toggleTag(tag)}>{displayTag(tag)}</Button>)}</div></details><div className="rail-note"><Icon name="book" size={20}/><strong>先了解，再安装</strong><p>查看源码与安装范围，让每一次复用都有据可循。</p><a href="#/guides">阅读安装指南 →</a></div></aside><section className="catalog-content" aria-label="开放目录">
    <div className="search-row"><label className="search-box"><Icon name="search" /><span className="visually-hidden">搜索内容</span><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索名称、作者或标签…" />{query && <button className="icon-button" type="button" onClick={() => setQuery('')} aria-label="清空搜索" title="清空搜索"><Icon name="close" /></button>}</label></div>
    <CatalogOverview entries={entries} type={type} onType={setType} />
    <div className="catalog-toolbar"><div><h2>{filtered ? '筛选结果' : '探索全部内容'}</h2><p aria-live="polite">{results.length} 个结果</p></div>{filtered && <Button size="sm" variant="light" color="primary" onPress={reset}>清空筛选</Button>}<label className="sort-select"><span className="visually-hidden">排序</span><select aria-label="排序" value={sort} onChange={e => setSort(e.target.value as Sort)}><option value="newest">最近更新</option><option value="oldest">最早更新</option><option value="name">名称 A–Z</option></select></label></div>
    {selectedTags.length > 0 && <div className="active-tags">{selectedTags.map(tag => <button key={tag} onClick={() => toggleTag(tag)} aria-label={`移除${displayTag(tag)}筛选`}>{displayTag(tag)}<Icon name="close" size={14} /></button>)}</div>}
    {results.length ? <div className="entry-grid">{results.map(entry => <EntryCard key={entry.id} entry={entry} state={state} />)}</div> : <div className="empty-state"><Icon name="search" size={32} /><h2>没有匹配的内容</h2><p>换个关键词，或清空筛选。</p><button className="button" onClick={reset}>清空筛选</button></div>}
    </section></div></main>
}
function CopyButton({ value, label = '复制命令' }: { value: string; label?: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const generation = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => { generation.current++; clearTimeout(timer.current) }, [])
  const copy = async () => {
    const request = ++generation.current
    clearTimeout(timer.current)
    try {
      await navigator.clipboard.writeText(value)
      if (request !== generation.current) return
      setStatus('copied')
      timer.current = setTimeout(() => setStatus('idle'), 1800)
    } catch { if (request === generation.current) setStatus('error') }
  }
  const text = status === 'copied' ? '已复制' : status === 'error' ? '复制失败，请手动选择文本' : label
  return <><button className="icon-button copy-button" type="button" aria-label={text} title={text} onClick={copy}><Icon name={status === 'copied' ? 'check' : 'copy'} size={18} /></button><span className="visually-hidden" role="status">{status === 'idle' ? '' : text}</span></>
}
function Command({ value, context = '终端', label = '复制命令' }: { value: string; context?: string; label?: string }) {
  return <div className="command"><div className="command-top"><span><Icon name={context === '终端' ? 'terminal' : 'prompt'} size={15} />{context}</span><CopyButton key={value} value={value} label={label} /></div><pre><code>{value}</code></pre></div>
}
function NpxInstall({ entry }: { entry: SkillEntry }) {
  // Only advertise the repository source whose SKILL.md names are checked in tests.
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id) || entry.source.primaryFile !== `examples/${entry.id}/SKILL.md` || entry.source.sourceUrl !== `${REPO}/blob/main/examples/${entry.id}/SKILL.md`) return null
  return <details className="npx-install"><summary>通用 npx 安装</summary><div className="disclosure-body">
    <p>需要 Git 与 Node.js 22.20+。运行后按提示选择 Agent 和安装范围；此命令不读取下方选择器。</p>
    <Command value={`npx skills@1.7.0 add THU-MEM/SkillMarket --skill ${entry.id} --copy`} label="复制 npx 安装命令" />
    <p>使用 Vercel Labs 的第三方安装器，复制完整技能目录；可能覆盖已有同名技能，请先备份。不会替你安装 Python 依赖或配置 Token。</p>
    <a className="inline-link" href="https://github.com/vercel-labs/skills/tree/7407f3893ad4dceab546ac002c3ef806e4000c73">查看 skills CLI 文档<Icon name="external" size={16} /></a>
  </div></details>
}
function CloudSetup() {
  return <section className="content-section cloud-setup" aria-labelledby="cloud-setup-heading">
    <h2 id="cloud-setup-heading">获取与配置 Token</h2>
    <p>安装只是复制技能。首次使用还需要你自己的<strong>资料库 Repo-Token</strong>和对应的 Repo ID；不要使用账户 Token 或统一身份认证密码。</p>
    <ol className="cloud-setup-steps">
      <li><h3>找到资料库的 API Token</h3><p>登录清华云盘，在“我的资料库”找到要授权的资料库，打开该资料库的操作菜单。</p>
        <div className="token-route" aria-label="Seafile 官方文档中的 Token 操作路径"><span>我的资料库</span><span aria-hidden="true">→</span><span>资料库菜单</span><span aria-hidden="true">→</span><span>高级</span><span aria-hidden="true">→</span><strong>API Token</strong></div>
        <p className="muted">路径依据 Seafile 官方文档；清华定制界面未登录复核，菜单名称可能不同。</p>
        <p>填写应用名称并创建：仅查看和下载时选<strong>只读</strong>，需要上传或修改时才选<strong>读写</strong>。若无入口，请联系资料库所有者或管理员。</p>
        <a className="inline-link" href="https://cloud.tsinghua.edu.cn/">打开清华云盘<Icon name="external" size={16} /></a>
      </li>
      <li><h3>复制同一资料库的 Repo ID</h3><p>进入资料库，取地址栏中 <code>/library/</code> 后的 ID，不是资料库名称或分享链接。例如 <code>/library/&lt;repo_id&gt;/…</code>。</p></li>
      <li><h3>保存私密配置并验证</h3><p>在 Agent 的运行环境设置 <code>TSINGHUA_CLOUD_TOKEN</code> 和 <code>TSINGHUA_CLOUD_REPO_ID</code>，或保存到技能目录之外的私密 JSON。不要在本站、公开聊天或截图中填写真实 Token。</p>
        <details><summary>私密 JSON 配置示例</summary><div className="disclosure-body"><p>将占位值替换为自己的凭据，保存到 <code>~/.config/tsinghua-cloud-drive/credentials.json</code>；macOS / Linux 将文件权限设为 <code>0600</code>。不要提交到 Git。</p>
          <Command value={'{\n  "base_url": "https://cloud.tsinghua.edu.cn",\n  "repo_id": "替换为资料库 ID",\n  "api_token": "替换为该资料库的 API Token"\n}'} context="私密配置 JSON（不是终端命令）" label="复制配置模板" />
        </div></details>
        <p>安装 Python 依赖后，先运行 <code>python3 &lt;技能目录&gt;/scripts/drive.py --help</code>，再用 <code>list /</code> 只读验证。Windows 将 <code>python3</code> 换为 <code>py -3</code>；自定义配置用 <code>--config</code>，放在子命令前。</p>
      </li>
    </ol>
    <a className="inline-link" href={`${REPO}/blob/main/docs/TSINGHUA_CLOUD_SETUP.md`}>完整配置与排错指南<Icon name="external" size={16} /></a>
    <a className="inline-link" href="https://seafile-api.readme.io/reference/authentication">Token 官方说明<Icon name="external" size={16} /></a>
  </section>
}
function commandContext(command: string, client: string) {
  return /^\/(?:skills?|plugin|reload|help)(?:\s|$)/.test(command.trim()) ? `${clientLabels[client]} 对话窗口（不是终端）` : '终端'
}
function SupportingDetails({ method }: { method: Installation }) {
  return <div className="supporting-details">
    <details><summary>前置条件与分步说明</summary><div className="disclosure-body">
      {method.prerequisites?.map(p => <div className="instruction" key={p.name}><h4>{p.name}</h4><p>{p.details}</p>{p.check && <Command value={p.check} />}</div>)}
      <ol>{method.steps.map((step, i) => <li key={i}><h4>{step.title}</h4><p>{step.description}</p>{step.command && step.command !== method.command && <Command value={step.command} context={commandContext(step.command, method.client)} />}{step.expected && <p className="muted">预期：{step.expected}</p>}</li>)}</ol>
    </div></details>
    <details><summary>验证、更新与卸载</summary><div className="disclosure-body">{(['verify', 'update', 'uninstall'] as const).map(key => { const action = method[key]; return action && <div className="instruction" key={key}><h4>{{ verify: '验证安装', update: '更新', uninstall: '卸载' }[key]}</h4><p>{action.description}</p>{action.command && <Command value={action.command} context={commandContext(action.command, method.client)} />}</div> })}</div></details>
    <details><summary>安全与文档依据</summary><div className="disclosure-body">{method.securityNote && <p>{method.securityNote}</p>}<a className="inline-link" href={method.evidenceUrl}>查看此方式的文档<Icon name="external" size={16} /></a></div></details>
  </div>
}
function initialPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'macos'
  return /Windows/i.test(navigator.userAgent) ? 'windows' : /Linux/i.test(navigator.userAgent) ? 'linux' : 'macos'
}
function InstallGuide({ entry, client }: { entry: SkillEntry; client?: string }) {
  const [platform, setPlatform] = useState<Platform>(initialPlatform)
  const methods = platformMethods(entry.installations, platform)
  const [selectedId, setSelectedId] = useState(() => (methods.find(m => m.client === client) ?? methods.find(m => m.recommended) ?? methods[0])?.id ?? '')
  const selected = methods.find(m => m.id === selectedId) ?? methods.find(m => m.recommended) ?? methods[0]
  const clients = [...new Set(methods.map(m => m.client))]
  const scopes = [...new Set(methods.filter(m => m.client === selected?.client).map(m => m.scope))]
  const related = methods.filter(m => m.client === selected?.client && m.scope === selected?.scope)
  const chooseClient = (client: string) => { const candidates = methods.filter(m => m.client === client); setSelectedId((candidates.find(m => m.scope === selected?.scope && m.recommended) ?? candidates.find(m => m.recommended) ?? candidates[0]).id) }
  return <section className="install-panel" aria-labelledby="install-heading"><div className="panel-heading"><h2 id="install-heading"><Icon name="terminal" />安装技能</h2><a className="icon-button" href="#/guides" aria-label="安装指南" title="安装指南"><Icon name="book" /></a></div>
    <NpxInstall entry={entry} />
    <div className="install-selectors"><label>客户端<select aria-label="客户端" value={selected?.client ?? ''} onChange={e => chooseClient(e.target.value)}>{clients.map(client => <option key={client} value={client}>{clientLabels[client]}</option>)}</select></label><label>范围<select aria-label="安装范围" value={selected?.scope ?? ''} onChange={e => setSelectedId(methods.find(m => m.client === selected?.client && m.scope === e.target.value)!.id)}>{scopes.map(scope => <option key={scope} value={scope}>{scopeLabels[scope]}</option>)}</select></label><label>系统<select aria-label="操作系统" value={platform} onChange={e => {
      const next = e.target.value as Platform
      const available = platformMethods(entry.installations, next)
      const match = available.find(m => m.id === selected?.id) ?? available.find(m => m.client === selected?.client && m.scope === selected?.scope) ?? available.find(m => m.client === selected?.client) ?? available.find(m => m.recommended) ?? available[0]
      setPlatform(next); setSelectedId(match?.id ?? '')
    }}>{(Object.keys(platformLabels) as Platform[]).filter(p => p !== 'web' || entry.installations.some(m => m.platforms.includes('web'))).map(p => <option key={p} value={p}>{platformLabels[p]}</option>)}</select></label></div>
    {selected ? <div key={selected.id} className="selected-method">
      {related.length > 1 && <label className="method-picker">安装方式<select aria-label="安装方式" value={selected.id} onChange={e => setSelectedId(e.target.value)}>{related.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>}
      <div className="method-heading"><h3>{selected.label}</h3><span className="badge">{statusLabels[selected.officialStatus]}</span></div><p>{selected.summary}</p>
      {selected.command && <Command value={selected.command} context={commandContext(selected.command, selected.client)} />}
      {selected.targetPath && <p className="target-path">目标 <code>{selected.targetPath}</code></p>}
      {selected.url && <a className="inline-link" href={selected.url}>打开安装链接<Icon name="external" size={16} /></a>}
      <p className="install-caution">安装前请审查源码、前置条件与目标目录。</p><SupportingDetails method={selected} />
    </div> : <p className="empty-state">暂无此系统的安装方式，请切换系统或查看源码。</p>}
  </section>
}
function Missing() { return <main id="main-content" className="shell empty-state"><span className="eyebrow">404</span><h1>没有找到这个内容</h1><p>检查链接，或返回目录继续探索。</p><a className="button" href="#/">返回目录</a></main> }
function DetailPage({ id, client }: { id: string; client?: string }) {
  const entry = entryById.get(id)
  if (!entry) return <Missing />
  const returnHash = catalogHash(readCatalogState(typeof window === 'undefined' ? '' : window.location.hash, tags))
  return <main id="main-content" className="shell detail-page"><a className="back-link" href={returnHash}><Icon name="back" size={17} />返回目录</a>
    <header className="detail-heading"><div className="detail-title"><span className="entry-symbol"><Icon name={entry.type} size={27} /></span><div><div className="eyebrow">{typeLabels[entry.type]}{entry.isExample && <span className="badge">官方示例</span>}</div><h1>{entry.name}</h1></div></div><p>{entry.description}</p>
      <div className="metadata"><span>{entry.author.url ? <a href={entry.author.url}>{entry.author.name}</a> : entry.author.name}</span><span>v{entry.version}</span><span>{entry.license}</span><time dateTime={entry.updatedAt}>{entry.updatedAt}</time></div>
    </header><div className="detail-layout"><article className="detail-content">
      {entry.type === 'skill' && <><p className="detail-orientation">选择 Agent、范围与系统，再查看安装命令。前置条件在下方分步说明中。</p><InstallGuide key={`${entry.id}:${client ?? ""}`} entry={entry} client={client} /></>}
      {entry.type === 'prompt' && <section className="content-section"><h2>提示词模板</h2><Command value={entry.prompt.template} context="提示词 · 对话窗口" label="复制提示词模板" /><dl className="variables">{entry.prompt.variables.map(v => <div key={v.name}><dt><code>{v.name}</code><small>{v.required ? '必填' : '选填'}</small></dt><dd>{v.description}</dd></div>)}</dl></section>}
      {entry.type === 'agent' && <section className="content-section"><h2>配置</h2><p>{entry.setup.instructions}</p><ul>{entry.setup.requirements.map(r => <li key={r}>{r}</li>)}</ul></section>}
      {entry.id === 'tsinghua-cloud-drive' && entry.type === 'skill' && <CloudSetup />}
      <section className="content-section"><h2>使用</h2><p>{entry.usage.instructions}</p>{entry.usage.example && <Command value={entry.usage.example} context="使用示例" label="复制使用示例" />}</section>
    </article><aside className="detail-sidebar"><h2>源码</h2><a className="inline-link" href={entry.source.sourceUrl}>查看主文件<Icon name="external" size={16} /></a><code className="source-path">{entry.source.primaryFile}</code>{entry.source.rawUrl && <a className="inline-link" href={entry.source.rawUrl}>原始文件<Icon name="external" size={16} /></a>}<a className="inline-link" href={entry.repository ?? entry.url}><Icon name="github" size={17} />项目仓库</a><div className="tag-list sidebar-tags">{entry.tags.map(t => <span key={t}>{displayTag(t)}</span>)}</div></aside></div>
  </main>
}
function GuidesPage() {
  const [client, setClient] = useState('github-copilot')
  const skills = entries.filter((e): e is SkillEntry => e.type === 'skill' && e.installations.some(m => m.client === client))
  return <main id="main-content" className="shell document-page"><div className="page-heading"><div><span className="eyebrow">GET STARTED</span><h1>安装指南</h1><p>选客户端，打开技能，复制对应的安装命令。</p></div></div><div className="guide-layout"><nav className="client-nav" aria-label="客户端指南">{Object.entries(clientLabels).filter(([id]) => entries.some(e => e.type === 'skill' && e.installations.some(m => m.client === id))).map(([id, name]) => <button key={id} aria-pressed={client === id} onClick={() => setClient(id)}>{name}<Icon name="arrow" size={16} /></button>)}</nav><article className="guide-content"><h2>{clientLabels[client]}</h2><p>项目级仅用于当前项目；用户级供个人多个项目复用。仅展示该技能明确支持的范围。</p><div className="guide-skill-list">{skills.map(entry => <a key={entry.id} href={`#/item/${entry.id}?client=${encodeURIComponent(client)}`}><Icon name="skill" /><span>{entry.name}</span><Icon name="arrow" /></a>)}{!skills.length && <p>当前目录暂无此客户端的安装说明。</p>}</div><ol className="guide-steps"><li><strong>选择环境</strong><p>在详情中选择客户端、范围与操作系统，再选择安装方式。</p></li><li><strong>审查并安装</strong><p>阅读主文件及前置条件，复制完整命令。对话窗口命令不要粘贴到终端。</p></li><li><strong>验证与维护</strong><p>展开验证、更新与卸载，按所选安装方式的说明操作。</p></li></ol><a className="inline-link" href={`${REPO}/blob/main/docs/USER_GUIDE.md`}>仓库安装文档<Icon name="external" size={16} /></a></article></div><section className="guide-content npx-guide"><h2>通用 npx 安装</h2><p>需要 Git 与 Node.js 22.20+。以清华云盘为例，按终端提示选择 Agent 和范围：</p><Command value="npx skills@1.7.0 add THU-MEM/SkillMarket --skill tsinghua-cloud-drive --copy" label="复制 npx 安装命令" /><p>这是第三方安装器，可能覆盖已有同名技能；先审查源码并备份。各技能详情页也提供对应命令。云盘运行仍需另配 Python 依赖和自己的 Token。</p></section></main>
}
function SubmitPage() {
  return <main id="main-content" className="shell document-page"><div className="page-heading"><div><span className="eyebrow">CONTRIBUTE</span><h1>发布到目录</h1><p>添加元数据，通过 Pull Request 共同审阅。</p></div></div><div className="submit-layout"><ol className="guide-steps"><li><strong>阅读贡献指南</strong><p>确认必填字段、源码路径与安装说明。</p><a className="inline-link" href={CONTRIBUTING}>CONTRIBUTING.md<Icon name="external" size={16} /></a></li><li><strong>创建条目</strong><p>选择内容类型，使用唯一的 kebab-case ID。</p><div className="publish-links">{(Object.keys(typeLabels) as EntryType[]).map(type => <a className="button" key={type} href={`${REPO}/new/main/registry/${type}s?filename=your-${type}.json`}><Icon name={type} />{typeLabels[type]}<Icon name="external" size={15} /></a>)}</div></li><li><strong>校验并提交 PR</strong><p>按照贡献指南运行检查，说明用途与来源，等待审阅。</p></li></ol></div></main>
}
export default function App() {
  const route = useRoute()
  const [theme, setTheme] = useState<Theme>(readTheme)
  const [themeWarning, setThemeWarning] = useState(false)
  useEffect(() => { applyTheme(theme) }, [theme])
  const toggleTheme = () => { const next = theme === 'light' ? 'dark' : 'light'; setTheme(next); setThemeWarning(!saveTheme(next)) }
  useEffect(() => {
    document.title = `${route.page === 'detail' ? entryById.get(route.id)?.name ?? '内容未找到' : route.page === 'guides' ? '安装指南' : route.page === 'submit' ? '发布内容' : route.page === 'missing' ? '内容未找到' : '开放目录'} · 清工技能市场`
  }, [route])
  return <HeroUIProvider><SkipLink /><Header page={route.page} theme={theme} toggleTheme={toggleTheme} />{themeWarning && <p className="theme-warning" role="status">主题已切换，但当前浏览器无法保存偏好。</p>}{route.page === 'detail' ? <DetailPage key={`${route.id}:${route.client ?? ""}`} id={route.id} client={route.client} /> : route.page === 'guides' ? <GuidesPage /> : route.page === 'submit' ? <SubmitPage /> : route.page === 'missing' ? <Missing /> : <Catalog />}</HeroUIProvider>
}
