import fs from 'fs-extra'
import path from 'path'
import esbuild from 'esbuild'
import { argv } from 'process';

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

let mode;

const ACTION_MAX_LENGTH = 15;
async function logBuildStep(action, message) {
    console.log(`${actionPad(action)} ${message}`);
}

function actionPad(text) {
    return text + ' '.repeat(ACTION_MAX_LENGTH - text.length);
}

async function build() {
    console.log(`Building... (mode: ${mode})`);

    if (fs.existsSync(OUT_DIR)) {
        fs.rmSync(OUT_DIR, { recursive: true, force: true });
        logBuildStep('cleared', OUT_DIR);
    }
    fs.mkdirSync(OUT_DIR);

    for (let platform of PLATFORMS) {
        console.log('');
        console.log(`building for: ${platform}`);
        console.log('');

        if (fs.existsSync(CACHE_DIR)) {
            fs.rmSync(CACHE_DIR, { recursive: true, force: true });
            logBuildStep('cleared', CACHE_DIR);
        }
        fs.mkdirSync(CACHE_DIR);

        const platformDir = path.resolve(PLATFORM_SRC, platform);
        fs.copySync(SRC_DIR, CACHE_DIR);
        fs.copySync(platformDir, CACHE_DIR, { overwrite: true });
        logBuildStep(`copied src to`, CACHE_DIR);
        await buildDist(CACHE_DIR, path.join(OUT_DIR, platform), FINAL_SCRIPTS);
    }
}

async function bundle(srcDir, input, output) {
    await esbuild.build({
        entryPoints: [input],
        minify: mode == 'release' ? true : false,
        bundle: true,
        outfile: output
    });
}

async function buildDist(srcDir, outDir, finalScripts) {
    fs.mkdirSync(outDir);
    let promises = []
    for (let file of fs.readdirSync(srcDir, { recursive: true })) {
        let srcFile = path.join(srcDir, file);
        let outFile = path.join(outDir, file);

        promises.push(buildDistSingle(srcDir, srcFile, outFile, finalScripts));
    }

    await Promise.all(promises);
}

async function buildDistSingle(srcDir, srcPath, outPath, finalScripts) {
    if ((await fs.lstat(srcPath)).isDirectory()) {
        return;
    }

    let isScriptFile = srcPath.endsWith('.js') || srcPath.endsWith('.ts');
    if (isScriptFile && !finalScripts.find(elem => path.join(srcDir, elem) == path.join(srcPath))) {
        return;
    }

    let outDir = path.dirname(outPath);
    if (!(await fs.exists(outDir))) {
        await fs.mkdirs(outDir);
    }

    if (!isScriptFile) {
        await fs.copyFile(srcPath, outPath);
        logBuildStep('copied', `${srcPath} > ${outPath}`);
        return;
    }

    logBuildStep('bundling', srcPath);
    await bundle(srcDir, srcPath, outPath);
    logBuildStep('bundled', `${srcPath} > ${outPath}`);
}

mode = argv[2];
build();