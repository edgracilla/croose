'use strict'

const path = require('path')
const mongoose = require('mongoose')
const baseModel = require('../../lib/base-model')
const resource = path.basename(__filename).split('.')[0]

const deepPopulate = require('mongoose-deep-populate')(mongoose)

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
schema.plugin(deepPopulate)

module.exports = mongoose.model(resource, schema, resource)
