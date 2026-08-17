const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace("import { initializeApp } from 'firebase/app';", "import { initializeApp } from 'firebase/app';\nimport { deleteDoc } from 'firebase/firestore';");

code = code.replace(/} catch\(e\) \{\n\s*console\.error\('Push failed for reminder', e\);\n\s*\}/, `} catch(e: any) {
                console.error('Push failed for reminder', e);
                if (e.statusCode === 410 || e.statusCode === 404 || e.statusCode === 403 || (e.body && e.body.includes('Received unexpected response code'))) {
                   try {
                     await deleteDoc(d.ref);
                     console.log('Deleted invalid subscription document');
                   } catch(deleteErr) {}
                }
              }`);
              
code = code.replace(/\} catch \(e\) \{\n\s*console\.error\('Push failed for timer', e\);\n\s*\}/, `} catch (e: any) {
              console.error('Push failed for timer', e);
              if (e.statusCode === 410 || e.statusCode === 404 || e.statusCode === 403 || (e.body && e.body.includes('Received unexpected response code'))) {
                 try {
                   await deleteDoc(d.ref);
                   console.log('Deleted invalid subscription document');
                 } catch(deleteErr) {}
              }
            }`);

fs.writeFileSync('server.ts', code);
