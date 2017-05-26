const gulp = require('gulp');
const babel = require('gulp-babel');

gulp.task('build', () =>
  void gulp.src('./src/index.js')
        .pipe(babel())
        .pipe(gulp.dest(`dist`))
);
