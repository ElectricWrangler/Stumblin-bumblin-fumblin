import { escapeHTML } from "./data.js";

function standingsRows(
  teams,
  limit = 5
) {
  return teams
    .slice(0, limit)
    .map(
      (team, index) => `
        <div class="standing-row">

          <span class="rank">
            ${index + 1}
          </span>

          <div>

            <span class="team-title">
              ${escapeHTML(
                team.team
              )}
            </span>

            <span class="owner-title">
              ${escapeHTML(
                team.owner
              )}
            </span>

          </div>

          <div class="record">

            ${team.wins}-${team.losses}

            <span class="points">
              ${team.pointsFor.toFixed(1)}
              PF
            </span>

          </div>

        </div>
      `
    )
    .join("");
}

async function loadPowerRankings() {
  try {
    const response = await fetch(
      `data/power-rankings.json?ts=${Date.now()}`
    );

    if (!response.ok) {
      throw new Error(
        "Power rankings unavailable"
      );
    }

    const result =
      await response.json();

    if (
      !Array.isArray(
        result?.teams
      )
    ) {
      throw new Error(
        "Invalid power ranking data"
      );
    }

    return result;

  } catch (error) {

    console.warn(
      "Using fallback championship odds:",
      error
    );

    return null;
  }
}

function fallbackOdds(
  teams
) {
  return teams
    .slice(0, 10)
    .map(
      (team, index) => `
        <div class="odds-row">

          <strong>
            ${escapeHTML(
              team.team
            )}
          </strong>

          <strong>
            +${350 + index * 125}
          </strong>

        </div>
      `
    )
    .join("");
}

function officialOdds(
  rankingData,
  data
) {
  const teamByRoster =
    Object.fromEntries(
      data.teams.map(
        team => [
          Number(team.rosterId),
          team
        ]
      )
    );

  /*
    =====================================================
    NORMAL GENERATED ODDS ORDER
    =====================================================
  */

  let orderedTeams =
    rankingData.teams
      .slice()
      .sort(
        (a, b) =>
          Number(
            a.rank || 999
          )
          -
          Number(
            b.rank || 999
          )
      );


  /*
    =====================================================
    PRESEASON COMMISSIONER OVERRIDE
    =====================================================

    Muth Juice is temporarily placed
    at #3 in Championship Odds.

    Once actual Week 1 fantasy scoring
    begins, this automatically turns off.
    =====================================================
  */

  const weekOneHasStarted =
    data.teams.some(
      team =>
        Number(
          team.pointsFor
        ) > 0
    );

  const preseasonOverrideActive =
    !weekOneHasStarted &&
    rankingData?.mode ===
      "preseason";

  if (
    preseasonOverrideActive
  ) {

    const muthIndex =
      orderedTeams.findIndex(
        team =>
          Number(
            team.roster_id
          ) === 1
          ||
          String(
            team.team || ""
          )
            .toLowerCase()
            .includes(
              "muth juice"
            )
      );

    if (
      muthIndex !== -1
    ) {

      const [
        muthJuice
      ] = orderedTeams.splice(
        muthIndex,
        1
      );

      orderedTeams.splice(
        2,
        0,
        muthJuice
      );
    }
  }


  /*
    =====================================================
    DISPLAY ODDS
    =====================================================
  */

  return orderedTeams
    .slice(0, 10)
    .map(
      (
        team,
        index
      ) => {

        const sleeperTeam =
          teamByRoster[
            Number(
              team.roster_id
            )
          ];

        const teamName =
          sleeperTeam?.team
          ||
          team.team
          ||
          `Team ${team.roster_id}`;

        const reason =
          team.reason || "";

        /*
          During the preseason override,
          Muth Juice inherits the odds
          value for the #3 position.

          Everyone below shifts down one
          odds slot.

          Once Week 1 starts, all teams
          return to their official
          generated odds.
        */

        let displayedOdds =
          team.championship_odds
          || "—";

        if (
          preseasonOverrideActive
        ) {

          const originalBoard =
            rankingData.teams
              .slice()
              .sort(
                (a, b) =>
                  Number(
                    a.rank || 999
                  )
                  -
                  Number(
                    b.rank || 999
                  )
              );

          const oddsForPosition =
            originalBoard[
              index
            ]?.championship_odds;

          if (oddsForPosition) {
            displayedOdds =
              oddsForPosition;
          }
        }

        return `
          <div class="odds-row">

            <div>

              <strong>
                ${escapeHTML(
                  teamName
                )}
              </strong>

              ${
                reason
                  ? `
                    <span class="owner-title">
                      ${escapeHTML(
                        reason
                      )}
                    </span>
                  `
                  : ""
              }

            </div>

            <strong>
              ${escapeHTML(
                displayedOdds
              )}
            </strong>

          </div>
        `;
      }
    )
    .join("");
}

export async function renderHome(
  data
) {
  const container =
    document.getElementById(
      "home"
    );

  if (!container) {
    return;
  }

  const rankingData =
    await loadPowerRankings();

  const odds =
    rankingData
      ? officialOdds(
          rankingData,
          data
        )
      : fallbackOdds(
          data.teams
        );

  let latest = {
    headline:
      "Preseason Headquarters",

    copy:
      "Your generated recap will appear here automatically."
  };

  try {

    const response =
      await fetch(
        `recaps/latest.json?ts=${Date.now()}`
      );

    if (response.ok) {

      const recap =
        await response.json();

      const wrapper =
        document.createElement(
          "div"
        );

      wrapper.innerHTML =
        recap.html || "";

      latest = {
        headline:
          wrapper
            .querySelector(
              "h2,h3"
            )
            ?.textContent
          ||
          recap.headline
          ||
          `Week ${recap.week} Recap`,

        copy:
          `Week ${recap.week} has been published automatically.`
      };
    }

  } catch {}


  /*
    =====================================================
    ODDS BOARD LABEL
    =====================================================
  */

  const weekOneHasStarted =
    data.teams.some(
      team =>
        Number(
          team.pointsFor
        ) > 0
    );

  const preseasonOverrideActive =
    rankingData?.mode ===
      "preseason"
    &&
    !weekOneHasStarted;

  let oddsLabel;

  if (
    preseasonOverrideActive
  ) {

    oddsLabel =
      "Preseason board";

  } else if (
    rankingData?.mode ===
    "preseason"
  ) {

    oddsLabel =
      "Preseason board";

  } else if (
    rankingData
  ) {

    oddsLabel =
      `Week ${rankingData.week} board`;

  } else {

    oddsLabel =
      "Fallback board";
  }


  /*
    =====================================================
    PAGE
    =====================================================
  */

  container.innerHTML = `

    <section class="hero">

      <div>

        <p class="eyebrow">
          Official League Media Home
        </p>

        <h1>
          ${escapeHTML(
            data.league.name
          )}
        </h1>

        <p>
          ${data.teams.length} teams
          •
          ${escapeHTML(
            data.season
          )} season
          •
          ${escapeHTML(
            data.status
          )}
        </p>

        <div class="actions">

          <button
            class="primary"
            data-route-jump="recaps"
          >
            Latest recap
          </button>

          <button
            class="secondary"
            data-route-jump="standings"
          >
            Standings
          </button>

        </div>

      </div>


      <article class="latest-card">

        <span>
          Latest Edition
        </span>

        <h2>
          ${escapeHTML(
            latest.headline
          )}
        </h2>

        <p>
          ${escapeHTML(
            latest.copy
          )}
        </p>

        <button
          data-route-jump="recaps"
        >
          Read story →
        </button>

      </article>

    </section>


    <section class="quick-stats">

      <article class="stat-card">

        <span>
          Teams
        </span>

        <strong>
          ${data.teams.length}
        </strong>

      </article>


      <article class="stat-card">

        <span>
          Week
        </span>

        <strong>
          ${data.currentWeek}
        </strong>

      </article>


      <article class="stat-card">

        <span>
          Status
        </span>

        <strong>
          ${escapeHTML(
            data.status
              .slice(0, 6)
              .toUpperCase()
          )}
        </strong>

      </article>

    </section>


    <section class="content-grid">

      <article class="panel">

        <div class="heading">

          <div>

            <p class="eyebrow">
              League Table
            </p>

            <h2>
              Standings
            </h2>

          </div>

        </div>

        ${standingsRows(
          data.teams
        )}

      </article>


      <article class="panel">

        <div class="heading">

          <div>

            <p class="eyebrow">
              The Book
            </p>

            <h2>
              Championship Odds
            </h2>

            <p class="owner-title">
              ${escapeHTML(
                oddsLabel
              )}
            </p>

          </div>

        </div>

        ${odds}

        <small>
          Entertainment only.
        </small>

      </article>

    </section>


    <section class="feature-row">

      <article class="panel">

        <span class="icon">
          🚨
        </span>

        <p class="eyebrow">
          Fraud Watch
        </p>

        <h3>
          No suspects yet
        </h3>

        <p>
          Everyone is innocent until
          the games begin.
        </p>

      </article>


      <article class="panel">

        <span class="icon">
          📈
        </span>

        <p class="eyebrow">
          Stock Up
        </p>

        <h3>
          League engagement
        </h3>

        <p>
          The site and recap engine
          are both live.
        </p>

      </article>


      <article class="panel">

        <span class="icon">
          🏆
        </span>

        <p class="eyebrow">
          Weekly Award
        </p>

        <h3>
          Preseason Optimist
        </h3>

        <p>
          Every manager currently
          thinks they built a champion.
        </p>

      </article>

    </section>
  `;

  container
    .querySelectorAll(
      "[data-route-jump]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const route =
            button.dataset.routeJump;

          document
            .querySelector(
              `[data-route="${route}"]`
            )
            ?.click();

        }
      );

    });
}