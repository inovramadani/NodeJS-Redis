var client = require('./redis')
var lodash = require('lodash')
var send = require('send-data/json')

var isEmpty = lodash.isEmpty

module.exports = {
  postBuyers: postBuyers,
  getBuyers: getBuyers,
  getRoute: getRoute
}

function postBuyers (req, res, opts) {
  let body = ''

  req.on('data', function (data) {
    body += data.toString()
  })

  req.on('end', function () {
    if (!(isEmpty(body) && body === undefined && body === null)) {
      let bodyJSON = {}

      try {
        bodyJSON = JSON.parse(body)
      } catch (err) {
        res.statusCode = 400
        return send(req, res, { message: 'request is not valid' })
      }

      if (!isEmpty(bodyJSON)) {
        if (Array.isArray(bodyJSON)) {
          bodyJSON.forEach(function (buyer) {
            client.set(buyer.id, JSON.stringify(buyer.offers))

            addLocationToDB(buyer)
          })
        } else {
          const buyer = bodyJSON
          client.set(buyer.id, JSON.stringify(buyer.offers))

          addLocationToDB(buyer)
        }
      }

      res.statusCode = 201
      send(req, res, { message: 'success' })
    } else {
      res.statusCode = 400
      send(req, res, { message: 'request is not valid' })
    }
  })
}

function getBuyers (req, res, opts) {
  const buyerId = opts.params.id

  client.get(buyerId, function (err, result) {
    if (err) return console.error(err)

    if (result !== null || !isEmpty(result)) {
      const data = { id: buyerId, offers: JSON.parse(result) }
      return send(req, res, data)
    } else {
      return send(req, res, { message: 'not found' })
    }
  })
}

function getRoute (req, res, opts) {
  const state = opts.query.state
  const device = opts.query.device
  const time = new Date(opts.query.timestamp)
  const day = time.getUTCDay()
  const hour = time.getUTCHours()

  client.lrange(`${state}.${device}.${day}.${hour}`, 0, 0, function (err, result) {
    if (err) return console.error(err)

    if (result !== null || !isEmpty(result)) {
      const data = JSON.parse(result)

      res.statusCode = 302
      return send(req, res, { headers: { location: data.location } })
    } else {
      res.statusCode = 404
      return send(req, res, { message: 'not found' })
    }
  })
}

// create location based record in DB for easy highest valued location retrieval
function addLocationToDB (buyer) {
  buyer.offers.forEach(function (offer) {
    const criteria = offer.criteria

    criteria.state.forEach(function (state) {
      criteria.device.forEach(function (device) {
        criteria.day.forEach(function (day) {
          criteria.hour.forEach(function (hour) {
            const record = {
              buyerId: buyer.id,
              value: offer.value,
              location: offer.location
            }

            client.lrange(`${state}.${device}.${day}.${hour}`, 0, 0, function (err, result) {
              if (err) return console.error(err)

              if (result.length > 0) {
                const data = JSON.parse(result[0])
                if (record.value > data.value) {
                  client.lpush(`${state}.${device}.${day}.${hour}`, JSON.stringify(record))
                } else {
                  client.rpush(`${state}.${device}.${day}.${hour}`, JSON.stringify(record))
                }
              } else {
                client.lpush(`${state}.${device}.${day}.${hour}`, JSON.stringify(record))
              }
            })
          })
        })
      })
    })
  })
}

