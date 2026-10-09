
import {
  API,
  LEAGUE_ID,
  escapeHTML,
  loadTransactions,
  loadNFLPlayers,
  loadWeekMatchups,
  getPlayerName
} from "./data.js";

// SBF LEAGUE CENTER — 2026
// Sleeper live scoring + NFL game progress.
// All win probabilities are SBF model estimates.

const RIVALRIES = new Set([4, 10]);
const REFRESH_MS = 60000;

const weekCache = new Map();

let dataRef = null;
let selectedWeek = null;
let activeView = "week";
let teamFilter = "all";
let openPreview = null;
let schedulePromise = null;
let playersPromise = null;
let rankingsPromise = null;
let refreshTimer = null;
let refreshing = false;
let rendering = 0;
let latestRefresh = null;

const css = `
<style>
#matchups .sbf-tabs,
#matchups .sbf-controls {
  display:flex;
  gap:10px;
  flex-wrap:wrap;
  align-items:center;
  margin:0 0 20px;
}

#matchups .sbf-tabs button[aria-pressed="true"] {
  background:#ffae15;
  color:#111927;
  border-color:#ffae15;
  font-weight:900;
}

#matchups .sbf-select {
  background:#142337;
  color:#f4f7fc;
  border:1px solid #43536a;
  border-radius:9px;
  min-height:43px;
  padding:0 12px;
  max-width:100%;
}

#matchups .sbf-week-list {
  display:grid;
  gap:18px;
}

#matchups .sbf-week {
  border:1px solid #344258;
  border-radius:12px;
  padding:16px;
  background:#0f1b2b;
}

#matchups .sbf-current {
  border-color:#edaa31;
}

#matchups .sbf-week-title {
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:10px;
  flex-wrap:wrap;
  margin-bottom:12px;
}

#matchups .sbf-week-title h3 {
  margin:4px 0 0;
}

#matchups .sbf-kicker {
  color:#fbb936;
  font-weight:850;
  letter-spacing:.1em;
  text-transform:uppercase;
  font-size:.73rem;
}

#matchups .sbf-games {
  display:grid;
  grid-template-columns:
    repeat(auto-fit,minmax(min(100%,285px),1fr));
  gap:12px;
}

#matchups .sbf-game {
  border:1px solid #34445b;
  background:#142236;
  border-radius:10px;
  padding:14px;
  min-width:0;
}

#matchups .sbf-game-top {
  display:flex;
  justify-content:space-between;
  gap:10px;
  color:#acbdd1;
  font-size:.75rem;
  text-transform:uppercase;
  letter-spacing:.06em;
  margin-bottom:12px;
}

#matchups .sbf-side {
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:10px;
  margin:11px 0;
}

#matchups .sbf-side-name {
  display:flex;
  align-items:center;
  gap:9px;
  min-width:0;
}

#matchups .sbf-side-name strong {
  overflow-wrap:anywhere;
  line-height:1.25;
}

#matchups .sbf-avatar {
  width:36px;
  height:36px;
  border-radius:50%;
  background:#28364c;
  object-fit:cover;
  flex:none;
}

#matchups .sbf-score {
  font-weight:900;
  font-variant-numeric:tabular-nums;
  white-space:nowrap;
}

#matchups .sbf-winner {
  color:#54d3a1;
}

#matchups .sbf-preview-button {
  width:100%;
  margin-top:12px;
  background:rgba(255,175,25,.12);
  color:#ffc467;
  border:1px solid #ab7b2c;
  border-radius:8px;
  padding:10px 12px;
  cursor:pointer;
  font-weight:850;
}

#matchups .sbf-preview {
  border:1px solid #f3a924;
  border-radius:13px;
  background:radial-gradient(
    circle at 45% 0%,
    #183a47,
    #0c1625 55%,
    #0a1020
  );
  color:#f4f7ff;
  padding:clamp(16px,4vw,30px);
  margin-bottom:23px;
}

#matchups .sbf-preview[hidden] {
  display:none!important;
}

#matchups .sbf-preview-head {
  display:flex;
  justify-content:space-between;
  gap:12px;
  align-items:center;
  margin-bottom:20px;
  flex-wrap:wrap;
}

#matchups .sbf-preview-head button {
  background:transparent;
  border:1px solid #7f91a5;
  border-radius:8px;
  padding:8px 12px;
  color:#f5f6fa;
  cursor:pointer;
}

#matchups .sbf-faceoff {
  display:grid;
  grid-template-columns:
    minmax(0,1fr) auto minmax(0,1fr);
  text-align:center;
  align-items:center;
  gap:10px;
}

#matchups .sbf-faceoff img {
  display:block;
  width:70px;
  height:70px;
  object-fit:cover;
  margin:0 auto 7px;
  border-radius:50%;
  border:2px solid #eaa62c;
}

#matchups .sbf-faceoff h3 {
  font-size:clamp(.95rem,3vw,1.32rem);
  line-height:1.23;
  margin:4px 0;
  overflow-wrap:anywhere;
}

#matchups .sbf-faceoff small {
  color:#a9bad0;
}

#matchups .sbf-middle {
  font-weight:900;
  font-size:clamp(1.17rem,4.3vw,2.2rem);
  white-space:nowrap;
}

#matchups .sbf-middle small {
  display:block;
  font-size:.64rem;
  color:#aabbd0;
  letter-spacing:.09em;
  text-transform:uppercase;
  white-space:normal;
  font-weight:600;
}

#matchups .sbf-comparison {
  margin:20px 0;
  border-top:1px solid #33455b;
}

#matchups .sbf-comparison-row {
  display:grid;
  grid-template-columns:
    minmax(0,1fr) minmax(94px,1fr) minmax(0,1fr);
  gap:7px;
  align-items:center;
  text-align:center;
  padding:10px 0;
  border-bottom:1px solid #2c3b4e;
}

#matchups .sbf-comparison-row strong {
  overflow-wrap:anywhere;
}

#matchups .sbf-comparison-row span {
  color:#a9b7c9;
  text-transform:uppercase;
  font-size:.7rem;
  letter-spacing:.05em;
}

#matchups .sbf-metrics {
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:10px;
}

#matchups .sbf-metric {
  text-align:center;
  border:1px solid #35455a;
  background:#132237;
  border-radius:9px;
  padding:13px 6px;
}

#matchups .sbf-metric strong {
  display:block;
  font-size:clamp(.98rem,2.9vw,1.45rem);
  overflow-wrap:anywhere;
}

#matchups .sbf-metric span {
  font-size:.67rem;
  color:#aab9ca;
  text-transform:uppercase;
  letter-spacing:.06em;
}

#matchups .sbf-section {
  margin-top:22px;
  border-top:1px solid #33455b;
  padding-top:16px;
}

#matchups .sbf-section h4 {
  font-size:.88rem;
  text-transform:uppercase;
  letter-spacing:.1em;
  margin:0 0 12px;
}

#matchups .sbf-moment {
  display:flex;
  justify-content:space-between;
  flex-wrap:wrap;
  gap:7px;
  padding:8px 0;
  border-bottom:1px solid #27364a;
}

#matchups .sbf-moment span {
  color:#a6b7ca;
}

#matchups .sbf-note {
  color:#adbed0;
  font-size:.78rem;
  line-height:1.5;
  margin:12px 0 0;
}

#matchups .sbf-predict {
  border:1px solid #aa791e;
  background:linear-gradient(
    120deg,
    rgba(244,165,19,.16),
    rgba(16,34,52,.75)
  );
  padding:17px;
  border-radius:11px;
  margin:22px 0;
}

#matchups .sbf-predict h4 {
  font-size:clamp(1.07rem,3vw,1.38rem);
  margin:7px 0 14px;
  overflow-wrap:anywhere;
}

#matchups .sbf-predict-scores {
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:10px;
  margin:13px 0;
}

#matchups .sbf-predict-team {
  border:1px solid #6b6148;
  background:rgba(0,0,0,.14);
  border-radius:9px;
  padding:12px;
  min-width:0;
}

#matchups .sbf-predict-team span {
  display:block;
  font-size:.78rem;
  color:#c7d2df;
  overflow-wrap:anywhere;
}

#matchups .sbf-predict-team strong {
  display:block;
  font-size:clamp(1.2rem,4vw,1.85rem);
  font-variant-numeric:tabular-nums;
}

#matchups .sbf-bar {
  display:flex;
  height:14px;
  width:100%;
  border-radius:8px;
  overflow:hidden;
  background:#293749;
}

#matchups .sbf-bar-a {
  background:#efac25;
}

#matchups .sbf-bar-b {
  background:#21b8b0;
}

#matchups .sbf-bar-legend {
  display:flex;
  justify-content:space-between;
  gap:10px;
  font-size:.78rem;
  margin:8px 0 13px;
  font-weight:750;
}

#matchups .sbf-roast {
  line-height:1.55;
  color:#e7edf6;
  font-size:.91rem;
}

#matchups .sbf-chart-row {
  display:grid;
  grid-template-columns:57px minmax(0,1fr) 90px;
  gap:7px;
  align-items:center;
  margin:8px 0;
  font-size:.75rem;
}

#matchups .sbf-chart-track {
  position:relative;
  height:18px;
  background:#1a2a40;
}

#matchups .sbf-chart-track:after {
  content:"";
  position:absolute;
  left:50%;
  width:1px;
  height:100%;
  background:#a5aeb9;
}

#matchups .sbf-chart-bar {
  position:absolute;
  height:11px;
  top:3px;
}

#matchups .sbf-chart-bar.a {
  background:#edaa22;
  right:50%;
}

#matchups .sbf-chart-bar.b {
  background:#1fb4ac;
  left:50%;
}

#matchups .sbf-live {
  display:inline-flex;
  align-items:center;
  gap:5px;
  color:#49d5a0;
  font-size:.76rem;
  font-weight:850;
}

#matchups .sbf-refresh {
  color:#b6c6d7;
  font-size:.77rem;
}

@media(max-width:530px) {
  #matchups .sbf-faceoff img {
    width:51px;
    height:51px;
  }

  #matchups .sbf-faceoff {
    gap:6px;
  }

  #matchups .sbf-comparison-row {
    grid-template-columns:
      minmax(0,1fr) 102px minmax(0,1fr);
  }

  #matchups .sbf-week {
    padding:12px;
  }

  #matchups .sbf-chart-row {
    grid-template-columns:
      43px minmax(0,1fr) 82px;
  }
}
</style>`;

const number = n => Number(n || 0);
const fmt = n => number(n).toFixed(2);
const clean = x => escapeHTML(x ?? "");

const nameOf = team =>
  clean(team?.team || "Unknown Team");

const regularWeeks = data =>
  Number(data.playoffWeekStart) > 1
    ? Number(data.playoffWeekStart) - 1
    : 14;

const clampWeek = week =>
  Math.max(1, Math.min(18, Number(week) || 1));

const currentWeek = data =>
  Number(data.currentWeek || 1);

const record = team =>
  `${number(team.wins)}-${number(team.losses)}${
    number(team.ties) ? `-${team.ties}` : ""
  }`;

const avatar = team => `
  <img
    class="sbf-avatar"
    alt=""
    loading="lazy"
    src="${clean(
      team?.avatar ||
      "https://sleepercdn.com/images/v2/icons/player_default.webp"
    )}"
  >
`;

function weekTag(week, data) {
  const result = [];

  if (week === currentWeek(data)) {
    result.push("● Current Week");
  }

  if (RIVALRIES.has(week)) {
    result.push("🔥 Rivalry Week");
  }

  if (week === regularWeeks(data)) {
    result.push("🏆 SBF Bowl Week");
  }

  return result.join(" · ") ||
    (week < currentWeek(data)
      ? "Final Results"
      : "Upcoming Matchups");
}

/*
  FRESH SLEEPER SCORING

  Bypass browser cache when refreshing live
  scores. Keep matchup data in the same format
  as the existing data.js functions.
*/

async function fetchFreshMatchups(week, data) {
  const response = await fetch(
    `${API}/league/${LEAGUE_ID}/matchups/${week}`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error(
      `Sleeper score request failed: ${response.status}`
    );
  }

  const raw = await response.json();
  const groups = new Map();

  for (const entry of raw) {
    if (entry.matchup_id == null) continue;

    const key = String(entry.matchup_id);

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    const base =
      data.teamByRoster[entry.roster_id] || {
        rosterId: entry.roster_id,
        team: `Team ${entry.roster_id}`
      };

    groups.get(key).push({
      ...base,
      score: number(entry.points),
      starters: entry.starters || [],
      players: entry.players || [],
      playersPoints: entry.players_points || {}
    });
  }

  return [...groups]
    .map(([matchupId, teams]) => ({
      matchupId,
      teams
    }))
    .sort(
      (a, b) =>
        number(a.matchupId) - number(b.matchupId)
    );
}

async function getWeek(week, data, fresh = false) {
  const old = weekCache.get(week);

  if (old && !fresh) {
    return old;
  }

  const fetcher =
    fresh || week === currentWeek(data)
      ? fetchFreshMatchups(week, data)
      : loadWeekMatchups(week, data);

  const task = fetcher.catch(error => {
    console.warn(
      "Sleeper matchups unavailable:",
      error
    );

    return old || [];
  });

  weekCache.set(week, task);

  return task;
}

async function getSchedule(data) {
  if (!schedulePromise) {
    schedulePromise = Promise.all(
      Array.from(
        { length: regularWeeks(data) },
        (_, i) => i + 1
      ).map(async week => ({
        week,
        games: await getWeek(week, data)
      }))
    );
  }

  const snapshot = await schedulePromise;

  return Promise.all(
    snapshot.map(async entry =>
      entry.week === currentWeek(data)
        ? {
            week: entry.week,
            games: await getWeek(entry.week, data)
          }
        : entry
    )
  );
}

function getPlayers() {
  if (!playersPromise) {
    playersPromise =
      loadNFLPlayers().catch(() => ({}));
  }

  return playersPromise;
}

function getRankings() {
  if (!rankingsPromise) {
    rankingsPromise = fetch(
      "data/power-rankings.json",
      { cache: "no-store" }
    )
      .then(response =>
        response.ok ? response.json() : null
      )
      .catch(() => null);
  }

  return rankingsPromise;
}

function gameState(week, data, game) {
  if (week < currentWeek(data)) {
    return "Final";
  }

  if (week > currentWeek(data)) {
    return "Upcoming";
  }

  return game.teams.some(
    team => number(team.score) !== 0
  )
    ? "Live / This Week"
    : "This Week";
}

function gameCard(game, week, data) {
  const final = week < currentWeek(data);

  return `
    <article class="sbf-game">
      <div class="sbf-game-top">
        <span>
          Matchup ${clean(game.matchupId)}
        </span>

        <span>
          ${clean(gameState(week, data, game))}
        </span>
      </div>

      ${(game.teams || []).map(team => {
        const rival = game.teams.find(
          other => other !== team
        );

        const won =
          final &&
          rival &&
          number(team.score) > number(rival.score);

        return `
          <div class="sbf-side">
            <div class="sbf-side-name">
              ${avatar(team)}

              <strong class="${
                won ? "sbf-winner" : ""
              }">
                ${nameOf(team)}
              </strong>
            </div>

            <span class="sbf-score">
              ${
                final || number(team.score) !== 0
                  ? fmt(team.score)
                  : "—"
              }
            </span>
          </div>
        `;
      }).join("")}

      <button
        class="sbf-preview-button"
        type="button"
        data-preview-week="${week}"
        data-preview-game="${clean(game.matchupId)}"
      >
        ${
          final
            ? "View Game Breakdown →"
            : "View Game Preview →"
        }
      </button>
    </article>
  `;
}

function weekGrid(games, week, data) {
  const shown =
    teamFilter === "all"
      ? games
      : games.filter(game =>
          game.teams.some(
            team =>
              String(team.rosterId) === teamFilter
          )
        );

  if (!shown.length) {
    return `
      <p class="sbf-note">
        ${
          games.length
            ? "No matchups for this team."
            : "Sleeper has not published matchups for this week."
        }
      </p>
    `;
  }

  return shown
    .map(game => gameCard(game, week, data))
    .join("");
}

function scheduleMarkup(schedule, data) {
  return schedule.map(({ week, games }) => `
    <section
      class="sbf-week ${
        week === currentWeek(data)
          ? "sbf-current"
          : ""
      }"
      id="sbf-week-${week}"
    >
      <div class="sbf-week-title">
        <div>
          <span class="sbf-kicker">
            ${clean(weekTag(week, data))}
          </span>

          <h3>Week ${week}</h3>
        </div>

        <button
          class="secondary"
          type="button"
          data-open-week="${week}"
        >
          Week View →
        </button>
      </div>

      <div
        class="sbf-games"
        data-week-grid="${week}"
      >
        ${weekGrid(games, week, data)}
      </div>
    </section>
  `).join("");
}

/*
  ORIGINAL TRANSACTION FEED
*/

function describeTransaction(tx, data, players) {
  const teams = (tx.roster_ids || [])
    .map(id => data.teamByRoster[id])
    .filter(Boolean);

  return {
    type: ({
      trade: "Trade",
      waiver: "Waiver Claim",
      free_agent: "Free Agent Move"
    })[tx.type] || "Transaction",

    teams: teams.length
      ? teams.map(team => team.team).join(", ")
      : "League transaction",

    adds: Object.keys(tx.adds || {}).map(
      id => getPlayerName(id, players)
    ),

    drops: Object.keys(tx.drops || {}).map(
      id => getPlayerName(id, players)
    )
  };
}

function transactionCards(
  transactions,
  data,
  players,
  week
) {
  if (!transactions.length) {
    return `
      <article class="panel">
        No completed transactions available
        for Week ${week}.
      </article>
    `;
  }

  return transactions.slice(0, 8)
    .map(transaction => {
      const item = describeTransaction(
        transaction,
        data,
        players
      );

      return `
        <article class="panel transaction-card">
          <p class="eyebrow">
            ${clean(item.type)}
          </p>

          <h3>${clean(item.teams)}</h3>

          ${
            item.adds.length
              ? `<p>
                  <strong>Added:</strong>
                  <br>
                  ${item.adds.map(
                    name => `➕ ${clean(name)}`
                  ).join("<br>")}
                </p>`
              : ""
          }

          ${
            item.drops.length
              ? `<p>
                  <strong>Dropped:</strong>
                  <br>
                  ${item.drops.map(
                    name => `➖ ${clean(name)}`
                  ).join("<br>")}
                </p>`
              : ""
          }
        </article>
      `;
    })
    .join("");
}

/*
  HISTORICAL SCORING MODEL

  Only finished fantasy weeks count toward
  scoring averages and pregame forecasts.
*/

function historicalScores(
  schedule,
  rosterId,
  data
) {
  return schedule
    .filter(
      entry => entry.week < currentWeek(data)
    )
    .sort(
      (a, b) => a.week - b.week
    )
    .flatMap(entry => {
      const team = entry.games
        .flatMap(game => game.teams)
        .find(
          team =>
            String(team.rosterId) ===
            String(rosterId)
        );

      return team
        ? [number(team.score)]
        : [];
    });
}

function scoreProfile(scores) {
  if (!scores.length) return null;

  const average =
    scores.reduce(
      (sum, points) => sum + points,
      0
    ) / scores.length;

  const recent = scores.slice(-3);

  const recentAverage =
    recent.reduce(
      (sum, points) => sum + points,
      0
    ) / recent.length;

  const variance =
    scores.reduce(
      (sum, points) =>
        sum + (points - average) ** 2,
      0
    ) / Math.max(1, scores.length - 1);

  return {
    mean:
      .45 * average +
      .55 * recentAverage,

    recentAverage,

    deviation:
      Math.max(18, Math.sqrt(variance)),

    count: scores.length,

    recentCount: recent.length
  };
}

/*
  NFL GAME STATUS

  The scoreboard identifies whether each
  NFL team is scheduled, playing or finished.

  If this source is unavailable, the site
  suppresses in-game probabilities instead
  of inventing a remaining-time estimate.
*/

const normalizeNFL = abbreviation =>
  ({
    JAC: "JAX",
    WSH: "WAS",
    LA: "LAR",
    STL: "LAR",
    OAK: "LV",
    SD: "LAC"
  })[
    String(abbreviation || "").toUpperCase()
  ] ||
  String(abbreviation || "").toUpperCase();

async function nflProgress(week, data) {
  const year = Number(data.season || 2026);

  const url =
    "https://site.api.espn.com/apis/site/v2/" +
    "sports/football/nfl/scoreboard" +
    `?dates=${year}` +
    "&seasontype=2" +
    `&week=${week}` +
    "&limit=40";

  try {
    const response = await fetch(
      url,
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error(
        `NFL scoreboard ${response.status}`
      );
    }

    const scoreboard = await response.json();

    if (
      !Array.isArray(scoreboard.events) ||
      !scoreboard.events.length
    ) {
      return null;
    }

    const statusByTeam = {};

    for (const event of scoreboard.events) {
      const state =
        event.status?.type?.state || "pre";

      const period =
        Number(event.status?.period || 0);

      const clock =
        Number(event.status?.clock || 0);

      // NFL regulation is four 900-second quarters.
      const remaining =
        state === "pre"
          ? 1
          : state === "post"
            ? 0
            : Math.max(
                .01,
                Math.min(
                  1,
                  (
                    (4 - period) * 900 + clock
                  ) / 3600
                )
              );

      const competitors =
        event.competitions?.[0]?.competitors ||
        [];

      for (const competitor of competitors) {
        const abbreviation = normalizeNFL(
          competitor.team?.abbreviation
        );

        if (abbreviation) {
          statusByTeam[abbreviation] = {
            state,
            remaining
          };
        }
      }
    }

    for (
      const bye of scoreboard.week?.teamsOnBye || []
    ) {
      statusByTeam[
        normalizeNFL(bye.abbreviation)
      ] = {
        state: "post",
        remaining: 0
      };
    }

    return statusByTeam;

  } catch (error) {
    console.warn(
      "NFL game-status feed unavailable.",
      error
    );

    return null;
  }
}

/*
  ESTIMATED PLAYER BASELINES

  Prefer a player's own recent fantasy points.
  Use a positional baseline if there are fewer
  than two prior starts in available history.

  These are estimates, not provider projections.
*/

const positionBaseline = {
  QB: 21,
  RB: 13,
  WR: 12,
  TE: 9,
  K: 8,
  DEF: 8,
  DB: 6,
  DL: 7,
  LB: 7
};

function starterBaseline(
  playerId,
  schedule,
  players
) {
  const previous = [];

  for (const entry of schedule) {
    for (const game of entry.games) {
      for (const team of game.teams) {
        if (
          !(team.starters || []).includes(playerId)
        ) {
          continue;
        }

        const value = Number(
          team.playersPoints?.[playerId]
        );

        if (Number.isFinite(value)) {
          previous.push({
            week: entry.week,
            points: value
          });
        }
      }
    }
  }

  previous.sort(
    (a, b) => a.week - b.week
  );

  if (previous.length >= 2) {
    const last = previous.slice(-3);

    return Math.max(
      1,
      last.reduce(
        (sum, entry) =>
          sum + entry.points,
        0
      ) / last.length
    );
  }

  const position =
    players?.[playerId]?.position ||
    (
      /^[A-Z]{2,3}$/.test(playerId)
        ? "DEF"
        : "WR"
    );

  return positionBaseline[position] ?? 10;
}

/*
  LIVE STARTER FORECAST

  Final NFL game: no remaining points.
  Upcoming NFL game: full estimated baseline.
  Game in progress: estimated portion remaining.

  The actual points already scored are always
  taken directly from Sleeper.
*/

function liveStarterForecast(
  team,
  profile,
  schedule,
  players,
  progress
) {
  if (!progress || !profile) {
    return null;
  }

  const starters =
    (team.starters || []).filter(Boolean);

  if (!starters.length) {
    return null;
  }

  let totalBaseline = 0;
  let remainingBaseline = 0;
  let verified = 0;

  const unplayed = [];
  const active = [];

  for (const id of starters) {
    const player = players?.[id];

    const nflTeam = normalizeNFL(
      player?.team ||
      (
        /^[A-Z]{2,3}$/.test(id)
          ? id
          : ""
      )
    );

    const game = progress[nflTeam];

    const baseline = starterBaseline(
      id,
      schedule,
      players
    );

    totalBaseline += baseline;

    if (!game) continue;

    verified++;

    if (game.state === "pre") {
      unplayed.push(
        getPlayerName(id, players)
      );
    }

    if (game.state === "in") {
      active.push(
        getPlayerName(id, players)
      );
    }

    remainingBaseline +=
      baseline * game.remaining;
  }

  // Do not publish live win chances if a
  // starting player's game cannot be verified.
  if (
    verified !== starters.length ||
    totalBaseline <= 0
  ) {
    return null;
  }

  const scale = Math.max(
    .65,
    Math.min(
      1.5,
      profile.mean / totalBaseline
    )
  );

  const remaining = Math.max(
    0,
    remainingBaseline * scale
  );

  const exposure = Math.max(
    0,
    Math.min(
      1,
      remainingBaseline / totalBaseline
    )
  );

  const actual = number(team.score);

  return {
    actual,
    remaining,

    projected:
      actual + remaining,

    sd: Math.max(
      2,
      profile.deviation *
      Math.sqrt(exposure)
    ),

    unplayed,
    active,
    exposure,

    completed:
      exposure === 0
  };
}

/*
  ESTIMATED WIN PROBABILITY

  This uses forecasted scoring difference and
  remaining scoring uncertainty.
*/

function probability(
  leftProjected,
  rightProjected,
  leftSd,
  rightSd,
  samples = 8
) {
  const difference =
    leftProjected - rightProjected;

  const scale = Math.max(
    1.5,
    Math.sqrt(
      leftSd ** 2 +
      rightSd ** 2
    )
  );

  const raw =
    1 /
    (
      1 +
      Math.exp(
        -1.702 * difference / scale
      )
    );

  const shrink = Math.min(
    1,
    samples / 6
  );

  return Math.max(
    .01,
    Math.min(
      .99,
      .5 + (raw - .5) * shrink
    )
  );
}

/*
  RANDOMIZED SBF TRASH-TALK ENGINE

  Different matchup/week combinations use
  different lines.

  Commentary also changes when the live
  scoreboard crosses meaningful thresholds.
*/

function hash(text) {
  let h = 2166136261;

  for (
    let i = 0;
    i < text.length;
    i++
  ) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  return h >>> 0;
}

const choose = (choices, key, salt) =>
  choices[
    hash(`${key}|${salt}`) %
    choices.length
  ];

function commentary(
  a,
  b,
  pick,
  aProfile,
  bProfile,
  edge,
  week,
  data,
  mode,
  aScore,
  bScore
) {
  const isA =
    String(pick.rosterId) ===
    String(a.rosterId);

  const other = isA ? b : a;

  const best =
    isA ? aProfile : bProfile;

  const worst =
    isA ? bProfile : aProfile;

  const key = [
    data.season,
    week,
    Math.min(a.rosterId, b.rosterId),
    Math.max(a.rosterId, b.rosterId),
    mode,
    Math.floor(aScore / 15),
    Math.floor(bScore / 15)
  ].join("|");

  const opening = [
    `The SBF stat department crunched the numbers, swore twice, and picked ${pick.team}.`,

    `Our prediction machine picked ${pick.team} and promptly requested hazard pay for covering this shitshow.`,

    `We consulted the spreadsheet, the fantasy gods, and the bottom of a beer can. The verdict: ${pick.team}.`,

    `The SBF crystal ball is mostly cracked glass and bad decisions, but it's flashing ${pick.team}.`,

    `The analytics department has spoken, and ${pick.team} is the least embarrassing choice on paper.`,

    `Our unlicensed fantasy experts are backing ${pick.team}. Lawsuits can be sent directly to the group chat.`,

    `After inspecting both rosters and our questionable life choices, we're taking ${pick.team}.`,

    `Somewhere a sober analyst is weeping. Meanwhile, we're picking ${pick.team}.`,

    `We asked the numbers for a winner. They told us ${pick.team} and asked us to stop wasting their damn time.`,

    `SBF headquarters has made its pick: ${pick.team}. Try not to make us look like assholes.`
  ];

  let middle;

  if (mode === "live") {
    middle = edge < 5
      ? [
          `This thing is tighter than the league's group chat after a vetoed trade. One play can flip the whole damn forecast.`,

          `Nobody gets to celebrate yet. One garbage-time catch could turn somebody's Sunday into a spectacular kick in the teeth.`,

          `Both managers are in a live-score hostage situation and neither deserves sympathy.`,

          `This is a coin flip drenched in beer and regret. Hold onto your asses.`,

          `These live projections are closer than anybody's blood pressure should allow.`
        ]
      : [
          `${pick.team} has the better live outlook, but ${other.team} still has football left. Start talking shit at your own risk.`,

          `The scoreboard is moving and the SBF forecast is taking sides. Somebody's Monday is about to suck.`,

          `${other.team} had better find some points or start preparing its weekly excuse manifesto.`,

          `This matchup has all the makings of a group-chat execution, but we aren't calling it until the remaining starters are done.`,

          `The live math favors ${pick.team}. That doesn't mean the fantasy gods can't still pants us on national television.`,

          `One team looks like it's cooking. The other is sweating through its hoodie while refreshing Sleeper.`
        ];

  } else if (edge < 3) {
    middle = [
      `These projections are so close a backup tight end farting near the end zone could decide it.`,

      `Neither team has earned the right to talk this much shit. This is a full-blown coin flip.`,

      `This could come down to one garbage-time reception and a phone being launched across the room.`,

      `Both managers are about one busted lineup decision away from getting roasted into next week.`,

      `Even our calculator is afraid to commit. What a magnificent pile of bullshit.`
    ];

  } else if (edge >= 20) {
    middle = [
      `${other.team} looks like it brought a pool noodle to a chainsaw fight.`,

      `This is starting to look like a public ass-whipping with fantasy points attached.`,

      `${other.team} might want to check if Sleeper has an emergency mercy-rule button.`,

      `The projected gap is big enough to fit every shitty excuse ${other.team} is drafting right now.`,

      `If the math holds, somebody is getting folded like a cheap lawn chair on Sunday.`
    ];

  } else if (
    best.recentAverage + 6 <
    worst.recentAverage
  ) {
    middle = [
      `Here's the nasty twist: ${other.team} has actually been hotter lately. This pick might make us look like complete clowns.`,

      `Recent form favors ${other.team}, so ${pick.team} better not get cocky about this one.`,

      `The overall numbers lean ${pick.team}, but recent momentum says we might owe the group chat an apology.`,

      `This is either sharp analysis or premium-grade bullshit. Recent scores are threatening the pick.`
    ];

  } else {
    middle = [
      `${pick.team} has the better statistical profile, but that isn't a damn championship trophy.`,

      `One 40-point performance could kick this prediction straight in the teeth.`,

      `${other.team} can still steal it and become absolutely insufferable in the group chat.`,

      `The spreadsheet picked ${pick.team}. Its insurance policy excludes idiot lineup decisions.`,

      `It's an edge, not a guarantee. Someone tell the cocky bastard who manages ${pick.team}.`,

      `We're confident enough to talk shit and smart enough not to bet the house on it.`
    ];
  }

  const finish = [
    `If we're wrong, please direct complaints to the nearest empty beer can.`,

    `Somebody's getting dragged through the group chat Monday morning. We're bringing popcorn.`,

    `The SBF model offers absolutely no refunds and even less emotional support.`,

    `If this prediction ages badly, we're blaming the commissioner and deleting the evidence.`,

    `Set your lineups, shut your mouths, and let the fantasy gods embarrass somebody.`,

    `The only sure thing is that one manager will be unbearable about this result.`,

    `If the underdog wins, congratulations on making our analytics staff look like assholes.`,

    `As always, projections are subject to injuries, miracles, and catastrophic stupidity.`,

    `This week somebody wins a matchup and somebody loses their dignity.`,

    `The losing manager's excuse tour begins the moment the final whistle blows.`
  ];

  const liveScores =
    mode === "live"
      ? `${a.team} has ${fmt(aScore)} actual points and ${b.team} has ${fmt(bScore)}. `
      : "";

  const stats =
    `${liveScores}` +
    `${pick.team} has averaged ` +
    `${fmt(best.recentAverage)} points recently ` +
    `versus ${fmt(worst.recentAverage)} ` +
    `for ${other.team}. ` +
    `The model currently sees about a ` +
    `${fmt(edge)}-point gap.`;

  return [
    choose(opening, key, 1),
    stats,
    choose(middle, key, 2),
    choose(finish, key, 3)
  ].join(" ");
}

/*
  SBF PREGAME / LIVE PREDICTION

  Upcoming weeks: Historical forecast.
  Current week: Live forecast if game states
  can be verified.
  Completed weeks: Final breakdown only.
*/

function predictor(
  a,
  b,
  week,
  data,
  schedule,
  players,
  progress
) {
  if (week < currentWeek(data)) {
    return "";
  }

  const aProfile = scoreProfile(
    historicalScores(
      schedule,
      a.rosterId,
      data
    )
  );

  const bProfile = scoreProfile(
    historicalScores(
      schedule,
      b.rosterId,
      data
    )
  );

  if (
    !aProfile ||
    !bProfile ||
    Math.min(
      aProfile.count,
      bProfile.count
    ) < 2
  ) {
    return `
      <section class="sbf-predict">
        <span class="sbf-kicker">
          🔮 SBF Network Prediction
        </span>

        <h4>Prediction coming soon</h4>

        <p class="sbf-note">
          At least two completed fantasy weeks
          per team are needed.
        </p>
      </section>
    `;
  }

  const thisWeek =
    week === currentWeek(data);

  const liveA = thisWeek
    ? liveStarterForecast(
        a,
        aProfile,
        schedule,
        players,
        progress
      )
    : null;

  const liveB = thisWeek
    ? liveStarterForecast(
        b,
        bProfile,
        schedule,
        players,
        progress
      )
    : null;

  const live = Boolean(
    liveA && liveB
  );

  const startedPlayers =
    live &&
    (
      [
        ...liveA.active,
        ...liveB.active
      ].length > 0 ||
      number(a.score) !== 0 ||
      number(b.score) !== 0
    );

  const scoresStarted =
    thisWeek &&
    (
      number(a.score) !== 0 ||
      number(b.score) !== 0
    );

  const projA = live
    ? liveA.projected
    : aProfile.mean;

  const projB = live
    ? liveB.projected
    : bProfile.mean;

  const sdA = live
    ? liveA.sd
    : aProfile.deviation;

  const sdB = live
    ? liveB.sd
    : bProfile.deviation;

  const estimateAllowed =
    live || !scoresStarted;

  const oddsA = estimateAllowed
    ? Math.round(
        probability(
          projA,
          projB,
          sdA,
          sdB,
          Math.min(
            aProfile.count,
            bProfile.count
          )
        ) * 100
      )
    : null;

  const pick =
    projA >= projB ? a : b;

  const edge = Math.abs(
    projA - projB
  );

  const mode =
    startedPlayers ? "live" : "pregame";

  const copy = commentary(
    a,
    b,
    pick,
    aProfile,
    bProfile,
    edge,
    week,
    data,
    mode,
    number(a.score),
    number(b.score)
  );

  const tagline = startedPlayers
    ? "🟢 LIVE IN-GAME FORECAST"
    : "🔮 SBF NETWORK PREGAME PREDICTION";

  const scoreTitle = live
    ? "Live projected finish"
    : "Projected fantasy score";

  const uncertaintyNote = live
    ? `Sleeper supplies actual fantasy points; remaining points are estimated using previous player scores and remaining NFL game clock. This is NOT an official Sleeper projection.`
    : scoresStarted
      ? `Sleeper's live scores are shown below, but the NFL game-status feed is unavailable or incomplete. We are displaying historical pregame estimates, NOT live win probabilities.`
      : `Pregame estimate based on completed fantasy weeks; does not use injury reports, individual player projections, or unplayed lineup changes.`;

  return `
    <section
      class="sbf-predict"
      aria-label="SBF prediction"
    >
      <span class="sbf-kicker">
        ${tagline}
      </span>

      <h4>
        ${
          estimateAllowed
            ? (
                edge < 3
                  ? `Too close to call — slight lean: ${nameOf(pick)}`
                  : `${nameOf(pick)} to win`
              )
            : "Live win probability temporarily unavailable"
        }
      </h4>

      ${
        thisWeek
          ? `<p class="sbf-note">
              Sleeper points right now:
              <strong>
                ${nameOf(a)} ${fmt(a.score)}
                ·
                ${nameOf(b)} ${fmt(b.score)}
              </strong>
            </p>`
          : ""
      }

      <div class="sbf-predict-scores">
        <div class="sbf-predict-team">
          <span>${nameOf(a)}</span>
          <strong>${fmt(projA)}</strong>
          <span>${scoreTitle}</span>
        </div>

        <div class="sbf-predict-team">
          <span>${nameOf(b)}</span>
          <strong>${fmt(projB)}</strong>
          <span>${scoreTitle}</span>
        </div>
      </div>

      ${
        oddsA != null
          ? `
            <div
              class="sbf-bar"
              role="img"
              aria-label="Estimated win chance: ${clean(a.team)} ${oddsA} percent, ${clean(b.team)} ${100 - oddsA} percent"
            >
              <span
                class="sbf-bar-a"
                style="width:${oddsA}%"
              ></span>

              <span
                class="sbf-bar-b"
                style="width:${100 - oddsA}%"
              ></span>
            </div>

            <div class="sbf-bar-legend">
              <span>
                ${oddsA}% ${nameOf(a)}
              </span>

              <span>
                ${100 - oddsA}% ${nameOf(b)}
              </span>
            </div>
          `
          : ""
      }

      <p class="sbf-roast">
        <strong>Why this pick:</strong>
        ${clean(copy)}
      </p>

      ${
        live
          ? `<p class="sbf-note">
              <strong>Yet to play:</strong>
              ${nameOf(a)}:
              ${clean(
                liveA.unplayed
                  .slice(0, 5)
                  .join(", ") || "None"
              )}
              ·
              ${nameOf(b)}:
              ${clean(
                liveB.unplayed
                  .slice(0, 5)
                  .join(", ") || "None"
              )}.
            </p>`
          : ""
      }

      <p class="sbf-note">
        ${clean(uncertaintyNote)}

        Estimated probabilities are not
        betting odds.

        ${
          thisWeek
            ? "Refreshes every 60 seconds while this page is open."
            : ""
        }
      </p>
    </section>
  `;
}

/*
  HEAD-TO-HEAD HISTORY
*/

function priorMeetings(
  schedule,
  week,
  a,
  b,
  data
) {
  return schedule
    .filter(
      entry =>
        entry.week < week &&
        entry.week < currentWeek(data)
    )
    .flatMap(({ week: w, games }) =>
      games
        .filter(game =>
          [a.rosterId, b.rosterId].every(
            id =>
              game.teams.some(
                team =>
                  String(team.rosterId) ===
                  String(id)
              )
          )
        )
        .map(game => {
          const x = game.teams.find(
            team =>
              String(team.rosterId) ===
              String(a.rosterId)
          );

          const y = game.teams.find(
            team =>
              String(team.rosterId) ===
              String(b.rosterId)
          );

          return {
            week: w,
            a: number(x.score),
            b: number(y.score),

            margin: Math.abs(
              number(x.score) -
              number(y.score)
            )
          };
        })
    )
    .filter(
      game =>
        game.a !== 0 ||
        game.b !== 0
    );
}

function comparisonRow(
  label,
  left,
  right
) {
  return `
    <div class="sbf-comparison-row">
      <strong>${clean(left)}</strong>
      <span>${clean(label)}</span>
      <strong>${clean(right)}</strong>
    </div>
  `;
}

function previewMarkup(
  game,
  week,
  data,
  schedule,
  rankings,
  players,
  progress
) {
  const [a, b] = (game.teams || [])
    .slice()
    .sort(
      (x, y) =>
        number(x.rosterId) -
        number(y.rosterId)
    );

  if (!a || !b) {
    return `<p>Matchup unavailable.</p>`;
  }

  const meetings = priorMeetings(
    schedule,
    week,
    a,
    b,
    data
  );

  const winsA = meetings.filter(
    game => game.a > game.b
  ).length;

  const winsB = meetings.filter(
    game => game.b > game.a
  ).length;

  const recent =
    meetings[meetings.length - 1];

  const biggest = meetings
    .slice()
    .sort(
      (x, y) => y.margin - x.margin
    )[0];

  const closest = meetings
    .slice()
    .sort(
      (x, y) => x.margin - y.margin
    )[0];

  const avg = id => {
    const scores = historicalScores(
      schedule,
      id,
      data
    );

    return scores.length
      ? fmt(
          scores.reduce(
            (x, y) => x + y,
            0
          ) / scores.length
        )
      : "—";
  };

  const ranked = Object.fromEntries(
    (rankings?.teams || []).map(
      row => [
        String(row.roster_id),
        row.rank
      ]
    )
  );

  const standings = Object.fromEntries(
    data.teams.map(
      (team, i) => [
        String(team.rosterId),
        i + 1
      ]
    )
  );

  const final =
    week < currentWeek(data);

  const chartMax = Math.max(
    1,
    ...meetings.map(
      game => game.margin
    )
  );

  return `
    <div class="sbf-preview-head">
      <span class="sbf-kicker">
        Week ${week} · SBF Network ·
        ${
          final
            ? "Final Breakdown"
            : "Game Preview"
        }
      </span>

      <div>
        <button
          type="button"
          data-refresh-preview
        >
          ↻ Refresh
        </button>

        <button
          type="button"
          data-close-preview
        >
          Close ×
        </button>
      </div>
    </div>

    <div class="sbf-faceoff">
      <div>
        ${avatar(a)}
        <h3>${nameOf(a)}</h3>
        <small>${record(a)} overall</small>
      </div>

      <div class="sbf-middle">
        ${
          final
            ? `${fmt(a.score)} – ${fmt(b.score)}`
            : `${winsA} – ${winsB}`
        }

        <small>
          ${
            final
              ? "Final points"
              : "2026 head to head"
          }
        </small>
      </div>

      <div>
        ${avatar(b)}
        <h3>${nameOf(b)}</h3>
        <small>${record(b)} overall</small>
      </div>
    </div>

    ${
      RIVALRIES.has(week) ||
      week === regularWeeks(data)
        ? `<p
            class="sbf-kicker"
            style="margin-top:16px"
          >
            ${clean(weekTag(week, data))}
          </p>`
        : ""
    }

    ${predictor(
      a,
      b,
      week,
      data,
      schedule,
      players,
      progress
    )}

    <div class="sbf-comparison">
      ${comparisonRow(
        "Record",
        record(a),
        record(b)
      )}

      ${comparisonRow(
        "Standings",
        `#${standings[a.rosterId] ?? "—"}`,
        `#${standings[b.rosterId] ?? "—"}`
      )}

      ${comparisonRow(
        "Power Rank",
        ranked[a.rosterId]
          ? `#${ranked[a.rosterId]}`
          : "—",
        ranked[b.rosterId]
          ? `#${ranked[b.rosterId]}`
          : "—"
      )}

      ${comparisonRow(
        "Historical Avg",
        avg(a.rosterId),
        avg(b.rosterId)
      )}

      ${comparisonRow(
        "Point Diff",
        fmt(
          number(a.pointsFor) -
          number(a.pointsAgainst)
        ),
        fmt(
          number(b.pointsFor) -
          number(b.pointsAgainst)
        )
      )}
    </div>

    <div class="sbf-metrics">
      <div class="sbf-metric">
        <strong>
          ${
            meetings.length
              ? `${winsA}-${winsB}`
              : "—"
          }
        </strong>

        <span>2026 Series</span>
      </div>

      <div class="sbf-metric">
        <strong>
          ${
            biggest
              ? fmt(biggest.margin)
              : "—"
          }
        </strong>

        <span>Biggest Margin</span>
      </div>

      <div class="sbf-metric">
        <strong>
          ${
            closest
              ? fmt(closest.margin)
              : "—"
          }
        </strong>

        <span>Closest Margin</span>
      </div>
    </div>

    <section class="sbf-section">
      <h4>Head-to-head scoring · 2026</h4>

      ${
        meetings.length
          ? meetings.map(meeting => `
              <div class="sbf-chart-row">
                <span>
                  Wk ${meeting.week}
                </span>

                <div class="sbf-chart-track">
                  <span
                    class="sbf-chart-bar ${
                      meeting.b > meeting.a
                        ? "b"
                        : "a"
                    }"
                    style="width:${
                      Math.max(
                        1,
                        Math.round(
                          meeting.margin /
                          chartMax * 47
                        )
                      )
                    }%"
                  ></span>
                </div>

                <span>
                  ${fmt(meeting.a)}
                  –
                  ${fmt(meeting.b)}
                </span>
              </div>
            `).join("")
          : `<p class="sbf-note">
              No earlier meetings this season.
            </p>`
      }

      <p class="sbf-note">
        Gold indicates the left team won;
        teal indicates the right team won.
      </p>
    </section>

    <section class="sbf-section">
      <h4>Key moments</h4>

      ${
        recent
          ? `<div class="sbf-moment">
              <span>
                Last meeting · Wk ${recent.week}
              </span>

              <strong>
                ${fmt(recent.a)}
                –
                ${fmt(recent.b)}
              </strong>
            </div>`
          : `<p class="sbf-note">
              First 2026 meeting between these teams.
            </p>`
      }

      ${
        biggest
          ? `<div class="sbf-moment">
              <span>
                Biggest win · Wk ${biggest.week}
              </span>

              <strong>
                ${fmt(biggest.margin)} pts
              </strong>
            </div>`
          : ""
      }

      ${
        closest
          ? `<div class="sbf-moment">
              <span>
                Closest finish · Wk ${closest.week}
              </span>

              <strong>
                ${fmt(closest.margin)} pts
              </strong>
            </div>`
          : ""
      }
    </section>

    <p class="sbf-note">
      Head-to-head history covers 2026.
      Older ESPN franchise IDs must be verified
      before combining all-time series.
    </p>

    <p class="sbf-refresh">
      ${
        latestRefresh
          ? `Last refreshed ${
              latestRefresh.toLocaleTimeString(
                [],
                {
                  hour: "numeric",
                  minute: "2-digit"
                }
              )
            }`
          : "From Sleeper live data"
      }
    </p>
  `;
}

/*
  GAME PREVIEW LOADER
*/

async function showPreview(
  week,
  id,
  manual = false
) {
  const container =
    document.getElementById(
      "sbf-preview"
    );

  if (!container) return;

  openPreview = {
    week,
    id
  };

  container.hidden = false;

  if (!manual) {
    container.innerHTML = `
      <p>Loading SBF Game Preview...</p>
    `;

    container.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  const data = dataRef;

  const [
    games,
    rankings,
    schedule,
    players,
    progress
  ] = await Promise.all([
    getWeek(
      week,
      data,
      manual && week === currentWeek(data)
    ),

    getRankings(),

    Promise.all(
      Array.from(
        {
          length: Math.max(
            0,
            Math.min(
              week - 1,
              currentWeek(data) - 1
            )
          )
        },
        (_, i) => i + 1
      ).map(async w => ({
        week: w,
        games: await getWeek(w, data)
      }))
    ),

    getPlayers(),

    week === currentWeek(data)
      ? nflProgress(week, data)
      : Promise.resolve(null)
  ]);

  if (
    !container.isConnected ||
    !openPreview ||
    openPreview.week !== week ||
    String(openPreview.id) !== String(id)
  ) {
    return;
  }

  const game = games.find(
    item =>
      String(item.matchupId) === String(id)
  );

  latestRefresh = new Date();

  container.innerHTML = game
    ? previewMarkup(
        game,
        week,
        data,
        schedule,
        rankings,
        players,
        progress
      )
    : `
        <p>
          Sorry, Sleeper did not return
          that matchup.
          <button
            data-close-preview
            type="button"
          >
            Close
          </button>
        </p>
      `;
}

/*
  EXISTING WEEK VIEW + SCHEDULE CENTER
*/

const nav = () => `
  <div class="sbf-tabs">
    <button
      type="button"
      class="secondary"
      data-view="week"
      aria-pressed="${activeView === "week"}"
    >
      🏈 Week View
    </button>

    <button
      type="button"
      class="secondary"
      data-view="schedule"
      aria-pressed="${activeView === "schedule"}"
    >
      📅 Schedule Center
    </button>
  </div>
`;

const header = () => `
  <header class="page-hero">
    <p class="eyebrow">
      LEAGUE HQ
    </p>

    <h1>League Center</h1>

    <p>
      Live Sleeper scores, predictions,
      schedule and league activity.
    </p>
  </header>
`;

const previewHolder = () => `
  <section
    id="sbf-preview"
    class="sbf-preview"
    hidden
  ></section>
`;

async function paint(data) {
  const container =
    document.getElementById(
      "matchups"
    );

  if (!container) return;

  const ticket = ++rendering;

  openPreview = null;

  container.innerHTML = `
    ${css}
    ${header()}
    ${nav()}

    <article class="panel">
      Loading Sleeper data...
    </article>
  `;

  if (activeView === "schedule") {
    const schedule = await getSchedule(data);

    if (ticket !== rendering) return;

    const count = schedule.reduce(
      (total, entry) =>
        total + entry.games.length,
      0
    );

    container.innerHTML = `
      ${css}
      ${header()}
      ${nav()}
      ${previewHolder()}

      <div class="heading">
        <div>
          <p class="eyebrow">
            ${clean(data.season)} Season
          </p>

          <h2>SBF Schedule Center</h2>

          <p>
            ${count} games ·
            ${regularWeeks(data)} weeks ·
            Rivalry Weeks 4 & 10 ·
            Week ${regularWeeks(data)} Bowl Week
          </p>
        </div>
      </div>

      <div class="sbf-controls">
        <label for="sbf-team-filter">
          Team:
        </label>

        <select
          class="sbf-select"
          id="sbf-team-filter"
        >
          <option value="all">
            All teams
          </option>

          ${data.teams.map(team => `
            <option
              value="${number(team.rosterId)}"
              ${
                String(team.rosterId) === teamFilter
                  ? "selected"
                  : ""
              }
            >
              ${nameOf(team)}
            </option>
          `).join("")}
        </select>

        <button
          type="button"
          class="secondary"
          data-jump-current
        >
          Jump to Week ${currentWeek(data)}
        </button>
      </div>

      <div class="sbf-week-list">
        ${scheduleMarkup(schedule, data)}
      </div>
    `;

  } else {
    const week = selectedWeek;

    const [
      games,
      transactions,
      players
    ] = await Promise.all([
      getWeek(week, data),
      loadTransactions(week),
      getPlayers()
    ]);

    if (ticket !== rendering) return;

    container.innerHTML = `
      ${css}
      ${header()}
      ${nav()}
      ${previewHolder()}

      <div class="heading">
        <div>
          <p class="eyebrow">
            ${
              week === currentWeek(data)
                ? "Current Week"
                : "Season Archive"
            }
          </p>

          <h2>Week ${week} Matchups</h2>

          <span class="sbf-kicker">
            ${clean(weekTag(week, data))}
          </span>
        </div>
      </div>

      <div class="sbf-controls">
        <button
          type="button"
          class="secondary"
          data-prev-week
          ${week <= 1 ? "disabled" : ""}
        >
          ← Previous Week
        </button>

        <select
          class="sbf-select"
          id="sbf-week-select"
        >
          ${Array.from(
            { length: 18 },
            (_, i) => i + 1
          ).map(w => `
            <option
              value="${w}"
              ${
                w === week
                  ? "selected"
                  : ""
              }
            >
              Week ${w}
            </option>
          `).join("")}
        </select>

        <button
          type="button"
          class="secondary"
          data-next-week
          ${week >= 18 ? "disabled" : ""}
        >
          Next Week →
        </button>

        ${
          week === currentWeek(data)
            ? ""
            : `<button
                type="button"
                class="primary"
                data-current-week
              >
                Current Week
              </button>`
        }
      </div>

      <div
        class="sbf-games"
        data-week-grid="${week}"
      >
        ${weekGrid(games, week, data)}
      </div>

      <section style="margin-top:32px">
        <div class="heading">
          <div>
            <p class="eyebrow">
              Week ${week}
            </p>

            <h2>League Activity</h2>
          </div>
        </div>

        <div class="archive-grid">
          ${transactionCards(
            transactions,
            data,
            players,
            week
          )}
        </div>
      </section>
    `;
  }
}

/*
  AUTO-REFRESH

  Runs every 60 seconds, only while the
  Matchups page is visible.

  Updates the live cards in place so the
  page does not jump back to the top.
*/

async function refreshLive() {
  const element =
    document.getElementById("matchups");

  if (
    !element ||
    !element.classList.contains("active") ||
    refreshing ||
    !dataRef
  ) {
    return;
  }

  refreshing = true;

  try {
    const week = currentWeek(dataRef);

    const games = await getWeek(
      week,
      dataRef,
      true
    );

    const grid = element.querySelector(
      `[data-week-grid="${week}"]`
    );

    if (grid) {
      grid.innerHTML = weekGrid(
        games,
        week,
        dataRef
      );
    }

    if (
      openPreview &&
      openPreview.week === week
    ) {
      await showPreview(
        openPreview.week,
        openPreview.id,
        true
      );
    }

  } finally {
    refreshing = false;
  }
}

/*
  BUTTON / SELECT HANDLERS

  Event delegation keeps the buttons working
  after the live cards are refreshed.
*/

function handleClick(event) {
  const button = event.target.closest("button");

  if (!button) return;

  if (button.dataset.view) {
    activeView = button.dataset.view;
    paint(dataRef);
    return;
  }

  if (
    button.hasAttribute("data-open-week")
  ) {
    selectedWeek = clampWeek(
      button.dataset.openWeek
    );

    activeView = "week";
    paint(dataRef);
    return;
  }

  if (
    button.hasAttribute("data-prev-week")
  ) {
    selectedWeek = clampWeek(
      selectedWeek - 1
    );

    paint(dataRef);
    return;
  }

  if (
    button.hasAttribute("data-next-week")
  ) {
    selectedWeek = clampWeek(
      selectedWeek + 1
    );

    paint(dataRef);
    return;
  }

  if (
    button.hasAttribute("data-current-week")
  ) {
    selectedWeek = currentWeek(dataRef);
    paint(dataRef);
    return;
  }

  if (
    button.hasAttribute("data-jump-current")
  ) {
    document
      .getElementById(
        `sbf-week-${currentWeek(dataRef)}`
      )
      ?.scrollIntoView({
        behavior: "smooth"
      });

    return;
  }

  if (
    button.hasAttribute("data-preview-week")
  ) {
    showPreview(
      number(button.dataset.previewWeek),
      button.dataset.previewGame
    );

    return;
  }

  if (
    button.hasAttribute("data-refresh-preview") &&
    openPreview
  ) {
    refreshLive();

    if (
      openPreview.week !== currentWeek(dataRef)
    ) {
      showPreview(
        openPreview.week,
        openPreview.id,
        true
      );
    }

    return;
  }

  if (
    button.hasAttribute("data-close-preview")
  ) {
    openPreview = null;

    const preview =
      document.getElementById(
        "sbf-preview"
      );

    if (preview) {
      preview.hidden = true;
      preview.innerHTML = "";
    }
  }
}

function handleChange(event) {
  if (
    event.target.id === "sbf-team-filter"
  ) {
    teamFilter = event.target.value;
    paint(dataRef);
  }

  if (
    event.target.id === "sbf-week-select"
  ) {
    selectedWeek = clampWeek(
      event.target.value
    );

    paint(dataRef);
  }
}

/*
  MAIN EXPORT
  Compatible with the existing app.js.
*/

export async function renderMatchups(
  _initialGames,
  data
) {
  dataRef = data;

  if (selectedWeek === null) {
    selectedWeek = currentWeek(data);
  }

  const element =
    document.getElementById(
      "matchups"
    );

  if (!element) return;

  if (!element.dataset.sbfBound) {
    element.addEventListener(
      "click",
      handleClick
    );

    element.addEventListener(
      "change",
      handleChange
    );

    element.dataset.sbfBound = "yes";
  }

  if (!refreshTimer) {
    refreshTimer = setInterval(
      refreshLive,
      REFRESH_MS
    );
  }

  await paint(data);
}
