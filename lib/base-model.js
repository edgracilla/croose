'use strict'

const mongoose = require('mongoose')
const _ = require('lodash')

const loSet = require('lodash/set')
const loGet = require('lodash/get')
const isEqual = require('lodash/isequal')
const isObject = require('lodash/isobject')
const cloneDeep = require('lodash/clonedeep')

const deserialize = require('fast-json-parse')
const serialize = require('fast-safe-stringify')

const mapExpand = require('./map-expand')

class BaseModel {
  static _init (options) {
    this.resource = this.collection.name
    this.cacher = process.env.CACHE === 'true'
      ? options.redis
      : false
  }

  static async _create (data, options) {
    const { expand } = options || {}
    const model = new this()

    let doc = await model
      .set(data)
      .save()

    doc = doc.toObject()

    if (this.cacher) await this._cache('set', doc)
    if (expand) doc = await this._expand(doc, expand)

    return doc
  }

  static async _read (_id, options) {
    const { expand } = options || {}

    let doc = this.cacher
      ? await this._cache('get', _id)
      : await this.findOne({ _id }).exec()

    if (!this.cacher) doc = doc.toObject()
    if (expand) doc = await this._expand2(doc, expand)

    return doc
  }

  static async _update (query, update, options) {
    let { expand, soft } = options || {}
    let doc = await this.findOne(query).exec()
    
    if (!doc) return null

    soft = soft === void 0
      ? true
      : soft

    const changeLog = {}
    const oldDoc = cloneDeep(doc)
    const keys = Object.keys(update)
    const plainDoc = doc.toObject()

    const comparator = function (a, b) {
      return typeof a === 'object'
        ? !isEqual(a, b)
        : a !== b
    }

    const mergeUnique = function (arr1, arr2) {
      return arr1
        .concat(arr2)
        .reduce((acc, item) => {
          for (let i = 0; i < acc.length; i++) {
            if (isEqual(acc[i], item)) return acc
          }

          return [...acc, item]
        }, [])
    }

    if (typeof soft === 'boolean') {
      if (soft) {
        // soft array update (append new items to existing array)
        keys.forEach(key => {
          doc[key] = Array.isArray(doc[key])
            ? mergeUnique(plainDoc[key], update[key])
            : update[key]
        })
      } else {
        // hard array update (overwrite array values with new ones)
        keys.forEach(key => {
          doc[key] = update[key]
        })
      }
    } else if (typeof soft === 'object') {
      // mixed! some fields are soft some are not
      keys.forEach(key => {
        doc[key] = Array.isArray(update[key]) && soft[key] === true
          ? mergeUnique(plainDoc[key], update[key])
          : update[key]
      })
    }

    const modifieds = doc.modifiedPaths()
    let updDoc = await doc.save()

    if (modifieds.length) {
      modifieds.forEach(field => {
        const updv = isObject(updDoc[field]) ? updDoc[field].toObject() : updDoc[field] // updated value
        const oldv = isObject(oldDoc[field]) ? oldDoc[field].toObject() : oldDoc[field] // old value

        if (Array.isArray(updv) && updv.length) {
          changeLog[field] = {
            added: updv.filter(a => oldv.every(b => comparator(a, b))),
            removed: oldv.filter(b => updv.every(a => comparator(b, a)))
          }

          // fix for same object value but diff ref -> treated as modified (changeLog result is empty)
          if (!changeLog[field].added.length && !changeLog[field].removed.length) {
            modifieds.splice(modifieds.indexOf(field), 1)
            delete changeLog[field]
          }
        } else {
          changeLog[field] = {
            from: oldv,
            to: updv
          }
        }
      })
    }

    updDoc = updDoc.toObject()

    if (this.cacher) await this._cache('set', updDoc)
    if (expand) updDoc = await this._expand(updDoc, expand)

    updDoc.modifieds = modifieds
    updDoc.changeLog = changeLog

    return updDoc
  }

  static async _delete (query) {
    let doc = await this
      .findOne(query)
      .exec()
    
    if (!doc) return null

    await doc.remove()
    if (this.cacher) await this._cache('del', doc)

    return true


  }

  static async _count (query) {
    return await this
      .find(query)
      .countDocuments()
  }

  static async _search (filter, options) {
    let { sort, page, expand, listOnly, limit } = options || {}

    let query = this.find(filter)
    let cquery = this.find(filter)

    page = page || 1
    limit = limit || 50

    query.limit(limit)
    query.skip(limit * (page > 0 ? page - 1 : 0))

    if (sort) {
      query.collation({ locale: 'en' })
      query.sort(sort)
    }

    if (expand) {
      await this._expand(query, expand, /* isSearch */ true)
    }

    const docs = await query.exec()
    const count = await cquery.countDocuments()

    if (listOnly) return docs
      
    return {
      page,
      count,
      limit,
      pages: Math.ceil(count / limit),
      data: docs
    }
  }

  static async _deleteMany (filter) {
    let docs = []
    
    if (this.cacher) {
      docs = await this
        .find(filter)
        .select('_id')
        .exec()
    }

    let ret = await this.deleteMany(filter)

    if (this.cacher && ret.deletedCount) {
      await this._cache('delm', docs)
    }

    return ret
  }

  static _updateMany () {}


  // -- helpers

  static async _cache (action, doc) {
    const _id = typeof doc === 'object' ? doc._id : doc
    const key = `${this.resource}:${_id}`

    switch (action) {
      case 'set':
        return await this.cacher
          .set(key, serialize(doc))

      case 'del':
        return await this.cacher.del(key)

      case 'get': {
        const strDoc = await this.cacher.get(key)
        const { err, value } = deserialize(strDoc)

        if (!err) return value

        doc = await this.findOne({ _id }).exec()
        await this.cacher.set(key, serialize(doc))

        return doc.toObject()
      }

      case 'delm': {
        const pipe = this.cacher.pipeline()
        const keys = doc.map(e => `${this.resource}:${e._id}`)

        return pipe
          .del(keys)
          .exec()
      }
    }
  }

  static async _expand (doc, expand, isSearch = false) { // simple expansion, non nested
    expand = expand
      .replace(' ', '')
      .replace(',', ' ')

    if (isSearch) {
      const query = doc
      return query.populate(expand)
    } else {
      let retDoc = await this
        .findOne({ _id: doc._id })
        .populate(expand)
        .exec()

      return retDoc.toObject()
    }
  }

  static async _expand2 (doc, expand) {

    // const hrTimeStart = process.hrtime()
    // const nsStart = hrTimeStart[0] * 1000000 + hrTimeStart[1] / 1000

    const populate = mapExpand(expand, this.schema.obj)

    // const hrTimeEnd = process.hrtime()
    // const nsEnd = hrTimeEnd[0] * 1000000 + hrTimeEnd[1] / 1000
    
    console.log(nsEnd - nsStart, 'ns');

    let retDoc = await this
      .findOne({ _id: doc._id })
      .populate(populate)
      .exec()

    return retDoc.toObject()
  }

  static _mapPopulates (expand) {
    const mapObj = {}

    // -- preparation / cleanup

    const expands = expand
      .replace(/\s/g, '')
      .replace(/\*/g, '.')
      .split(',')

    // used lodash.set to auto convert string path to obj
    // e.g. 'aa.bb.cc' to { aa: { bb : { cc: 1 } } }

    // also removes faulty duplicate expand
    // e.g. ?expand=foo,bar,foo >> maps to 'foo,bar'

    expands.forEach(key => {
      loSet(mapObj, key, 1)
    })

    // -- mapper / crawler

    const mapPopulates = function (map, root, schema) {
      const populate = []

      for (const key in map) {
        const value = map[key]

        // --
        const prop = schema[key]

        if (prop) {
          console.log('--a', key, cname(prop), prop)

          switch (cname(prop)) {
            case 'Object': 
            console.log('--bx')
              populator(populate, prop.ref, map, value, key)
              break

            case 'Array':
              console.log('--b', key, cname(prop[0]))

              const ref = cname(prop[0]) === 'Object'
                ? prop[0].ref
                : prop

                console.log('---c', ref, prop)
              populator(populate, ref, map, value, key)
              break

            default:
              if (schema[key]) {
                for (const subKey in value) {
                  populator(populate, schema, value, value[subKey], `${key}.${subKey}`)
                }
              }
          }
        }
      }

      return { path: root, populate }
    }

    const populator = function (populate, ref, map, val, key) {
      switch (typeof val) {
        case 'number':
          populate.push({ path: key })
          delete map[key]
          break

        case 'object':
          const targetRefSchema = mongoose.model(ref).schema.obj
          populate.push(mapPopulates(val, key, targetRefSchema))
          break
      }
    }

    const cname = function (obj) {
      return obj.constructor.name
    }
    
    const isReferenced = (schema, key) => { // helper
      const prop = schema[key]
      if (!prop) return false

      if (Array.isArray(prop)) {
        return prop[0].ref !== void 0
      } else {
        return prop.ref !== void 0
      }
    }

    // console.log(mapObj)
    const root = mapPopulates(mapObj, 'root', this.schema.obj)

    return root.populate
  }
}

module.exports = BaseModel
