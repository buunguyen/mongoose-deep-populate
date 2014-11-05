module.exports = deepPopulatePlugin

function deepPopulatePlugin(schema, options) {
  options = options || {}
  if (options.whitelist) options.whitelist = normalize(deconstruct(options.whitelist))

  schema.methods.deepPopulate = function (paths, cb) {
    cb = cb || function() {}
    populate(createOptions(this.constructor, this, paths), 0, cb)
  }

  schema.statics.deepPopulate = function (docs, paths, cb) {
    cb = cb || function() {}
    if (!docs && !docs.length) return cb(null, docs)
    populate(createOptions(this, docs, paths), 0, cb)
  }

  function createOptions(model, docs, paths) {
    paths = normalize((isArray(paths) ? paths : (paths || '').split(',')))
    if (options.rewrite) paths = paths.map(function (path) { return options.rewrite[path] || path })
    paths = normalize(deconstruct(paths))
    if (options.whitelist) paths = paths.filter(function (path) { return ~options.whitelist.indexOf(path) })

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
      db      : db,
      model   : model,
      docs    : docs,
      paths   : paths,
      maxLevel: maxNoOfSubpaths - 1
    }
  }
}

function populate(opts, level, cb) {
  if (level === 0 && opts.paths.length === 0) return cb(null, opts.docs)

  var currentPaths = opts.paths.filter(function (path) { return (path.split('.').length - 1) === level })
    , remained = currentPaths.length
    , model, path

  while (path = currentPaths.shift()) {
    model = getModelFromPath(opts.db, opts.model, path)
    model ? model.populate(opts.docs, path, one) : one()
  }

  function one(err) {
    if (err) return nextLevel(err)
    if (--remained === 0) nextLevel()
  }

  function nextLevel(err) {
    if (err) return cb(err)
    if (level === opts.maxLevel) return cb(null, opts.docs)
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

    // no schema, possibly a subdocument, continue to find out
    if (!schemaPath) return

    // found a schema, resets current path
    currentPath = null

    // dereferences if document array
    if (schemaPath.caster && schemaPath.caster.options) schemaPath = schemaPath.caster

    // linked document(s)
    if (schemaPath.options && schemaPath.options.ref) {
      candidateModel = db.model(schemaPath.options.ref)
      schema = candidateModel.schema
    }

    // else, subdocuments => no model
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

function isArray(obj) {
  return Object.prototype.toString.call(obj) === '[object Array]'
}
