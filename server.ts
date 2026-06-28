import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import webpush from "web-push";
import fs from "fs";
import crypto from 'crypto';

// Use a local file for subscriptions if Firebase Admin is not configured
const SUBSCRIPTIONS_FILE = 'subscriptions.json';

const getSubscriptions = () => {
  if (fs.existsSync(SUBSCRIPTIONS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf-8'));
    } catch (e) {
      return {};
    }
  }
  return {};
};

const saveSubscriptions = (subs: any) => {
  fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(subs, null, 2));
};

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
  try {
    const { subscription } = req.body;
    const docId = getDocId(subscription.endpoint);
    
    const subs = getSubscriptions();
    if (!subs[docId]) {
      subs[docId] = { sub: subscription, activeTimers: [], dailyReminders: [] };
    } else {
      subs[docId].sub = subscription;
    }
    saveSubscriptions(subs);
    
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
    
    const subs = getSubscriptions();
    if (!subs[docId]) {
      subs[docId] = { sub: subscription, activeTimers: [], dailyReminders: [] };
    } else {
      subs[docId].sub = subscription;
    }
    
    if (activeTimers !== undefined) subs[docId].activeTimers = activeTimers;
    if (dailyReminders !== undefined) subs[docId].dailyReminders = dailyReminders;
    if (timezoneOffset !== undefined) subs[docId].timezoneOffset = timezoneOffset;
    
    saveSubscriptions(subs);
    
    res.status(200).json({});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to sync tasks' });
  }
});

// Process Notifications Function
async function processNotifications() {
  const subs = getSubscriptions();
  const now = Date.now();

  for (const docId of Object.keys(subs)) {
    const s = subs[docId];
    let modified = false;

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
        const userTime = new Date(now - ((s.timezoneOffset || 0) * 60000));
        const todayStr = userTime.toISOString().split('T')[0];
        const currentDayOfWeek = userTime.getUTCDay();
        const currentTimeStr = `${String(userTime.getUTCHours()).padStart(2, '0')}:${String(userTime.getUTCMinutes()).padStart(2, '0')}`;
        const isTargetDay = r.targetDays ? r.targetDays.includes(currentDayOfWeek) : true;

        if (r.time === currentTimeStr && r.lastSentDay !== todayStr && isTargetDay) {
          try {
            await webpush.sendNotification(s.sub, JSON.stringify({ title: "Daily Reminder", body: `It's time to work on ${r.title}...` }));
          } catch(e) {
            console.error('Push failed for reminder', e);
          }
          r.lastSentDay = todayStr;
          modified = true;
        }
      }
    }

    if (modified) {
      saveSubscriptions(subs);
    }
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
