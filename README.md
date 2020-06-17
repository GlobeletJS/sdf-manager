# sdf-manager

Load, parse, and cache Mapbox glyph SDFs, and construct glyph atlases

The code follows the same strategy as the glyph management in
[mapbox-gl-js](https://github.com/mapbox/mapbox-gl-js).
sdf-manager simply pulls out this part of the code and modularizes it.

## Installation
vector-map is provided as an ESM import
```javascript
import * as sdfManager from 'sdf-manager';
```

## Syntax
```javascript
const getGlyphs = sdfManager.initGetter(urlTemplate, key);
```

The `urlTemplate` must follow the pattern described in the
[Mapbox documentation](https://docs.mapbox.com/mapbox-gl-js/style-spec/glyphs/).
The `key` is your API key to access the SDF server.

The returned `getGlyphs` function has the following syntax:
```javascript
const atlas = getGlyphs(fonts);
```
where `fonts` is a dictionary of fonts and associated character codes, with 
the following structure:
```javascript
const fonts = { font1: [code1, code2, ...], font2: [...], ... };
```

Examples of the returned `atlas`, and how it can be used, can be found in this
[Observable notebook](https://observablehq.com/@jjhembd/mapbox-glyph-pbfs#atlas_documentation)

## References
- [Valve's paper on SDF for text rendering](https://steamcdn-a.akamaihd.net/apps/valve/2007/SIGGRAPH2007_AlphaTestedMagnification.pdf)
- [Konstantin Käfer's application to map labels](https://blog.mapbox.com/drawing-text-with-signed-distance-fields-in-mapbox-gl-b0933af6f817)
- [mapbox-gl-native text rendering documentation](https://github.com/mapbox/mapbox-gl-native/wiki/Text-Rendering)
