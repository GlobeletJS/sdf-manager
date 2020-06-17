import potpack from 'potpack';
import { AlphaImage } from "./alpha-image.js";

const padding = 1; // TODO: name is too general to be global?

export function buildAtlas(fonts) {
  // See mapbox-gl-js/src/render/glyph_atlas.js

  // Collect all the glyph metrics, and add bitmap rectangles
  const positions = {};
  const rects = []; // Temporary list of links to positions[font][id].rect
  Object.keys(fonts).forEach(font => {
    let fontPos = positions[font] = {};
    let glyphs = Object.values(fonts[font]);
    glyphs.forEach(glyph => addGlyphRect(glyph, fontPos, rects));
  });

  // Figure out how to pack all the bitmaps into one image
  // NOTE: modifies the rects in the positions object, in place!
  const { w, h } = potpack(rects);

  // Using the updated rects, copy all the bitmaps into one image
  const image = new AlphaImage({ width: w || 1, height: h || 1 });
  Object.keys(fonts).forEach(font => {
    let fontPos = positions[font];
    let glyphs = Object.values(fonts[font]);
    glyphs.forEach(glyph => copyGlyphBitmap(glyph, fontPos, image));
  });

  return { image, positions };
}

function addGlyphRect(glyph, positions, rects) {
  let { id, bitmap: { width, height }, metrics } = glyph;
  if (width === 0 || height === 0) return;

  // Construct a preliminary rect, positioned at the origin for now
  let w = width + 2 * padding;
  let h = height + 2 * padding;
  let rect = { x: 0, y: 0, w, h };

  positions[id] = { rect, metrics };
  rects.push(rect);
}

function copyGlyphBitmap(glyph, positions, image) {
  let { id, bitmap, metrics } = glyph;
  let position = positions[id];
  if (!position) return;

  let srcPt = { x: 0, y: 0 };
  let { x, y } = position.rect;
  let dstPt = { x: x + padding, y: y + padding };
  AlphaImage.copy(bitmap, image, srcPt, dstPt, bitmap);
}
