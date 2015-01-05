var gulp      = require('gulp')
  , mongoose  = require('mongoose')
  , es        = require('event-stream')
  , series    = require('stream-series')
  , $         = require('gulp-load-plugins')()
  , parseArgs = require('minimist')
  , fs        = require('fs')

function pipe(src, transforms, dest) {
  if (typeof transforms === 'string') {
    dest = transforms
    transforms = null
  }
  var stream = src.pipe ? src : gulp.src(src)
  transforms && transforms.forEach(function (transform) {
    stream = stream.pipe(transform)
  })
  if (dest) stream = stream.pipe(gulp.dest(dest))
  return stream
}

gulp.task('default', ['test', 'jshint'])

gulp.task('test', ['dropdb'], function () {
  return pipe('./test/**/*.js', [$.mocha({reporter: 'spec'}), $.exit()])
})

gulp.task('dropdb', function (cb) {
  var dbUrl = process.env.TEST_DB = parseArgs(process.argv)['db']
  if (!dbUrl) return cb(new Error('Full database URL must be specified via --db'));
  mongoose.connect(dbUrl, function (err) {
    if (err) return cb(err)
    mongoose.connection.db.dropDatabase(function (err) {
      if (err) return cb(err)
      mongoose.disconnect(cb)
    })
  })
})

gulp.task('jshint', function () {
  return pipe(['./lib/**/*.js'], [$.jshint(), $.jshint.reporter('jshint-stylish')])
})
