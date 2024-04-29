const fs = require('fs-extra');
const path = require('path');
const browserify = require('browserify');

const LOG_COMMAND_LENGTH = 12;
const PLATFORM_SRC = 'platform_src/';
const SRC_DIR = 'src/';
const CACHE_DIR = '.build/';
const OUT_DIR = 'dist/';
const PLATFORMS = ['chrome', 'firefox'];
const FINAL_SCRIPTS = [
    "authenticator/authentication.js",
    "background/background.js",
    "popup/popup.js"
];

async function build() {
    console.log('Building...');

    if (fs.existsSync(OUT_DIR)) {
        fs.rmSync(OUT_DIR, { recursive: true, force: true });
        console.log(`${pad("cleared")} ${OUT_DIR}`);
    }
    fs.mkdirSync(OUT_DIR);

    for (let platform of PLATFORMS) {
        console.log('');
        console.log(`building for: ${platform}`);
        console.log('');

        if (fs.existsSync(CACHE_DIR)) {
            fs.rmSync(CACHE_DIR, { recursive: true, force: true });
            console.log(`${pad('cleared')} ${CACHE_DIR}`);
        }
        fs.mkdirSync(CACHE_DIR);

        const platformDir = platform + "/";
        fs.copySync(SRC_DIR, CACHE_DIR);
        fs.copySync(PLATFORM_SRC + platformDir, CACHE_DIR, { overwrite: true });
        console.log(`${pad('copied src')} > ${CACHE_DIR}`);
        await buildDist([CACHE_DIR], OUT_DIR + platformDir, FINAL_SCRIPTS);
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
    fs.mkdirSync(outDir);
    for (let srcDir of srcDirs) {
        for (let file of readdirRecursive(srcDir)) {
            let srcFile = srcDir + file;
            let outFile = outDir + file;

            if (fs.lstatSync(srcFile).isDirectory()) {
                if (fs.existsSync(outFile)) {
                    continue;
                }
                fs.mkdirSync(outFile);
                console.log(`${pad("created")} ${outFile}`);
                continue;
            }

            if (file.endsWith('.js')) {
                if (!finalScripts.find(elem => file == elem)) {
                    continue;
                }
                console.log(`${pad("bundling")} ${srcFile}`);
                await bundle(srcFile, srcDirs, outFile);
                console.log(`${pad("bundled")} ${srcFile} > ${outFile}`);
                continue;
            }

            fs.copyFileSync(srcFile, outFile);
            console.log(`${pad("copied")} ${srcFile} > ${outFile}`);
        }
    }
}

build();