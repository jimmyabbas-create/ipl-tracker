# IPL 2026 – Total Runs Tracker

A live, auto-updating page showing IPL 2026 total runs scored by each team.  
Share the URL with anyone — they open it on their phone and see the latest data.

---

## How to Deploy (5 minutes, free)

### Step 1: Create a Vercel account
Go to **https://vercel.com** and sign up with your Google or GitHub account. It's free.

### Step 2: Install Vercel CLI
Open your terminal/command prompt and run:
```
npm install -g vercel
```

### Step 3: Deploy
Navigate to this folder and run:
```
cd ipl-tracker
vercel
```
Follow the prompts (just press Enter for defaults). Vercel will give you a URL like:
```
https://ipl-tracker-xxxx.vercel.app
```

### Step 4: Share the URL
Send that URL to your store people. They tap it on their phone → see the latest IPL 2026 team runs.

---

## How It Works

1. Someone opens the URL on their phone
2. The page calls `/api/stats` on your server
3. The server fetches the latest data from CricTracker/myKhel (server-side, no CORS issues)
4. Data is displayed in a clean, mobile-friendly table
5. Results are cached for 30 minutes so the cricket sites don't get hammered

---

## File Structure

```
ipl-tracker/
├── api/
│   └── stats.js          ← Serverless function (fetches live data)
├── public/
│   └── index.html         ← The page your store people see
├── package.json
├── vercel.json
└── README.md
```

---

## Updating

The data updates automatically. No action needed from you.  
If CricTracker is temporarily down, the page shows cached data from the last known good state.

---

## Alternative: Deploy to Netlify

If you prefer Netlify:
1. Move `api/stats.js` to `netlify/functions/stats.js`
2. Update the fetch URL in `index.html` from `/api/stats` to `/.netlify/functions/stats`
3. Run `netlify deploy`
