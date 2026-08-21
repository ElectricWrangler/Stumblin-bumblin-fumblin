import {
  escapeHTML,
  loadNFLPlayers,
  loadWeekMatchups
} from "./data.js";

const ESPN_SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";

const ESPN_SUMMARY_URL =
  gameId =>
    `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${gameId}`;

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

let leagueData = null;
let currentData = null;
let selectedGameId = null;
let refreshTimer = null;
let playerDatabasePromise = null;
let detailRequestNumber = 0;

function normalizeNFLTeam(team) {
  const value = String(team || "")
    .trim()
    .toUpperCase();

  return value === "WAS"
    ? "WSH"
    : value;
}

function normalizePlayerName(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function getTeamInfo(team) {
  const info =
    NFL_TEAMS[team.name] || {};

  return {
    abbr:
      info.abbr ||
      team.abbr ||
      team.name,

    logo:
      team.logo ||
      (
        info.logo
          ? `https://a.espncdn.com/i/teamlogos/nfl/500/${info.logo}.png`
          : ""
      )
  };
}

function getRecord(competitor) {
  const records =
    competitor.records || [];

  const overall =
    records.find(
      record =>
        record.name === "overall"
    ) ||
    records[0];

  return overall?.summary || "";
}

function getGameStatus(competition) {
  const status =
    competition.status || {};

  const type =
    status.type || {};

  if (
    type.completed ||
    type.state === "post"
  ) {
    return {
      status: "final",
      detail:
        type.shortDetail ||
        "Final"
    };
  }

  if (
    type.state === "in"
  ) {
    return {
      status: "live",
      detail:
        type.shortDetail ||
        type.detail ||
        `${
          status.period
            ? `Q${status.period}`
            : ""
        } ${
          status.displayClock || ""
        }`.trim()
    };
  }

  return {
    status: "scheduled",
    detail:
      type.shortDetail ||
      type.detail ||
      ""
  };
}

function getNetwork(competition) {
  const broadcasts =
    competition.broadcasts || [];

  const names =
    broadcasts.flatMap(
      broadcast =>
        broadcast.names || []
    );

  return names[0] || "NFL";
}

function buildTeam(competitor) {
  const team =
    competitor.team || {};

  return {
    name:
      team.displayName ||
      team.name ||
      "Unknown Team",

    abbr:
      team.abbreviation || "",

    record:
      getRecord(competitor),

    score:
      competitor.score !== undefined &&
      competitor.score !== null &&
      competitor.score !== ""
        ? Number(competitor.score)
        : null,

    logo:
      team.logo || ""
  };
}

function transformGame(event) {
  const competition =
    event.competitions?.[0] || {};

  const competitors =
    competition.competitors || [];

  const away =
    competitors.find(
      team =>
        team.homeAway === "away"
    );

  const home =
    competitors.find(
      team =>
        team.homeAway === "home"
    );

  if (!away || !home) {
    return null;
  }

  const status =
    getGameStatus(
      competition
    );

  return {
    id:
      String(event.id),

    status:
      status.status,

    detail:
      status.detail,

    network:
      getNetwork(
        competition
      ),

    startTime:
      event.date,

    away:
      buildTeam(away),

    home:
      buildTeam(home),

    note:
      competition
        .notes?.[0]
        ?.headline || ""
  };
}

function buildWeekLabel(data) {
  const seasonType =
    data.season?.type;

  const week =
    data.week?.number;

  if (seasonType === 1) {
    return week
      ? `Preseason ${week}`
      : "Preseason";
  }

  if (seasonType === 3) {
    return week
      ? `Postseason ${week}`
      : "Postseason";
  }

  return week || "—";
}

async function loadCachedScores() {
  const response =
    await fetch(
      `data/nfl-scores.json?ts=${Date.now()}`
    );

  if (!response.ok) {
    throw new Error(
      `Cached NFL scores request failed: ${response.status}`
    );
  }

  const data =
    await response.json();

  return {
    ...data,
    source: "cached"
  };
}

async function loadLiveScores() {
  try {
    const response =
      await fetch(
        `${ESPN_SCOREBOARD_URL}?ts=${Date.now()}`,
        {
          cache: "no-store"
        }
      );

    if (!response.ok) {
      throw new Error(
        `ESPN request failed: ${response.status}`
      );
    }

    const raw =
      await response.json();

    const games =
      (raw.events || [])
        .map(transformGame)
        .filter(Boolean);

    return {
      week:
        buildWeekLabel(raw),

      updatedAt:
        new Date().toISOString(),

      games,

      source: "live"
    };

  } catch (error) {
    console.warn(
      "Direct NFL feed unavailable. Using cached ScoreCenter data.",
      error
    );

    try {
      return await loadCachedScores();
    } catch (fallbackError) {
      console.warn(
        "Cached NFL ScoreCenter data unavailable:",
        fallbackError
      );

      return {
        updatedAt: null,
        week: null,
        games: [],
        source: "unavailable"
      };
    }
  }
}

function formatKickoff(dateString) {
  if (!dateString) {
    return "TBD";
  }

  const date =
    new Date(dateString);

  return date.toLocaleString(
    [],
    {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit"
    }
  );
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
        ● LIVE •
        ${escapeHTML(
          game.detail || ""
        )}
      </span>
    `;
  }

  return `
    <span class="nfl-status scheduled">
      ${escapeHTML(
        formatKickoff(
          game.startTime
        )
      )}
    </span>
  `;
}

function renderTeam(team) {
  const info =
    getTeamInfo(team);

  return `
    <div class="nfl-team-row">

      <div class="nfl-team-info">

        ${
          info.logo
            ? `
              <img
                class="nfl-team-logo"
                src="${info.logo}"
                alt="${escapeHTML(
                  team.name
                )}"
              >
            `
            : ""
        }

        <div>

          <strong class="nfl-team-abbr">
            ${escapeHTML(
              info.abbr
            )}
          </strong>

          <span class="nfl-team-name">
            ${escapeHTML(
              team.name
            )}
          </span>

          ${
            team.record
              ? `
                <span class="nfl-team-record">
                  ${escapeHTML(
                    team.record
                  )}
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
            ? escapeHTML(
                team.score
              )
            : "—"
        }
      </strong>

    </div>
  `;
}

function renderGame(game) {
  const selected =
    String(selectedGameId) ===
    String(game.id);

  return `
    <article
      class="
        nfl-game-card
        nfl-clickable-game
        ${
          selected
            ? "selected"
            : ""
        }
      "
      data-nfl-game-id="${escapeHTML(
        game.id
      )}"
      role="button"
      tabindex="0"
    >

      <div class="nfl-game-header">

        <span>
          ${escapeHTML(
            game.network ||
            "NFL"
          )}
        </span>

        ${renderGameStatus(game)}

      </div>

      ${renderTeam(game.away)}

      ${renderTeam(game.home)}

      ${
        game.note
          ? `
            <div class="nfl-game-note">
              ${escapeHTML(
                game.note
              )}
            </div>
          `
          : ""
      }

      <div class="nfl-game-open-hint">
        ${
          selected
            ? "Viewing SBF players"
            : "Tap for SBF players →"
        }
      </div>

    </article>
  `;
}

function renderSection(
  title,
  games,
  className = ""
) {
  if (!games.length) {
    return "";
  }

  return `
    <section
      class="
        nfl-score-section
        ${className}
      "
    >

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
        ${games
          .map(renderGame)
          .join("")}
      </div>

    </section>
  `;
}

function findGame(gameId) {
  return (
    currentData
      ?.games
      ?.find(
        game =>
          String(game.id) ===
          String(gameId)
      ) ||
    null
  );
}

function findLabelValue(
  labels,
  stats,
  wanted
) {
  const index =
    labels.findIndex(
      label =>
        String(label)
          .toUpperCase() ===
        wanted.toUpperCase()
    );

  if (index === -1) {
    return null;
  }

  return stats[index] ?? null;
}

function buildStatLine(
  category,
  labels,
  stats
) {
  const name =
    String(category || "")
      .toLowerCase();

  const pieces = [];
  let title = "";

  if (name.includes("passing")) {
    title = "PASS";

    [
      "C/ATT",
      "YDS",
      "TD",
      "INT"
    ].forEach(label => {
      const value =
        findLabelValue(
          labels,
          stats,
          label
        );

      if (
        value !== null &&
        value !== ""
      ) {
        pieces.push(
          `${value} ${label}`
        );
      }
    });
  }

  if (name.includes("rushing")) {
    title = "RUSH";

    [
      "CAR",
      "YDS",
      "TD"
    ].forEach(label => {
      const value =
        findLabelValue(
          labels,
          stats,
          label
        );

      if (
        value !== null &&
        value !== ""
      ) {
        pieces.push(
          `${value} ${label}`
        );
      }
    });
  }

  if (name.includes("receiving")) {
    title = "REC";

    [
      "REC",
      "TGTS",
      "YDS",
      "TD"
    ].forEach(label => {
      const value =
        findLabelValue(
          labels,
          stats,
          label
        );

      if (
        value !== null &&
        value !== ""
      ) {
        pieces.push(
          `${value} ${label}`
        );
      }
    });
  }

  if (name.includes("fumble")) {
    title = "FUM";

    [
      "FUM",
      "LOST"
    ].forEach(label => {
      const value =
        findLabelValue(
          labels,
          stats,
          label
        );

      if (
        value !== null &&
        value !== ""
      ) {
        pieces.push(
          `${value} ${label}`
        );
      }
    });
  }

  if (name.includes("kicking")) {
    title = "KICK";

    [
      "FG",
      "XP",
      "PTS"
    ].forEach(label => {
      const value =
        findLabelValue(
          labels,
          stats,
          label
        );

      if (
        value !== null &&
        value !== ""
      ) {
        pieces.push(
          `${value} ${label}`
        );
      }
    });
  }

  if (!pieces.length) {
    return "";
  }

  return `
    ${title}
    ${pieces.join(" • ")}
  `.trim();
}

function extractESPNPlayerStats(summary) {
  const byPlayer =
    new Map();

  const blocks =
    summary
      ?.boxscore
      ?.players || [];

  blocks.forEach(
    teamBlock => {

      const teamAbbr =
        normalizeNFLTeam(
          teamBlock
            ?.team
            ?.abbreviation
        );

      (
        teamBlock.statistics ||
        []
      ).forEach(
        group => {

          const labels =
            group.labels || [];

          (
            group.athletes ||
            []
          ).forEach(
            row => {

              const athlete =
                row.athlete || {};

              const name =
                athlete.displayName ||
                athlete.fullName ||
                "";

              if (!name) {
                return;
              }

              const key =
                `${
                  normalizePlayerName(
                    name
                  )
                }|${teamAbbr}`;

              let player =
                byPlayer.get(key);

              if (!player) {
                player = {
                  name,
                  team:
                    teamAbbr,

                  position:
                    athlete
                      ?.position
                      ?.abbreviation ||
                    "",

                  headshot:
                    athlete
                      ?.headshot
                      ?.href ||
                    athlete
                      ?.headshot ||
                    "",

                  statLines: []
                };

                byPlayer.set(
                  key,
                  player
                );
              }

              const statLine =
                buildStatLine(
                  group.name ||
                  group.displayName,
                  labels,
                  row.stats || []
                );

              if (
                statLine &&
                !player.statLines.includes(
                  statLine
                )
              ) {
                player.statLines.push(
                  statLine
                );
              }
            }
          );
        }
      );
    }
  );

  return byPlayer;
}

async function loadGameSummary(gameId) {
  try {
    const response =
      await fetch(
        `${
          ESPN_SUMMARY_URL(
            gameId
          )
        }&ts=${Date.now()}`,
        {
          cache: "no-store"
        }
      );

    if (!response.ok) {
      throw new Error(
        `Game summary failed: ${response.status}`
      );
    }

    return await response.json();

  } catch (error) {
    console.warn(
      `NFL game summary unavailable for ${gameId}:`,
      error
    );

    return null;
  }
}

async function loadFantasyContext() {
  if (!leagueData) {
    return {
      players: {},
      matchups: []
    };
  }

  if (!playerDatabasePromise) {
    playerDatabasePromise =
      loadNFLPlayers();
  }

  const [
    players,
    matchups
  ] =
    await Promise.all([
      playerDatabasePromise,

      loadWeekMatchups(
        leagueData.currentWeek,
        leagueData
      )
    ]);

  return {
    players,
    matchups
  };
}

function getPlayersOwnedInGame(
  game,
  players,
  matchups
) {
  const nflTeams =
    new Set([
      normalizeNFLTeam(
        game.away.abbr
      ),
      normalizeNFLTeam(
        game.home.abbr
      )
    ]);

  const owned = [];

  matchups.forEach(
    matchup => {

      matchup.teams.forEach(
        fantasyTeam => {

          const starters =
            new Set(
              fantasyTeam.starters ||
              []
            );

          (
            fantasyTeam.players ||
            []
          ).forEach(
            playerId => {

              const player =
                players[playerId];

              if (!player) {
                return;
              }

              const playerTeam =
                normalizeNFLTeam(
                  player.team
                );

              if (
                !nflTeams.has(
                  playerTeam
                )
              ) {
                return;
              }

              const fantasyPoints =
                Number(
                  fantasyTeam
                    .playersPoints
                    ?.[playerId] ??
                  0
                );

              owned.push({
                playerId,

                name:
                  player.full_name ||
                  `${
                    player.first_name ||
                    ""
                  } ${
                    player.last_name ||
                    ""
                  }`
                    .trim() ||
                  playerId,

                position:
                  player.position ||
                  "",

                nflTeam:
                  playerTeam,

                fantasyTeam:
                  fantasyTeam.team,

                owner:
                  fantasyTeam.owner,

                starter:
                  starters.has(
                    playerId
                  ),

                fantasyPoints:
                  Number.isFinite(
                    fantasyPoints
                  )
                    ? fantasyPoints
                    : 0
              });
            }
          );
        }
      );
    }
  );

  return owned.sort(
    (a, b) => {

      if (
        a.starter !==
        b.starter
      ) {
        return a.starter
          ? -1
          : 1;
      }

      if (
        a.fantasyPoints !==
        b.fantasyPoints
      ) {
        return (
          b.fantasyPoints -
          a.fantasyPoints
        );
      }

      return a.name.localeCompare(
        b.name
      );
    }
  );
}

function renderFantasyPlayer(
  player,
  espnStats
) {
  const statKey =
    `${
      normalizePlayerName(
        player.name
      )
    }|${
      normalizeNFLTeam(
        player.nflTeam
      )
    }`;

  const stats =
    espnStats.get(
      statKey
    );

  const statLines =
    stats?.statLines || [];

  return `
    <article
      class="
        nfl-fantasy-player
        ${
          player.starter
            ? "is-starter"
            : ""
        }
      "
    >

      <div class="nfl-fantasy-player-top">

        <div>

          <div class="nfl-player-name-row">

            <strong class="nfl-player-name">
              ${escapeHTML(
                player.name
              )}
            </strong>

            ${
              player.starter
                ? `
                  <span class="nfl-starter-badge">
                    STARTER
                  </span>
                `
                : `
                  <span class="nfl-bench-badge">
                    BENCH
                  </span>
                `
            }

          </div>

          <span class="nfl-player-meta">
            ${escapeHTML(
              player.position
            )}
            •
            ${escapeHTML(
              player.nflTeam
            )}
          </span>

        </div>

        <div class="nfl-fantasy-points">

          <strong>
            ${player
              .fantasyPoints
              .toFixed(1)}
          </strong>

          <span>
            FPTS
          </span>

        </div>

      </div>

      <div class="nfl-sbf-owner">

        <span>
          SBF TEAM
        </span>

        <strong>
          ${escapeHTML(
            player.fantasyTeam
          )}
        </strong>

        <small>
          ${escapeHTML(
            player.owner
          )}
        </small>

      </div>

      ${
        statLines.length
          ? `
            <div class="nfl-stat-lines">

              ${statLines
                .map(
                  line => `
                    <div>
                      ${escapeHTML(
                        line
                      )}
                    </div>
                  `
                )
                .join("")}

            </div>
          `
          : `
            <div class="nfl-stat-lines muted">
              No box-score stats yet.
            </div>
          `
      }

    </article>
  `;
}

function renderDetailLoading(game) {
  return `
    <section class="nfl-game-detail">

      <div class="nfl-detail-header">

        <div>

          <p class="eyebrow">
            SBF GameTracker
          </p>

          <h2>
            ${escapeHTML(
              game.away.abbr
            )}
            at
            ${escapeHTML(
              game.home.abbr
            )}
          </h2>

        </div>

        <button
          class="nfl-detail-close"
          type="button"
          data-close-nfl-detail
        >
          Close ×
        </button>

      </div>

      <p>
        Loading SBF players...
      </p>

    </section>
  `;
}

async function renderSelectedGameDetail() {
  const host =
    document.getElementById(
      "nfl-game-detail-host"
    );

  if (!host) {
    return;
  }

  if (!selectedGameId) {
    host.innerHTML = "";
    return;
  }

  const game =
    findGame(
      selectedGameId
    );

  if (!game) {
    host.innerHTML = "";
    return;
  }

  const requestNumber =
    ++detailRequestNumber;

  host.innerHTML =
    renderDetailLoading(
      game
    );

  const [
    fantasyContext,
    summary
  ] =
    await Promise.all([
      loadFantasyContext(),
      loadGameSummary(
        game.id
      )
    ]);

  if (
    requestNumber !==
    detailRequestNumber
  ) {
    return;
  }

  const ownedPlayers =
    getPlayersOwnedInGame(
      game,
      fantasyContext.players,
      fantasyContext.matchups
    );

  const espnStats =
    extractESPNPlayerStats(
      summary
    );

  host.innerHTML = `
    <section class="nfl-game-detail">

      <div class="nfl-detail-header">

        <div>

          <p class="eyebrow">
            SBF GameTracker
          </p>

          <h2>
            ${escapeHTML(
              game.away.abbr
            )}
            ${game.away.score ?? "—"}
            •
            ${escapeHTML(
              game.home.abbr
            )}
            ${game.home.score ?? "—"}
          </h2>

          <p class="nfl-detail-status">
            ${
              game.status === "live"
                ? `● LIVE • ${
                    escapeHTML(
                      game.detail ||
                      ""
                    )
                  }`
                : game.status === "final"
                  ? "FINAL"
                  : escapeHTML(
                      formatKickoff(
                        game.startTime
                      )
                    )
            }
          </p>

        </div>

        <button
          class="nfl-detail-close"
          type="button"
          data-close-nfl-detail
        >
          Close ×
        </button>

      </div>

      <div class="nfl-detail-score">

        <div>

          <strong>
            ${escapeHTML(
              game.away.abbr
            )}
          </strong>

          <span>
            ${escapeHTML(
              game.away.name
            )}
          </span>

          <b>
            ${game.away.score ?? "—"}
          </b>

        </div>

        <span class="nfl-detail-vs">
          VS
        </span>

        <div>

          <strong>
            ${escapeHTML(
              game.home.abbr
            )}
          </strong>

          <span>
            ${escapeHTML(
              game.home.name
            )}
          </span>

          <b>
            ${game.home.score ?? "—"}
          </b>

        </div>

      </div>

      <div class="nfl-detail-section-heading">

        <div>

          <p class="eyebrow">
            Fantasy Impact
          </p>

          <h3>
            SBF Players in This Game
          </h3>

        </div>

        <span class="nfl-live-refresh">
          ↻ Updates every 30 sec
        </span>

      </div>

      ${
        ownedPlayers.length
          ? `
            <div class="nfl-fantasy-player-grid">

              ${ownedPlayers
                .map(
                  player =>
                    renderFantasyPlayer(
                      player,
                      espnStats
                    )
                )
                .join("")}

            </div>
          `
          : `
            <article class="panel">

              <h3>
                No SBF players
              </h3>

              <p>
                Nobody in the league currently
                has a player from these two NFL
                teams rostered.
              </p>

            </article>
          `
      }

    </section>
  `;

  attachDetailCloseHandler();
}

function attachDetailCloseHandler() {
  document
    .querySelector(
      "[data-close-nfl-detail]"
    )
    ?.addEventListener(
      "click",
      () => {

        selectedGameId =
          null;

        detailRequestNumber++;

        const host =
          document.getElementById(
            "nfl-game-detail-host"
          );

        if (host) {
          host.innerHTML = "";
        }

        document
          .querySelectorAll(
            ".nfl-game-card.selected"
          )
          .forEach(
            card =>
              card.classList.remove(
                "selected"
              )
          );
      }
    );
}

function attachGameHandlers() {
  document
    .querySelectorAll(
      "[data-nfl-game-id]"
    )
    .forEach(
      card => {

        const openGame =
          async () => {

            selectedGameId =
              card.dataset.nflGameId;

            document
              .querySelectorAll(
                ".nfl-game-card"
              )
              .forEach(
                other =>
                  other.classList.toggle(
                    "selected",
                    other === card
                  )
              );

            await renderSelectedGameDetail();

            document
              .getElementById(
                "nfl-game-detail-host"
              )
              ?.scrollIntoView({
                behavior: "smooth",
                block: "start"
              });
          };

        card.addEventListener(
          "click",
          openGame
        );

        card.addEventListener(
          "keydown",
          event => {

            if (
              event.key === "Enter" ||
              event.key === " "
            ) {
              event.preventDefault();
              openGame();
            }
          }
        );
      }
    );
}

function renderScoreCenter() {
  const container =
    document.getElementById(
      "nfl"
    );

  if (
    !container ||
    !currentData
  ) {
    return;
  }

  const games =
    Array.isArray(
      currentData.games
    )
      ? currentData.games
      : [];

  const liveGames =
    games.filter(
      game =>
        game.status === "live"
    );

  const upcomingGames =
    games.filter(
      game =>
        game.status === "scheduled"
    );

  const finalGames =
    games.filter(
      game =>
        game.status === "final"
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
              Waiting for the NFL feed.
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
        Live NFL scores with SBF fantasy
        impact built directly into every game.
      </p>

    </header>

    <div class="nfl-scorecenter-meta">

      <div>

        <span>
          Week
        </span>

        <strong>
          ${escapeHTML(
            currentData.week ??
            "—"
          )}
        </strong>

      </div>

      <div>

        <span>
          Last Updated
        </span>

        <strong>
          ${
            currentData.updatedAt
              ? new Date(
                  currentData.updatedAt
                )
                .toLocaleTimeString(
                  [],
                  {
                    hour: "numeric",
                    minute: "2-digit",
                    second: "2-digit"
                  }
                )
              : "Waiting for feed"
          }
        </strong>

      </div>

      <div>

        <span>
          Refresh
        </span>

        <strong>
          30 seconds
        </strong>

      </div>

    </div>

    <div id="nfl-game-detail-host"></div>

    ${scoreSections}
  `;

  attachGameHandlers();

  if (selectedGameId) {
    renderSelectedGameDetail();
  }
}

async function refreshNFL() {
  const nflPage =
    document.getElementById(
      "nfl"
    );

  if (!nflPage) {
    return;
  }

  try {
    currentData =
      await loadLiveScores();

    renderScoreCenter();

  } catch (error) {
    console.warn(
      "NFL ScoreCenter refresh failed:",
      error
    );
  }
}

function startLiveRefresh() {
  if (refreshTimer) {
    clearInterval(
      refreshTimer
    );
  }

  refreshTimer =
    window.setInterval(
      async () => {

        const nflPage =
          document.getElementById(
            "nfl"
          );

        if (
          !nflPage ||
          !nflPage.classList.contains(
            "active"
          )
        ) {
          return;
        }

        await refreshNFL();

      },
      30000
    );
}

export async function renderNFL(data) {
  leagueData = data;

  const container =
    document.getElementById(
      "nfl"
    );

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
        Loading live NFL games...
      </p>

    </header>

    <article class="panel">
      <p>
        Connecting to ScoreCenter...
      </p>
    </article>
  `;

  await refreshNFL();

  startLiveRefresh();
}