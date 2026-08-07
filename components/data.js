export const LEAGUE_ID = "1371503267833475072";
export const API = "https://api.sleeper.app/v1";

export async function getJSON(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

export function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function formatLeagueStatus(status) {
  const statuses = {
    pre_draft: "Pre-Draft",
    drafting: "Drafting",
    in_season: "Regular Season",
    post_season: "Postseason",
    complete: "Season Complete"
  };

  return statuses[status] || status || "Preseason";
}

export function calculatePower(team, maxPoints) {
  const base =
    team.wins === 0 && team.losses === 0
      ? 50
      : 20;

  const winScore = team.wins * 20;

  const pointScore = maxPoints
    ? (team.pointsFor / maxPoints) * 35
    : 0;

  const score = base + winScore + pointScore;

  return Math.max(
    1,
    Math.min(99, Math.round(score))
  );
}

export async function loadLeagueData() {
  const [league, users, rosters, state] =
    await Promise.all([
      getJSON(`${API}/league/${LEAGUE_ID}`),
      getJSON(`${API}/league/${LEAGUE_ID}/users`),
      getJSON(`${API}/league/${LEAGUE_ID}/rosters`),
      getJSON(`${API}/state/nfl`)
    ]);

  const usersById = Object.fromEntries(
    users.map(user => [user.user_id, user])
  );

  const teams = rosters
    .map(roster => {
      const user =
        usersById[roster.owner_id] || {};

      const settings =
        roster.settings || {};

      return {
        rosterId: roster.roster_id,

        ownerId: roster.owner_id,

        owner:
          user.display_name ||
          `Owner ${roster.roster_id}`,

        team:
          user.metadata?.team_name ||
          user.display_name ||
          `Team ${roster.roster_id}`,

        avatar: user.avatar
          ? `https://sleepercdn.com/avatars/thumbs/${user.avatar}`
          : "https://sleepercdn.com/images/v2/icons/player_default.webp",

        wins: settings.wins || 0,

        losses: settings.losses || 0,

        ties: settings.ties || 0,

        pointsFor:
          (settings.fpts || 0) +
          ((settings.fpts_decimal || 0) / 100),

        pointsAgainst:
          (settings.fpts_against || 0) +
          ((settings.fpts_against_decimal || 0) / 100),

        players: roster.players || [],

        starters: roster.starters || [],

        reserve: roster.reserve || [],

        taxi: roster.taxi || []
      };
    })
    .sort((a, b) =>
      b.wins - a.wins ||
      a.losses - b.losses ||
      b.pointsFor - a.pointsFor
    );

  const currentWeek = Number(
    state.leg ||
    state.week ||
    1
  );

  const teamByRoster = Object.fromEntries(
    teams.map(team => [
      team.rosterId,
      team
    ])
  );

  return {
    league,

    teams,

    teamByRoster,

    currentWeek,

    nflWeek: Number(state.week || currentWeek),

    status: league.status || "pre_draft",

    statusLabel:
      formatLeagueStatus(
        league.status
      ),

    season:
      league.season || "2026",

    playoffWeekStart:
      league.settings?.playoff_week_start ||
      null,

    totalTeams:
      league.total_rosters ||
      teams.length
  };
}

export async function loadWeekMatchups(
  week,
  leagueData
) {
  const raw = await getJSON(
    `${API}/league/${LEAGUE_ID}/matchups/${week}`
  );

  const grouped = {};

  raw.forEach(entry => {
    if (entry.matchup_id == null) {
      return;
    }

    grouped[entry.matchup_id] ||= [];

    const team =
      leagueData.teamByRoster[
        entry.roster_id
      ] || {
        rosterId: entry.roster_id,
        owner: "Unknown Owner",
        team: `Team ${entry.roster_id}`
      };

    grouped[entry.matchup_id].push({
      ...team,

      score:
        Number(entry.points || 0),

      players:
        entry.players || [],

      starters:
        entry.starters || [],

      playersPoints:
        entry.players_points || {}
    });
  });

  return Object.entries(grouped)
    .map(([matchupId, teams]) => ({
      matchupId,

      teams: teams.sort(
        (a, b) =>
          b.score - a.score
      )
    }))
    .sort(
      (a, b) =>
        Number(a.matchupId) -
        Number(b.matchupId)
    );
}

export async function loadTransactions(
  week
) {
  try {
    const transactions =
      await getJSON(
        `${API}/league/${LEAGUE_ID}/transactions/${week}`
      );

    return transactions
      .filter(transaction =>
        transaction.status === "complete"
      )
      .sort(
        (a, b) =>
          (b.status_updated || 0) -
          (a.status_updated || 0)
      );
  } catch (error) {
    console.warn(
      "Transactions unavailable:",
      error
    );

    return [];
  }
}

export async function loadDrafts() {
  try {
    return await getJSON(
      `${API}/league/${LEAGUE_ID}/drafts`
    );
  } catch (error) {
    console.warn(
      "Draft information unavailable:",
      error
    );

    return [];
  }
}

export async function loadDraftPicks(
  draftId
) {
  if (!draftId) {
    return [];
  }

  try {
    return await getJSON(
      `${API}/draft/${draftId}/picks`
    );
  } catch (error) {
    console.warn(
      "Draft picks unavailable:",
      error
    );

    return [];
  }
}

export async function loadPlayoffBracket() {
  try {
    const [
      winnersBracket,
      losersBracket
    ] = await Promise.all([
      getJSON(
        `${API}/league/${LEAGUE_ID}/winners_bracket`
      ),
      getJSON(
        `${API}/league/${LEAGUE_ID}/losers_bracket`
      )
    ]);

    return {
      winnersBracket,
      losersBracket
    };
  } catch (error) {
    console.warn(
      "Playoff bracket unavailable:",
      error
    );

    return {
      winnersBracket: [],
      losersBracket: []
    };
  }
}let playerCache = null;

export async function loadNFLPlayers() {
  if (playerCache) {
    return playerCache;
  }

  try {
    playerCache = await getJSON(
      `${API}/players/nfl`
    );

    return playerCache;
  } catch (error) {
    console.warn(
      "NFL player database unavailable:",
      error
    );

    return {};
  }
}

export function getPlayerName(
  playerId,
  players
) {
  const player = players?.[playerId];

  if (!player) {
    return playerId || "Unknown Player";
  }

  return (
    player.full_name ||
    `${player.first_name || ""} ${player.last_name || ""}`.trim() ||
    playerId
  );
}