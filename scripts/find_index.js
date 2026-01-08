const fs = require('fs');
const p = 'd:/projects/kryptyk_labs_arg/src/components/puzzle/JigsawPuzzle.tsx';
const s = fs.readFileSync(p,'utf8');
const idx = 495;
let cum = 0;
const lines = s.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (cum + line.length + 1 > idx) {
    console.log('index', idx, 'is on line', i+1, 'col', idx - cum + 1);
    console.log('line content:', line);
    break;
  }
  cum += line.length + 1;
}

// print 10 lines around
for (let i = Math.max(0, i-5); i < Math.min(lines.length, i+5); i++) {
  console.log(i+1, lines[i]);
}
