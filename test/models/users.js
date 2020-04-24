'use strict'

const path = require('path')
const mongoose = require('mongoose')
const baseModel = require('../../lib/base-model')
const resource = path.basename(__filename).split('.')[0]

const SubDocument = new mongoose.Schema({
  post: {
    ref: 'posts',
    type: String
  },
}, {
  _id: false
})

const schema = new mongoose.Schema({
  _id: {
    type: String,
  },
  name: {
    type: String,
  },
  email: {
    type: String,
  },
  connections: [{
    ref: 'users',
    type: String
  }],

  plainObj: {
    user: {
      ref: 'users',
      type: String
    }
  },

  subDoc: SubDocument,
  subDocArr: [SubDocument],
}, {
  minimize: false,
  timestamps: true,
  useNestedStrict: true
})

schema.loadClass(baseModel)
schema.index({ name: 'text' })

module.exports = mongoose.model(resource, schema, resource)
