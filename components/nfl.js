import { escapeHTML } from "./data.js";

const NFL_TEAMS = {
  "Arizona Cardinals": { abbr: "ARI", logo: "ari" },
  "Atlanta Falcons": { abbr: "ATL", logo: "atl" },
  "Baltimore Ravens": { abbr: "BAL", logo: "bal" },
  "Buffalo Bills": { abbr: "BUF", logo: "buf" },
  "Carolina Panthers": { abbr: "CAR", logo: "car" },
  "Chicago Bears": { abbr: "CHI", logo: "chi" },
  "Cincinnati Bengals": { abbr: "CIN", logo: "cin" },
  "Cleveland Browns": { abbr: "CLE", logo: "cle" },
  "Dallas Cowboys": { abbr: "DAL", logo: "dal" },
  "Denver Broncos": { abbr: "DEN", logo: "den" },
  "Detroit Lions": { abbr: "DET", logo: "det" },
  "Green Bay Packers": { abbr: "GB", logo: "gb" },
  "Houston Texans": { abbr: "HOU", logo: "hou" },
  "Indianapolis Colts": { abbr: "IND", logo: "ind" },
  "Jacksonville Jaguars": { abbr: "JAX", logo: "jax" },
  "Kansas City Chiefs": { abbr: "KC", logo: "kc" },
  "Las Vegas Raiders": { abbr: "LV", logo: "lv" },
  "Los Angeles Chargers": { abbr: "LAC", logo: "lac" },
  "Los Angeles Rams": { abbr: "LAR", logo: "lar" },
  "Miami Dolphins": { abbr: "MIA", logo: "mia" },
  "Minnesota Vikings": { abbr: "MIN", logo: "min" },
  "New England Patriots": { abbr: "NE", logo: "ne" },
  "New Orleans Saints": { abbr: "NO", logo: "no" },
  "New York Giants": { abbr: "NYG", logo: "nyg" },
  "New York Jets": { abbr: "NYJ", logo: "nyj" },
  "Philadelphia Eagles": { abbr: "PHI", logo: "phi" },
  "Pittsburgh Steelers": { abbr: "PIT", logo: "pit" },
  "San Francisco 49ers": { abbr: "SF", logo: "sf" },
  "Seattle Seahawks": { abbr: "SEA", logo: "sea" },
  "Tampa Bay Buccaneers": { abbr: "TB", logo: "tb" },
  "Tennessee Titans": { abbr: "TEN", logo: "ten" },
  "Washington Commanders": { abbr: "WSH", logo: "wsh" }
};

function getTeamInfo(team) {
  const info = NFL_TEAMS[team.name] || {};

  return {
    abbr: info.abbr || team.abbr || team.name,
    logo:
      team.logo ||
      (info.logo
        ? `https://a.espncdn.com/i/teamlogos/nfl/500/${info.logo}.png`
        : "")
  };
}

async function loadNFLScores() {
  try {
    const response = await fetch(
      `data/nfl-scores.json?ts=${Date.now()}`
    );

    if (!response.ok) {
      throw new Error(
        `NFL scores request failed: ${response.status}`
      );
    }

    return await response.json();
  } catch (error) {
    console.warn(
      "NFL ScoreCenter data unavailable:",
      error
    );

    return {
      updatedAt: null,
      week: null,
      games: []
    };
  }
}

function formatKickoff(dateString) {
  if (!dateString) {
    return "TBD";
  }

  const date = new Date(dateString);

  return date.toLocaleString([], {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit"
  });
}

function renderGameStatus(game) {
  if (game.status === "final") {
    return `
      <span class="nfl-status final">
        FINAL
      </span>
    `;
  }

  if (game.status === "live") {
    return `
      <span class="nfl-status live">
        ● LIVE • ${escapeHTML(game.detail || "")}
      </span>
    `;
  }

  return `
    <span class="nfl-status scheduled">
      ${escapeHTML(formatKickoff(game.startTime))}
    </span>
  `;
}

function renderTeam(team) {
  const info = getTeamInfo(team);

  return `
    <div class="nfl-team-row">

      <div class="nfl-team-info">

        ${
          info.logo
            ? `
              <img
                class="nfl-team-logo"
                src="${info.logo}"
                alt="${escapeHTML(team.name)}"
              >
            `
            : ""
        }

        <div>
          <strong class="nfl-team-abbr">
            ${escapeHTML(info.abbr)}
          </strong>

          <span class="nfl-team-name">
            ${escapeHTML(team.name)}
          </span>

          ${
            team.record
              ? `
                <span class="nfl-team-record">
                  ${escapeHTML(team.record)}
                </span>
              `
              : ""
          }
        </div>

      </div>

      <strong class="nfl-score">
        ${
          team.score !== null &&
          team.score !== undefined
            ? escapeHTML(team.score)
            : "—"
        }
      </strong>

    </div>
  `;
}

function renderGame(game) {
  return `
    <article class="nfl-game-card">

      <div class="nfl-game-header">

        <span>
          ${escapeHTML(game.network || "NFL")}
        </span>

        ${renderGameStatus(game)}

      </div>

      ${renderTeam(game.away)}
      ${renderTeam(game.home)}

      ${
        game.note
          ? `
            <div class="nfl-game-note">
              ${escapeHTML(game.note)}
            </div>
          `
          : ""
      }

    </article>
  `;
}

function renderSection(title, games, className = "") {
  if (!games.length) {
    return "";
  }

  return `
    <section class="nfl-score-section ${className}">

      <div class="heading">
        <div>
          <p class="eyebrow">
            NFL ScoreCenter
          </p>

          <h2>
            ${escapeHTML(title)}
          </h2>
        </div>
      </div>

      <div class="nfl-games-grid">
        ${games.map(renderGame).join("")}
      </div>

    </section>
  `;
}

export async function renderNFL() {
  const container =
    document.getElementById("nfl");

  if (!container) {
    return;
  }

  container.innerHTML = `
    <header class="page-hero">

      <p class="eyebrow">
        NFL ScoreCenter
      </p>

      <h1>
        NFL Scores
      </h1>

      <p>
        Live scores, game status and weekly NFL
        action in one place.
      </p>

    </header>

    <article class="panel">
      <p>Loading NFL games...</p>
    </article>
  `;

  const data =
    await loadNFLScores();

  const games =
    Array.isArray(data.games)
      ? data.games
      : [];

  const liveGames =
    games.filter(
      game => game.status === "live"
    );

  const upcomingGames =
    games.filter(
      game => game.status === "scheduled"
    );

  const finalGames =
    games.filter(
      game => game.status === "final"
    );

  const scoreSections =
    games.length
      ? `
          ${renderSection(
            "Live Now",
            liveGames,
            "live-games"
          )}

          ${renderSection(
            "Upcoming",
            upcomingGames,
            "upcoming-games"
          )}

          ${renderSection(
            "Final",
            finalGames,
            "final-games"
          )}
        `
      : `
          <article class="panel">

            <p class="eyebrow">
              ScoreCenter
            </p>

            <h2>
              No NFL games loaded yet
            </h2>

            <p>
              The NFL data feed has not been
              connected yet.
            </p>

          </article>
        `;

  container.innerHTML = `

    <header class="page-hero">

      <p class="eyebrow">
        NFL ScoreCenter
      </p>

      <h1>
        NFL Scores
      </h1>

      <p>
        Live scores, game status and weekly NFL
        action in one place.
      </p>

    </header>

    <div class="nfl-scorecenter-meta">

      <div>
        <span>Week</span>

        <strong>
          ${data.week ?? "—"}
        </strong>
      </div>

      <div>
        <span>Last Updated</span>

        <strong>
          ${
            data.updatedAt
              ? new Date(
                  data.updatedAt
                ).toLocaleTimeString(
                  [],
                  {
                    hour: "numeric",
                    minute: "2-digit"
                  }
                )
              : "Waiting for feed"
          }
        </strong>
      </div>

    </div>

    ${scoreSections}

  `;
}