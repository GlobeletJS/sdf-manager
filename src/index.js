import { initGlyphCache } from "./cache.js";
import { buildAtlas } from "./atlas.js";

export { GLYPH_PBF_BORDER, ONE_EM } from "./glyph-pbf.js";
export { ATLAS_PADDING } from "./atlas.js";

export function initGetter(urlTemplate, key) {
  // Check if url is valid
  const urlOK = (
    (typeof urlTemplate === "string" || urlTemplate instanceof String) &&
    urlTemplate.slice(0, 4) === "http"
  );
  if (!urlOK) return console.log("sdf-manager: no valid glyphs URL!");

  // Put in the API key, if supplied
  const endpoint = (key)
    ? urlTemplate.replace('{key}', key)
    : urlTemplate;

  const getGlyph = initGlyphCache(endpoint);

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
