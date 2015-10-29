module.exports = function (mongoose) {
  if (mongoose == null) {
    throw new Error('An instance of mongoose needs passing in')
  }

  if (mongoose.Query.prototype.deepPopulate == null) {
    patchMongooseQuery(mongoose)
  }

  return deepPopulatePlugin;
}

/**
 * Patches Query to add `deepPopulate()` method.
 */
function patchMongooseQuery(mongoose) {
  var Query = mongoose.Query
    , _exec = Query.prototype.exec

  /**
   * Registers deep population on this query.
   * @param paths the paths to be populated.
   * @param options (optional) the population options.
   * @remark this method can only be invoked once per query.
   * @return {Query}
   */
  Query.prototype.deepPopulate = function (paths, options) {
    if (this.model.schema.methods.deepPopulate == null) {
      throw new Error('Plugin was not installed')
    }

    if (this._deepPopulates) {
      throw new Error('deepPopulate was already invoked')
    }

    this._deepPopulates = {paths: paths, options: options}
    return this
  }

  /**
   * Monkey-patches `exec` to add deep population hook.
   * @param op the operation to be executed.
   * @param cb the callback.
   * @return {MongoosePromise}
   */
  Query.prototype.exec = function (op, cb) {
    var deepPopulate = this._deepPopulates
    if (!deepPopulate) {
      return _exec.call(this, op, cb)
    }

    var model = this.model
      , paths = deepPopulate.paths
      , options = deepPopulate.options
      , defaultOptions = model.schema._defaultDeepPopulateOptions
      , lean = this._mongooseOptions.lean
      , promise

    if (isFunction(op)) {
      cb = op
      op = null
    }
    else {
      cb = cb || noop
    }

    var resolver = function (resolve, reject) {
      _exec.call(this, op, function (err, docs) {
        if (err) {
          return cb(err), reject(err)
        }

        if (!docs) {
          return cb(null, docs), resolve(docs)
        }

        execute(model, docs, paths, options, defaultOptions, lean, function (err, docs) {
          if (err) {
            return cb(err), reject(err)
          }
          cb(null, docs)
          resolve(docs)
        })
      })
    }.bind(this)

    // Mongoose 4.1.x and up
    if (mongoose.Promise.ES6) {
      promise = new mongoose.Promise.ES6(resolver)
    }
    // backward compatibility
    else {
      promise = new mongoose.Promise
      resolver(promise.resolve.bind(promise, null), promise.reject.bind(promise))
    }

    return promise
  }
}

/**
 * Invoked by Mongoose to executes the plugin on the specified schema.
 */
function deepPopulatePlugin(schema, defaultOptions) {
  schema._defaultDeepPopulateOptions = defaultOptions = defaultOptions || {}

  /**
   * Populates this document with the specified paths.
   * @param paths the paths to be populated.
   * @param options (optional) the population options.
   * @param cb (optional) the callback.
   */
  schema.methods.deepPopulate = function (paths, options, cb) {
    deepPopulate(this.constructor, this, paths, options, cb)
  }

  /**
   * Populates provided documents with the specified paths.
   * @param docs the documents to be populated.
   * @param paths the paths to be populated.
   * @param options (optional) the population options.
   * @param cb (optional) the callback.
   */
  schema.statics.deepPopulate = function (docs, paths, options, cb) {
    deepPopulate(this, docs, paths, options, cb)
  }

  function deepPopulate(model, docs, paths, options, cb) {
    if (isFunction(options)) {
      cb = options
      options = null
    }
    else {
      cb = cb || noop
    }

    if (docs == null || docs.length === 0) {
      return cb(null, docs)
    }

    execute(model, docs, paths, options, defaultOptions, false, cb)
  }
}

function execute(model, docs, paths, options, defaultOptions, lean, cb) {
  var params = createParams(model, docs, paths, extend({}, defaultOptions, options), lean)

  if (params.paths.length === 0) cb(null, docs)
  else populate(params, 0, cb)
}

function createParams(model, docs, paths, options, lean) {
  var rewrite = options.rewrite
    , whitelist = options.whitelist
    , populate = options.populate

  paths = isArray(paths) ? paths : (paths || '').split(/[\s,]+/) // space or comma delimited
  paths = normalize(paths)

  // rewrites paths, whitelist and populate
  if (rewrite) {
    paths = paths.map(function (path) { return rewrite[path] || path })

    if (whitelist) {
      whitelist = whitelist.map(function (path) { return rewrite[path] || path })
    }

    if (populate) {
      Object.keys(populate).forEach(function (path) {
        var rewrittenPath = rewrite[path] || path
        if (rewrittenPath) populate[rewrittenPath] = populate[path]
      })
    }
  }

  // deconstructs then filters paths using whitelist
  paths = normalize(deconstruct(paths))
  if (whitelist) {
    whitelist = normalize(deconstruct(whitelist))
    paths = paths.filter(function (path) { return ~whitelist.indexOf(path) })
  }

  // computes max subpaths, i.e. levels
  var maxNoOfSubpaths = -1
  paths.forEach(function (path) {
    var noOfSubpaths = path.split('.').length
    if (noOfSubpaths > maxNoOfSubpaths) maxNoOfSubpaths = noOfSubpaths
  })

  var db = model.db
  if (!db) {
    var doc = isArray(docs) ? docs[0] : docs
    if (doc && doc.ownerDocument) db = doc.ownerDocument().constructor.db
    else throw new Error('Cannot retrieve database instance')
  }

  return {
    db: db,
    model: model,
    docs: docs,
    paths: paths,
    lean: lean,
    max: maxNoOfSubpaths - 1,
    options: populate || {}
  }
}

function populate(opts, level, cb) {
  var docs = opts.docs
    , paths = opts.paths
    , lvlPaths = paths.filter(function (path) { return (path.split('.').length - 1) === level })
    , remained = lvlPaths.length
    , model, path, populateOpts

  while (path = lvlPaths.shift()) {
    model = getModelFromPath(opts.db, opts.model, path)

    if (model != null) {
      populateOpts = extend({}, opts.options[path], {path: path, model: model.modelName})

      if (opts.lean) {
        populateOpts.options = extend({lean: true}, populateOpts.options)
      }

      model.populate(docs, populateOpts, one)
    }
    else one()
  }

  function one(err) {
    if (err) return nextLevel(err)
    if (--remained === 0) nextLevel()
  }

  function nextLevel(err) {
    if (err) return cb(err)
    if (level === opts.max) return cb(null, docs)
    populate(opts, ++level, cb)
  }
}

function getModelFromPath(db, model, path) {
  var schema = model.schema
    , currentPath = null
    , candidateModel = null

  path.split('.').forEach(function (subpath) {
    currentPath = (currentPath ? (currentPath + '.') : '') + subpath
    var schemaPath = schema.paths[currentPath]

    // no schema, possibly a subdocument, continues to find out
    if (!schemaPath) {
      candidateModel = null
      return
    }

    // found a schema, resets current path
    currentPath = null

    // dereferences if linked documents
    if (schemaPath.caster && schemaPath.caster.options) {
      schemaPath = schemaPath.caster
    }

    // if linked document(s), extract model and schema
    if (schemaPath.options && schemaPath.options.ref) {
      candidateModel = db.model(schemaPath.options.ref)
      schema = candidateModel.schema
    }

    // else, subdocuments => no model but has schema
    else {
      candidateModel = null
      schema = schemaPath.schema
    }
  })

  return candidateModel
}

// Breaks ['a.b.c', ...] to ['a', 'a.b', 'a.b.c', ...]
function deconstruct(paths) {
  var _paths = []

  paths.forEach(function (path) {
    var currentPath = null
    path.split('.').forEach(function (subpath) {
      currentPath = (currentPath ? (currentPath + '.') : '') + subpath.trim()
      _paths.push(currentPath)
    })
  })

  return _paths
}

function normalize(paths) {
  return paths
    .map(function (path) { return path.trim() })
    .filter(function (path) { return path !== '' })
    .filter(function (path, index, self) { return self.indexOf(path) === index }) // removes duplicates
}

function extend(target) {
  var src
  for (var i = 1, l = arguments.length; i < l; i++) {
    src = arguments[i]
    for (var k in src) target[k] = src[k]
  }
  return target
}

function isArray(obj) {
  return Object.prototype.toString.call(obj) === '[object Array]'
}

function isFunction(obj) {
  return Object.prototype.toString.call(obj) === '[object Function]'
}

function noop() {}
