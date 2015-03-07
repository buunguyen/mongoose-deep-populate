var gulp      = require('gulp')
  , mongoose  = require('mongoose')
  , $         = require('gulp-load-plugins')()
  , parseArgs = require('minimist')

gulp.task('default', ['test', 'jshint'])

gulp.task('test', ['dropdb'], function () {
  return gulp.src('./test/**/*.js')
             .pipe($.mocha({reporter: 'spec'}))
             .pipe($.exit())
})

gulp.task('dropdb', function (cb) {
  var dbUrl = process.env.TEST_DB = parseArgs(process.argv)['db']
  if (!dbUrl) return cb(new Error('Connection string must be specified via --db'));
  mongoose.connect(dbUrl, function (err) {
    if (err) return cb(err)
    mongoose.connection.db.dropDatabase(function (err) {
      if (err) return cb(err)
      mongoose.disconnect(cb)
    })
  })
})

gulp.task('jshint', function () {
  return gulp.src('./lib/**/*.js')
             .pipe($.jshint())
             .pipe($.jshint.reporter('jshint-stylish'))
})
