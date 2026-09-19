import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import webpush from "web-push";
import fs from "fs";
import crypto from 'crypto';
import { initializeApp } from 'firebase/app';
import { deleteDoc } from 'firebase/firestore';
import { getFirestore, doc, getDoc, setDoc, getDocs, collection } from 'firebase/firestore';

const configStr = fs.readFileSync(path.join(process.cwd(), 'src', 'lib', 'firebase-config.json'), 'utf-8');
const firebaseConfig = JSON.parse(configStr);
const fbApp = initializeApp(firebaseConfig, 'server');
const db = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId || '(default)');

const app = express();
const PORT = 3000;
app.use(express.json());

let vapidKeys: { publicKey: string, privateKey: string };

// Hash endpoint to create a safe document ID
const getDocId = (endpoint: string) => crypto.createHash('sha256').update(endpoint).digest('hex');

app.get('/api/vapidPublicKey', (req, res) => {
  if (!vapidKeys) return res.status(500).json({ error: 'Not ready' });
  res.send(vapidKeys.publicKey);
});

app.post('/api/subscribe', async (req, res) => {
  try {
    const { subscription } = req.body;
    const docId = getDocId(subscription.endpoint);
    
    const docRef = doc(db, 'subscriptions', docId);
    const snap = await getDoc(docRef);
    let subData: any = snap.exists() ? snap.data() : { activeTimers: [], dailyReminders: [] };
    
    subData.sub = subscription;
    await setDoc(docRef, subData);
    
    res.status(201).json({});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

app.post('/api/sync-tasks', async (req, res) => {
  try {
    const { subscription, activeTimers, dailyReminders, timezoneOffset } = req.body;
    const docId = getDocId(subscription.endpoint);
    
    const docRef = doc(db, 'subscriptions', docId);
    const snap = await getDoc(docRef);
    let subData: any = snap.exists() ? snap.data() : { activeTimers: [], dailyReminders: [] };
    
    subData.sub = subscription;
    
    if (activeTimers !== undefined) subData.activeTimers = activeTimers;
    if (dailyReminders !== undefined) {
      const existingReminders = subData.dailyReminders || [];
      const now = Date.now();
      subData.dailyReminders = dailyReminders.map((nr: any) => {
        const ex = existingReminders.find((er: any) => er.title === nr.title && er.time === nr.time);
        if (ex) {
          if (ex.lastSentTimestamp) nr.lastSentTimestamp = ex.lastSentTimestamp;
          if (ex.createdTs) nr.createdTs = ex.createdTs;
        } else {
          nr.createdTs = now;
        }
        return nr;
      });
    }
    if (timezoneOffset !== undefined) subData.timezoneOffset = timezoneOffset;
    
    await setDoc(docRef, subData);
    res.status(200).json({});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to sync tasks' });
  }
});

// Process Notifications Function
async function processNotifications() {
  if (!vapidKeys) return;
  const now = Date.now();
  
  try {
    const snap = await getDocs(collection(db, 'subscriptions'));
    
    for (const d of snap.docs) {
      const s = d.data();
      let modified = false;
      
      // Process Timers
      if (s.activeTimers && s.activeTimers.length > 0) {
        let sentAny = false;
        const newTimers = [];
        for (const timer of s.activeTimers) {
          if (!timer.sent && now >= timer.time) {
            try {
              await webpush.sendNotification(s.sub, JSON.stringify({ title: timer.title, body: timer.body }));
            } catch (e: any) {
              
if (!(e.statusCode === 410 || e.statusCode === 404 || e.statusCode === 403 || (e.message && e.message.includes('Received unexpected response code')) || (e.body && e.body.includes('Received unexpected response code')))) {
  console.error('Push failed for timer', e);
}

              if (e.statusCode === 410 || e.statusCode === 404 || e.statusCode === 403 || (e.message && e.message.includes('Received unexpected response code')) || (e.body && e.body.includes('Received unexpected response code'))) {
                 // The subscription is invalid or has expired. Delete it.
                 try {
                   await deleteDoc(d.ref);
                 } catch(deleteErr) {}
              }
            }
            sentAny = true;
          } else if (!timer.sent) {
            newTimers.push(timer); // keep if not sent
          }
        }
        if (sentAny || newTimers.length !== s.activeTimers.length) {
          s.activeTimers = newTimers;
          modified = true;
        }
      }
      
      // Process Reminders
      if (s.dailyReminders && s.dailyReminders.length > 0) {
        for (const r of s.dailyReminders) {
          const userTime = new Date(now - ((s.timezoneOffset || 0) * 60000));
          const todayStr = userTime.toISOString().split('T')[0];
          const currentDayOfWeek = userTime.getUTCDay();
          const isTargetDay = r.targetDays ? r.targetDays.includes(currentDayOfWeek) : true;
          const isCompleted = r.dates && r.dates.includes(todayStr);
          const [rHr, rMin] = r.time.split(':').map(Number);
          const rTimeMins = rHr * 60 + rMin;
          const currentMins = userTime.getUTCHours() * 60 + userTime.getUTCMinutes();
          
          if (isTargetDay && !isCompleted && currentMins >= rTimeMins) {
            const lastSentTimestamp = r.lastSentTimestamp || 0;
            const createdTs = r.createdTs || 0;
            
            const lastSentDate = new Date(lastSentTimestamp - ((s.timezoneOffset || 0) * 60000));
            const lastSentTodayStr = lastSentDate.toISOString().split('T')[0];
            const sentToday = lastSentTimestamp > 0 && lastSentTodayStr === todayStr;
            
            let shouldSend = false;
            if (!sentToday) {
              const createdDate = new Date(createdTs - ((s.timezoneOffset || 0) * 60000));
              const createdTodayStr = createdDate.toISOString().split('T')[0];
              const createdToday = createdTs > 0 && createdTodayStr === todayStr;
              const createdMins = createdDate.getUTCHours() * 60 + createdDate.getUTCMinutes();
              
              if (createdToday && createdMins >= rTimeMins) {
                 if (now - createdTs >= 120 * 60 * 1000) {
                   shouldSend = true;
                 }
              } else {
                 shouldSend = true;
              }
            } else {
              if (now - lastSentTimestamp >= 120 * 60 * 1000) {
                shouldSend = true;
              }
            }
            
            if (shouldSend) {
              r.lastSentTimestamp = now;
              modified = true;
              try {
                await webpush.sendNotification(s.sub, JSON.stringify({ 
                   title: `Daily Reminder - ${r.title}...`, 
                   body: `Let's build this streak to ${(r.streak || 0) + 1} 🔥` 
                 }));
              } catch(e: any) {
                
if (!(e.statusCode === 410 || e.statusCode === 404 || e.statusCode === 403 || (e.message && e.message.includes('Received unexpected response code')) || (e.body && e.body.includes('Received unexpected response code')))) {
  console.error('Push failed for reminder', e);
}

                if (e.statusCode === 410 || e.statusCode === 404 || e.statusCode === 403 || (e.message && e.message.includes('Received unexpected response code')) || (e.body && e.body.includes('Received unexpected response code'))) {
                   try {
                     await deleteDoc(d.ref);
                     console.log('Deleted invalid subscription document');
                   } catch(deleteErr) {}
                }
              }
            }
          }
        }
      }
      
      if (modified) {
        await setDoc(d.ref, s);
      }
    }
  } catch (e) {
    console.error('Error processing notifications:', e);
  }
}

// Background worker to check notifications locally
setInterval(processNotifications, 10000);

// Endpoint for Google Cloud Scheduler (Allows keeping backend active)
app.get('/api/cron', async (req, res) => {
  await processNotifications();
  res.status(200).send('Processed');
});

async function startServer() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    vapidKeys = {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY
    };
  } else {
    const docRef = doc(db, 'settings', 'vapidKeys');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      vapidKeys = snap.data() as any;
    } else {
      vapidKeys = webpush.generateVAPIDKeys();
      await setDoc(docRef, vapidKeys);
    }
  }
  webpush.setVapidDetails('mailto:example@example.com', vapidKeys.publicKey, vapidKeys.privateKey);

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html') || filePath.endsWith('sw.js')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        } else {
          // Vite hashes other assets, so they can be cached
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      }
    }));
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
  
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
