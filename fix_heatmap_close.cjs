const fs = require('fs');
let code = fs.readFileSync('src/components/AnalyticsPage.tsx', 'utf8');

const target = `      </div>
    );
  };`;

const replace = `      </div>
      </div>
    );
  };`;

code = code.replace(target, replace);
fs.writeFileSync('src/components/AnalyticsPage.tsx', code);
