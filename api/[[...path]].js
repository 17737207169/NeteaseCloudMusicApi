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
  app(req, res)
}
