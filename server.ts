import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import webpush from "web-push";
import fs from "fs";
import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import crypto from 'crypto';

// Initialize Firebase Admin
let db: any = null;
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)),
  });
  db = getFirestore();
} else {
  console.warn("FIREBASE_SERVICE_ACCOUNT_JSON is missing. Push notifications background worker and sync endpoints are disabled.");
}

const app = express();
const PORT = 3000;
app.use(express.json());

// Load or generate VAPID keys
let vapidKeys: { publicKey: string, privateKey: string };
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  vapidKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY
  };
} else if (fs.existsSync('vapid-keys.json')) {
  vapidKeys = JSON.parse(fs.readFileSync('vapid-keys.json', 'utf-8'));
} else {
  vapidKeys = webpush.generateVAPIDKeys();
  fs.writeFileSync('vapid-keys.json', JSON.stringify(vapidKeys));
}

webpush.setVapidDetails(
  'mailto:example@example.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// Hash endpoint to create a safe document ID
const getDocId = (endpoint: string) => crypto.createHash('sha256').update(endpoint).digest('hex');

app.get('/api/vapidPublicKey', (req, res) => {
  res.send(vapidKeys.publicKey);
});

app.post('/api/subscribe', async (req, res) => {
  if (!db) {
    return res.status(503).json({ error: 'Push notifications are disabled (missing credentials)' });
  }
  try {
    const { subscription } = req.body;
    const docId = getDocId(subscription.endpoint);
    const docRef = db.collection('subscriptions').doc(docId);
    
    const doc = await docRef.get();
    if (!doc.exists) {
      await docRef.set({ sub: subscription, activeTimers: [], dailyReminders: [] });
    } else {
      await docRef.update({ sub: subscription });
    }
    res.status(201).json({});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

app.post('/api/sync-tasks', async (req, res) => {
  if (!db) {
    return res.status(503).json({ error: 'Push notifications are disabled (missing credentials)' });
  }
  try {
    const { subscription, activeTimers, dailyReminders } = req.body;
    const docId = getDocId(subscription.endpoint);
    const docRef = db.collection('subscriptions').doc(docId);
    
    await docRef.set({
      sub: subscription,
      activeTimers: activeTimers || [],
      dailyReminders: dailyReminders || []
    }, { merge: true });
    
    res.status(200).json({});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to sync tasks' });
  }
});

// Process Notifications Function
async function processNotifications() {
  if (!db) return;
  const now = Date.now();
  const today = new Date();
  const currentTimeStr = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;
  
  try {
    const snapshot = await db.collection('subscriptions').get();
    
    const batch = db.batch();
    let batchCount = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      let modified = false;
      let s = data;

      // Process Timers
      if (s.activeTimers && s.activeTimers.length > 0) {
        let sentAny = false;
        const newTimers = [];
        for (const timer of s.activeTimers) {
          if (!timer.sent && now >= timer.time) {
            try {
              await webpush.sendNotification(s.sub, JSON.stringify({ title: timer.title, body: timer.body }));
            } catch (e) {
              console.error('Push failed for timer', e);
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
          const todayStr = today.toISOString().split('T')[0];
          const currentDayOfWeek = today.getDay();
          const isTargetDay = r.targetDays ? r.targetDays.includes(currentDayOfWeek) : true;

          if (r.time === currentTimeStr && r.lastSentDay !== todayStr && isTargetDay) {
            try {
              await webpush.sendNotification(s.sub, JSON.stringify({ title: "Habit Reminder", body: `Time to work on your habit: ${r.title}` }));
            } catch(e) {
              console.error('Push failed for reminder', e);
            }
            r.lastSentDay = todayStr;
            modified = true;
          }
        }
      }

      if (modified) {
        batch.update(doc.ref, { 
          activeTimers: s.activeTimers, 
          dailyReminders: s.dailyReminders 
        });
        batchCount++;
      }
    }
    
    if (batchCount > 0) {
      await batch.commit();
    }
  } catch (err) {
    console.error('Error processing notifications:', err);
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
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
