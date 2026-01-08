const fs = require('fs');
const s = fs.readFileSync('d:/projects/kryptyk_labs_arg/src/components/puzzle/JigsawPuzzle.tsx','utf8');
let stack = [];
for (let i = 0; i < s.length; i++) {
  const ch = s[i];
  if (ch === '{' || ch === '(' || ch === '[') stack.push({ ch, i });
  else if (ch === '}' || ch === ')' || ch === ']') stack.pop();
}
if (stack.length > 0) {
  const last = stack[stack.length - 1];
  const upto = s.slice(0, last.i);
  const line = upto.split('\n').length;
  const col = upto.split('\n').pop().length + 1;
  console.log('unmatched opening', last.ch, 'at index', last.i, 'line', line, 'col', col);
  const all = s.split('\n');
  for (let i = Math.max(0, line - 5); i < Math.min(all.length, line + 5); i++) {
    console.log((i + 1).toString().padStart(4, ' '), '|', all[i]);
  }
} else {
  console.log('No unmatched');
}
