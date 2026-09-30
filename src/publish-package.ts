import { Zip, ZipPassThrough } from 'fflate'

export type PackageFile = { path: string; bytes: Uint8Array }
export type PreparedPackage = {
  files: PackageFile[]
  excluded: string[]
  name: string
  entryPath: string
  kind: 'skill' | 'agent' | 'prompt'
  totalBytes: number
}

export const PACKAGE_LIMITS = Object.freeze({
  maxFiles: 300,
  maxTotalBytes: 20 * 1024 * 1024,
  maxFileBytes: 4 * 1024 * 1024,
  maxDepth: 16,
  maxZipBytes: 20 * 1024 * 1024,
  maxEntryBytes: 256 * 1024,
})

const fold = (value: string) => value.normalize('NFKC').toUpperCase().toLowerCase()

/** Basic filename hygiene, NOT a secret scanner or a path validator. */
export function isExcludedPath(path: string): boolean {
  return fold(path).split(/[\\/]/).some(part => part.startsWith('.') ||
    ['node_modules', '__pycache__', '__macosx'].includes(part) ||
    /^(?:credentials?|auth|secrets?|tokens?)(?:[._-]|$)/.test(part) ||
    /\.(?:pem|key|p12|pfx|keystore)$/.test(part) || /^id_(?:rsa|dsa|ecdsa|ed25519)(?:[.-]|$)/.test(part))
}

function safePath(path: string): string {
  const parts = path.split('/')
  const unsafe = (part: string) => !part || part === '.' || part === '..' ||
    /[\\/:*?"<>|\p{Cc}\p{Cf}\p{Cs}]/u.test(part) || /[. ]$/.test(part) ||
    /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)
  if (path.length > 1024 || parts.length > PACKAGE_LIMITS.maxDepth ||
    parts.some(part => unsafe(part) || unsafe(part.normalize('NFKC')) || new TextEncoder().encode(part).length > 255)) {
    throw new Error('文件路径不安全或过深')
  }
  return path.normalize('NFC')
}

function checkPaths(entries: { path: string; directory?: boolean }[]): void {
  const seen = new Map<string, boolean>()
  for (const { path, directory = false } of entries) {
    const key = fold(path)
    if (seen.has(key)) throw new Error('文件路径重复（包含大小写或 Unicode 等价名称）')
    seen.set(key, directory)
  }
  for (const key of seen.keys()) {
    const parts = key.split('/')
    for (let i = 1; i < parts.length; i++) {
      if (seen.get(parts.slice(0, i).join('/')) === false) throw new Error('文件与目录路径冲突')
    }
  }
}

function checkCount(count: number): void {
  if (!count || count > PACKAGE_LIMITS.maxFiles) throw new Error('文件数量必须在 1–300 之间')
}

function checkSize(size: number, limit: number, label = '文件大小'): void {
  if (!Number.isSafeInteger(size) || size < 0 || size > limit) throw new Error(`${label}超过限制`)
}

function joinChunks(chunks: Uint8Array[], size: number): Uint8Array {
  const result = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length }
  return result
}

// Read bounded streams, rather than trusting File.size or allocating arrayBuffer first.
async function readBounded(file: File, limit: number): Promise<Uint8Array> {
  checkSize(file.size, limit)
  const reader = file.stream().getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.length
      checkSize(size, limit)
      chunks.push(value)
    }
  } finally {
    await reader.cancel()
    reader.releaseLock()
  }
  if (size !== file.size) throw new Error('文件大小与读取内容不一致')
  return joinChunks(chunks, size)
}

function prepare(files: PackageFile[], excluded: string[] = [], stripRoot = true): PreparedPackage {
  const root = files[0]?.path.split('/')[0]
  if (stripRoot && root && files.every(file => file.path.startsWith(root + '/'))) {
    files = files.map(file => ({ ...file, path: file.path.slice(root.length + 1) }))
  }
  let entry: PackageFile | undefined
  let kind: PreparedPackage['kind'] = 'skill'
  for (const [names, type] of [
    [['skill.md'], 'skill'], [['agent.md', 'agents.md'], 'agent'],
    [['prompt.md'], 'prompt'], [['readme.md'], 'prompt'],
  ] as const) {
    const candidates = files.filter(file => (names as readonly string[]).includes(fold(file.path.split('/').at(-1)!)))
    if (candidates.length > 1) throw new Error('发现多个入口，请一次仅提交一个包')
    if (candidates.length) { entry = candidates[0]; kind = type; break }
  }
  if (!entry) throw new Error('缺少入口：SKILL.md、AGENT(S).md、PROMPT.md 或 README.md')
  checkSize(entry.bytes.length, PACKAGE_LIMITS.maxEntryBytes, '入口文件大小')
  let text: string
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(entry.bytes) }
  catch { throw new Error('入口必须为 UTF-8 文本') }
  if (text.includes('\0')) throw new Error('入口必须为文本')
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text)?.[1]
  const name = /^#[ \t]+([^\r\n]+)$/m.exec(text)?.[1] ||
    (frontmatter && /^name:[ \t]*([^\r\n]+)$/m.exec(frontmatter)?.[1].replace(/^["']|["']$/g, '')) || root || 'package'
  // A display label only: never interpret Markdown/HTML or use it as a URL/path.
  const displayName = name.replace(/[\p{Cc}\p{Cf}\p{Cs}<>]/gu, '').trim().slice(0, 100) || 'package'
  return { files, excluded, name: displayName, entryPath: entry.path, kind, totalBytes: files.reduce((sum, file) => sum + file.bytes.length, 0) }
}

export async function inspectFiles(files: File[]): Promise<PreparedPackage> {
  checkCount(files.length)
  const entries = files.map(file => ({ file, path: safePath(file.webkitRelativePath || file.name) }))
  checkPaths(entries)
  const collected: PackageFile[] = []
  const excluded: string[] = []
  let total = 0
  for (const { file, path } of entries) {
    if (isExcludedPath(path)) { excluded.push(path); continue }
    checkSize(file.size, PACKAGE_LIMITS.maxFileBytes)
    checkSize(total + file.size, PACKAGE_LIMITS.maxTotalBytes, '文件总大小')
    const bytes = await readBounded(file, Math.min(PACKAGE_LIMITS.maxFileBytes, PACKAGE_LIMITS.maxTotalBytes - total))
    total += bytes.length
    collected.push({ path, bytes })
  }
  return prepare(collected, excluded)
}

type ZipEntry = { path: string; directory: boolean; start: number; end: number; size: number; crc: number; method: number }

// Strict ZIP32 subset: stored/DEFLATE, single disk, ASCII or UTF-8 names.
// Parse the directory AND local records before any decompression. Never trust a
// library's object-keyed file map: duplicates and __proto__ can disappear there.
function zipEntries(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const invalid = () => new Error('ZIP 结构损坏或使用不支持的格式（不支持分卷、ZIP64 或加密）')
  const range = (offset: number, length: number) => {
    if (offset < 0 || length < 0 || offset + length > bytes.length) throw invalid()
  }
  const u16 = (offset: number) => { range(offset, 2); return view.getUint16(offset, true) }
  const u32 = (offset: number) => { range(offset, 4); return view.getUint32(offset, true) }
  const extra = (offset: number, length: number) => {
    const end = offset + length
    range(offset, length)
    while (offset < end) {
      if (offset + 4 > end) throw invalid()
      const id = u16(offset), size = u16(offset + 2)
      // Only inert timestamp/uid fields; alternate names, ZIP64, links and AES
      // extra fields are not carried forward or silently interpreted.
      if (![0x5455, 0x7875, 0x5855, 0x000a].includes(id) || offset + 4 + size > end) throw invalid()
      offset += 4 + size
    }
  }
  let end = bytes.length - 22
  for (; end >= Math.max(0, bytes.length - 65557); end--) {
    if (u32(end) === 0x06054b50 && end + 22 + u16(end + 20) === bytes.length) break
  }
  if (end < 0 || u32(end) !== 0x06054b50) throw invalid()
  const count = u16(end + 10), central = u32(end + 16)
  if (u16(end + 4) || u16(end + 6) || u16(end + 8) !== count ||
    count === 65535 || central + u32(end + 12) !== end) throw invalid()
  checkCount(count)
  const entries: ZipEntry[] = []
  const spans: { start: number; end: number }[] = []
  let offset = central, total = 0
  for (let i = 0; i < count; i++) {
    range(offset, 46)
    if (u32(offset) !== 0x02014b50) throw invalid()
    const flags = u16(offset + 8), method = u16(offset + 10)
    const crc = u32(offset + 16), compressed = u32(offset + 20), size = u32(offset + 24)
    const nameLength = u16(offset + 28), extraLength = u16(offset + 30), commentLength = u16(offset + 32)
    const attrs = u32(offset + 38), local = u32(offset + 42)
    if ((flags & ~0x080e) || ![0, 8].includes(method) || u16(offset + 6) > 20 || u16(offset + 34) ||
      compressed === 0xffffffff || size === 0xffffffff || local >= central) throw invalid()
    const next = offset + 46 + nameLength + extraLength + commentLength
    if (next > end) throw invalid()
    const nameBytes = bytes.subarray(offset + 46, offset + 46 + nameLength)
    if (!(flags & 0x0800) && nameBytes.some(byte => byte >= 128)) throw invalid()
    let name: string
    try { name = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(nameBytes) }
    catch { throw invalid() }
    const directory = name.endsWith('/')
    const path = safePath(directory ? name.slice(0, -1) : name)
    const mode = (attrs >>> 16) & 0xf000
    if ((mode && mode !== (directory ? 0x4000 : 0x8000)) || (!directory && (attrs & 0x10))) {
      throw new Error('ZIP 不允许符号链接或特殊文件')
    }
    if (directory && (size !== 0 || crc !== 0)) throw invalid()
    checkSize(size, PACKAGE_LIMITS.maxFileBytes)
    total += size
    checkSize(total, PACKAGE_LIMITS.maxTotalBytes, '文件总大小')
    if (method === 0 && compressed !== size) throw invalid()
    extra(offset + 46 + nameLength, extraLength)
    range(local, 30)
    if (u32(local) !== 0x04034b50 || u16(local + 4) !== u16(offset + 6) ||
      u16(local + 6) !== flags || u16(local + 8) !== method || u16(local + 26) !== nameLength) throw invalid()
    for (let n = 0; n < nameLength; n++) if (bytes[local + 30 + n] !== nameBytes[n]) throw invalid()
    extra(local + 30 + nameLength, u16(local + 28))
    const start = local + 30 + nameLength + u16(local + 28), dataEnd = start + compressed
    if (dataEnd > central) throw invalid()
    for (const [at, expected] of [[14, crc], [18, compressed], [22, size]]) {
      const value = u32(local + at)
      if (value !== expected && (!(flags & 8) || value !== 0)) throw invalid()
    }
    let recordEnd = dataEnd
    if (flags & 8) {
      if (u32(recordEnd) === 0x08074b50) recordEnd += 4
      if (u32(recordEnd) !== crc || u32(recordEnd + 4) !== compressed || u32(recordEnd + 8) !== size) throw invalid()
      recordEnd += 12
    }
    if (recordEnd > central) throw invalid()
    spans.push({ start: local, end: recordEnd })
    entries.push({ path, directory, start, end: dataEnd, size, crc, method })
    offset = next
  }
  if (offset !== end) throw invalid()
  // No overlapping, unreferenced, prefixed or hidden local records.
  spans.sort((a, b) => a.start - b.start)
  let cursor = 0
  for (const span of spans) {
    if (span.start !== cursor) throw invalid()
    cursor = span.end
  }
  if (cursor !== central) throw invalid()
  checkPaths(entries)
  return entries
}

const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0)
  return value >>> 0
})

async function extractEntry(archive: Uint8Array, entry: ZipEntry, keep: boolean): Promise<Uint8Array> {
  let offset = entry.start
  // Small compressed pushes bound native inflate's work/allocation per transform,
  // not merely the number of bytes retained AFTER a whole-file inflate.
  const source = new ReadableStream<Uint8Array>({ pull(controller) {
    if (offset === entry.end) { controller.close(); return }
    const next = Math.min(offset + 256, entry.end)
    controller.enqueue(archive.subarray(offset, next))
    offset = next
  } })
  let stream: ReadableStream<Uint8Array> = source
  if (entry.method === 8) {
    let decoder: DecompressionStream
    try { decoder = new DecompressionStream('deflate-raw') }
    catch { throw new Error('浏览器不支持安全 ZIP 解压，请升级浏览器或直接选择文件夹') }
    stream = source.pipeThrough(decoder)
  }
  const reader = stream.getReader(), chunks: Uint8Array[] = []
  let size = 0, crc = 0xffffffff
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.length
      checkSize(size, Math.min(entry.size, PACKAGE_LIMITS.maxFileBytes), '解压后的文件大小')
      for (const byte of value) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8)
      if (keep) chunks.push(value)
    }
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
  if (size !== entry.size || ((crc ^ 0xffffffff) >>> 0) !== entry.crc) throw new Error('ZIP 文件长度或 CRC 校验失败')
  return keep ? joinChunks(chunks, size) : new Uint8Array()
}

export async function inspectZip(file: File): Promise<PreparedPackage> {
  const archive = await readBounded(file, PACKAGE_LIMITS.maxZipBytes)
  const entries = zipEntries(archive)
  const files: PackageFile[] = [], excluded: string[] = []
  for (const entry of entries) {
    const denied = isExcludedPath(entry.path)
    // Excluded archive entries are verified but never retained. They count toward
    // ALL budgets; an excluded name must not conceal a bomb or corrupt payload.
    const bytes = await extractEntry(archive, entry, !denied && !entry.directory)
    if (denied) excluded.push(entry.path + (entry.directory ? '/' : ''))
    else if (!entry.directory) files.push({ path: entry.path, bytes })
  }
  return prepare(files, excluded)
}

export async function exportPackage(bundle: PreparedPackage): Promise<Blob> {
  checkCount(bundle.files.length)
  const files = bundle.files.map(file => ({ path: safePath(file.path), bytes: file.bytes }))
  checkPaths(files)
  let total = 0
  for (const file of files) {
    if (isExcludedPath(file.path)) throw new Error('导出包含已排除的敏感路径')
    checkSize(file.bytes.length, PACKAGE_LIMITS.maxFileBytes)
    total += file.bytes.length
    checkSize(total, PACKAGE_LIMITS.maxTotalBytes, '文件总大小')
  }
  prepare(files, [], false)
  const chunks: Uint8Array<ArrayBuffer>[] = []
  const zip = new Zip((error, data) => {
    if (error) throw error
    chunks.push(new Uint8Array(data))
  })
  for (const file of files) {
    const entry = new ZipPassThrough(file.path)
    zip.add(entry)
    entry.push(file.bytes, true)
  }
  zip.end()
  return new Blob(chunks, { type: 'application/zip' })
}
