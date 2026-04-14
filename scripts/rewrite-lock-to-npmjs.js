/**
 * 将 package-lock.json 中国内镜像的 tarball URL 改写为 registry.npmjs.org，
 * 避免 Vercel 等境外环境无法解析 nlark / 淘宝源导致 npm install 失败。
 * 使用：node scripts/rewrite-lock-to-npmjs.js
 */
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const lockPath = path.join(root, 'package-lock.json')
const pkgPath = path.join(root, 'package.json')

/**
 * 与 cnpm / nlark / npmmirror 常见格式一致：…/包名或@scope名/download/xxx.tgz
 * 统一为 https://registry.npmjs.org/<pkg>/-/<tarball>
 */
function mirrorDownloadUrlsToNpmjs(text) {
  const hosts = ['registry\\.nlark\\.com', 'registry\\.npmmirror\\.com']
  let out = text
  for (const host of hosts) {
    const re = new RegExp(
      `https?://${host}/((?:@[^/]+/)?[^/]+)/download/([^"\\s]+\\.tgz)`,
      'gi',
    )
    out = out.replace(re, 'https://registry.npmjs.org/$1/-/$2')
  }
  return out
}

/** nlark / 旧 cnpm：…/包名/download/包名-版本.tgz */
function nlarkToNpmjs(clean) {
  const re =
    /^https?:\/\/registry\.nlark\.com\/(@[^/]+\/[^/]+|[^/]+)\/download\/([^/]+\.tgz)$/i
  const m = clean.match(re)
  if (!m) return null
  return `https://registry.npmjs.org/${m[1]}/-/${m[2]}`
}

function npmmirrorToNpmjs(clean) {
  const re =
    /^https?:\/\/registry\.npmmirror\.com\/(@[^/]+\/[^/]+|[^/]+)\/download\/([^/]+\.tgz)$/i
  const m = clean.match(re)
  if (!m) return null
  return `https://registry.npmjs.org/${m[1]}/-/${m[2]}`
}

function rewriteResolved(resolved) {
  if (!resolved || typeof resolved !== 'string') return resolved
  const clean = resolved.split('?')[0]

  const fromNlark = nlarkToNpmjs(clean)
  if (fromNlark) return fromNlark

  const fromNpmmirror = npmmirrorToNpmjs(clean)
  if (fromNpmmirror) return fromNpmmirror

  const taobao = 'registry.npm.taobao.org'
  if (!resolved.includes(taobao)) return resolved
  const marker = '/download/'
  const i = clean.indexOf(marker)
  if (i === -1) {
    console.warn('[rewrite-lock] 无法解析，跳过:', resolved.slice(0, 100))
    return resolved
  }
  const pkgPathPart = clean
    .slice(0, i)
    .replace(/^https?:\/\/registry\.npm\.taobao\.org\//, '')
  const tail = clean.slice(i + marker.length)
  const fileName = tail.includes('/') ? tail.split('/').pop() : tail
  return `https://registry.npmjs.org/${pkgPathPart}/-/${fileName}`
}

function walk(obj) {
  if (!obj || typeof obj !== 'object') return
  if (Array.isArray(obj)) {
    obj.forEach(walk)
    return
  }
  if (typeof obj.resolved === 'string') {
    obj.resolved = rewriteResolved(obj.resolved)
  }
  for (const k of Object.keys(obj)) walk(obj[k])
}

let lockText = fs.readFileSync(lockPath, 'utf8')
const before = lockText
lockText = mirrorDownloadUrlsToNpmjs(lockText)
if (lockText !== before) {
  console.log('[rewrite-lock] 已对 lock 文本中的 nlark/npmmirror URL 做整文件替换')
}

const lock = JSON.parse(lockText)
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))

walk(lock)

if (lock.packages && lock.packages['']) {
  lock.version = pkg.version
  lock.packages[''].version = pkg.version
  lock.packages[''].dependencies = { ...pkg.dependencies }
  lock.packages[''].devDependencies = { ...pkg.devDependencies }
}

fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n')
console.log('已更新', lockPath)
