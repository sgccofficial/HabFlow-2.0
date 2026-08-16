const fs = require('fs');
let code = fs.readFileSync('src/store/AppContext.tsx', 'utf8');
code = code.replace(/import React, \{ createContext, useContext, useEffect, useState \} from 'react';/, "import React, { createContext, useContext, useEffect, useState, useRef } from 'react';");
fs.writeFileSync('src/store/AppContext.tsx', code);
