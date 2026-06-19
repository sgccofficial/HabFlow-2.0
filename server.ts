import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import webpush from "web-push";
import fs from "fs";

const app = express();
const PORT = 3000;
app.use(express.json());

// Load or generate VAPID keys
let vapidKeys: { publicKey: string, privateKey: string };
if (fs.existsSync('vapid-keys.json')) {
  vapidKeys = JSON.parse(fs.readFileSync('vapid-keys.json', 'utf-8'));
} else {
  vapidKeys = webpush.generateVAPIDKeys();
  fs.writeFileSync('vapid-keys.json', JSON.stringify(vapidKeys));
}

// NOTE: use a dummy mailto since this is an example
webpush.setVapidDetails(
  'mailto:example@example.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// DB of subscriptions
// subs array format:
// { sub: webpush.PushSubscription, activeTimers: [], dailyReminders: [] }
let subs: any[] = [];
if (fs.existsSync('subs.json')) {
  try { subs = JSON.parse(fs.readFileSync('subs.json', 'utf-8')); } catch(e) {}
}

const saveSubs = () => fs.writeFileSync('subs.json', JSON.stringify(subs));

app.get('/api/vapidPublicKey', (req, res) => {
  res.send(vapidKeys.publicKey);
});

app.post('/api/subscribe', (req, res) => {
  const { subscription } = req.body;
  const existing = subs.find(s => s.sub.endpoint === subscription.endpoint);
  if (!existing) {
    subs.push({ sub: subscription, activeTimers: [], dailyReminders: [] });
    saveSubs();
  }
  res.status(201).json({});
});

app.post('/api/sync-tasks', (req, res) => {
  const { subscription, activeTimers, dailyReminders } = req.body;
  const existing = subs.find(s => s.sub.endpoint === subscription.endpoint);
  if (existing) {
    existing.activeTimers = activeTimers || [];
    existing.dailyReminders = dailyReminders || [];
    saveSubs();
    res.status(200).json({});
  } else {
    subs.push({ sub: subscription, activeTimers: activeTimers || [], dailyReminders: dailyReminders || [] });
    saveSubs();
    res.status(201).json({});
  }
});

// Background worker to check notifications every 10 seconds
setInterval(() => {
  const now = Date.now();
  const today = new Date();
  const currentTimeStr = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;

  subs.forEach(s => {
    let modified = false;

    // Process Timers
    if (s.activeTimers && s.activeTimers.length > 0) {
      s.activeTimers.forEach((timer: any) => {
        if (!timer.sent && now >= timer.time) {
          webpush.sendNotification(s.sub, JSON.stringify({ title: timer.title, body: timer.body })).catch(e => console.error(e));
          timer.sent = true;
          modified = true;
        }
      });
      const initialLength = s.activeTimers.length;
      s.activeTimers = s.activeTimers.filter((t: any) => !t.sent); // clear sent timers
      if (initialLength !== s.activeTimers.length) modified = true;
    }

    // Process Reminders
    if (s.dailyReminders && s.dailyReminders.length > 0) {
      s.dailyReminders.forEach((r: any) => {
        // We need to ensure we don't send the same reminder multiple times for the same minute
        // r.lastSentDay is tracked as YYYY-MM-DD
        const todayStr = today.toISOString().split('T')[0];
        if (r.time === currentTimeStr && r.lastSentDay !== todayStr) {
          webpush.sendNotification(s.sub, JSON.stringify({ title: "Habit Reminder", body: `Time to work on your habit: ${r.title}` })).catch(e => console.error(e));
          r.lastSentDay = todayStr;
          modified = true;
        }
      });
    }

    if (modified) saveSubs();
  });
}, 10000);

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
