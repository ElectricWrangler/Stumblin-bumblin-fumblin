export const LEAGUE_ID = "1371503267833475072";
export const API = "https://api.sleeper.app/v1";

export async function getJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

export function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

export function calculatePower(team, maxPoints) {
  const base = team.wins === 0 && team.losses === 0 ? 50 : 20;
  const score = base + team.wins * 20 + (maxPoints ? team.pointsFor / maxPoints * 35 : 0);
  return Math.max(1, Math.min(99, Math.round(score)));
}

export async function loadLeagueData() {
  const [league, users, rosters, state] = await Promise.all([
    getJSON(`${API}/league/${LEAGUE_ID}`),
    getJSON(`${API}/league/${LEAGUE_ID}/users`),
    getJSON(`${API}/league/${LEAGUE_ID}/rosters`),
    getJSON(`${API}/state/nfl`)
  ]);

  const usersById = Object.fromEntries(users.map(user => [user.user_id, user]));

  const teams = rosters.map(roster => {
    const user = usersById[roster.owner_id] || {};
    const settings = roster.settings || {};
    return {
      rosterId: roster.roster_id,
      owner: user.display_name || `Owner ${roster.roster_id}`,
      team: user.metadata?.team_name || user.display_name || `Team ${roster.roster_id}`,
      avatar: user.avatar
        ? `https://sleepercdn.com/avatars/thumbs/${user.avatar}`
        : "https://sleepercdn.com/images/v2/icons/player_default.webp",
      wins: settings.wins || 0,
      losses: settings.losses || 0,
      ties: settings.ties || 0,
      pointsFor: (settings.fpts || 0) + ((settings.fpts_decimal || 0) / 100),
      pointsAgainst: (settings.fpts_against || 0) + ((settings.fpts_against_decimal || 0) / 100)
    };
  }).sort((a,b) =>
    b.wins - a.wins ||
    a.losses - b.losses ||
    b.pointsFor - a.pointsFor
  );

  return {
    league,
    teams,
    currentWeek: Number(state.leg || state.week || 1),
    status: league.status || "preseason",
    season: league.season || "2026"
  };
}

export async function loadWeekMatchups(week, leagueData) {
  const raw = await getJSON(`${API}/league/${LEAGUE_ID}/matchups/${week}`);
  const teamByRoster = Object.fromEntries(
    leagueData.teams.map(team => [team.rosterId, team])
  );

  const grouped = {};
  raw.forEach(entry => {
    if (entry.matchup_id == null) return;
    grouped[entry.matchup_id] ||= [];
    grouped[entry.matchup_id].push({
      ...(teamByRoster[entry.roster_id] || {}),
      score: Number(entry.points || 0)
    });
  });

  return Object.entries(grouped).map(([matchupId, teams]) => ({
    matchupId,
    teams: teams.sort((a,b) => b.score - a.score)
  }));
}
