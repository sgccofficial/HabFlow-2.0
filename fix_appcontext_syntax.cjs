const fs = require('fs');
let code = fs.readFileSync('src/store/AppContext.tsx', 'utf8');
code = code.replace("            }\n            } else if (initialLoad) {", "            } else if (initialLoad) {");
fs.writeFileSync('src/store/AppContext.tsx', code);
