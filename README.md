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

#### Install the plugin

```javascript
var deepPopulate = require('mongoose-deep-populate');
PostSchema.plugin(deepPopulate, options /* more on options below */);
```

This will make the method `deepPopulate` available in both `Post` and its instances.

#### Perform population

On an instance of `Post`:

```javascript
post.deepPopulate('comments.user', function (err) {
  // post.comments and post.comments.user are fully populated
});
```

On `Post`:

```javascript
Post.deepPopulate(posts, 'comments.user', function (err) {
  posts.forEach(function (post) {
    // post.comments and post.comments.user are fully populated
  });
});
```

#### Populate multiple paths

Pass paths in a comma-delimited string:

```javascript
post.deepPopulate('user, comments.user, likes.user, approved.user', cb);
```
Or use an array of strings:

```javascript
post.deepPopulate(['comments.user', 'user', 'likes.user', 'approved.user'], cb);
```

#### Specify options

If you allow an API client to specify population paths, you should whitelist the paths to prevent performance and security problems:

```javascript
PostSchema.plugin(deepPopulate, {
  whitelist: [
    'user',
    'comments.user' 
  ]
});
```

You can also enable path rewriting to make the public-facing APIs more user-friendly.  For example:

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

### Test

To run tests, execute the following command. Note that you need a test database (don't reuse an existing database as the test will delete it every run).

```
gulp test -db mongodb://localhost/test_db
```

### License

MIT
