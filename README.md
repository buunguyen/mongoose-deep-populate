Mongoose plugin to enable population of nested models at any level of depth. Support **Mongoose 3.8.x** and later. Refer to [changelog](https://github.com/buunguyen/mongoose-deep-populate#changelog) for breaking changes.

[![NPM](https://nodei.co/npm/mongoose-deep-populate.png?compact=true)](https://www.npmjs.com/package/mongoose-deep-populate)

[![Build Status](https://travis-ci.org/buunguyen/mongoose-deep-populate.svg?branch=master)](https://travis-ci.org/buunguyen/mongoose-deep-populate) [![Issue Stats](http://issuestats.com/github/buunguyen/mongoose-deep-populate/badge/pr)](http://issuestats.com/github/buunguyen/mongoose-deep-populate) [![Issue Stats](http://issuestats.com/github/buunguyen/mongoose-deep-populate/badge/issue)](http://issuestats.com/github/buunguyen/mongoose-deep-populate)

### Usage

Sample usages are based on the following schemas:

```javascript
var UserSchema = new Schema({})

var CommentSchema = new Schema({
  user  : {type: Number, ref: 'User'}
})

var PostSchema = new Schema({
  user    : {type: Number, ref: 'User'},
  comments: [{type: Number, ref: 'Comment'}],
  likes   : [{user: {type: Number, ref: 'User'}}],
  approved: {status: Boolean, user: {type: Number, ref: 'User'}}
})
```

#### Register plugin

```javascript
// CHANGE from 1.x: need to pass in mongoose instance
var deepPopulate = require('mongoose-deep-populate')(mongoose);
PostSchema.plugin(deepPopulate, options /* more on options below */);
```

#### Perform population

On `Post` model:

```javascript
Post.deepPopulate(posts, 'comments.user', function (err, _posts) {
  // _posts is the same instance as posts and provided for convenience
  posts.forEach(function (post) {
    // post.comments and post.comments.user are fully populated
  });
});
```

On an instance of `Post`:

```javascript
post.deepPopulate('comments.user', function (err, _post) {
  // _post is the same instance as post and provided for convenience
});
```

On `Query`:

```javascript
Post.find().deepPopulate('comments.user').exec(function (err, posts) { ... });
Post.findOne().deepPopulate('comments.user').exec(function (err, post) { ... });
Post.findById(id).deepPopulate('comments.user').exec(function (err, post) { ... });
```


#### Populate multiple paths

Pass paths in a space- or comma-delimited string:

```javascript
post.deepPopulate('user comments.user likes.user approved.user', cb);
```
Or use an array of strings:

```javascript
post.deepPopulate(['comments.user', 'user', 'likes.user', 'approved.user'], cb);
```

#### Specify options

Specify `whitelist` option to ensure only certain paths can be populated. This is to prevent potential performance and security issues if you allow API clients to supply population paths.

```javascript
PostSchema.plugin(deepPopulate, {
  whitelist: [
    'user',
    'comments.user'
  ]
});
```

Use the `populate` option to supply paths with corresponding [Mongoose populate options](http://mongoosejs.com/docs/api.html#model_Model.populate).

```javascript
PostSchema.plugin(deepPopulate, {
  populate: {
    'comments.user': {
      select: 'name',
      options: {
        limit: 5
      }
    },
    'approved.user': {
      select: 'name'
    }
  }
});
```

Use `rewrite` option to rewrite provided paths as well as paths in `whitelist` and `populate`. This is useful when you allow API clients to supply population paths (e.g. via query string) and want to make these paths more user-friendly. For example:

```javascript
PostSchema.plugin(deepPopulate, {
  rewrite: {
    author: 'user',
    approver: 'approved.user'
  }
});

// assume the query string is: ?populate=author,approver
post.deepPopulate(req.query.populate, cb);  
```

##### Overriding options

You can override the above plugin options when invoking `deepPopulate`.

```javascript
Post.deepPopulate(posts, paths, {
  whitelist: [],
  populate: {},
  rewrite: {}
}, cb)

post.deepPopulate(paths, {
  whitelist: [],
  populate: {},
  rewrite: {}
}, cb);

Post.find({}).deepPopulate(paths, {
  whitelist: [],
  populate: {},
  rewrite: {}
}).exec(cb)
```


### Test

The test suite will **drop the database** each run, so only run it against a test database. To run tests, execute this command where `--db` is the connection string.

```
gulp test --db mongodb://127.0.0.1/mongoose_deep_populate_test_db
```

### Changelog

#### v2.0.3

* [Bug] Fix bug cannot use native ES6 Promise

#### v2.0.2

* [Bug] Fix bug populating when there is a subdocument within a linked document (see #29)

#### v2.0.0

* [Breaking] Need a mongoose instance passed to the function returned by `require`
* [Feature] Support mongoose promise provider

#### v1.1.0

* [Feature] Make mongoose a peer dependency to enforce supported versions

#### v1.0.2

* [Bug] Fix bug happening when Mongoose#populate does not infer the expected schema

#### v1.0.1

* [Bug] Apply `lean` to populated documents

#### v1.0.0

* [Feature] Apply `rewrites` to `whitelist` and `populate`

#### v0.0.7

* [Feature] Add `deepPopulate` to `Query`
* [Feature] Support space delimiter in paths

#### v0.0.6

* [Feature] Support populate options
* [Feature] Override options per call
* [Bug] Handle null paths and callback

#### v0.0.1

* Initial release


### License

MIT
