import { escapeHTML } from "./data.js";

async function loadHistory() {
  const response = await fetch(
    `data/history/league-history.json?ts=${Date.now()}`
  );

  if (!response.ok) {
    throw new Error(
      `League history request failed: ${response.status}`
    );
  }

  return response.json();
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString(
    undefined,
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }
  );
}

function findTeam(season, teamId) {
  return (
    season.teams?.find(
      team => team.id === teamId
    ) || null
  );
}

function getSortedSeasons(seasons) {
  return seasons
    .slice()
    .sort(
      (a, b) => b.year - a.year
    );
}

function getTeamOwner(team) {
  if (!team) {
    return null;
  }

  const owners =
    Array.isArray(team.owners)
      ? team.owners
      : [];

  return owners[0] || null;
}

/*
  ESPN identifies franchises using owner IDs.

  We keep those IDs behind the scenes only.
  The website displays the most recent team
  name used by each franchise instead.
*/
function buildFranchiseNameMap(seasons) {
  const map = {};

  seasons
    .slice()
    .sort(
      (a, b) => a.year - b.year
    )
    .forEach(season => {
      season.teams?.forEach(team => {
        const owners =
          Array.isArray(team.owners)
            ? team.owners
            : [];

        owners.forEach(ownerId => {
          map[ownerId] =
            team.name ||
            `Team ${team.id}`;
        });
      });
    });

  return map;
}

function renderChampions(seasons) {
  return getSortedSeasons(seasons)
    .map(season => {
      const champion =
        season.champion;

      const runnerUp =
        season.runnerUp;

      return `
        <article class="history-champion-card">

          <div class="history-champion-year">
            ${season.year}
          </div>

          <div class="history-trophy">
            🏆
          </div>

          <p class="eyebrow">
            SBF Champion
          </p>

          <h3>
            ${escapeHTML(
              champion?.name ||
              "Unknown Champion"
            )}
          </h3>

          ${
            runnerUp
              ? `
                <div class="history-runner-up">
                  <span>
                    Runner-Up
                  </span>

                  <strong>
                    ${escapeHTML(
                      runnerUp.name
                    )}
                  </strong>
                </div>
              `
              : ""
          }

        </article>
      `;
    })
    .join("");
}

function buildAllTimeFranchises(
  allTime,
  franchiseNames
) {
  return allTime
    .map(row => ({
      ...row,

      franchise:
        franchiseNames[row.owner] ||
        "Unknown Franchise"
    }))
    .sort(
      (a, b) =>
        b.championships -
          a.championships ||
        b.wins -
          a.wins ||
        b.pointsFor -
          a.pointsFor
    );
}

function renderAllTime(
  allTime,
  franchiseNames
) {
  const franchises =
    buildAllTimeFranchises(
      allTime,
      franchiseNames
    );

  return franchises
    .map((team, index) => `
      <div class="history-standing-row">

        <div class="history-rank">
          ${index + 1}
        </div>

        <div class="history-standing-team">

          <strong>
            ${escapeHTML(
              team.franchise
            )}
          </strong>

          <span>
            ${team.seasons}
            season${team.seasons === 1 ? "" : "s"}
          </span>

        </div>

        <div class="history-standing-stat">

          <strong>
            ${team.wins}-${team.losses}
          </strong>

          <span>
            Record
          </span>

        </div>

        <div class="history-standing-stat">

          <strong>
            ${
              team.wins + team.losses > 0
                ? (
                    team.wins /
                    (team.wins + team.losses)
                  ).toFixed(3).replace(/^0/, "")
                : "—"
            }
          </strong>

          <span>
            Win %
          </span>

        </div>

        <div class="history-standing-stat">

          <strong>
            ${team.championships}
          </strong>

          <span>
            ${
              team.championships === 1
                ? "Title"
                : "Titles"
            }
          </span>

        </div>

        <div class="history-standing-stat history-points-stat">

          <strong>
            ${formatNumber(
              team.pointsFor
            )}
          </strong>

          <span>
            Points
          </span>

        </div>

      </div>
    `)
    .join("");
}

function findHighestScore(seasons) {
  let best = null;

  seasons.forEach(season => {
    season.matchups?.forEach(game => {
      [
        game.home,
        game.away
      ].forEach(side => {
        const score =
          Number(side.score || 0);

        if (
          !best ||
          score > best.score
        ) {
          const team =
            findTeam(
              season,
              side.teamId
            );

          best = {
            year: season.year,
            week: game.week,
            score,
            team:
              team?.name ||
              "Unknown Team"
          };
        }
      });
    });
  });

  return best;
}

function findBiggestBlowout(seasons) {
  let best = null;

  seasons.forEach(season => {
    season.matchups?.forEach(game => {
      const homeScore =
        Number(
          game.home?.score || 0
        );

      const awayScore =
        Number(
          game.away?.score || 0
        );

      const margin =
        Math.abs(
          homeScore - awayScore
        );

      if (
        !best ||
        margin > best.margin
      ) {
        const home =
          findTeam(
            season,
            game.home.teamId
          );

        const away =
          findTeam(
            season,
            game.away.teamId
          );

        const homeWon =
          homeScore >
          awayScore;

        best = {
          year: season.year,
          week: game.week,
          margin,

          winner:
            homeWon
              ? home?.name
              : away?.name,

          loser:
            homeWon
              ? away?.name
              : home?.name,

          winningScore:
            Math.max(
              homeScore,
              awayScore
            ),

          losingScore:
            Math.min(
              homeScore,
              awayScore
            )
        };
      }
    });
  });

  return best;
}

function findClosestGame(seasons) {
  let best = null;

  seasons.forEach(season => {
    season.matchups?.forEach(game => {
      const homeScore =
        Number(
          game.home?.score || 0
        );

      const awayScore =
        Number(
          game.away?.score || 0
        );

      const margin =
        Math.abs(
          homeScore - awayScore
        );

      if (margin === 0) {
        return;
      }

      if (
        !best ||
        margin < best.margin
      ) {
        const home =
          findTeam(
            season,
            game.home.teamId
          );

        const away =
          findTeam(
            season,
            game.away.teamId
          );

        best = {
          year: season.year,
          week: game.week,
          margin,

          home:
            home?.name ||
            "Unknown Team",

          away:
            away?.name ||
            "Unknown Team",

          homeScore,
          awayScore
        };
      }
    });
  });

  return best;
}

function renderLeagueRecords(seasons) {
  const highest =
    findHighestScore(seasons);

  const blowout =
    findBiggestBlowout(seasons);

  const closest =
    findClosestGame(seasons);

  return `
    <div class="history-record-grid">

      ${
        highest
          ? `
            <article class="history-record-card">

              <p class="eyebrow">
                🔥 Highest Weekly Score
              </p>

              <h3>
                ${escapeHTML(
                  highest.team
                )}
              </h3>

              <strong class="history-record-number">
                ${formatNumber(
                  highest.score
                )}
              </strong>

              <span>
                ${highest.year}
                • Week ${highest.week}
              </span>

            </article>
          `
          : ""
      }

      ${
        blowout
          ? `
            <article class="history-record-card">

              <p class="eyebrow">
                💥 Biggest Blowout
              </p>

              <h3>
                ${escapeHTML(
                  blowout.winner ||
                  "Unknown Team"
                )}
              </h3>

              <strong class="history-record-number">
                +${formatNumber(
                  blowout.margin
                )}
              </strong>

              <span>
                ${formatNumber(
                  blowout.winningScore
                )}
                –
                ${formatNumber(
                  blowout.losingScore
                )}
                vs
                ${escapeHTML(
                  blowout.loser ||
                  "Unknown Team"
                )}
              </span>

              <small>
                ${blowout.year}
                • Week ${blowout.week}
              </small>

            </article>
          `
          : ""
      }

      ${
        closest
          ? `
            <article class="history-record-card">

              <p class="eyebrow">
                🎯 Closest Game
              </p>

              <h3>
                ${escapeHTML(
                  closest.home
                )}
              </h3>

              <strong class="history-record-number">
                ${formatNumber(
                  closest.margin
                )}
              </strong>

              <span>
                ${formatNumber(
                  closest.homeScore
                )}
                –
                ${formatNumber(
                  closest.awayScore
                )}
                vs
                ${escapeHTML(
                  closest.away
                )}
              </span>

              <small>
                ${closest.year}
                • Week ${closest.week}
              </small>

            </article>
          `
          : ""
      }

    </div>
  `;
}

/* =====================================================
   RIVALRY CENTER
   ===================================================== */

function buildRivalryFranchises(
  seasons,
  franchiseNames
) {
  const owners = new Set();

  seasons.forEach(season => {
    season.teams?.forEach(team => {
      const owner =
        getTeamOwner(team);

      if (owner) {
        owners.add(owner);
      }
    });
  });

  return Array.from(owners)
    .map(owner => ({
      owner,
      name:
        franchiseNames[owner] ||
        "Unknown Franchise"
    }))
    .sort(
      (a, b) =>
        a.name.localeCompare(
          b.name
        )
    );
}

function buildRivalryGames(
  seasons,
  ownerA,
  ownerB,
  franchiseNames
) {
  const games = [];

  seasons.forEach(season => {
    season.matchups?.forEach(game => {
      const homeTeam =
        findTeam(
          season,
          game.home?.teamId
        );

      const awayTeam =
        findTeam(
          season,
          game.away?.teamId
        );

      const homeOwner =
        getTeamOwner(
          homeTeam
        );

      const awayOwner =
        getTeamOwner(
          awayTeam
        );

      const isMatch =
        (
          homeOwner === ownerA &&
          awayOwner === ownerB
        ) ||
        (
          homeOwner === ownerB &&
          awayOwner === ownerA
        );

      if (!isMatch) {
        return;
      }

      const homeScore =
        Number(
          game.home?.score || 0
        );

      const awayScore =
        Number(
          game.away?.score || 0
        );

      let winnerOwner = null;

      if (homeScore > awayScore) {
        winnerOwner = homeOwner;
      } else if (awayScore > homeScore) {
        winnerOwner = awayOwner;
      }

      games.push({
        year:
          Number(season.year),

        week:
          Number(game.week),

        homeOwner,
        awayOwner,

        homeName:
          franchiseNames[
            homeOwner
          ] ||
          homeTeam?.name ||
          "Unknown Franchise",

        awayName:
          franchiseNames[
            awayOwner
          ] ||
          awayTeam?.name ||
          "Unknown Franchise",

        historicalHomeName:
          homeTeam?.name ||
          "Unknown Team",

        historicalAwayName:
          awayTeam?.name ||
          "Unknown Team",

        homeScore,
        awayScore,

        margin:
          Math.abs(
            homeScore -
            awayScore
          ),

        winnerOwner
      });
    });
  });

  return games.sort(
    (a, b) =>
      a.year - b.year ||
      a.week - b.week
  );
}

function getRivalryStats(
  seasons,
  ownerA,
  ownerB,
  franchiseNames
) {
  const games =
    buildRivalryGames(
      seasons,
      ownerA,
      ownerB,
      franchiseNames
    );

  let winsA = 0;
  let winsB = 0;
  let ties = 0;
  let pointsA = 0;
  let pointsB = 0;

  games.forEach(game => {
    const aIsHome =
      game.homeOwner === ownerA;

    const scoreA =
      aIsHome
        ? game.homeScore
        : game.awayScore;

    const scoreB =
      aIsHome
        ? game.awayScore
        : game.homeScore;

    pointsA += scoreA;
    pointsB += scoreB;

    if (scoreA > scoreB) {
      winsA++;
    } else if (scoreB > scoreA) {
      winsB++;
    } else {
      ties++;
    }
  });

  const nonTies =
    games.filter(
      game =>
        game.winnerOwner
    );

  const biggest =
    nonTies
      .slice()
      .sort(
        (a, b) =>
          b.margin - a.margin
      )[0] || null;

  const closest =
    nonTies
      .slice()
      .sort(
        (a, b) =>
          a.margin - b.margin
      )[0] || null;

  let streakOwner = null;
  let streak = 0;

  for (
    let i = games.length - 1;
    i >= 0;
    i--
  ) {
    const winner =
      games[i].winnerOwner;

    if (!winner) {
      break;
    }

    if (!streakOwner) {
      streakOwner = winner;
      streak = 1;
      continue;
    }

    if (
      winner === streakOwner
    ) {
      streak++;
    } else {
      break;
    }
  }

  return {
    games,
    winsA,
    winsB,
    ties,
    pointsA,
    pointsB,
    biggest,
    closest,
    streakOwner,
    streak
  };
}

function getGameWinnerName(
  game,
  franchiseNames
) {
  if (!game?.winnerOwner) {
    return "Tie";
  }

  return (
    franchiseNames[
      game.winnerOwner
    ] ||
    "Unknown Franchise"
  );
}

function buildRivalrySummary(
  stats,
  ownerA,
  ownerB,
  franchiseNames
) {
  const nameA =
    franchiseNames[ownerA] ||
    "Franchise A";

  const nameB =
    franchiseNames[ownerB] ||
    "Franchise B";

  if (!stats.games.length) {
    return `${nameA} and ${nameB} have not met in the available SBF history.`;
  }

  let leaderText = "";

  if (
    stats.winsA >
    stats.winsB
  ) {
    leaderText =
      `${nameA} owns the all-time edge ${stats.winsA}-${stats.winsB}`;
  } else if (
    stats.winsB >
    stats.winsA
  ) {
    leaderText =
      `${nameB} owns the all-time edge ${stats.winsB}-${stats.winsA}`;
  } else {
    leaderText =
      `the all-time series is dead even at ${stats.winsA}-${stats.winsB}`;
  }

  if (stats.ties) {
    leaderText +=
      ` with ${stats.ties} tie${stats.ties === 1 ? "" : "s"}`;
  }

  let summary =
    `Through ${stats.games.length} meeting${stats.games.length === 1 ? "" : "s"}, ${leaderText}.`;

  if (
    stats.streakOwner &&
    stats.streak
  ) {
    const streakName =
      franchiseNames[
        stats.streakOwner
      ] ||
      "One franchise";

    summary +=
      ` ${streakName} enters the next matchup riding a ${stats.streak}-game winning streak in the series.`;
  }

  if (stats.closest) {
    summary +=
      ` The tightest meeting was decided by only ${formatNumber(stats.closest.margin)} point${stats.closest.margin === 1 ? "" : "s"}.`;
  }

  return summary;
}

function renderRivalryGame(
  game,
  franchiseNames
) {
  const winner =
    getGameWinnerName(
      game,
      franchiseNames
    );

  return `
    <div class="history-rivalry-game">

      <div class="history-rivalry-game-date">

        <strong>
          ${game.year}
        </strong>

        <span>
          Week ${game.week}
        </span>

      </div>

      <div class="history-rivalry-game-matchup">

        <div>
          <strong>
            ${escapeHTML(
              game.historicalAwayName
            )}
          </strong>

          <span>
            ${formatNumber(
              game.awayScore
            )}
          </span>
        </div>

        <div>
          <strong>
            ${escapeHTML(
              game.historicalHomeName
            )}
          </strong>

          <span>
            ${formatNumber(
              game.homeScore
            )}
          </span>
        </div>

      </div>

      <div class="history-rivalry-game-result">

        <span>
          Winner
        </span>

        <strong>
          ${escapeHTML(
            winner
          )}
        </strong>

      </div>

    </div>
  `;
}

function renderRivalryResults(
  seasons,
  ownerA,
  ownerB,
  franchiseNames
) {
  if (
    !ownerA ||
    !ownerB
  ) {
    return `
      <article class="history-rivalry-empty">

        <div class="history-rivalry-empty-icon">
          ⚔️
        </div>

        <h3>
          Pick Two Franchises
        </h3>

        <p>
          Choose any two SBF franchises
          above to open the all-time
          rivalry file.
        </p>

      </article>
    `;
  }

  if (ownerA === ownerB) {
    return `
      <article class="history-rivalry-empty">

        <div class="history-rivalry-empty-icon">
          🤨
        </div>

        <h3>
          Pick Two Different Franchises
        </h3>

        <p>
          A franchise cannot have an
          all-time rivalry with itself.
        </p>

      </article>
    `;
  }

  const stats =
    getRivalryStats(
      seasons,
      ownerA,
      ownerB,
      franchiseNames
    );

  const nameA =
    franchiseNames[ownerA] ||
    "Franchise A";

  const nameB =
    franchiseNames[ownerB] ||
    "Franchise B";

  if (!stats.games.length) {
    return `
      <article class="history-rivalry-empty">

        <div class="history-rivalry-empty-icon">
          📂
        </div>

        <h3>
          No Meetings Found
        </h3>

        <p>
          ${escapeHTML(nameA)}
          and
          ${escapeHTML(nameB)}
          have no head-to-head games in
          the available SBF archive.
        </p>

      </article>
    `;
  }

  const biggest =
    stats.biggest;

  const closest =
    stats.closest;

  const biggestWinner =
    biggest
      ? getGameWinnerName(
          biggest,
          franchiseNames
        )
      : "—";

  const streakName =
    stats.streakOwner
      ? franchiseNames[
          stats.streakOwner
        ] ||
        "Unknown"
      : "None";

  const summary =
    buildRivalrySummary(
      stats,
      ownerA,
      ownerB,
      franchiseNames
    );

  return `
    <div class="history-rivalry-results">

      <div class="history-rivalry-title">

        <div>

          <p class="eyebrow">
            All-Time Series
          </p>

          <h3>
            ${escapeHTML(nameA)}
            <span>vs</span>
            ${escapeHTML(nameB)}
          </h3>

        </div>

        <div class="history-rivalry-meetings">

          <strong>
            ${stats.games.length}
          </strong>

          <span>
            Meetings
          </span>

        </div>

      </div>

      <div class="history-rivalry-series">

        <div class="history-rivalry-side">

          <strong>
            ${escapeHTML(nameA)}
          </strong>

          <span class="history-rivalry-wins">
            ${stats.winsA}
          </span>

          <small>
            Wins
          </small>

        </div>

        <div class="history-rivalry-series-middle">

          <span>
            SERIES
          </span>

          <strong>
            ${stats.winsA}
            -
            ${stats.winsB}
            ${
              stats.ties
                ? `-${stats.ties}`
                : ""
            }
          </strong>

          ${
            stats.ties
              ? `
                <small>
                  W-L-T
                </small>
              `
              : `
                <small>
                  W-L
                </small>
              `
          }

        </div>

        <div class="history-rivalry-side">

          <strong>
            ${escapeHTML(nameB)}
          </strong>

          <span class="history-rivalry-wins">
            ${stats.winsB}
          </span>

          <small>
            Wins
          </small>

        </div>

      </div>

      <div class="history-rivalry-stat-grid">

        <article>

          <span>
            Total Points
          </span>

          <strong>
            ${formatNumber(
              stats.pointsA
            )}
            –
            ${formatNumber(
              stats.pointsB
            )}
          </strong>

          <small>
            ${escapeHTML(nameA)}
            vs
            ${escapeHTML(nameB)}
          </small>

        </article>

        <article>

          <span>
            Biggest Win
          </span>

          <strong>
            ${
              biggest
                ? `+${formatNumber(
                    biggest.margin
                  )}`
                : "—"
            }
          </strong>

          <small>
            ${escapeHTML(
              biggestWinner
            )}
            ${
              biggest
                ? `• ${biggest.year} W${biggest.week}`
                : ""
            }
          </small>

        </article>

        <article>

          <span>
            Closest Game
          </span>

          <strong>
            ${
              closest
                ? formatNumber(
                    closest.margin
                  )
                : "—"
            }
          </strong>

          <small>
            ${
              closest
                ? `${closest.year} • Week ${closest.week}`
                : ""
            }
          </small>

        </article>

        <article>

          <span>
            Current Streak
          </span>

          <strong>
            ${
              stats.streak
                ? `${stats.streak} W`
                : "—"
            }
          </strong>

          <small>
            ${escapeHTML(
              streakName
            )}
          </small>

        </article>

      </div>

      <article class="history-rivalry-summary">

        <p class="eyebrow">
          Rivalry Report
        </p>

        <p>
          ${escapeHTML(
            summary
          )}
        </p>

      </article>

      <div class="history-rivalry-history">

        <div class="history-rivalry-history-heading">

          <div>

            <p class="eyebrow">
              The Tape
            </p>

            <h3>
              Head-to-Head History
            </h3>

          </div>

          <span>
            Most recent first
          </span>

        </div>

        ${stats.games
          .slice()
          .reverse()
          .map(
            game =>
              renderRivalryGame(
                game,
                franchiseNames
              )
          )
          .join("")}

      </div>

    </div>
  `;
}

function renderRivalryCenter(
  seasons,
  franchiseNames
) {
  const franchises =
    buildRivalryFranchises(
      seasons,
      franchiseNames
    );

  const options =
    franchises
      .map(
        franchise => `
          <option
            value="${escapeHTML(
              franchise.owner
            )}"
          >
            ${escapeHTML(
              franchise.name
            )}
          </option>
        `
      )
      .join("");

  return `
    <section class="history-section history-rivalry-section">

      <div class="section-heading">

        <p class="eyebrow">
          ⚔️ Head-to-Head
        </p>

        <h2>
          Rivalry Center
        </h2>

        <p class="history-section-copy">
          Pick any two franchises to
          open their all-time SBF
          head-to-head record.
        </p>

      </div>

      <div class="history-rivalry-picker">

        <label>

          <span>
            Franchise A
          </span>

          <select
            id="history-rivalry-a"
            class="history-rivalry-select"
          >

            <option value="">
              Choose Franchise
            </option>

            ${options}

          </select>

        </label>

        <div class="history-rivalry-vs">
          VS
        </div>

        <label>

          <span>
            Franchise B
          </span>

          <select
            id="history-rivalry-b"
            class="history-rivalry-select"
          >

            <option value="">
              Choose Franchise
            </option>

            ${options}

          </select>

        </label>

      </div>

      <div id="history-rivalry-results">

        ${renderRivalryResults(
          seasons,
          "",
          "",
          franchiseNames
        )}

      </div>

    </section>
  `;
}

function attachRivalryHandlers(
  seasons,
  franchiseNames
) {
  const selectA =
    document.getElementById(
      "history-rivalry-a"
    );

  const selectB =
    document.getElementById(
      "history-rivalry-b"
    );

  const results =
    document.getElementById(
      "history-rivalry-results"
    );

  if (
    !selectA ||
    !selectB ||
    !results
  ) {
    return;
  }

  const update = () => {
    results.innerHTML =
      renderRivalryResults(
        seasons,
        selectA.value,
        selectB.value,
        franchiseNames
      );
  };

  selectA.addEventListener(
    "change",
    update
  );

  selectB.addEventListener(
    "change",
    update
  );
}

/* =====================================================
   SEASON ARCHIVE
   ===================================================== */

function renderSeasonStandings(season) {
  const teams =
    Array.isArray(season.teams)
      ? season.teams
      : [];

  return teams
    .slice()
    .sort((a, b) => {
      const standingA =
        Number(
          a.finalStanding || 999
        );

      const standingB =
        Number(
          b.finalStanding || 999
        );

      return (
        standingA -
        standingB
      );
    })
    .map(team => `
      <div class="history-season-team">

        <div class="history-season-rank">
          ${
            team.finalStanding ||
            "—"
          }
        </div>

        <div class="history-season-team-info">

          <strong>
            ${escapeHTML(
              team.name ||
              "Unknown Team"
            )}
          </strong>

          ${
            season.champion?.teamId ===
            team.id
              ? `
                <span class="history-champion-tag">
                  🏆 Champion
                </span>
              `
              : ""
          }

          ${
            season.runnerUp?.teamId ===
            team.id
              ? `
                <span class="history-runner-tag">
                  Runner-Up
                </span>
              `
              : ""
          }

        </div>

        <div class="history-season-record">

          <strong>
            ${team.wins || 0}-${
              team.losses || 0
            }
          </strong>

          <span>
            ${formatNumber(
              team.pointsFor
            )} PF
          </span>

        </div>

      </div>
    `)
    .join("");
}

function renderSeasonRecordGame(
  season,
  record,
  label,
  icon
) {
  if (!record) {
    return "";
  }

  const home =
    findTeam(
      season,
      record.home?.teamId
    );

  const away =
    findTeam(
      season,
      record.away?.teamId
    );

  const homeScore =
    Number(
      record.home?.score || 0
    );

  const awayScore =
    Number(
      record.away?.score || 0
    );

  return `
    <div class="history-season-record-item">

      <p class="eyebrow">
        ${icon} ${escapeHTML(label)}
      </p>

      <strong>
        ${escapeHTML(
          home?.name ||
          "Unknown Team"
        )}
        ${formatNumber(
          homeScore
        )}
      </strong>

      <span>
        vs
      </span>

      <strong>
        ${escapeHTML(
          away?.name ||
          "Unknown Team"
        )}
        ${formatNumber(
          awayScore
        )}
      </strong>

      <small>
        Week ${record.week}
      </small>

    </div>
  `;
}

function renderSeason(season) {
  return `
    <article class="history-season-card">

      <header class="history-season-header">

        <div>

          <p class="eyebrow">
            Season Archive
          </p>

          <h2>
            ${season.year}
          </h2>

        </div>

        <div class="history-season-champ">

          <span>
            Champion
          </span>

          <strong>
            🏆
            ${escapeHTML(
              season.champion?.name ||
              "Unknown"
            )}
          </strong>

        </div>

      </header>

      <div class="history-season-standings">

        <div class="history-season-title">
          <span>
            Final Standings
          </span>
        </div>

        ${renderSeasonStandings(
          season
        )}

      </div>

      <div class="history-season-records">

        <div class="history-season-record-item">

          <p class="eyebrow">
            🔥 Highest Score
          </p>

          <strong>
            ${formatNumber(
              season.records
                ?.highestSingleTeamScore
            )}
          </strong>

        </div>

        ${renderSeasonRecordGame(
          season,
          season.records
            ?.biggestBlowout,
          "Biggest Blowout",
          "💥"
        )}

        ${renderSeasonRecordGame(
          season,
          season.records
            ?.closestGame,
          "Closest Game",
          "🎯"
        )}

      </div>

    </article>
  `;
}

export async function renderHistory() {
  const container =
    document.getElementById(
      "history"
    );

  if (!container) {
    return;
  }

  container.innerHTML = `
    <article class="panel">

      <p class="eyebrow">
        League History
      </p>

      <h2>
        Loading the record book...
      </h2>

    </article>
  `;

  try {
    const data =
      await loadHistory();

    const seasons =
      Array.isArray(data.seasons)
        ? data.seasons
        : [];

    const allTime =
      Array.isArray(data.allTime)
        ? data.allTime
        : [];

    const franchiseNames =
      buildFranchiseNameMap(
        seasons
      );

    const sortedSeasons =
      getSortedSeasons(
        seasons
      );

    const allTimeFranchises =
      buildAllTimeFranchises(
        allTime,
        franchiseNames
      );

    const championshipLeader =
      allTimeFranchises
        .slice()
        .sort(
          (a, b) =>
            b.championships -
              a.championships ||
            b.wins -
              a.wins
        )[0];

    const winsLeader =
      allTimeFranchises
        .slice()
        .sort(
          (a, b) =>
            b.wins -
            a.wins
        )[0];

    const pointsLeader =
      allTimeFranchises
        .slice()
        .sort(
          (a, b) =>
            Number(
              b.pointsFor || 0
            ) -
            Number(
              a.pointsFor || 0
            )
        )[0];

    const winPctLeader =
      allTimeFranchises
        .filter(team => {
          const games =
            Number(team.wins || 0) +
            Number(team.losses || 0);

          return games > 0;
        })
        .slice()
        .sort((a, b) => {
          const gamesA =
            Number(a.wins || 0) +
            Number(a.losses || 0);

          const gamesB =
            Number(b.wins || 0) +
            Number(b.losses || 0);

          const pctA =
            gamesA
              ? Number(a.wins || 0) /
                gamesA
              : 0;

          const pctB =
            gamesB
              ? Number(b.wins || 0) /
                gamesB
              : 0;

          return (
            pctB - pctA ||
            b.wins - a.wins
          );
        })[0];

    const winPct =
      winPctLeader
        ? (
            Number(
              winPctLeader.wins || 0
            ) /
            (
              Number(
                winPctLeader.wins || 0
              ) +
              Number(
                winPctLeader.losses || 0
              )
            )
          )
            .toFixed(3)
            .replace(/^0/, "")
        : "—";

    container.innerHTML = `

      <header class="page-hero history-hero">

        <p class="eyebrow">
          SBF Record Book
        </p>

        <h1>
          League History
        </h1>

        <p>
          Every champion, franchise,
          record and season from the
          history of Stumblin Bumblin
          and Fumblin.
        </p>

        <div class="history-hero-stats">

          <div>
            <strong>
              ${seasons.length}
            </strong>

            <span>
              Seasons
            </span>
          </div>

          <div>
            <strong>
              ${seasons.length}
            </strong>

            <span>
              Champions Crowned
            </span>
          </div>

          <div>
            <strong>
              ${
                allTime.reduce(
                  (
                    total,
                    team
                  ) =>
                    total +
                    Number(
                      team.championships ||
                      0
                    ),
                  0
                )
              }
            </strong>

            <span>
              Titles
            </span>
          </div>

        </div>

      </header>


      <section class="history-section">

        <div class="section-heading">

          <p class="eyebrow">
            Hall of Champions
          </p>

          <h2>
            Champions
          </h2>

        </div>

        <div class="history-champions-grid">
          ${renderChampions(
            seasons
          )}
        </div>

      </section>


      <section class="history-section">

        <div class="section-heading">

          <p class="eyebrow">
            SBF Record Book
          </p>

          <h2>
            League Records
          </h2>

        </div>


        <div class="history-franchise-record-grid">

          <article class="history-franchise-record-card">

            <p class="eyebrow">
              🏆 Most Championships
            </p>

            <h3>
              ${
                championshipLeader
                  ? escapeHTML(
                      championshipLeader.franchise
                    )
                  : "—"
              }
            </h3>

            <strong class="history-record-number">
              ${
                championshipLeader
                  ? championshipLeader
                      .championships
                  : "—"
              }
            </strong>

            <span>
              ${
                championshipLeader
                  ? championshipLeader
                        .championships === 1
                    ? "Championship"
                    : "Championships"
                  : ""
              }
            </span>

          </article>


          <article class="history-franchise-record-card">

            <p class="eyebrow">
              📈 Most All-Time Wins
            </p>

            <h3>
              ${
                winsLeader
                  ? escapeHTML(
                      winsLeader.franchise
                    )
                  : "—"
              }
            </h3>

            <strong class="history-record-number">
              ${
                winsLeader
                  ? winsLeader.wins
                  : "—"
              }
            </strong>

            <span>
              Career Wins
            </span>

          </article>


          <article class="history-franchise-record-card">

            <p class="eyebrow">
              🎯 Best All-Time Win %
            </p>

            <h3>
              ${
                winPctLeader
                  ? escapeHTML(
                      winPctLeader.franchise
                    )
                  : "—"
              }
            </h3>

            <strong class="history-record-number">
              ${winPct}
            </strong>

            <span>
              ${
                winPctLeader
                  ? `${winPctLeader.wins}-${winPctLeader.losses}`
                  : ""
              }
            </span>

          </article>


          <article class="history-franchise-record-card">

            <p class="eyebrow">
              ⚡ Most All-Time Points
            </p>

            <h3>
              ${
                pointsLeader
                  ? escapeHTML(
                      pointsLeader.franchise
                    )
                  : "—"
              }
            </h3>

            <strong class="history-record-number">
              ${
                pointsLeader
                  ? formatNumber(
                      pointsLeader.pointsFor
                    )
                  : "—"
              }
            </strong>

            <span>
              Points For
            </span>

          </article>

        </div>


        ${renderLeagueRecords(
          seasons
        )}

      </section>


      <section class="history-section">

        <div class="section-heading">

          <p class="eyebrow">
            Franchise Records
          </p>

          <h2>
            All-Time Standings
          </h2>

          <p class="history-section-copy">
            Franchises are ranked by
            championships, wins and
            total points.
          </p>

        </div>

        <div class="history-alltime">

          ${renderAllTime(
            allTime,
            franchiseNames
          )}

        </div>

      </section>


      ${renderRivalryCenter(
        seasons,
        franchiseNames
      )}


      <section class="history-section">

        <div class="section-heading">

          <p class="eyebrow">
            The Archives
          </p>

          <h2>
            Season by Season
          </h2>

          <p class="history-section-copy">
            Final standings, champions
            and notable records from
            every SBF season.
          </p>

        </div>

        <div class="history-seasons">

          ${sortedSeasons
            .map(renderSeason)
            .join("")}

        </div>

      </section>

    `;

    attachRivalryHandlers(
      seasons,
      franchiseNames
    );

  } catch (error) {
    console.error(
      "League history failed:",
      error
    );

    container.innerHTML = `
      <article class="panel">

        <p class="eyebrow">
          League History
        </p>

        <h2>
          History unavailable
        </h2>

        <p>
          The SBF record book could
          not be loaded.
        </p>

      </article>
    `;
  }
}