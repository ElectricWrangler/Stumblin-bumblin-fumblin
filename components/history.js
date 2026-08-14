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
}function findClosestGame(seasons) {
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

      /*
        Ignore exact ties for the
        "closest game" record.
      */
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
            season.champion?.id ===
            team.id
              ? `
                <span class="history-champion-tag">
                  🏆 Champion
                </span>
              `
              : ""
          }

          ${
            season.runnerUp?.id ===
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
}export async function renderHistory() {
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