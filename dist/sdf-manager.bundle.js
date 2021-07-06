import Protobuf from 'pbf';

class AlphaImage {
  // See maplibre-gl-js/src/util/image.js
  constructor(size, data) {
    createImage(this, size, 1, data);
  }

  resize(size) {
    resizeImage(this, size, 1);
  }

  clone() {
    return new AlphaImage(
      { width: this.width, height: this.height },
      new Uint8Array(this.data)
    );
  }

  static copy(srcImg, dstImg, srcPt, dstPt, size) {
    copyImage(srcImg, dstImg, srcPt, dstPt, size, 1);
  }
}

function createImage(image, { width, height }, channels, data) {
  if (!data) {
    data = new Uint8Array(width * height * channels);
  } else if (data.length !== width * height * channels) {
    throw new RangeError("mismatched image size");
  }
  return Object.assign(image, { width, height, data });
}

function resizeImage(image, { width, height }, channels) {
  if (width === image.width && height === image.height) return;

  const size = {
    width: Math.min(image.width, width),
    height: Math.min(image.height, height),
  };

  const newImage = createImage({}, { width, height }, channels);

  copyImage(image, newImage, { x: 0, y: 0 }, { x: 0, y: 0 }, size, channels);

  Object.assign(image, { width, height, data: newImage.data });
}

function copyImage(srcImg, dstImg, srcPt, dstPt, size, channels) {
  if (size.width === 0 || size.height === 0) return dstImg;

  if (outOfRange(srcPt, size, srcImg)) {
    throw new RangeError("out of range source coordinates for image copy");
  }
  if (outOfRange(dstPt, size, dstImg)) {
    throw new RangeError("out of range destination coordinates for image copy");
  }

  const srcData = srcImg.data;
  const dstData = dstImg.data;

  console.assert(
    srcData !== dstData,
    "copyImage: src and dst data are identical!"
  );

  for (let y = 0; y < size.height; y++) {
    const srcOffset = ((srcPt.y + y) * srcImg.width + srcPt.x) * channels;
    const dstOffset = ((dstPt.y + y) * dstImg.width + dstPt.x) * channels;
    for (let i = 0; i < size.width * channels; i++) {
      dstData[dstOffset + i] = srcData[srcOffset + i];
    }
  }

  return dstImg;
}

function outOfRange(point, size, image) {
  let { width, height } = size;
  return (
    width > image.width ||
    height > image.height ||
    point.x > image.width - width ||
    point.y > image.height - height
  );
}

const GLYPH_PBF_BORDER = 3;
const ONE_EM = 24;

function parseGlyphPbf(data) {
  // See maplibre-gl-js/src/style/parse_glyph_pbf.js
  // Input is an ArrayBuffer, which will be read as a Uint8Array
  return new Protobuf(data).readFields(readFontstacks, []);
}

function readFontstacks(tag, glyphs, pbf) {
  if (tag === 1) pbf.readMessage(readFontstack, glyphs);
}

function readFontstack(tag, glyphs, pbf) {
  if (tag !== 3) return;

  const glyph = pbf.readMessage(readGlyph, {});
  const { id, bitmap, width, height, left, top, advance } = glyph;

  const borders = 2 * GLYPH_PBF_BORDER;
  const size = { width: width + borders, height: height + borders };

  glyphs.push({
    id,
    bitmap: new AlphaImage(size, bitmap),
    metrics: { width, height, left, top, advance }
  });
}

function readGlyph(tag, glyph, pbf) {
  if (tag === 1) glyph.id = pbf.readVarint();
  else if (tag === 2) glyph.bitmap = pbf.readBytes();
  else if (tag === 3) glyph.width = pbf.readVarint();
  else if (tag === 4) glyph.height = pbf.readVarint();
  else if (tag === 5) glyph.left = pbf.readSVarint();
  else if (tag === 6) glyph.top = pbf.readSVarint();
  else if (tag === 7) glyph.advance = pbf.readVarint();
}

function initGlyphCache(endpoint) {
  const fonts = {};

  function getBlock(font, range) {
    const first = range * 256;
    const last = first + 255;
    const href = endpoint
      .replace("{fontstack}", font.split(" ").join("%20"))
      .replace("{range}", first + "-" + last);

    return fetch(href)
      .then(getArrayBuffer)
      .then(parseGlyphPbf)
      .then(glyphs => glyphs.reduce((d, g) => (d[g.id] = g, d), {}));
  }

  return function(font, code) {
    // 1. Find the 256-char block containing this code
    if (code > 65535) throw Error("glyph codes > 65535 not supported");
    const range = Math.floor(code / 256);

    // 2. Get the Promise for the retrieval and parsing of the block
    const blocks = fonts[font] || (fonts[font] = {});
    const block = blocks[range] || (blocks[range] = getBlock(font, range));

    // 3. Return a Promise that resolves to the requested glyph
    // NOTE: may be undefined! if the API returns a sparse or empty block
    return block.then(glyphs => glyphs[code]);
  };
}

function getArrayBuffer(response) {
  if (!response.ok) throw Error(response.status + " " + response.statusText);
  return response.arrayBuffer();
}

function potpack(boxes) {

    // calculate total box area and maximum box width
    let area = 0;
    let maxWidth = 0;

    for (const box of boxes) {
        area += box.w * box.h;
        maxWidth = Math.max(maxWidth, box.w);
    }

    // sort the boxes for insertion by height, descending
    boxes.sort((a, b) => b.h - a.h);

    // aim for a squarish resulting container,
    // slightly adjusted for sub-100% space utilization
    const startWidth = Math.max(Math.ceil(Math.sqrt(area / 0.95)), maxWidth);

    // start with a single empty space, unbounded at the bottom
    const spaces = [{x: 0, y: 0, w: startWidth, h: Infinity}];

    let width = 0;
    let height = 0;

    for (const box of boxes) {
        // look through spaces backwards so that we check smaller spaces first
        for (let i = spaces.length - 1; i >= 0; i--) {
            const space = spaces[i];

            // look for empty spaces that can accommodate the current box
            if (box.w > space.w || box.h > space.h) continue;

            // found the space; add the box to its top-left corner
            // |-------|-------|
            // |  box  |       |
            // |_______|       |
            // |         space |
            // |_______________|
            box.x = space.x;
            box.y = space.y;

            height = Math.max(height, box.y + box.h);
            width = Math.max(width, box.x + box.w);

            if (box.w === space.w && box.h === space.h) {
                // space matches the box exactly; remove it
                const last = spaces.pop();
                if (i < spaces.length) spaces[i] = last;

            } else if (box.h === space.h) {
                // space matches the box height; update it accordingly
                // |-------|---------------|
                // |  box  | updated space |
                // |_______|_______________|
                space.x += box.w;
                space.w -= box.w;

            } else if (box.w === space.w) {
                // space matches the box width; update it accordingly
                // |---------------|
                // |      box      |
                // |_______________|
                // | updated space |
                // |_______________|
                space.y += box.h;
                space.h -= box.h;

            } else {
                // otherwise the box splits the space into two spaces
                // |-------|-----------|
                // |  box  | new space |
                // |_______|___________|
                // | updated space     |
                // |___________________|
                spaces.push({
                    x: space.x + box.w,
                    y: space.y,
                    w: space.w - box.w,
                    h: box.h
                });
                space.y += box.h;
                space.h -= box.h;
            }
            break;
        }
    }

    return {
        w: width, // container width
        h: height, // container height
        fill: (area / (width * height)) || 0 // space utilization
    };
}

const ATLAS_PADDING = 1;

function buildAtlas(fonts) {
  // See maplibre-gl-js/src/render/glyph_atlas.js

  // Construct position objects (metrics and rects) for each glyph
  const positions = Object.entries(fonts)
    .reduce((pos, [font, glyphs]) => {
      pos[font] = getPositions(glyphs);
      return pos;
    }, {});

  // Figure out how to pack all the bitmaps into one image
  // NOTE: modifies the rects in the positions object, in place!
  const rects = Object.values(positions)
    .flatMap(fontPos => Object.values(fontPos))
    .map(p => p.rect);
  const { w, h } = potpack(rects);

  // Using the updated rects, copy all the bitmaps into one image
  const image = new AlphaImage({ width: w || 1, height: h || 1 });
  Object.entries(fonts).forEach(([font, glyphs]) => {
    let fontPos = positions[font];
    glyphs.forEach(glyph => copyGlyphBitmap(glyph, fontPos, image));
  });

  return { image, positions };
}

function getPositions(glyphs) {
  return glyphs.reduce((dict, glyph) => {
    let pos = getPosition(glyph);
    if (pos) dict[glyph.id] = pos;
    return dict;
  }, {});
}

function getPosition(glyph) {
  let { bitmap: { width, height }, metrics } = glyph;
  if (width === 0 || height === 0) return;

  // Construct a preliminary rect, positioned at the origin for now
  let w = width + 2 * ATLAS_PADDING;
  let h = height + 2 * ATLAS_PADDING;
  let rect = { x: 0, y: 0, w, h };

  return { metrics, rect };
}

function copyGlyphBitmap(glyph, positions, image) {
  let { id, bitmap } = glyph;
  let position = positions[id];
  if (!position) return;

  let srcPt = { x: 0, y: 0 };
  let { x, y } = position.rect;
  let dstPt = { x: x + ATLAS_PADDING, y: y + ATLAS_PADDING };
  AlphaImage.copy(bitmap, image, srcPt, dstPt, bitmap);
}

function initGetter(urlTemplate, key) {
  // Check if url is valid
  const urlOK = (
    (typeof urlTemplate === "string" || urlTemplate instanceof String) &&
    urlTemplate.slice(0, 4) === "http"
  );
  if (!urlOK) return console.log("sdf-manager: no valid glyphs URL!");

  // Put in the API key, if supplied
  const endpoint = (key)
    ? urlTemplate.replace("{key}", key)
    : urlTemplate;

  const getGlyph = initGlyphCache(endpoint);

  return function(fontCodes) {
    // fontCodes = { font1: [code1, code2...], font2: ... }
    const fontGlyphs = {};

    const promises = Object.entries(fontCodes).map(([font, codes]) => {
      let requests = Array.from(codes, code => getGlyph(font, code));

      return Promise.all(requests).then(glyphs => {
        fontGlyphs[font] = glyphs.filter(g => g !== undefined);
      });
    });

    return Promise.all(promises).then(() => {
      return buildAtlas(fontGlyphs);
    });
  };
}

export { ATLAS_PADDING, GLYPH_PBF_BORDER, ONE_EM, initGetter };
