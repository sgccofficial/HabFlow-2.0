const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/await webpush\.sendNotification\(s\.sub, JSON\.stringify\(\{ title: timer\.title, body: timer\.body \}\)\);\n\s*\} catch \(e\) \{\n\s*console\.error\('Push failed for timer', e\);\n\s*\}/g, `await webpush.sendNotification(s.sub, JSON.stringify({ title: timer.title, body: timer.body }));
            } catch (e: any) {
              console.error('Push failed for timer', e);
              if (e.statusCode === 410 || e.statusCode === 404) {
                 // The subscription is invalid or has expired. Delete it.
                 try {
                   const { deleteDoc } = require('firebase/firestore');
                   await deleteDoc(d.ref);
                 } catch(deleteErr) {}
              }
            }`);

code = code.replace(/await webpush\.sendNotification\(s\.sub, JSON\.stringify\(\{\n\s*title: \`Daily Reminder - \$\{r\.title\}\.\.\.\`,\n\s*body: \`Let's build this streak to \$\{\(r\.streak \|\| 0\) \+ 1\} 🔥\`\n\s*\}\)\);\n\s*\} catch\(e\) \{\n\s*console\.error\('Push failed for reminder', e\);\n\s*\}/g, `await webpush.sendNotification(s.sub, JSON.stringify({
                    title: \`Daily Reminder - \${r.title}...\`,
                    body: \`Let's build this streak to \${(r.streak || 0) + 1} 🔥\`
                  }));
              } catch(e: any) {
                console.error('Push failed for reminder', e);
                if (e.statusCode === 410 || e.statusCode === 404 || e.statusCode === 403) {
                   try {
                     const { deleteDoc } = require('firebase/firestore');
                     await deleteDoc(d.ref);
                   } catch(deleteErr) {}
                }
              }`);
              
fs.writeFileSync('server.ts', code);
