const fs = require('fs');
const browserify = require('browserify');

const LOG_COMMAND_LENGTH = 12;
const SRC_DIR = 'src/';
const OUT_DIR = 'dist/';

async function build() {
    console.log('Building...');

    if (!fs.existsSync(OUT_DIR)) {
        fs.mkdirSync(OUT_DIR);
    }

    for (let file of fs.readdirSync(SRC_DIR)) {
        let srcFile = SRC_DIR + file;
        let outFile = OUT_DIR + file;

        if (fs.lstatSync(srcFile).isDirectory()) {
            fs.mkdirSync(outFile);
            console.log(`${pad("created")} ${outFile}`);
            continue;
        }

        if (fs.existsSync(outFile)) {
            fs.rmSync(outFile);
            console.log(`${pad("deleted")} ${outFile}`);
        }

        if (file.endsWith('.js')) {
            console.log(`${pad("bundling")} ${srcFile}`);
            await bundle(srcFile, outFile);
            console.log(`${pad("bundled")} ${srcFile} > ${outFile}`);
            continue;
        }

        fs.copyFileSync(srcFile, outFile);
        console.log(`${pad("copied")} ${srcFile} > ${outFile}`);
    }
}

function pad(text) {
    let output = text;
    for (let i = 0; i <= LOG_COMMAND_LENGTH - text.length; i++) {
        output += " ";
    }
    return output;
}

function bundle(input, output) {
    let outStream = fs.createWriteStream(output);
    return new Promise((resolve, reject) => 
        browserify(input).bundle().pipe(outStream)
            .on('finish', () => {
                resolve();
            }
        )
    );
}

build();