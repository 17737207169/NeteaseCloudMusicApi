/**
 * 将 package-lock.json 中 registry.npm.taobao.org 的 tarball URL
 * 改写为 registry.npmjs.org，避免 Vercel 等境外环境无法拉取淘宝源导致缺包。
 * 使用：node scripts/rewrite-lock-to-npmjs.js
 */
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const lockPath = path.join(root, 'package-lock.json')
const pkgPath = path.join(root, 'package.json')

function rewriteResolved(resolved) {
  if (!resolved || typeof resolved !== 'string') return resolved
  const taobao = 'registry.npm.taobao.org'
  if (!resolved.includes(taobao)) return resolved
  const clean = resolved.split('?')[0]
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

const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'))
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
