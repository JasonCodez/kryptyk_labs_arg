// Usage: node scripts/extract-logo-colors.js <path-to-image>
// Example: node scripts/extract-logo-colors.js public/images/puzzle_warz_logo.png
// node-vibrant 3.x no longer ships lib/vibrant — require the package root.
const Vibrant = require('node-vibrant');
const path = process.argv[2] || 'public/images/puzzle_warz_logo.png';

Vibrant.from(path).getPalette()
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
