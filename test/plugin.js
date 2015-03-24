var _            = require('lodash')
  , expect       = require('chai').expect
  , async        = require('async')
  , mongoose     = require('mongoose')
  , Schema       = mongoose.Schema
  , deepPopulate = require('../index')

describe('mongoose-deep-populate', function () {


  /*==============================================*
   * Bugs
   *==============================================*/
  describe('Bugs', function () {
    it('bug #12', function (cb) {
      var dbUrl = process.env.TEST_DB
        , connection = mongoose.createConnection(dbUrl)

      var UserSchema = new Schema({
        items: [{ type: Schema.Types.ObjectId, ref: 'Item.bug12' }]
      })
      UserSchema.plugin(deepPopulate)
      var User = connection.model('User.bug12', UserSchema)

      var ItemSchema = new Schema({
        seller: { type: Schema.Types.ObjectId, ref: 'User.bug12' }
      })
      ItemSchema.plugin(deepPopulate)
      var Item = connection.model('Item.bug12', ItemSchema)

      var user = new User()
      var item = new Item({seller: user})
      user.items.addToSet(item)

      user.save(function (err) {
        if (err) return cb(err)
        item.save(function (err) {
          if (err) return cb(err)
          user.deepPopulate('items.seller', function (err) {
            if (err) return cb(err)
            expect(user.equals(user.items[0].seller))
            cb()
          })
        })
      })
    })
  })



  var UserSchema, User
    , CommentSchema, Comment
    , PostSchema, Post
    , nextModelVersion = 0

  /*==============================================*
   * Specific behaviors of static call pattern
   *==============================================*/
  describe('[static] Specific behaviors', function () {
    before(setup)

    it('passes through null or empty document array', function (cb) {
      async.parallel([
        function (cb) {
          Post.deepPopulate(null, 'comments', function (err, docs) {
            expect(docs).to.be.null
            cb()
          })
        },
        function (cb) {
          Post.deepPopulate(undefined, 'comments', function (err, docs) {
            expect(docs).to.be.undefined
            cb()
          })
        },
        function (cb) {
          var docs = []
          Post.deepPopulate(docs, 'comments', function (err, _docs) {
            expect(_docs).to.equal(docs)
            cb()
          })
        }
      ], cb)
    })

    it('populates the same document array', function (cb) {
      Post.find({_id: 1}, function (err, docs) {
        if (err) return cb(err)
        Post.deepPopulate(docs, 'comments', function (err, _docs) {
          if (err) return cb(err)
          expect(_docs).to.equal(docs)
          cb()
        })
      })
    })
  })

  /*==============================================*
   * Specific behaviors of instance call pattern
   *==============================================*/
  describe('[instance] Specific behaviors', function () {
    before(setup)

    it('populates the same document', function (cb) {
      Post.findById(1, function (err, doc) {
        if (err) return cb(err)
        doc.deepPopulate('comments', function (err, _doc) {
          if (err) return cb(err)
          expect(_doc).to.equal(doc)
          cb()
        })
      })
    })
  })

  /*==============================================*
   * Specific behaviors of Query call pattern
   *==============================================*/
  describe('[query] Specific behaviors', function () {
    before(setup)

    it('passes in undefined if no document is found', function (cb) {
      async.parallel([
        function (cb) {
          Post.find({_id: 'not exist'}).deepPopulate('comments').exec(function (err, docs) {
            expect(docs).to.be.undefined
            cb()
          })
        },
        function (cb) {
          Post.findOne({_id: 'not exist'}).deepPopulate('comments').exec(function (err, doc) {
            expect(doc).to.be.undefined
            cb()
          })
        },
        function (cb) {
          Post.findById('not exist').deepPopulate('comments').exec(function (err, doc) {
            expect(doc).to.be.undefined
            cb()
          })
        }
      ], cb)
    })

    it('supports `lean` query option', function (cb) {
      async.parallel([
        function withoutLean(cb) {
          Post.findOne({}).deepPopulate('user comments').exec(function (err, doc) {
            checkType(doc, 'model', cb)
          })
        },
        function withLean(cb) {
          Post.findOne({}).deepPopulate('user comments').lean().exec(function (err, doc) {
            checkType(doc, 'Object', cb)
          })
        },
        function withLeanInvokedBeforeDeepPopulate(cb) {
          Post.findOne({}).lean().deepPopulate('user comments').exec(function (err, doc) {
            checkType(doc, 'Object', cb)
          })
        },
      ], cb)

      function checkType(doc, expectedType, cb) {
        expect(doc.constructor.name).to.equal(expectedType)
        expect(doc.user.constructor.name).to.equal(expectedType)
        doc.comments.forEach(function (comment) {
          expect(comment.constructor.name).to.equal(expectedType)
        })
        cb()
      }
    })
  })

  /*==============================================*
   * Behaviors of all call patterns
   *==============================================*/
  eachPopulationType(function (type, populateFn) {
    describe(type + ' Using default options', function () {
      before(setup)

      it('deeply populates a linked document', function (cb) {
        populateFn('user.manager', null, function (err, post) {
          if (err) return cb(err)
          check(post.user, true)
          check(post.user.manager, true)
          cb()
        })
      })

      it('deeply populates a document array', function (cb) {
        populateFn('comments.user.manager', null, function (err, post) {
          if (err) return cb(err)
          post.comments.forEach(function (comment) {
            check(comment, true)
            check(comment.user, true)
            check(comment.user.manager, true)
          })
          cb()
        })
      })

      it('deeply populates a document array which link back to original model', function (cb) {
        populateFn('reviewers.mainPage', null, function (err, post) {
          if (err) return cb(err)
          post.reviewers.forEach(function (reviewer) {
            check(reviewer, true)
            check(reviewer.mainPage, true)
          })
          cb()
        })
      })

      it('deeply populates a subdocument', function (cb) {
        populateFn('approved.user.manager', null, function (err, post) {
          if (err) return cb(err)
          check(post.approved.user, true)
          check(post.approved.user.manager, true)
          cb()
        })
      })

      it('deeply populates a subdocument array', function (cb) {
        populateFn('likes.user.manager', null, function (err, post) {
          if (err) return cb(err)
          post.likes.forEach(function (like) {
            check(like.user, true)
            check(like.user.manager, true)
          })
          cb()
        })
      })

      it('supports multiple paths using space-delimited string', function (cb) {
        populateFn('user.manager comments.user.manager  approved.user.manager   likes.user.manager', null, function (err, post) {
          if (err) return cb(err)
          checkPost(post)
          cb()
        })
      })

      it('supports multiple paths using comma-delimited string', function (cb) {
        populateFn('user.manager,comments.user.manager,approved.user.manager,likes.user.manager', null, function (err, post) {
          if (err) return cb(err)
          checkPost(post)
          cb()
        })
      })

      it('supports multiple paths via array param', function (cb) {
        populateFn(['user.manager', 'comments.user.manager', 'approved.user.manager', 'likes.user.manager'], null, function (err, post) {
          if (err) return cb(err)
          checkPost(post)
          cb()
        })
      })

      it('ignores invalid paths', function (cb) {
        populateFn('invalid1 invalid2.invalid3 user', null, function (err, post) {
          if (err) return cb(err)
          check(post.user, true)
          cb()
        })
      })

      it('ignores null path', function (cb) {
        populateFn(null, null, cb)
      })

      it('ignores null callback', function (cb) {
        if (type === 'static') {
          Post.deepPopulate()
          cb()
        }
        else Post.findOne({}, function (err, post) {
          if (err) return cb(err)
          post.deepPopulate()
          cb()
        })
      })
    })

    describe(type + ' Using whitelist', function () {
      before(function (cb) {
        setup(cb, {
          whitelist: ['comments']
        })
      })

      it('populates whitelisted paths', function (cb) {
        populateFn('comments', null, function (err, post) {
          if (err) return cb(err)
          post.comments.forEach(function (comment) {
            check(comment, true)
          })
          cb()
        })
      })

      it('ignores nested non-whitelisted subpaths', function (cb) {
        populateFn('comments.user', null, function (err, post) {
          if (err) return cb(err)
          post.comments.forEach(function (comment) {
            check(comment, true)
            check(comment.user)
          })
          cb()
        })
      })

      it('ignores non-whitelisted paths', function (cb) {
        populateFn('user', null, function (err, post) {
          if (err) return cb(err)
          check(post.user)
          cb()
        })
      })
    })

    describe(type + ' Using populate options', function () {
      before(function (cb) {
        setup(cb, {
          populate: {
            comments       : {
              select : 'user',
              options: {
                limit: 1
              }
            },
            'comments.user': {
              select: 'manager'
            }
          }
        })
      })

      it('applies populate options for corresponding paths', function (cb) {
        populateFn('comments.user', null, function (err, post) {
          if (err) return cb(err)
          expect(post.comments.length).to.equal(1)
          post.comments.forEach(function (comment) {
            check(comment)
            check(comment.user)
          })
          cb()
        })
      })
    })

    describe(type + ' Using rewriting', function () {
      before(function (cb) {
        setup(cb, {
          rewrite: {
            author  : 'user',
            approved: 'approved.user'
          },
          whitelist: [
            'author',
            'approved'
          ],
          populate: {
            author: {
              select: '-manager -_id'
            }
          }
        })
      })

      it('rewrites paths and whitelist', function (cb) {
        populateFn('author approved', null, function (err, post) {
          if (err) return cb(err)
          check(post.user, true)
          check(post.approved.user, true)
          cb()
        })
      })

      it('rewrites populate option paths', function (cb) {
        populateFn('author', null, function (err, post) {
          if (err) return cb(err)
          check(post.user, true)
          expect(post.user.manager && post.user._id).to.be.undefined
          cb()
        })
      })
    })

    describe(type + ' Overriding options', function () {
      before(function (cb) {
        setup(cb, {
          whitelist: [],
          populate: {}
        })
      })

      it('use overriding options', function (cb) {
        var overridingOpts = {
          whitelist: ['comments.user'],
          populate: {
            comments       : {
              select : 'user',
              options: {
                limit: 1
              }
            },
            'comments.user': {
              select: 'manager'
            }
          }
        }

        populateFn('comments.user', overridingOpts, function (err, post) {
          if (err) return cb(err)
          expect(post.comments.length).to.equal(1)
          post.comments.forEach(function (comment) {
            check(comment)
            check(comment.user)
          })
          cb()
        })
      })
    })
  })

  /*==============================================*
   * Helpers
   *==============================================*/
  function setup(cb, options) {
    var dbUrl = process.env.TEST_DB
      , connection = mongoose.createConnection(dbUrl)
      , modelVersion = ++nextModelVersion

    UserSchema = new Schema({
      _id    : Number,
      manager: {type: Number, ref: 'User' + modelVersion},
      mainPage: {type: Number, ref: 'Post' + modelVersion},
      loaded : {type: Boolean, default: true}
    })
    User = connection.model('User' + modelVersion, UserSchema)

    CommentSchema = new Schema({
      _id   : Number,
      loaded: {type: Boolean, default: true},
      user  : {type: Number, ref: 'User' + modelVersion}
    })
    Comment = connection.model('Comment' + modelVersion, CommentSchema)

    PostSchema = new Schema({
      _id     : Number,
      loaded  : {type: Boolean, default: true},
      user    : {type: Number, ref: 'User' + modelVersion}, // linked doc
      reviewers : [{type: Number, ref: 'User' + modelVersion}], // linked docs
      comments: [{type: Number, ref: 'Comment' + modelVersion}], // linked docs
      likes   : [{user: {type: Number, ref: 'User' + modelVersion}}], // subdocs
      approved: {status: Boolean, user: {type: Number, ref: 'User' + modelVersion}} // subdoc
    })
    PostSchema.plugin(deepPopulate, options)
    Post = connection.model('Post' + modelVersion, PostSchema)

    async.parallel([
      User.create.bind(User, {_id: 1, manager: 2, mainPage: 1}),
      User.create.bind(User, {_id: 2, mainPage: 2}),
      Comment.create.bind(Comment, {_id: 1, user: 1}),
      Comment.create.bind(Comment, {_id: 2, user: 1}),
      Comment.create.bind(Comment, {_id: 3, user: 1}),
      Post.create.bind(Post, {_id: 1, user: 1, reviewers: [1, 2], comments: [1, 2], likes: [{user: 1}], approved: {user: 1}}),
      Post.create.bind(Post, {_id: 2, user: 1, reviewers: [1, 2], comments: [3], likes: [{user: 1}], approved: {user: 1}})
    ], cb)
  }

  function eachPopulationType(cb) {
    function doneFn(cb) {
      return function (err, obj) {
        if (arguments.length === 2) {
          if (err) return cb(err)
          cb(null, _.isArray(obj) ? obj[0] : obj)
        }
        else cb(null, _.isArray(err) ? err[0] : err)
      }
    }

    var populationTypes = {
      '[static]': function (paths, options, cb) {
        Post.find({}, function (err, posts) {
          if (err) return cb(err)
          Post.deepPopulate(posts, paths, options, doneFn(cb))
        })
      },

      '[instance]': function (paths, options, cb) {
        Post.findOne({}, function (err, post) {
          if (err) return cb(err)
          post.deepPopulate(paths, options, doneFn(cb))
        })
      },

      '[query-one-callback]': function (paths, options, cb) {
        Post.findOne({}).deepPopulate(paths, options).exec(doneFn(cb))
      },

      '[query-one-promise]': function (paths, options, cb) {
        Post.findOne({}).deepPopulate(paths, options).exec().then(doneFn(cb))
      },

      '[query-id-callback]': function (paths, options, cb) {
        Post.findById(1).deepPopulate(paths, options).exec(doneFn(cb))
      },

      '[query-id-promise]': function (paths, options, cb) {
        Post.findById(1).deepPopulate(paths, options).exec().then(doneFn(cb))
      },

      '[query-many-callback]': function (paths, options, cb) {
        Post.find({_id: 1}).deepPopulate(paths, options).exec(doneFn(cb))
      },

      '[query-many-promise]': function (paths, options, cb) {
        Post.find({_id: 1}).deepPopulate(paths, options).exec().then(doneFn(cb))
      }
    }

    Object.keys(populationTypes).forEach(function (type) {
      cb(type, populationTypes[type])
    })
  }

  function check(obj, loaded) {
    expect(obj.loaded).to.equal(loaded)
  }

  function checkPost(post) {
    check(post.user, true)
    check(post.user.manager, true)

    check(post.approved.user, true)
    check(post.approved.user.manager, true)

    post.comments.forEach(function (comment) {
      check(comment, true)
      check(comment.user, true)
      check(comment.user.manager, true)
    })

    post.likes.forEach(function (like) {
      check(like.user, true)
      check(like.user.manager, true)
    })
  }
})
