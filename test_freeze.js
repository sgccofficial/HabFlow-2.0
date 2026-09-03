import { readFileSync } from 'fs';
const utilsCode = readFileSync('./src/lib/utils.ts', 'utf-8');
console.log(utilsCode.includes('if (!habit.isFrozen && dStr === todayStr) {'));
