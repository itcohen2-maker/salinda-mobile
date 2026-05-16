/**
 * Match green capsule graphic footprint to RED capsule FOOTPRINT:
 * Uses rim mean RGB (“checkerboard flattened” background),
 * FG bbox from RED drives output cell size/placement on a 1024×774 PNG.
 * Greens are cropped by their OWN FG bbox, then scaleToFit + center into RED’s cell,
 * pasted at RED’s FG top‑left — so outer capsule uses identical layout slot as red.
 *
 * Env: CAPSULE_IMG_A, CAPSULE_IMG_B, EDGE_BORDER (24), FG_RGB_DIST_THRESH (48),
 *      OUT_W (1024), OUT_H (774).
 *
 * Run: node scripts/normalize-green-capsule-to-red-bbox.js
 */
const fs = require('fs');
const path = require('path');
const { Jimp, rgbaToInt } = require('jimp');
const { clone } = require('@jimp/utils');

const DEFAULT_A =
  'C:/Users/asus/.cursor/projects/c-Users-asus-bmad-card/assets/c__Users_asus_AppData_Roaming_Cursor_User_workspaceStorage_21efa850dddde0d32cbc0b558184a7a1_images_____-0e70caa7-172b-4fd1-9e34-d928bd4b2d50.png';

const DEFAULT_B =
  'C:/Users/asus/.cursor/projects/c-Users-asus-bmad-card/assets/c__Users_asus_AppData_Roaming_Cursor_User_workspaceStorage_21efa850dddde0d32cbc0b558184a7a1_images_Gemini_Generated_Image_uhgqbmuhgqbmuhgq-18317e6d-6a4a-4de1-934c-1031f41910ef.png';

const RED_SRC = process.env.CAPSULE_IMG_A || DEFAULT_A;
const GREEN_SRC = process.env.CAPSULE_IMG_B || DEFAULT_B;

const OUT_DIR = path.join(__dirname, '..', 'assets', 'capsules');
const EDGE_BORDER = Number(process.env.EDGE_BORDER ?? '24');
const FG_THRESH = Number(process.env.FG_RGB_DIST_THRESH ?? '48');
const OUT_CANVAS_W = Number(process.env.OUT_W ?? '1024');
const OUT_CANVAS_H = Number(process.env.OUT_H ?? '774');
const FG_SQ = FG_THRESH * FG_THRESH;

const TRANSPARENT = rgbaToInt(0, 0, 0, 0);

/** @param {import('jimp').Jimp} img */
function meanEdgeRgb(img, border) {
  const w = img.width;
  const h = img.height;
  const { data } = img.bitmap;
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let n = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x < border || x >= w - border || y < border || y >= h - border) {
        const i = (w * y + x) << 2;
        sr += data[i];
        sg += data[i + 1];
        sb += data[i + 2];
        n++;
      }
    }
  }
  return { r: sr / n, g: sg / n, b: sb / n };
}

/**
 * FG pixels: RGB farther than sqrt(thSq) from `bg`.
 * @param {import('jimp').Jimp} img
 */
function foregroundBBoxRgb(img, bg, thSq) {
  const w = img.width;
  const h = img.height;
  const { data } = img.bitmap;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;

  const br = bg.r;
  const bv = bg.g;
  const bb = bg.b;

  for (let y = 0; y < h; y++) {
    const row = w * y * 4;
    for (let x = 0; x < w; x++) {
      const i = row + (x << 2);
      const dr = data[i] - br;
      const dg = data[i + 1] - bv;
      const db = data[i + 2] - bb;
      if (dr * dr + dg * dg + db * db > thSq) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) throw new Error('foregroundBBoxRgb empty');
  return {
    minX,
    minY,
    maxX,
    maxY,
    w: maxX - minX + 1,
    h: maxY - minY + 1,
  };
}

/**
 * @param {import('jimp').Jimp} image
 */
function cropBox(image, b) {
  const j = clone(image);
  return j.crop({ x: b.minX, y: b.minY, w: b.w, h: b.h });
}

/**
 * @param {import('jimp').Jimp} cropped
 */
function composeOnCanvas(cropped, cw, ch, ox, oy) {
  const canvas = new Jimp({
    width: cw,
    height: ch,
    color: TRANSPARENT,
  });
  canvas.composite(cropped, ox, oy);
  return canvas;
}

/**
 * @param {import('jimp').Jimp} scaledInner must be ≤ plate w/h
 */
function centerOnPlate(scaledInner, plateW, plateH) {
  const plate = new Jimp({
    width: plateW,
    height: plateH,
    color: TRANSPARENT,
  });
  plate.composite(
    scaledInner,
    Math.floor((plateW - scaledInner.width) / 2),
    Math.floor((plateH - scaledInner.height) / 2),
  );
  return plate;
}

async function main() {
  if (!fs.existsSync(RED_SRC) || !fs.existsSync(GREEN_SRC)) {
    console.error('Missing PNG. Set CAPSULE_IMG_A / CAPSULE_IMG_B.');
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const red = await Jimp.read(RED_SRC);
  const green = await Jimp.read(GREEN_SRC);

  const mr = meanEdgeRgb(red, EDGE_BORDER);
  const mg = meanEdgeRgb(green, EDGE_BORDER);
  const boxR = foregroundBBoxRgb(red, mr, FG_SQ);
  const boxG = foregroundBBoxRgb(green, mg, FG_SQ);

  const croppedR = cropBox(red, boxR);

  const gc = cropBox(green, boxG);
  gc.scaleToFit({ w: boxR.w, h: boxR.h });
  const greenPlate = centerOnPlate(gc, boxR.w, boxR.h);

  const outRed = composeOnCanvas(croppedR, OUT_CANVAS_W, OUT_CANVAS_H, boxR.minX, boxR.minY);
  const outGreen = composeOnCanvas(greenPlate, OUT_CANVAS_W, OUT_CANVAS_H, boxR.minX, boxR.minY);

  const redOutPath = path.join(OUT_DIR, 'red-math-capsule-shared-layout-1024x774.png');
  const greenOutPath = path.join(OUT_DIR, 'green-poker-table-matched-red-layout-1024x774.png');
  const cropRedOnly = path.join(OUT_DIR, 'red-math-cell-cropped.png');
  const cropGreenMatched = path.join(OUT_DIR, 'green-poker-matched-cell-cropped.png');

  await outRed.write(redOutPath);
  await outGreen.write(greenOutPath);
  await croppedR.write(cropRedOnly);
  await greenPlate.write(cropGreenMatched);

  const sameNativeCell = boxR.w === boxG.w && boxR.h === boxG.h && boxR.minX === boxG.minX && boxR.minY === boxG.minY;

  const meta = {
    edgeBorderPx: EDGE_BORDER,
    fgRgbDistThresh: FG_THRESH,
    redEdgeMeanRgb: mr,
    greenEdgeMeanRgb: mg,
    redForegroundBox: boxR,
    greenForegroundBox: boxG,
    greenNativeFgMatchesRedFgBox: sameNativeCell,
    canvas: `${OUT_CANVAS_W}x${OUT_CANVAS_H}`,
    pastedAt: { x: boxR.minX, y: boxR.minY },
    outputs: {
      red1024x774TransparentPad: redOutPath,
      green1024x774Matched: greenOutPath,
      redCellOnlyPng: cropRedOnly,
      greenMatchedCellOnlyPng: cropGreenMatched,
    },
    note:
      'Opaque PNG edges; FG box uses rim-mean chroma separation. Identity scale when FG boxes coincide (your assets).',
  };

  fs.writeFileSync(path.join(OUT_DIR, 'capsule-shared-bbox-metadata.json'), JSON.stringify(meta, null, 2));

  console.log(JSON.stringify(meta, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
