import fs from 'fs';
const code = fs.readFileSync('src/lib/utils.ts', 'utf-8');
console.log(code.includes("if (!habit.isFrozen && dStr === todayStr) {"));
