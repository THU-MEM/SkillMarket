type DropPolicy = {
  maxFiles: number; maxDepth: number; maxFileBytes: number; maxTotalBytes: number; maxZipBytes: number
  isExcludedPath: (path: string) => boolean
}

function readEntry<T>(start: (resolve: (value: T) => void, reject: () => void) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const fail = () => { clearTimeout(timer); reject(new Error('无法读取文件夹，请改用选择文件夹或 ZIP。')) }
    const timer = setTimeout(fail, 10_000)
    try { start(value => { clearTimeout(timer); resolve(value) }, fail) } catch { fail() }
  })
}

// Capture entries synchronously: a DataTransfer's protected store expires after drop.
export async function collectDroppedFiles(data: DataTransfer, policy: DropPolicy): Promise<{ files: File[]; excluded: string[] }> {
  const items = Array.from(data.items).filter(item => item.kind === 'file')
  const entries = items.map(item => item.webkitGetAsEntry?.() ?? null)
  const fallback = Array.from(data.files)
  const files: File[] = []
  const excluded: string[] = []
  let visited = 0, totalBytes = 0
  async function visit(entry: FileSystemEntry, parent = '', depth = 1): Promise<void> {
    if (++visited > 1000) throw new Error('目录项目过多，请只选择要发布的资源文件夹。')
    if (depth > policy.maxDepth) throw new Error('文件夹层级过深，请缩小到资源目录后重试。')
    const path = `${parent}${entry.name}`
    if (policy.isExcludedPath(path)) { excluded.push(path + (entry.isDirectory ? '/' : '')); return }
    if (entry.isFile) {
      if (files.length >= policy.maxFiles) throw new Error('文件数量超限，请移除不必要的资源。')
      const file = await readEntry<File>((done, fail) => (entry as FileSystemFileEntry).file(done, fail))
      totalBytes += file.size
      const fileLimit = !parent && entries.length === 1 && /\.zip$/i.test(file.name) ? policy.maxZipBytes : policy.maxFileBytes
      if (file.size > fileLimit || totalBytes > policy.maxTotalBytes) throw new Error('文件体积超限，请移除模型、成片或依赖缓存后重试。')
      Object.defineProperty(file, 'webkitRelativePath', { value: path })
      files.push(file)
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader()
      for (;;) {
        const batch = await readEntry<FileSystemEntry[]>((done, fail) => reader.readEntries(done, fail))
        if (!batch.length) break
        for (const child of batch) await visit(child, `${path}/`, depth + 1)
      }
    } else throw new Error('不支持这个文件类型，请选择普通文件夹或 ZIP。')
  }
  if (entries.some(Boolean)) {
    if (entries.some(entry => !entry)) throw new Error('部分拖入内容无法读取，请改用选择文件夹或 ZIP。')
    for (const entry of entries) await visit(entry!)
  } else {
    if (fallback.length > policy.maxFiles) throw new Error('文件数量超限，请移除不必要的资源。')
    files.push(...fallback)
  }
  if (!files.length) throw new Error('没有可读取的文件，请选择 ZIP 或资源文件夹。')
  return { files, excluded }
}
