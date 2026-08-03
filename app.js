const LEAGUE_ID = "1371503267833475072";
const API = "https://api.sleeper.app/v1";

const byId = (id) => document.getElementById(id);
const safe = (value, fallback = "Unknown") => value || fallback;

async function getJSON(path) {
  const response = await fetch(`${API}${path}`);
  if (!response.ok) throw new Error(`Sleeper API error: ${response.status}`);
  return response.json();
}

function avatarUrl(user) {
  return user.avatar
    ? `https://sleepercdn.com/avatars/thumbs/${user.avatar}`
    : "https://sleepercdn.com/images/v2/icons/player_default.webp";
}

async function loadLeague() {
  try {
    const [league, users, rosters, state] = await Promise.all([
      getJSON(`/league/${LEAGUE_ID}`),
      getJSON(`/league/${LEAGUE_ID}/users`),
      getJSON(`/league/${LEAGUE_ID}/rosters`),
      getJSON("/state/nfl")
    ]);

    const usersById = Object.fromEntries(users.map(user => [user.user_id, user]));
    const rosterRows = rosters.map(roster => {
      const user = usersById[roster.owner_id] || {};
      const settings = roster.settings || {};
      return {
        rosterId: roster.roster_id,
        owner: safe(user.display_name, `Team ${roster.roster_id}`),
        team: safe(user.metadata?.team_name, safe(user.display_name, `Team ${roster.roster_id}`)),
        avatar: avatarUrl(user),
        wins: settings.wins || 0,
        losses: settings.losses || 0,
        ties: settings.ties || 0,
        points: (settings.fpts || 0) + ((settings.fpts_decimal || 0) / 100)
      };
    }).sort((a, b) => b.wins - a.wins || a.losses - b.losses || b.points - a.points);

    byId("league-name").textContent = safe(league.name, "Stumblin' Bumblin' & Fumblin'");
    byId("league-status").textContent = `${safe(league.total_rosters, rosters.length)} teams • ${safe(league.status, "preseason")} • Sleeper league data connected`;
    byId("season-pill").textContent = `${league.season || "2026"} • ${String(league.status || "League").toUpperCase()}`;
    byId("roster-count").textContent = rosters.length;
    byId("team-count").textContent = `${rosters.length} teams`;
    byId("week-number").textContent = state.week ?? "—";
    byId("league-year").textContent = league.season || "2026";

    byId("standings").innerHTML = rosterRows.map((row, index) => `
      <div class="standing-row">
        <span class="rank">${index + 1}</span>
        <div>
          <span class="team-name">${row.team}</span>
          <span class="owner-name">${row.owner}</span>
        </div>
        <span class="record">${row.wins}-${row.losses}${row.ties ? `-${row.ties}` : ""}</span>
      </div>
    `).join("");

    byId("teams").innerHTML = rosterRows.map(row => `
      <article class="team-card">
        <img class="avatar" src="${row.avatar}" alt="">
        <strong>${row.team}</strong>
        <span>Owner: ${row.owner}</span>
      </article>
    `).join("");
  } catch (error) {
    console.error(error);
    byId("league-status").textContent = "The site is ready, but Sleeper did not return league data yet. This can happen before the league is fully activated.";
    byId("standings").innerHTML = '<p class="loading">League data unavailable right now.</p>';
    byId("teams").innerHTML = '<p class="loading">League members will appear here once available.</p>';
    byId("season-pill").textContent = "SITE READY";
  }
}

loadLeague();
