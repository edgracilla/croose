'use strict'

const path = require('path')
const mongoose = require('mongoose')
const baseModel = require('../../lib/base-model')
const resource = path.basename(__filename).split('.')[0]

const schema = new mongoose.Schema({
  _id: {
    type: String,
  },
  message: {
    type: String
  },
  createdBy: {
    ref: 'users',
    type: String
  }
}, {
  minimize: false,
  timestamps: true,
  useNestedStrict: true
})

schema.loadClass(baseModel)

module.exports = mongoose.model(resource, schema, resource)
