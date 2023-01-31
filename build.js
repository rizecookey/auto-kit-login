const fs = require('fs');
const path = require('path');
const browserify = require('browserify');

const LOG_COMMAND_LENGTH = 12;
const PLATFORM_SRC = 'platform_src/';
const SRC_DIR = 'src/';
const OUT_DIR = 'dist/';
const PLATFORMS = ['chrome', 'firefox'];
const FINAL_SCRIPTS = [
    "auth_scrape.js",
    "background.js",
    "grab_login.js"
];

async function build() {
    console.log('Building...');

    if (fs.existsSync(OUT_DIR)) {
        fs.rmSync(OUT_DIR, { recursive: true, force: true });
        console.log(`${pad("cleared")} ${OUT_DIR}`);
    }
    fs.mkdirSync(OUT_DIR);

    for (let platform of PLATFORMS) {
        let platformDir = platform + "/";
        await buildDist([SRC_DIR, PLATFORM_SRC + platformDir], OUT_DIR + platformDir, FINAL_SCRIPTS);
    }
}

function readdirRecursive(path) {
    let files = [];
    for (let file of fs.readdirSync(path)) {
        files.push(file);
        if (fs.lstatSync(path + file).isDirectory()) {
            readdirRecursive(path + file + "/")
                .map(elem => file + "/" + elem)
                .forEach(elem => {
                    files.push(elem);
                });
        }
    }
    return files;
}

function pad(text) {
    let output = text;
    for (let i = 0; i <= LOG_COMMAND_LENGTH - text.length; i++) {
        output += " ";
    }
    return output;
}

function bundle(input, additionalSources, output) {
    let outStream = fs.createWriteStream(output);
    return new Promise((resolve) =>
        browserify(input, {
            paths: additionalSources
        }).bundle().pipe(outStream).on('finish', () => resolve()));
}

async function buildDist(srcDirs, outDir, finalScripts) {
    fs.mkdirSync(outDir)
    for (let srcDir of srcDirs) {
        for (let file of readdirRecursive(srcDir)) {
            let srcFile = srcDir + file;
            let outFile = outDir + file;

            if (fs.lstatSync(srcFile).isDirectory()) {
                if (!fs.existsSync(outFile)) {
                    fs.mkdirSync(outFile);
                    console.log(`${pad("created")} ${outFile}`);
                }
                continue;
            }

            if (file.endsWith('.js')) {
                if (finalScripts.find(elem => file == elem)) {
                    console.log(`${pad("bundling")} ${srcFile}`);
                    await bundle(srcFile, srcDirs, outFile);
                    console.log(`${pad("bundled")} ${srcFile} > ${outFile}`);
                }
                continue;
            }

            fs.copyFileSync(srcFile, outFile);
            console.log(`${pad("copied")} ${srcFile} > ${outFile}`);
        }
    }
}

build();