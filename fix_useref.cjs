const fs = require('fs');
let code = fs.readFileSync('src/store/AppContext.tsx', 'utf8');
code = code.replace(/import React, \{ createContext, useState, useEffect, ReactNode \} from 'react';/, "import React, { createContext, useState, useEffect, useRef, ReactNode } from 'react';");
fs.writeFileSync('src/store/AppContext.tsx', code);
