
/**
 * EXPAND TYPES
 * - Simple
 * - Simple Recurssive
 * - Simple SubDocument
 * - Array
 * - Array Recurssive
 * - Array SubDocument
 * 
 */

 /**
  * TO BE WATCHED
  * subdocument plain object
  */

const _set = require('lodash/set')
const _get = require('lodash/get')
const mongoose = require('mongoose')

const Schema = mongoose.Schema

function MapExpand (str, rootSchema) {
  const mapObj = {}

  // -- preparation / cleanup

  const expands = str
    .replace(/\s/g, '')
    .replace(/\*/g, '.')
    .split(',')


  expands.forEach(key => {
    _set(mapObj, key, 1)
  })

  const root = mapPopulates(mapObj, 'root', rootSchema)

  return root.populate
}

function mapPopulates (map, root, schema) {
  const populate = []

  console.log('\n--------------------------')
  console.log(map)
  console.log(schema)
  console.log('--------------------------')

  for (const key in map) {
    const sProp = schema[key] // schema property

    if (sProp) {
      console.log('\n--a', key, cname(sProp))
      const instance = cname(sProp)

      if (instance === 'Object') {
        console.log('--b')
        populator(populate, map, key, sProp.ref)

      } else if (instance === 'Array') {
        const arrInst = cname(sProp[0])

        console.log('--c', arrInst, sProp[0])
        if (arrInst === 'Object') {
          console.log('--d')
          populator(populate, map, key, sProp[0].ref)
        } else if (arrInst === 'Schema') {
          console.log('--da', root, key, map[key], sProp[0].obj)
          for (const subKey in map[key]) {
            console.log('--da a', subKey, map)
            populator(populate, map, `${key}.${subKey}`, sProp[0].obj[subKey].ref)
          }
        }

      } else if (instance === 'Schema') {
        console.log('--e', root, key, map[key], sProp.obj)
        for (const subKey in map[key]) {
          console.log('--e a', subKey, map)
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

  console.log('--pop', key, value, typeof ref, ref)

  const vtype = typeof value
  const rtype = typeof ref

  if (vtype === 'number') {
    console.log('--pop a')
    populate.push({ path: key })
    delete map[key]

  } else if (vtype === 'object') {
    console.log('--pop b')
    if (rtype === 'string') {
      console.log('--pop ba', key)
      const targetRefSchema = mongoose.model(ref).schema.obj
      populate.push(mapPopulates(value, key, targetRefSchema))
    } else if (rtype === 'object') {
      console.log('--pop bbbbbbbbbbbbbbbb =============', key, ref)
      populate.push(mapPopulates(value, key, ref))
    }
  }
}

module.exports = MapExpand