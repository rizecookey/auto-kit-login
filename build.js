const fs = require('fs');
const browserify = require('browserify');

const SRC_DIR = './src/';
const OUT_DIR = './dist/';

if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR);
}

fs.readdirSync(SRC_DIR).forEach(file => {
    if (fs.lstatSync(SRC_DIR + file).isDirectory()) {
        fs.mkdirSync(OUT_DIR + file);
        return;
    }

    if (fs.existsSync(OUT_DIR + file)) {
        fs.rmSync(OUT_DIR + file);
    }

    if (file.endsWith('.js')) {
        let outStream = fs.createWriteStream(OUT_DIR + file);
        browserify().add(SRC_DIR + file).bundle().pipe(outStream);
        return;
    }

    fs.copyFileSync(SRC_DIR + file, OUT_DIR + file);
})