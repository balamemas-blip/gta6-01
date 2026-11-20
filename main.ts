// Solmar Heat — the gta6-01 entry program (Node 22, standard library only).
//
// What it does: takes this repository — the game under game/, the
// screenshots under screenshots/ — and hands it to the grader by writing
// the same files to /output plus /output/dossier.json, the summary the
// judge reads, built with the vendored make.fun library.
//
// Run it outside the grader with MAKEFUN_OUTPUT_DIR standing in for
// /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Run it twice into two directories and the bytes must match exactly:
// the program is deterministic (plain file copies, no timestamps in the
// dossier), so a diff of the two runs should be empty.
//
// The game itself: Solmar Heat, an original top-down open-world crime game
// in the fictional city of Solmar. Explore on foot and by car, steal cars,
// dodge traffic and pedestrians, outrun the police at five wanted levels,
// and finish five story jobs to become a Solmar Legend. HUD with minimap,
// save via localStorage, synthesized WebAudio sound, title / pause / win /
// busted screens. Serve it locally with `node serve.ts` and open
// http://localhost:8080.

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Repository root: the directory this file lives in.
const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)));

// Grader's writable output; MAKEFUN_OUTPUT_DIR stands in for /output
// when the program runs on a developer machine.
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

// Copy a directory tree file by file (plain files only, no symlinks),
// creating destination directories as needed. Returns the file count.
function copyTree(srcDir, destDir) {
  let copied = 0;
  mkdirSync(destDir, { recursive: true });
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    const src = join(srcDir, entry.name);
    const dest = join(destDir, entry.name);
    if (entry.isDirectory()) {
      copied += copyTree(src, dest);
    } else if (entry.isFile()) {
      copyFileSync(src, dest);
      copied += 1;
    }
    // Anything else (symlink, socket, ...) is skipped: the gate only
    // accepts plain files and directories under game/ anyway.
  }
  return copied;
}

const gameDir = join(repoRoot, 'game');
if (!existsSync(join(gameDir, 'index.html'))) {
  throw new Error('game/index.html is missing — the entry has no game to hand in');
}

mkdirSync(outDir, { recursive: true });
const gameFiles = copyTree(gameDir, join(outDir, 'game'));

let shotFiles = 0;
const shotsDir = join(repoRoot, 'screenshots');
if (existsSync(shotsDir)) {
  shotFiles = copyTree(shotsDir, join(outDir, 'screenshots'));
} else {
  mkdirSync(join(outDir, 'screenshots'), { recursive: true });
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes
// the bytes; the other limits refuse an entry the scorer would refuse
// (more than 4 screenshots or one over 256 KiB; more than 993 files in
// game/ or 48 MiB of game files in all, or a path under game/ over 1000
// bytes — game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

console.log(`Solmar Heat: ${gameFiles} game files, ${shotFiles} screenshots -> ${outDir}`);
console.log(`dossier.json: ${Buffer.byteLength(dossier, 'utf8')} bytes`);
