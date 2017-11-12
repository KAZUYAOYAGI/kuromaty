"use strict";

const fs = require("fs");
const del = require("del");
const merge = require("merge2");
const gulp = require("gulp");
const gutil = require("gulp-util");
const sourcemaps = require("gulp-sourcemaps");
const rename = require("gulp-rename");
const uglify = require("gulp-uglify");
const typescript = require("gulp-typescript");
const less = require("gulp-less");
const cleanCSS = require("gulp-clean-css");
const LessAutoprefix = require("less-plugin-autoprefix");
const autoprefix = new LessAutoprefix({ browsers: ["last 2 versions"] });
const browserify = require("browserify");
const babelify = require("babelify");
const source = require("vinyl-source-stream")
const buffer = require("vinyl-buffer");

gulp.task("clean", () => {

    return del.sync([
        "lib/dts",
        "lib/es6",
        "lib/*.js",
        "lib/*.js.map"
    ]);
});

gulp.task("tsc", () => {

    const tsResult = gulp
        .src([
            "src/js/**/*.ts"
        ])
        .pipe(sourcemaps.init())
        .pipe(typescript({
            typescript: require("typescript"),
            target: "es6",
            module: "es6",
            moduleResolution: "node",
            removeComments: false,
            declaration: true
        }));

    const dtsResult = gulp
        .src([
            "src/js/**/*.ts"
        ])
        .pipe(typescript({
            typescript: require("typescript"),
            target: "es6",
            module: "system",
            moduleResolution: "node",
            removeComments: false,
            declaration: true,
            outFile: "kuromaty.js"
        }));

    return merge([
        tsResult
            .js
            .pipe(sourcemaps.write("./"))
            .pipe(gulp.dest("lib/es6")),
        tsResult
            .dts
            .pipe(gulp.dest("lib/es6")),
        dtsResult
            .dts
            .pipe(gulp.dest("lib/dts"))
    ]);
});

gulp.task("browserify", ["tsc"], () => {

    return browserify({
        debug: true,
        entries: "./lib/es6/kuromaty.js",
        extensions: [".js"]
    })
        .transform("babelify", {
            global: true,
            presets: ["es2015"],
            sourceMaps: true
        })
        .bundle()
        .pipe(source("kuromaty.js"))
        .pipe(buffer())
        .pipe(gulp.dest("lib"));
});

gulp.task("split", ["browserify"], () => {

    let source = fs.readFileSync("lib/kuromaty.js", { encoding: "utf8" });

    let data = new Buffer(source.match(/\/\/. sourceMappingURL=[^,]+,(.+)/)[1], "base64").toString("ascii");

    source = source.replace(/\/\/. sourceMappingURL=[^,]+,(.+)/, "//# sourceMappingURL=kuromaty.js.map");

    fs.writeFileSync("lib/kuromaty.js", source);
    fs.writeFileSync("lib/kuromaty.js.map", data);

    return;
});

gulp.task("minify", ["split"], () => {

    return gulp.src("lib/kuromaty.js")
        .pipe(sourcemaps.init())
        .pipe(uglify({
            output: {
                comments: /^!/
            }
        }))
        .on('error', err => { gutil.log(gutil.colors.red('[Error]'), err.toString()); })
        .pipe(rename({
            extname: ".min.js"
        }))
        .pipe(sourcemaps.write("./"))
        .pipe(gulp.dest("lib"));
});

gulp.task("less", () => {

    return gulp
        .src([
            "src/css/kuromaty.less"
        ])
        .pipe(sourcemaps.init())
        .pipe(less({
            plugins: [ autoprefix ]
        }))
        .pipe(cleanCSS())
        .pipe(rename({
            extname: ".min.css"
        }))
        .pipe(sourcemaps.write("./"))
        .pipe(gulp.dest("lib"));
});

gulp.task("build-js", ["minify"]);
gulp.task("build-css", ["less"]);

gulp.task("watch", () => {
    gulp.watch("src/js/**/*.ts", ["build-js"]);
    gulp.watch("src/css/**/*.less", ["build-css"]);
});

gulp.task("build", ["build-js", "build-css"]);

gulp.task("default", ["build"]);
