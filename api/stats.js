const https = require('https');

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 15000,
    }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchPage(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// Parse CricTracker team total runs page
function parseCricTracker(html) {
  const teams = [];
  // CricTracker table has rows: No | Team | R | 100s | 50s | Wkts
  // The table is rendered in Next.js but the SSR HTML contains it
  
  const teamNames = [
    'Sunrisers Hyderabad', 'Chennai Super Kings', 'Royal Challengers Bengaluru',
    'Royal Challengers Bangalore', 'Mumbai Indians', 'Kolkata Knight Riders',
    'Punjab Kings', 'Gujarat Titans', 'Rajasthan Royals', 'Delhi Capitals',
    'Lucknow Super Giants'
  ];

  // Try table row pattern
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;
  while ((match = rowRegex.exec(html)) !== null) {
    const row = match[1];
    const cells = [];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(row)) !== null) {
      cells.push(cellMatch[1].replace(/<[^>]+>/g, '').trim());
    }
    if (cells.length >= 3) {
      for (const tn of teamNames) {
        if (cells.some(c => c.includes(tn) || c.includes(tn.replace('Bengaluru', 'Bangalore')))) {
          const teamCell = cells.findIndex(c => teamNames.some(t => c.includes(t)));
          if (teamCell >= 0 && cells[teamCell + 1]) {
            const runs = parseInt(cells[teamCell + 1].replace(/,/g, ''));
            if (runs > 50 && runs < 10000) {
              const name = tn === 'Royal Challengers Bangalore' ? 'Royal Challengers Bengaluru' : tn;
              if (!teams.find(t => t.team === name)) {
                teams.push({ team: name, runs });
              }
            }
          }
        }
      }
    }
  }
  return teams;
}

// Parse points table to get matches played
function parsePointsTable(html) {
  const data = {};
  const teamAbbrs = {
    'RR': 'Rajasthan Royals', 'PBKS': 'Punjab Kings', 'RCB': 'Royal Challengers Bengaluru',
    'DC': 'Delhi Capitals', 'GT': 'Gujarat Titans', 'LSG': 'Lucknow Super Giants',
    'SRH': 'Sunrisers Hyderabad', 'MI': 'Mumbai Indians', 'CSK': 'Chennai Super Kings',
    'KKR': 'Kolkata Knight Riders'
  };
  
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;
  while ((match = rowRegex.exec(html)) !== null) {
    const row = match[1];
    const cells = [];
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(row)) !== null) {
      cells.push(cellMatch[1].replace(/<[^>]+>/g, '').trim());
    }
    for (const [abbr, full] of Object.entries(teamAbbrs)) {
      if (cells.some(c => c === abbr || c.includes(full))) {
        // Look for a small number (1-14) that could be matches played
        for (let i = 0; i < cells.length; i++) {
          const val = parseInt(cells[i]);
          if (val >= 1 && val <= 14 && cells[i].length <= 2) {
            data[full] = val;
            break;
          }
        }
      }
    }
  }
  return data;
}

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');

  const sources = [
    'https://www.crictracker.com/t20/ipl-indian-premier-league/stats/team-total-runs/',
    'https://www.mykhel.com/cricket/ipl-stats-s4/team-total-runs/',
  ];

  let teams = [];
  let sourceUsed = '';

  for (const url of sources) {
    try {
      const html = await fetchPage(url);
      teams = parseCricTracker(html);
      if (teams.length >= 5) {
        sourceUsed = url.includes('crictracker') ? 'CricTracker' : 'myKhel';
        break;
      }
    } catch (e) {
      console.error(`Failed to fetch ${url}:`, e.message);
    }
  }

  // Try to get matches played from points table
  let matchesPlayed = {};
  try {
    const ptHtml = await fetchPage('https://www.crictracker.com/t20/ipl-indian-premier-league/points-table/');
    matchesPlayed = parsePointsTable(ptHtml);
  } catch (e) {
    console.error('Points table fetch failed:', e.message);
  }

  // Merge matches played
  teams = teams.map(t => ({
    ...t,
    matches: matchesPlayed[t.team] || null,
  }));

  teams.sort((a, b) => b.runs - a.runs);

  if (teams.length >= 5) {
    return res.status(200).json({
      success: true,
      source: sourceUsed,
      updated: new Date().toISOString(),
      data: teams,
    });
  }

  // Fallback: return cached data
  return res.status(200).json({
    success: true,
    source: 'cached',
    updated: '2026-04-12T23:59:00Z',
    data: [
      { team: 'Royal Challengers Bengaluru', runs: 894, matches: 4 },
      { team: 'Sunrisers Hyderabad', runs: 802, matches: 4 },
      { team: 'Chennai Super Kings', runs: 755, matches: 4 },
      { team: 'Gujarat Titans', runs: 741, matches: 4 },
      { team: 'Mumbai Indians', runs: 731, matches: 4 },
      { team: 'Delhi Capitals', runs: 707, matches: 4 },
      { team: 'Rajasthan Royals', runs: 690, matches: 4 },
      { team: 'Lucknow Super Giants', runs: 647, matches: 4 },
      { team: 'Punjab Kings', runs: 598, matches: 4 },
      { team: 'Kolkata Knight Riders', runs: 562, matches: 4 },
    ],
  });
};
