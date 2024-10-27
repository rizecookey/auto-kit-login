import fs from 'fs-extra'
import path from 'path'
import esbuild from 'esbuild'
import { argv } from 'process';
import { sassPlugin } from 'esbuild-sass-plugin'

const PLATFORM_SRC = 'platform_src/';
const SRC_DIR = 'src/';
const CACHE_DIR = '.build/';
const BUILD_SRC_COPY_DIR = '.build/src/'
const OUT_DIR = 'dist/';

const PLATFORMS = ['chrome', 'firefox'];
const FINAL_FILES = [
    "authenticator/authenticating.html",
    "authenticator/authenticating.css",
    "authenticator/authentication.ts",
    "background/background.ts",
    "content/auto_submit.ts",
    "common_style.scss",
    "popup/popup.ts",
    "popup/popup.html",
    "popup/popup.css",
    "manifest.json",
    "kit_cookie.png"
]

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

        const platformDir = path.join(PLATFORM_SRC, platform);
        fs.copySync(SRC_DIR, BUILD_SRC_COPY_DIR);
        fs.copySync(platformDir, BUILD_SRC_COPY_DIR, { overwrite: true });
        logBuildStep(`copied src`, `${SRC_DIR}, ${platformDir} > ${BUILD_SRC_COPY_DIR}`);
        await bundle(BUILD_SRC_COPY_DIR, FINAL_FILES, path.join(OUT_DIR, platform));
    }
}

async function bundle(srcDir, finalFiles, outDir) {
    logBuildStep('bundling', `${srcDir}`);
    await esbuild.build({
        entryPoints: finalFiles.map(file => path.join(srcDir, file)),
        minify: mode == 'release' ? true : false,
        bundle: true,
        platform: 'browser',
        loader: {
            '.png': 'copy',
            '.html': 'copy',
            '.json': 'copy',
            '.ttf': 'copy'
        },
        plugins: [sassPlugin({silenceDeprecations: ['import', 'global-builtin', 'mixed-decls', 'color-functions']})], // deprecations caused by bootstrap
        outbase: srcDir,
        outdir: outDir
    });
    logBuildStep('bundled', `${srcDir} > ${outDir}`);
}

mode = argv[2];
build();