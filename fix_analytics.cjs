const fs = require('fs');
let code = fs.readFileSync('src/components/AnalyticsPage.tsx', 'utf8');

// Fix heatmap structure
const targetHeatmap = `<div className="flex w-full justify-center mt-2">
        <div className="grid grid-cols-7 gap-1 sm:gap-2 w-full max-w-[250px] sm:max-w-[300px] mx-auto">`;
const replaceHeatmap = `<div className="grid grid-cols-7 gap-2 mt-2 w-full max-w-[280px] sm:max-w-sm mx-auto">`;
code = code.replace(targetHeatmap, replaceHeatmap);

// I had also added an extra </div> to close the wrapper. Let's find it.
const targetHeatmapEnd = `      </div>
      </div>
    );
  };`;
const replaceHeatmapEnd = `      </div>
    );
  };`;
code = code.replace(targetHeatmapEnd, replaceHeatmapEnd);

// Fix padding
const targetPadding = `<div className="pb-24 pt-8 px-4">`;
const replacePadding = `<div className="pt-2 px-4 max-w-3xl mx-auto w-full pb-8">`;
code = code.replace(targetPadding, replacePadding);

// Let's also remove <div className="max-w-3xl mx-auto"> just inside it, if we merge it.
// Let's just do:
// <div className="pt-2 px-4"> 
code = code.replace(`<div className="pt-2 px-4 max-w-3xl mx-auto w-full pb-8">
      <div className="max-w-3xl mx-auto">`, `<div className="pt-2 px-4 pb-8">
      <div className="max-w-3xl mx-auto">`);

fs.writeFileSync('src/components/AnalyticsPage.tsx', code);
