const fs = require('fs');
let code = fs.readFileSync('src/components/AnalyticsPage.tsx', 'utf8');

const target = `<div className="grid grid-cols-7 gap-2 mt-2 w-full sm:max-w-md mx-auto">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (`;

const replace = `<div className="flex w-full justify-center mt-2">
        <div className="grid grid-cols-7 gap-2 sm:gap-3 w-full sm:max-w-[360px]">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (`;

code = code.replace(target, replace);
fs.writeFileSync('src/components/AnalyticsPage.tsx', code);
