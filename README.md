By default, Mongoose only supports populating nested models at one level of depth. This plugin makes it very simple to populate nested models at any level of depth.

### Installation
```
npm install mongoose-deep-populate
```

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
var deepPopulate = require('mongoose-deep-populate');
PostSchema.plugin(deepPopulate, options /* more on options below */);
```

#### Perform population

On `Post` model:

```javascript
Post.deepPopulate(posts, 'comments.user', function (err) {
  posts.forEach(function (post) {
    // post.comments and post.comments.user are fully populated
  });
});
```

On an instance of `Post`:

```javascript
post.deepPopulate('comments.user', function (err) {
  // post.comments and post.comments.user are fully populated
});
```

On `Query`:

```javascript
Post.find({}).deepPopulate('comments.user').exec(function (err, posts) {
  posts.forEach(function (post) {
    // post.comments and post.comments.user are fully populated
  });
});
```

Or:

```javascript
Post.findOne({}).deepPopulate('comments.user').exec(function (err, post) { ... });
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

Specify `whitelist` option to prevent performance and security issues.

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

Use `rewrite` option to rewrite provided paths as well as paths in `whitelist` and `populate`. This is useful when you allow API clients to specify paths and want to make these paths more user-friendly. For example:

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

Finally, you can override the above plugin options when invoking `deepPopulate`.
 
```javascript
Post.deepPopulate(posts, paths, {
  whitelist: [],
  rewrite: {},
  populate: {}
}, cb)

post.deepPopulate(paths, {
  whitelist: [],
  rewrite: {},
  populate: {}
}, cb);

Post.find({}).deepPopulate(paths, {
  whitelist: [],
  rewrite: {},
  populate: {}
}).exec(cb)
```


### Test

To run tests, execute the following command. Note that you need a test database (don't reuse an existing database as the test will drop it every run).

```
gulp test --db mongodb://localhost/test_db
```

### Changelog

#### v1.0.0

* [Feature] Apply `rewrites` to `whitelist` and `populate`

#### v0.0.7

* [Feature] Add `deepPopulate` to `Query`
* [Feature] Support space dilimiter in paths

#### v0.0.6

* [Feature] Support populate options
* [Feature] Override options per call
* [Bug] Handle null paths and callback

#### v0.0.1

* Initial release


### License

MIT
