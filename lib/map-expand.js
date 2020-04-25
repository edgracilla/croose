'use strict'

const _set = require('lodash/set')
const _get = require('lodash/get')
const mongoose = require('mongoose')

const crc = require('crc')
const QuickLRU = require('quick-lru')

const cache = new QuickLRU({ maxSize: 1000 })

function MapExpand (str, rootSchema) {
  const hash = crc.crc32(str).toString(16)
  if (cache.has(hash)) {
    return cache.get(hash)
  }

  // -- preparation / cleanup

  const mapObj = {}

  const expands = str
    .replace(/\s/g, '')
    .replace(/\*/g, '.')
    .split(',')

  expands.forEach(key => {
    _set(mapObj, key, 1)
  })

  const root = mapPopulates(mapObj, 'root', rootSchema)

  cache.set(hash, root.populate)
  return root.populate
}

function mapPopulates (map, root, schema) {
  const populate = []

  for (const key in map) {
    const sProp = schema[key] // schema property

    if (sProp) {
      const instance = cname(sProp)

      if (instance === 'Object') {
        populator(populate, map, key, sProp.ref)

      } else if (instance === 'Array') {
        const arrInst = cname(sProp[0])

        if (arrInst === 'Object') {
          populator(populate, map, key, sProp[0].ref)
        } else if (arrInst === 'Schema') {
          for (const subKey in map[key]) {
            populator(populate, map, `${key}.${subKey}`, sProp[0].obj[subKey].ref)
          }
        }

      } else if (instance === 'Schema') {
        for (const subKey in map[key]) {
          populator(populate, map, `${key}.${subKey}`, sProp.obj[subKey].ref)
        }
      }
    }
  }

  return { path: root, populate }
}

function cname (obj) {
  return obj.constructor.name
}

function populator (populate, map, key, ref) {
  const value = _get(map, key)
  const vtype = typeof value

  if (vtype === 'number') {
    populate.push({ path: key })
  } else if (vtype === 'object') {
    const targetRefSchema = mongoose.model(ref).schema.obj
    populate.push(mapPopulates(value, key, targetRefSchema))
  }
}

module.exports = MapExpand