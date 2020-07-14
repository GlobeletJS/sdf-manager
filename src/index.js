import { initGlyphCache } from "./cache.js";
import { buildAtlas } from "./atlas.js";

export { GLYPH_PBF_BORDER, ONE_EM } from "./glyph-pbf.js";
export { ATLAS_PADDING } from "./atlas.js";

export function initGetter(urlTemplate, key) {
  const getGlyph = initGlyphCache(urlTemplate, key);

  return function(fonts) {
    // fonts = { font1: [code1, code2...], font2: ... }
    const promises = [];
    const fontGlyphs = {};

    Object.entries(fonts).forEach(([font, codes]) => {
      const glyphs = fontGlyphs[font] = [];
      codes.forEach(code => {
        let request = getGlyph(font, code)
          .then(glyph => glyphs.push(glyph));
        promises.push(request);
      });
    });

    return Promise.all(promises).then(() => {
      return buildAtlas(fontGlyphs);
    });
  };
}
