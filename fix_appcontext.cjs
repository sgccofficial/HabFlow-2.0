const fs = require('fs');
let code = fs.readFileSync('src/store/AppContext.tsx', 'utf8');

const target = `const [dataLoadedForUser, setDataLoadedForUser] = useState<string | null>(user ? user.id : null);`;
const replace = `const [dataLoadedForUser, setDataLoadedForUser] = useState<string | null>(user ? user.id : null);
  const isRemoteUpdate = useRef(false);`;

code = code.replace(target, replace);
fs.writeFileSync('src/store/AppContext.tsx', code);
