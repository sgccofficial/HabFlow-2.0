const fs = require('fs');
let code = fs.readFileSync('src/components/AnalyticsPage.tsx', 'utf8');

const target = `<div className="flex w-full justify-center mt-2">
        <div className="grid grid-cols-7 gap-2 sm:gap-3 w-full sm:max-w-[360px]">`;

const replace = `<div className="flex w-full justify-center mt-2">
        <div className="grid grid-cols-7 gap-1 sm:gap-2 w-full max-w-[250px] sm:max-w-[300px] mx-auto">`;

code = code.replace(target, replace);
fs.writeFileSync('src/components/AnalyticsPage.tsx', code);
