/**
 * Compare two capsule PNGs: side‑by‑side strip + normalized diff metric.
 * From repo root: node scripts/compare-capsule-visual.js
 *
 * Paths: CAPSULE_IMG_A, CAPSULE_IMG_B env override defaults (Cursor‑saved PNGs).
 */
const fs = require('fs');
const path = require('path');
const { Jimp, diff, rgbaToInt } = require('jimp');

const DEFAULT_A =
  'C:/Users/asus/.cursor/projects/c-Users-asus-bmad-card/assets/c__Users_asus_AppData_Roaming_Cursor_User_workspaceStorage_21efa850dddde0d32cbc0b558184a7a1_images_____-0e70caa7-172b-4fd1-9e34-d928bd4b2d50.png';

const DEFAULT_B =
  'C:/Users/asus/.cursor/projects/c-Users-asus-bmad-card/assets/c__Users_asus_AppData_Roaming_Cursor_User_workspaceStorage_21efa850dddde0d32cbc0b558184a7a1_images_Gemini_Generated_Image_uhgqbmuhgqbmuhgq-18317e6d-6a4a-4de1-934c-1031f41910ef.png';

const SRC_A = process.env.CAPSULE_IMG_A || DEFAULT_A;
const SRC_B = process.env.CAPSULE_IMG_B || DEFAULT_B;

const OUT_DIR = path.join(__dirname, '..', 'assets', 'visual-compare');

/** @param {import('jimp').Jimp} j */
function flattenOnWhite(j) {
  const bg = new Jimp({
    width: j.width,
    height: j.height,
    color: rgbaToInt(255, 255, 255, 255),
  });
  bg.composite(j, 0, 0);
  return bg;
}

async function main() {
  for (const p of [SRC_A, SRC_B]) {
    if (!fs.existsSync(p)) {
      console.error(`Missing image: ${p}`);
      console.error('Set CAPSULE_IMG_A / CAPSULE_IMG_B.');
      process.exit(1);
    }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const rawA = await Jimp.read(SRC_A);
  const rawB = await Jimp.read(SRC_B);

  const wA = rawA.width;
  const hA = rawA.height;
  const wB = rawB.width;
  const hB = rawB.height;
  console.log(`A: ${wA}x${hA}`);
  console.log(`B: ${wB}x${hB}`);
  const sameDims = wA === wB && hA === hB;
  console.log(`Same dimensions: ${sameDims}`);

  const flatA = flattenOnWhite(rawA);
  const flatB = flattenOnWhite(rawB);

  const sensitivity = Number(process.env.CAPSULE_DIFF_THRESHOLD || '0.1');
  const result = diff(flatA, flatB, sensitivity);
  const diffPercent = result.percent * 100;

  const pad = 12;
  const w = flatA.width;
  const h = flatA.height;
  const stripW = w * 3 + pad * 4;
  const stripH = h + pad * 2;

  const strip = new Jimp({
    width: stripW,
    height: stripH,
    color: rgbaToInt(52, 52, 54, 255),
  });

  strip.composite(rawA, pad, pad);
  strip.composite(rawB, pad * 2 + w, pad);
  strip.composite(result.image, pad * 3 + w * 2, pad);

  const outStrip = path.join(OUT_DIR, 'capsule-triple-strip.png');
  const outDiffOnly = path.join(OUT_DIR, 'capsule-diff-only.png');

  await strip.write(outStrip);
  await result.image.write(outDiffOnly);

  const summary = {
    sourceA: SRC_A,
    sourceB: SRC_B,
    widthHeightA: `${wA}x${hA}`,
    widthHeightB: `${wB}x${hB}`,
    sameDimensions: sameDims,
    diffThreshold: sensitivity,
    diffPercentFlattenedRgb: Number(diffPercent.toFixed(4)),
    note:
      'Diff is computed on images flattened onto white so transparent regions do not skew the metric.',
    outputs: [path.relative(process.cwd(), outStrip), path.relative(process.cwd(), outDiffOnly)],
  };

  const summaryPath = path.join(OUT_DIR, 'capsule-diff-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  console.log(`Diff (~flattened to white): ${diffPercent.toFixed(2)}% of pixels over threshold`);
  console.log(`Written: ${outStrip}`);
  console.log(`Written: ${outDiffOnly}`);
  console.log(`Written: ${summaryPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
