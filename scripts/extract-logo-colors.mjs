// Usage: node scripts/extract-logo-colors.mjs <path-to-image>
// Example: node scripts/extract-logo-colors.mjs public/images/puzzle_warz_logo.png
// node-vibrant 3.x no longer ships lib/vibrant as a bare specifier — the
// package root re-exports the node build, so import that directly.
import Vibrant from 'node-vibrant';

const vibrantInstance = Vibrant.default || Vibrant;
const path = process.argv[2] || 'public/images/puzzle_warz_logo.png';

vibrantInstance.from(path).getPalette()
  .then((palette) => {
    console.log('Dominant colors from logo:');
    Object.entries(palette).forEach(([name, swatch]) => {
      if (swatch) {
        console.log(`${name}: ${swatch.getHex()} (rgb: ${swatch.getRgb().map(Math.round).join(', ')})`);
      }
    });
  })
  .catch((err) => {
    console.error('Error extracting colors:', err);
  });
