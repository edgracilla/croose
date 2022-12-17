const should = require('should')
const mongoose = require('mongoose')

const users = require('./models/users')
const posts = require('./models/posts')
const comments = require('./models/comments')

const data = {
  users: [
    {
      _id: 'user1',
      name: 'John Joe',
      email: 'john@test.com',
      connections: ['user2'],

      // for complex expand testing
      subDoc: { post: 'post1' },
      subDocArr: [{ post: 'post1' }, { post: 'post2' }],
      plainObj: { user: 'user1' }
    }, {
      _id: 'user2',
      name: 'Jane',
      email: 'jane@test.com',
      connections: ['user3']
    }, {
      _id: 'user3',
      name: 'Joe',
      email: 'joe@test.com',
      connections: ['user4']
    }, {
      _id: 'user4',
      name: 'James',
      email: 'james@test.com',
      connections: ['user3']
    }
  ],
  posts: [
    {
      _id: 'post1',
      content: 'content one',
      comments: ['comment1'],
      createdBy: 'user1'
    },
    {
      _id: 'post2',
      content: 'content two',
      comments: ['comment1', 'comment2'],
      createdBy: 'user2'
    },
    {
      _id: 'post3',
      content: 'content three',
      comments: ['comment1', 'comment2', 'comment3'],
      createdBy: 'user3'
    }
  ],
  comments: [
    {
      _id: 'comment1',
      message: 'comment one',
      createdBy: 'user1'
    },
    {
      _id: 'comment2',
      message: 'comment two',
      createdBy: 'user2'
    },
    {
      _id: 'comment3',
      message: 'comment three',
      createdBy: 'user3'
    }
  ]
}

describe(`croose test`, () => {
  beforeAll(done => {
    mongoose.connect('mongodb://localhost:27017', {
      useUnifiedTopology: true,
      useNewUrlParser: true,
      useCreateIndex: true,
      dbName: 'test-db'
    })

    mongoose.connection.on('connected', () => {
      done()
    })

    mongoose.connection.on('error', (err) => {
      should.ifError(err)
    })
  })

  // describe(`Simple CRUD - users`, () => {
  //   it('should create', (done) => {
  //     users._create(data.users[3])
  //       .then(doc => {
  //         expect(doc.createdAt).toBeDefined()
  //         done()
  //       })
  //       .catch(err => should.ifError(err))
  //   })

  //   it('should read', (done) => {
  //     users._read(data.users[3]._id)
  //       .then(doc => {
  //         expect(data.users[3]._id).toBe(doc._id)
  //         done()
  //       })
  //       .catch(err => should.ifError(err))
  //   })

  //   it('should update - trace changes', (done) => {
  //     users._update({ _id: data.users[3]._id }, { name: 'foo' })
  //       .then(doc => {
  //         expect(doc.name).toBe('foo')

  //         expect(doc.modifieds).toBeDefined()
  //         expect(doc.changeLog).toBeDefined()

  //         expect(doc.modifieds[0]).toBe('name')
  //         expect(doc.changeLog.name.to).toBe('foo')
  //         expect(doc.changeLog.name.from).toBe('James')

  //         done()
  //       })
  //       .catch(err => should.ifError(err))
  //   })

  //   it('should count', (done) => {
  //     users._count({})
  //       .then(count => {
  //         expect(count).toBe(1)
  //         done()
  //       })
  //       .catch(err => should.ifError(err))
  //   })

  //   it('should search', (done) => {
  //     users._search({})
  //       .then(ret => {
  //         expect(ret.count).toBeDefined()
  //         expect(ret.pages).toBeDefined()
  //         expect(ret.limit).toBeDefined()
  //         expect(ret.page).toBeDefined()
  //         ret.data.should.be.Array()
  //         done()
  //       })
  //       .catch(err => should.ifError(err))
  //   })

  //   it('should delete', (done) => {
  //     users._delete({ _id: data.users[3]._id})
  //       .then(ret => {
  //         expect(ret).toBe(true)
  //         done()
  //       })
  //       .catch(err => should.ifError(err))
  //   })
  // })

  describe(`Expand`, () => {
    beforeAll(done => {
      Promise.all([
        users._create(data.users[0]),
        users._create(data.users[1]),
        users._create(data.users[2]),

        posts._create(data.posts[0]),
        posts._create(data.posts[1]),
        posts._create(data.posts[2]),

        comments._create(data.comments[0]),
        comments._create(data.comments[1]),
        comments._create(data.comments[2]),
      ])
      .then(() => { done() })
      .catch(err => should.ifError(err))
    })

    describe(`Simple`, () => {
      it(`should expand basic - '/?expand=createdBy'`, (done) => {
        posts._read(data.posts[0]._id, { expand: 'createdBy' })
          .then(doc => {
            expect(doc.createdBy._id).toBeDefined()
            done()
          })
          .catch(err => should.ifError(err))
      })

      it(`should expand arrays - '/?expand=comments'`, (done) => {
        posts._read(data.posts[2]._id, { expand: 'comments' })
          .then(doc => {
            expect(doc.comments[0]._id).toBeDefined()
            expect(doc.comments[1]._id).toBeDefined()
            expect(doc.comments[2]._id).toBeDefined()
            done()
          })
          .catch(err => should.ifError(err))
      })

      it(`should expand multiples - '/?expand=createdBy,comments'`, (done) => {
        posts._read(data.posts[2]._id, { expand: 'createdBy,comments' })
          .then(doc => {
            expect(doc.createdBy._id).toBeDefined()
            expect(doc.comments[0]._id).toBeDefined()
            expect(doc.comments[1]._id).toBeDefined()
            expect(doc.comments[2]._id).toBeDefined()
            done()
          })
          .catch(err => should.ifError(err))
      })
    })

    describe(`Ladder`, () => {
      it(`should expand nested ladder down - '/?expand=createdBy'`, (done) => {
        posts._read(data.posts[0]._id, { expand: 'createdBy' })
          .then(doc => {
            expect(doc.createdBy._id).toBeDefined()
            done()
          })
          .catch(err => should.ifError(err))
      })

      it(`should expand nested ladder down - '/?expand=createdBy.subDoc'`, (done) => {
        posts._read(data.posts[0]._id, { expand: 'createdBy.subDoc' })
          .then(doc => {
            expect(doc.createdBy.subDoc).toBeDefined()
            done()
          })
          .catch(err => should.ifError(err))
      })

      it(`should expand nested ladder down - '/?expand=createdBy.subDoc.post'`, (done) => {
        posts._read(data.posts[0]._id, { expand: 'createdBy.subDoc.post' })
          .then(doc => {
            expect(doc.createdBy.subDoc.post._id).toBeDefined()
            done()
          })
          .catch(err => should.ifError(err))
      })

      it(`should expand nested ladder down - '/?expand=createdBy.subDoc.post.comments'`, (done) => {
        posts._read(data.posts[0]._id, { expand: 'createdBy.subDoc.post.comments' })
          .then(doc => {
            expect(doc.createdBy.subDoc.post.comments[0]._id).toBeDefined()
            done()
          })
          .catch(err => should.ifError(err))
      })
    })

    describe(`Complex`, () => {
      it(`should expand nested basic - '/?expand=comments.createdBy'`, (done) => {
        posts._read(data.posts[0]._id, { expand: 'comments.createdBy' })
          .then(doc => {
            expect(doc.comments[0].createdBy._id).toBeDefined()
            done()
          })
          .catch(err => should.ifError(err))
      })

      it(`should expand nested recursive - '/?expand=createdBy.connections.connections'`, (done) => {
        posts._read(data.posts[0]._id, { expand: 'createdBy.connections.connections' })
          .then(doc => {
            expect(doc.createdBy.connections[0].connections[0]._id).toBeDefined()
            done()
          })
          .catch(err => should.ifError(err))
      })

      it(`should expand nested subDocument - '/?expand=createdBy.subDoc.post.comments'`, (done) => {
        posts._read(data.posts[0]._id, { expand: 'createdBy.subDoc.post.comments' })
          .then(doc => {
            expect(doc.createdBy.subDoc.post.comments[0]._id).toBeDefined()
            done()
          })
          .catch(err => should.ifError(err))
      })

      it(`should expand nested array subDocument - '/?expand=createdBy.subDocArr*post.comments'`, (done) => {
        posts._read(data.posts[0]._id, { expand: 'createdBy.subDocArr.post.comments' })
          .then(doc => {
            console.log(doc.createdBy.subDocArr)
            expect(doc.createdBy.subDocArr[0].post.comments[0]._id).toBeDefined()
            done()
          })
          .catch(err => should.ifError(err))
      })
    })

    afterAll(done => {
      Promise.all([
        users._deleteMany({}),
        posts._deleteMany({}),
        comments._deleteMany({})
      ])
      .then(() => { done() })
      .catch(err => should.ifError(err))
    })
  })
})