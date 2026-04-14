const { consturctServer } = require('../server')

let appPromise = null
function getApp() {
  if (!appPromise) appPromise = consturctServer()
  return appPromise
}

module.exports = async function handler(req, res) {
  const app = await getApp()
  const path = (req.url || '').replace(/^\/api/, '') || '/'
  req.url = path
  // Vercel 传入的 req 可能没有 originalUrl；server.js 里 decode(req.originalUrl) 需要字符串否则会抛错
  req.originalUrl = path
  app(req, res)
}
