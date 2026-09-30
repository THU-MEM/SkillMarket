import { useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { Button } from '@heroui/react'
import Icon from '../Icon'
import { AGENT_PUBLISH_PROMPT, SUBMISSION_URL } from '../publish-instructions'
import { collectDroppedFiles } from '../publish-drop'
import { PACKAGE_LIMITS, isExcludedPath, inspectZip, inspectFiles, exportPackage } from '../publish-package'
import type { PreparedPackage } from '../publish-package'
import './submit.css'

const GUIDE = 'https://github.com/THU-MEM/SkillMarket/blob/main/CONTRIBUTING.md'
const labels = { skill: 'Skill', agent: 'Agent', prompt: 'Prompt / 文档' }
const sizeLabel = (bytes: number) => bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

export default function SubmitPage() {
  const zipInput = useRef<HTMLInputElement>(null)
  const folderInput = useRef<HTMLInputElement>(null)
  const generation = useRef(0)
  const objectUrl = useRef('')
  const active = useRef(false)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [bundle, setBundle] = useState<PreparedPackage | null>(null)
  const [error, setError] = useState('')
  const [reviewed, setReviewed] = useState(false)
  const [downloaded, setDownloaded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  useEffect(() => () => {
    generation.current++
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
  }, [])

  function clearBundle() {
    generation.current++
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
    objectUrl.current = ''
    setBundle(null); setReviewed(false); setDownloaded(false); setError('')
  }
  async function receive(input: Promise<{ files: File[]; excluded: string[] }>, zipAllowed: boolean) {
    if (active.current) return
    active.current = true
    clearBundle()
    const request = generation.current
    setBusy(true)
    try {
      const { files, excluded } = await input
      const next = zipAllowed && files.length === 1 && /\.zip$/i.test(files[0].name)
        ? await inspectZip(files[0]) : await inspectFiles(files)
      next.excluded = [...new Set([...excluded, ...next.excluded])]
      const archive = await exportPackage(next)
      if (request !== generation.current) return
      objectUrl.current = URL.createObjectURL(archive)
      setBundle(next)
    } catch (failure) {
      if (request === generation.current) setError(failure instanceof Error ? failure.message : '无法读取文件，请重新选择 ZIP 或文件夹。')
    } finally {
      active.current = false
      if (request === generation.current) setBusy(false)
    }
  }
  function drop(event: DragEvent) {
    event.preventDefault(); setDragging(false)
    if (active.current) return
    // Begin enumeration in the event handler, before DataTransfer is protected again.
    void receive(collectDroppedFiles(event.dataTransfer, { ...PACKAGE_LIMITS, isExcludedPath }), true)
  }
  async function copyInstructions() {
    setCopyError(false)
    try { await navigator.clipboard.writeText(AGENT_PUBLISH_PROMPT); setCopied(true) }
    catch { setCopied(false); setCopyError(true) }
  }
  const entry = bundle?.files.find(file => file.path === bundle.entryPath)

  return <main id="main-content" className="shell document-page publish-page">
    <div className="page-heading"><div><h1>发布资源</h1><p>拖入你的作品，或让 Coding Agent 帮你完成。无需手写 JSON。</p></div><a className="inline-link" href={GUIDE}><Icon name="book" size={17} />详细发布说明</a></div>
    <div className="publish-workspace">
      <section className="publish-intake" aria-labelledby="intake-heading">
        <div className="publish-section-title"><h2 id="intake-heading">已有资源，直接拖入</h2><span>ZIP / 文件夹</span></div>
        <div className={`publish-drop${dragging ? ' is-dragging' : ''}`} aria-label="资源拖放区域" aria-busy={busy}
          onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true) }}
          onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false) }} onDrop={drop}>
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><path d="M12 16V3m-5 5 5-5 5 5M4 14v6h16v-6" /></svg>
          <h3>{busy ? '正在本地检查…' : '拖入 ZIP 或文件夹'}</h3>
          <p>自动识别 SKILL.md 与配套文件</p>
          <div className="publish-actions">
            <Button className="publish-primary" isDisabled={busy} onPress={() => zipInput.current?.click()}>选择 ZIP</Button>
            <Button variant="bordered" className="publish-secondary" isDisabled={busy} onPress={() => folderInput.current?.click()}>选择文件夹</Button>
          </div>
          <input ref={zipInput} type="file" accept=".zip,application/zip" aria-label="选择 ZIP 文件" hidden onChange={event => {
            const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ''
            if (files.length) void receive(Promise.resolve({ files, excluded: [] }), true)
          }} />
          <input ref={folderInput} type="file" {...{ webkitdirectory: '', directory: '' }} multiple aria-label="选择资源文件夹" hidden onChange={event => {
            const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ''
            if (files.length) void receive(Promise.resolve({ files, excluded: [] }), false)
          }} />
          <small>每次一个资源 · ZIP 及展开总量 ≤20 MB · 单文件 ≤4 MB · 最多 300 个文件</small>
        </div>
        <p className="publish-local-note"><Icon name="check" size={16} />仅在浏览器本地处理，不执行文件、不自动上传。刷新后清空。</p>
        {busy && <p role="status" className="publish-status">正在读取、检查并整理提交包，请稍候。</p>}
        {error && <div role="alert" className="publish-error"><strong>暂时无法准备这个包</strong><p>{error}</p><a href={GUIDE}>查看格式说明</a><span>，或使用右侧 Agent 路径。</span></div>}
        {bundle && <section className="publish-result" aria-labelledby="package-heading">
          <div className="publish-section-title"><h2 id="package-heading">{bundle.name}</h2><span>{labels[bundle.kind]}</span></div>
          <p role="status" className="publish-status">本地检查完成，尚未提交</p>
          <p>{bundle.files.length} 个文件 · {sizeLabel(bundle.totalBytes)} · 入口 <code>{bundle.entryPath}</code></p>
          <details className="publish-detail"><summary>查看将提交的文件</summary><ul className="publish-files">{bundle.files.map(file => <li key={file.path}><code>{file.path}</code><span>{sizeLabel(file.bytes.length)}</span></li>)}</ul></details>
          {bundle.excluded.length > 0 && <details className="publish-detail publish-exclusions"><summary>已排除 {bundle.excluded.length} 项隐藏文件、缓存或敏感文件名</summary><ul>{bundle.excluded.map(path => <li key={path}><code>{path}</code></li>)}</ul><p>若缺少必要文件，请整理目录后重试，或交给 Agent 逐项审查；不要上传原始未检查的包。</p></details>}
          <details className="publish-detail"><summary>预览入口内容（纯文本）</summary><pre>{entry ? new TextDecoder().decode(entry.bytes) : ''}</pre></details>
          <p className="publish-warning">这里只做格式与文件名检查，不代表安全审计。请确认正文、脚本和附件中没有密钥或私人资料。</p>
          <label className="publish-consent"><input type="checkbox" checked={reviewed} onChange={event => { setReviewed(event.target.checked); setDownloaded(false) }} /><span>我已检查这些文件，确认有权公开且不含敏感信息。</span></label>
          <div className="publish-actions">
            {reviewed ? <a className="button publish-primary" href={objectUrl.current} download="skillmarket-submission.zip" onClick={() => setDownloaded(true)}>1. 下载提交包</a> : <button className="button" disabled>1. 下载提交包</button>}
            {reviewed && downloaded ? <a className="button publish-secondary" href={SUBMISSION_URL} target="_blank" rel="noopener noreferrer">2. 去 GitHub 提交<Icon name="external" size={15} /></a> : <button className="button" disabled>2. 去 GitHub 提交</button>}
            <button className="text-button" onClick={clearBundle}>移除</button>
          </div>
          {downloaded && <p role="status" className="publish-next">已发起下载。打开 GitHub 后，把 ZIP 拖入正文，补一句用途与来源，等待附件上传完成，再点击 Submit new issue。</p>}
        </section>}
        <p className="publish-review-note">通过 GitHub Issue 提交审核（需登录 GitHub）。附件由你在 GitHub 上传，审核通过、PR 合并并部署后才会上线。</p>
      </section>
      <aside className="publish-agent" aria-labelledby="agent-heading">
        <div className="publish-agent-heading"><Icon name="terminal" size={22} /><span>另一种方式</span></div>
        <h2 id="agent-heading">交给 Coding Agent</h2>
        <p>把指令和资源发给你常用的 Agent。它来整理文件、生成条目、校验并提交 PR。</p>
        <Button className="publish-primary" startContent={<Icon name={copied ? 'check' : 'copy'} size={17} />} onPress={copyInstructions}>{copied ? '已复制发布指令' : '复制发布指令'}</Button>
        <p className="publish-agent-tip">随后提供 ZIP、指定文件夹或公开仓库链接。适用于 Codex、Claude Code 等 Coding Agent。</p>
        <div role="status">{copied && <p>已复制，粘贴到 Agent 对话中即可。</p>}{copyError && <p>浏览器未允许复制，请展开下方指令手动复制。</p>}</div>
        <details className="publish-detail" open={copyError || undefined}><summary>查看完整指令</summary><textarea aria-label="完整发布指令" readOnly value={AGENT_PUBLISH_PROMPT} /></details>
        <p className="publish-agent-note">网站不索取 Token。Agent 需要在你自己的环境中获得 GitHub 授权；不会直接推送 main。</p>
      </aside>
    </div>
    <div className="publish-help">
      <details><summary>资源包里需要放什么？</summary><p>Skill 放入 SKILL.md 及它引用的 scripts、references、assets，保留原始许可。Agent 可提供 AGENT.md / AGENTS.md；Prompt 可提供 PROMPT.md 或 README.md。不要把整个项目的依赖、模型或成片一起拖进来。</p><pre>{'my-skill/\n├── SKILL.md\n├── references/  （如有）\n├── scripts/     （如有）\n└── LICENSE      （按实际许可提供）'}</pre></details>
      <details><summary>提交后会发生什么？如何更新？</summary><p>Issue 是审核申请，不会直接上架。维护者确认用途、来源、许可和可用性后整理成 PR；合并并部署后才显示在目录。已有条目请说明名称及这次改动，沿用原 ID，避免重复上架。你也可以让 Agent 直接准备更新 PR。</p></details>
      <a className="inline-link" href={GUIDE}>字段、使用说明写法与常见问题<Icon name="arrow" size={16} /></a>
    </div>
  </main>
}
