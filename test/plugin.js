var expect        = require('chai').expect
  , async         = require('async')
  , mongoose      = require('mongoose')
  , Schema        = mongoose.Schema
  , deepPopulate = require('../index')

describe('mongoose-deep-populate', function () {
  var UserSchema, User
    , CommentSchema, Comment
    , PostSchema, Post
    , nextModelVersion = 0

  eachPopulationType(function (type, populateFn) {

    describe(type + ' Using default options', function () {
      before(setup)

      it('deeply populates a linked document', function (cb) {
        populateFn('user.manager', function (err, post, _post) {
          if (err) return cb(err)
          expect(post).to.equal(_post)
          check(post.user, true)
          check(post.user.manager, true)
          cb()
        })
      })

      it('deeply populates a document array', function (cb) {
        populateFn('comments.user.manager', function (err, post) {
          if (err) return cb(err)
          post.comments.forEach(function (comment) {
            check(comment, true)
            check(comment.user, true)
            check(comment.user.manager, true)
          })
          cb()
        })
      })

      it('deeply populates a subdocument', function (cb) {
        populateFn('approved.user.manager', function (err, post) {
          if (err) return cb(err)
          check(post.approved.user, true)
          check(post.approved.user.manager, true)
          cb()
        })
      })

      it('deeply populates a subdocument array', function (cb) {
        populateFn('likes.user.manager', function (err, post) {
          if (err) return cb(err)
          post.likes.forEach(function (like) {
            check(like.user, true)
            check(like.user.manager, true)
          })
          cb()
        })
      })

      it('supports multiple paths', function (cb) {
        populateFn('user.manager, comments.user.manager, approved.user.manager, likes.user.manager', function (err, post) {
          if (err) return cb(err)
          checkPost(post)
          cb()
        })
      })

      it('supports multiple paths via array param', function (cb) {
        populateFn(['user.manager', 'comments.user.manager', 'approved.user.manager', 'likes.user.manager'], function (err, post) {
          if (err) return cb(err)
          checkPost(post)
          cb()
        })
      })

      it('ignores invalid paths', function (cb) {
        populateFn('invalid1, invalid2.invalid3, user', function (err, post) {
          if (err) return cb(err)
          check(post.user, true)
          cb()
        })
      })

      it('ignores null path', function (cb) {
        populateFn(null, cb)
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

    describe(type + ' Using whitelist option', function () {
      before(function (cb) {
        setup(cb, {
          whitelist: ['comments']
        })
      })

      it('populates whitelisted paths', function (cb) {
        populateFn('comments', function (err, post) {
          if (err) return cb(err)
          post.comments.forEach(function (comment) {
            check(comment, true)
          })
          cb()
        })
      })

      it('ignores nested non-whitelisted subpaths', function (cb) {
        populateFn('comments.user', function (err, post) {
          if (err) return cb(err)
          post.comments.forEach(function (comment) {
            check(comment, true)
            check(comment.user)
          })
          cb()
        })
      })

      it('ignores non-whitelisted paths', function (cb) {
        populateFn('user', function (err, post) {
          if (err) return cb(err)
          check(post.user)
          cb()
        })
      })
    })

    describe(type + ' Using rewrite option', function () {
      before(function (cb) {
        setup(cb, {
          rewrite: {
            author  : 'user',
            approved: 'approved.user'
          }
        })
      })

      it('rewrites and populates paths', function (cb) {
        populateFn('author, approved', function (err, post) {
          if (err) return cb(err)
          check(post.user, true)
          check(post.approved.user, true)
          cb()
        })
      })
    })
  })

  // Helpers
  function setup(cb, options) {
    var dbUrl = process.env.MONGOOSE_INCLUDE_TEST_DB
      , connection = mongoose.createConnection(dbUrl)
      , modelVersion = ++nextModelVersion

    UserSchema = new Schema({
      _id    : Number,
      manager: {type: Number, ref: 'User' + modelVersion},
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
      comments: [{type: Number, ref: 'Comment' + modelVersion}], // linked docs
      likes   : [{user: {type: Number, ref: 'User' + modelVersion}}], // subdocs
      approved: {status: Boolean, user: {type: Number, ref: 'User' + modelVersion}} // subdoc
    })
    PostSchema.plugin(deepPopulate, options)
    Post = connection.model('Post' + modelVersion, PostSchema)

    async.parallel([
      function (cb) { User.create({_id: 1, manager: 2}, cb) },
      function (cb) { User.create({_id: 2}, cb) },
      function (cb) { Comment.create({_id: 1, user: 1}, cb) },
      function (cb) { Comment.create({_id: 2, user: 1}, cb) },
      function (cb) { Comment.create({_id: 3, user: 1}, cb) },
      function (cb) { Post.create({_id: 1, user: 1, comments: [1, 2], likes: [{user: 1}], approved: {user: 1}}, cb) },
      function (cb) { Post.create({_id: 2, user: 1, comments: [3], likes: [{user: 1}], approved: {user: 1}}, cb) },
    ], cb)
  }

  function eachPopulationType(cb) {
    var populationTypes = {
      '[static]': function (paths, cb) {
        Post.find({}, function (err, posts) {
          if (err) return cb(err)
          Post.deepPopulate(posts, paths, function (err, _posts) {
            if (err) return cb(err)
            cb(null, posts[0], _posts[0])
          })
        })
      },

      '[instance]': function (paths, cb) {
        Post.findOne({}, function (err, post) {
          if (err) return cb(err)
          post.deepPopulate(paths, function (err, _post) {
            if (err) return cb(err)
            cb(null, post, _post)
          })
        })
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
