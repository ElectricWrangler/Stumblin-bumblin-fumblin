import {
  escapeHTML,
  loadTransactions,
  loadNFLPlayers,
  loadWeekMatchups,
  getPlayerName
} from "./data.js";


let selectedWeek = null;
let currentLeagueData = null;
let playerDatabasePromise = null;


function clampWeek(
  week,
  maxWeek = 18
) {
  return Math.max(
    1,
    Math.min(
      maxWeek,
      Number(week) || 1
    )
  );
}


function renderMatchupCards(
  matchups,
  data,
  week
) {
  if (!matchups.length) {
    return `
      <article class="panel">

        <p class="eyebrow">
          Week ${week}
        </p>

        <h3>
          No matchups available yet
        </h3>

        <p>
          Sleeper has not published
          matchup data for Week ${week}
          yet.
        </p>

      </article>
    `;
  }


  return matchups
    .map(
      game => `
        <article class="matchup-card">

          <p class="eyebrow">
            Matchup ${escapeHTML(
              game.matchupId
            )}
          </p>


          ${game.teams
            .map(
              team => `
                <div class="matchup-team">

                  <div>

                    <span class="team-title">
                      ${escapeHTML(
                        team.team ||
                        "Unknown Team"
                      )}
                    </span>

                    <span class="owner-title">
                      ${escapeHTML(
                        team.owner || ""
                      )}
                    </span>

                  </div>


                  <strong>
                    ${Number(
                      team.score || 0
                    ).toFixed(2)}
                  </strong>

                </div>
              `
            )
            .join("")}


          <div class="matchup-meta">
            Week ${week}
          </div>

        </article>
      `
    )
    .join("");
}


function describeTransaction(
  transaction,
  data,
  players
) {
  const rosterIds =
    transaction.roster_ids || [];

  const teams =
    rosterIds
      .map(
        id =>
          data.teamByRoster[id]
      )
      .filter(Boolean);

  const teamNames =
    teams.length
      ? teams
          .map(
            team =>
              team.team
          )
          .join(", ")
      : "League transaction";


  const adds =
    transaction.adds
      ? Object.keys(
          transaction.adds
        ).map(
          playerId =>
            getPlayerName(
              playerId,
              players
            )
        )
      : [];


  const drops =
    transaction.drops
      ? Object.keys(
          transaction.drops
        ).map(
          playerId =>
            getPlayerName(
              playerId,
              players
            )
        )
      : [];


  let typeLabel =
    "Transaction";

  if (
    transaction.type ===
    "trade"
  ) {
    typeLabel =
      "Trade";
  }

  if (
    transaction.type ===
    "waiver"
  ) {
    typeLabel =
      "Waiver Claim";
  }

  if (
    transaction.type ===
    "free_agent"
  ) {
    typeLabel =
      "Free Agent Move";
  }


  return {
    typeLabel,
    teamNames,
    adds,
    drops
  };
}


function renderTransactions(
  transactions,
  data,
  players,
  week
) {
  if (!transactions.length) {
    return `
      <article class="panel">

        <p>
          No completed transactions
          are available for Week ${week}.
        </p>

      </article>
    `;
  }


  return transactions
    .slice(0, 8)
    .map(
      transaction => {

        const details =
          describeTransaction(
            transaction,
            data,
            players
          );

        return `
          <article
            class="panel transaction-card"
          >

            <p class="eyebrow">
              ${escapeHTML(
                details.typeLabel
              )}
            </p>


            <h3>
              ${escapeHTML(
                details.teamNames
              )}
            </h3>


            ${
              details.adds.length
                ? `
                  <p>
                    <strong>
                      Added:
                    </strong>
                    <br>

                    ${details.adds
                      .map(
                        name =>
                          `➕ ${escapeHTML(
                            name
                          )}`
                      )
                      .join("<br>")}
                  </p>
                `
                : ""
            }


            ${
              details.drops.length
                ? `
                  <p>
                    <strong>
                      Dropped:
                    </strong>
                    <br>

                    ${details.drops
                      .map(
                        name =>
                          `➖ ${escapeHTML(
                            name
                          )}`
                      )
                      .join("<br>")}
                  </p>
                `
                : ""
            }

          </article>
        `;
      }
    )
    .join("");
}


function renderWeekOptions(
  selected,
  maxWeek
) {
  let html = "";

  for (
    let week = 1;
    week <= maxWeek;
    week++
  ) {
    html += `
      <option
        value="${week}"
        ${
          week === selected
            ? "selected"
            : ""
        }
      >
        Week ${week}
      </option>
    `;
  }

  return html;
}


function renderLoadingState(
  container,
  week
) {
  container.innerHTML = `

    <header class="page-hero">

      <p class="eyebrow">
        League HQ
      </p>

      <h1>
        League Center
      </h1>

      <p>
        Loading Week ${week}...
      </p>

    </header>


    <article class="panel">

      <p>
        Loading Sleeper matchup data...
      </p>

    </article>
  `;
}


async function loadSelectedWeek(
  data,
  week
) {
  const container =
    document.getElementById(
      "matchups"
    );

  if (!container) {
    return;
  }


  const maxWeek =
    Math.max(
      18,
      Number(
        data.currentWeek || 1
      )
    );

  selectedWeek =
    clampWeek(
      week,
      maxWeek
    );


  renderLoadingState(
    container,
    selectedWeek
  );


  if (!playerDatabasePromise) {
    playerDatabasePromise =
      loadNFLPlayers();
  }


  let weekMatchups = [];
  let transactions = [];
  let players = {};


  try {

    [
      weekMatchups,
      transactions,
      players
    ] =
      await Promise.all([
        loadWeekMatchups(
          selectedWeek,
          data
        ),

        loadTransactions(
          selectedWeek
        ),

        playerDatabasePromise
      ]);

  } catch (error) {

    console.error(
      "Could not load League Center:",
      error
    );

  }


  const matchupCards =
    renderMatchupCards(
      weekMatchups,
      data,
      selectedWeek
    );


  const transactionCards =
    renderTransactions(
      transactions,
      data,
      players,
      selectedWeek
    );


  const previousDisabled =
    selectedWeek <= 1;


  const nextDisabled =
    selectedWeek >= maxWeek;


  const isCurrentWeek =
    Number(selectedWeek) ===
    Number(data.currentWeek);


  container.innerHTML = `

    <header class="page-hero">

      <p class="eyebrow">
        League HQ
      </p>

      <h1>
        League Center
      </h1>

      <p>
        Live Sleeper scores,
        league activity,
        standings data and
        weekly movement.
      </p>

    </header>


    <section>

      <div class="heading">

        <div>

          <p class="eyebrow">
            ${
              isCurrentWeek
                ? "Current Week"
                : "Season Archive"
            }
          </p>

          <h2>
            Week ${selectedWeek}
            Matchups
          </h2>

        </div>

      </div>


      <div
        class="week-navigation"
        style="
          display:flex;
          flex-wrap:wrap;
          gap:10px;
          align-items:center;
          margin-bottom:20px;
        "
      >

        <button
          type="button"
          class="secondary"
          id="previous-week-button"
          ${
            previousDisabled
              ? "disabled"
              : ""
          }
        >
          ← Previous Week
        </button>


        <select
          id="matchup-week-select"
          style="
            min-height:42px;
            padding:0 14px;
            border-radius:8px;
          "
        >
          ${renderWeekOptions(
            selectedWeek,
            maxWeek
          )}
        </select>


        <button
          type="button"
          class="secondary"
          id="next-week-button"
          ${
            nextDisabled
              ? "disabled"
              : ""
          }
        >
          Next Week →
        </button>


        ${
          !isCurrentWeek
            ? `
              <button
                type="button"
                class="primary"
                id="current-week-button"
              >
                Current Week
              </button>
            `
            : ""
        }

      </div>


      <div class="matchup-grid">
        ${matchupCards}
      </div>

    </section>


    <section
      style="margin-top:32px;"
    >

      <div class="heading">

        <div>

          <p class="eyebrow">
            Week ${selectedWeek}
          </p>

          <h2>
            League Activity
          </h2>

        </div>

      </div>


      <div class="archive-grid">
        ${transactionCards}
      </div>

    </section>

  `;


  attachWeekNavigation(
    data,
    maxWeek
  );
}


function attachWeekNavigation(
  data,
  maxWeek
) {
  const previousButton =
    document.getElementById(
      "previous-week-button"
    );

  const nextButton =
    document.getElementById(
      "next-week-button"
    );

  const currentWeekButton =
    document.getElementById(
      "current-week-button"
    );

  const weekSelect =
    document.getElementById(
      "matchup-week-select"
    );


  if (previousButton) {
    previousButton.addEventListener(
      "click",
      () => {

        if (
          selectedWeek <= 1
        ) {
          return;
        }

        loadSelectedWeek(
          data,
          selectedWeek - 1
        );

      }
    );
  }


  if (nextButton) {
    nextButton.addEventListener(
      "click",
      () => {

        if (
          selectedWeek >= maxWeek
        ) {
          return;
        }

        loadSelectedWeek(
          data,
          selectedWeek + 1
        );

      }
    );
  }


  if (currentWeekButton) {
    currentWeekButton.addEventListener(
      "click",
      () => {

        loadSelectedWeek(
          data,
          Number(
            data.currentWeek || 1
          )
        );

      }
    );
  }


  if (weekSelect) {
    weekSelect.addEventListener(
      "change",
      () => {

        loadSelectedWeek(
          data,
          Number(
            weekSelect.value
          )
        );

      }
    );
  }
}


export async function renderMatchups(
  matchups,
  data
) {
  const container =
    document.getElementById(
      "matchups"
    );

  if (!container) {
    return;
  }


  currentLeagueData =
    data;


  /*
    First time the page opens,
    default to Sleeper's current week.

    If the user already selected another
    week and returns to this page, keep
    their selected week.
  */

  if (
    selectedWeek === null
  ) {
    selectedWeek =
      Number(
        data.currentWeek || 1
      );
  }


  await loadSelectedWeek(
    currentLeagueData,
    selectedWeek
  );
}