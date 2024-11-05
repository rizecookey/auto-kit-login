import fs from 'fs-extra'
import path from 'path'
import esbuild from 'esbuild'
import { argv } from 'process';
import { sassPlugin } from 'esbuild-sass-plugin'
import webExt from 'web-ext'
import { globSync } from 'glob'

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
    "content/**/*",
    "common_style.scss",
    "popup/popup.*",
    "manifest.json",
    "kit_cookie.png"
];

const PACKAGE_JSON = JSON.parse(fs.readFileSync('./package.json'));

const EXPANSIONS = {
    'name': 'Auto KIT Login',
    'description': PACKAGE_JSON.description,
    'version': PACKAGE_JSON.version
};

let mode;

const ACTION_MAX_LENGTH = 20;
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

        clear(CACHE_DIR);
        prepareSource(SRC_DIR, PLATFORM_SRC, platform, BUILD_SRC_COPY_DIR);
        const manifestFile = path.join(BUILD_SRC_COPY_DIR, 'manifest.json');
        expandManifest(manifestFile, EXPANSIONS);

        await bundle(BUILD_SRC_COPY_DIR, FINAL_FILES, path.join(OUT_DIR, platform));

        let packageName = `${PACKAGE_JSON.name}-${PACKAGE_JSON.version}-${platform}`
        await packExtension(path.join(OUT_DIR, platform), OUT_DIR, packageName);
    }
}

function clear(cacheDir) {
    if (fs.existsSync(cacheDir)) {
        fs.rmSync(cacheDir, { recursive: true, force: true });
        logBuildStep('cleared', cacheDir);
    }
    fs.mkdirSync(cacheDir);
}

function prepareSource(srcDir, platformSrc, platform, destDir) {
    const platformDir = path.join(platformSrc, platform);
    fs.copySync(srcDir, destDir);
    fs.copySync(platformDir, destDir, { overwrite: true });
    logBuildStep('copied src', `${srcDir}, ${platformDir} > ${destDir}`);
}

function expandManifest(manifestFile, expansions) {
    let manifest = fs.readFileSync(manifestFile, { encoding: 'utf-8' });
    const pattern = /(?<=(?:(?:[^\\]|^)(?:\\\\)*))\$(\w+)\$/gm;
    let matches;
    while ((matches = pattern.exec(manifest)) != null) {
        let match = matches[0];
        let matchIndex = matches.index;
        let expandable = matches[1];
        manifest = manifest.substring(0, matchIndex) + expansions[expandable] + manifest.substring(matchIndex + match.length, manifest.length);
    }
    manifest = manifest.replaceAll('\\\\$', '$');
    fs.writeFile(manifestFile, manifest, { overwrite: true });
    logBuildStep('expanded manifest', manifestFile);
}

async function bundle(srcDir, finalFiles, outDir) {
    logBuildStep('bundling', `${srcDir}`);
    await esbuild.build({
        entryPoints: globSync(finalFiles, { cwd: srcDir, nodir: true }).map(file => path.join(srcDir, file)),
        minify: mode == 'release' ? true : false,
        bundle: true,
        platform: 'browser',
        loader: {
            '.png': 'copy',
            '.html': 'copy',
            '.json': 'copy',
            '.ttf': 'copy'
        },
        plugins: [sassPlugin({ silenceDeprecations: ['import', 'global-builtin', 'mixed-decls', 'color-functions'] })], // deprecations caused by bootstrap
        outbase: srcDir,
        outdir: outDir
    });
    logBuildStep('bundled', `${srcDir} > ${outDir}`);
}

async function packExtension(bundleDir, outDir, packageName) {
    const filename = `${packageName}.zip`;
    const filePath = path.join(outDir, filename);
    logBuildStep('packing', filePath);

    console.log('###################');
    await webExt.cmd.build({
        sourceDir: bundleDir,
        artifactsDir: outDir,
        filename
    }, { shouldExitProgram: false });
    console.log('###################');
    logBuildStep('packaged', filePath);
}

mode = argv[2];
build();