var URL = require('url')
var http = require('http')
var sendJson = require('send-data/json')
var HttpHashRouter = require('http-hash-router')

var router = HttpHashRouter()
var api = require('../src/api')

router.set('/favicon.ico', empty)
router.set('/buyers', { POST: api.postBuyers })
router.set('/buyers/:id', { GET: api.getBuyers })
router.set('/route', { GET: api.getRoute })

module.exports = function createServer () {
  return http.createServer(handler)
}

function handler (req, res) {
  router(req, res, { query: getQuery(req.url) }, onError.bind(null, req, res))
}

function onError (req, res, err) {
  if (!err) return

  res.statusCode = err.statusCode || 500
  logError(req, res, err)

  sendJson(req, res, {
    error: err.message || http.STATUS_CODES[res.statusCode]
  })
}

function logError (req, res, err) {
  if (process.env.NODE_ENV === 'test') return

  var logType = res.statusCode >= 500 ? 'error' : 'warn'

  console[logType]({
    err: err,
    requestId: req.id,
    statusCode: res.statusCode
  }, err.message)
}

function empty (req, res) {
  res.writeHead(204)
  res.end()
}

function getQuery (url) {
  return URL.parse(url, true).query
}
