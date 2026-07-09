const fs = require('fs');
const path = 'c:/puzzlewarz/src/components/puzzle/HiddenWordPuzzle.tsx';

// Read as latin1 to get raw bytes as characters
let c = fs.readFileSync(path, 'latin1');

// Each entry: [corrupted-latin1-sequence, correct-unicode-char]
const fixes = [
  ['\xf0\x9f\x94\xa1', '\uD83D\uDD21'], // 🔡
  ['\xf0\x9f\x8e\xaf', '\uD83C\uDFAF'], // 🎯
  ['\xc3\xaf\xc2\xb8\xc2\xae', '\u2328\uFE0F'], // ⌨️
  ['\xe2\x80\x94', '\u2014'],  // —
  ['\xe2\x80\x93', '\u2013'],  // –
  ['\xf0\x9f\x9f\xa2', '\uD83D\uDFE2'], // 🟢
  ['\xf0\x9f\x9f\xa1', '\uD83D\uDFE1'], // 🟡
  ['\xe2\x9a\xab', '\u26AB'],  // ⚫
  ['\xf0\x9f\x9a\x80', '\uD83D\uDE80'], // 🚀
  ['\xf0\x9f\x94\xa5', '\uD83D\uDD25'], // 🔥
  ['\xf0\x9f\x8c\x9f', '\uD83C\uDF1F'], // 🌟
  ['\xe2\x9c\xa8', '\u2728'],  // ✨
  ['\xf0\x9f\x91\x8f', '\uD83D\uDC4F'], // 👏
  ['\xf0\x9f\x98\x8a', '\uD83D\uDE0A'], // 😊
  ['\xf0\x9f\x98\x85', '\uD83D\uDE05'], // 😅
  ['\xf0\x9f\x92\xa1', '\uD83D\uDCA1'], // 💡
  ['\xf0\x9f\x8e\x89', '\uD83C\uDF89'], // 🎉
  ['\xf0\x9f\x92\x80', '\uD83D\uDC80'], // 💀
  ['\xe2\x80\x99', '\u2019'],  // '
  ['\xc2\xb7', '\u00B7'],      // ·
];

for (const [bad, good] of fixes) {
  // Convert the good unicode char back to utf-8 bytes expressed as latin1
  const goodUtf8AsLatin1 = Buffer.from(good).toString('latin1');
  c = c.split(bad).join(goodUtf8AsLatin1);
}

// Now write back as UTF-8
fs.writeFileSync(path, Buffer.from(c, 'latin1'));
console.log('Done - file re-encoded as UTF-8');
