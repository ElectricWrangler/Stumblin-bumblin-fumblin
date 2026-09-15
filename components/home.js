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
    const response =
      await fetch(
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


async function loadLatestRecap() {
  try {

    const response =
      await fetch(
        `recaps/latest.json?ts=${Date.now()}`,
        {
          cache: "no-store"
        }
      );

    if (!response.ok) {
      return null;
    }

    return await response.json();

  } catch (error) {

    console.warn(
      "Latest recap unavailable:",
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
    PRESEASON COMMISSIONER OVERRIDE

    This remains here so the old
    preseason setup still behaves
    correctly if preseason data is
    ever displayed again.
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
      ] =
        orderedTeams.splice(
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

        let displayedOdds =
          team.championship_odds
          ||
          "—";


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


/*
  =====================================================
  WEEKLY RECAP SECTION HELPERS
  =====================================================

  These read the actual generated recap HTML.

  That means Home automatically follows
  whatever the newest weekly recap says.
  =====================================================
*/


function makeRecapWrapper(
  recap
) {
  const wrapper =
    document.createElement(
      "div"
    );

  wrapper.innerHTML =
    recap?.html || "";

  return wrapper;
}


function findRecapSection(
  wrapper,
  sectionName
) {
  const headings =
    Array.from(
      wrapper.querySelectorAll(
        "h2"
      )
    );

  const heading =
    headings.find(
      node =>
        node.textContent
          .trim()
          .toLowerCase() ===
        sectionName
          .trim()
          .toLowerCase()
    );

  if (!heading) {
    return [];
  }


  const nodes = [];

  let current =
    heading.nextElementSibling;


  while (
    current &&
    current.tagName !== "H2"
  ) {

    nodes.push(
      current
    );

    current =
      current.nextElementSibling;
  }


  return nodes;
}


function cleanText(value) {
  return String(
    value || ""
  )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


function parseFraudWatch(
  wrapper,
  week
) {
  const nodes =
    findRecapSection(
      wrapper,
      "Fraud Watch"
    );

  const titleNode =
    nodes.find(
      node =>
        node.tagName === "H3"
    );

  let copyNode = null;

  if (titleNode) {

    const titleIndex =
      nodes.indexOf(
        titleNode
      );

    copyNode =
      nodes
        .slice(
          titleIndex + 1
        )
        .find(
          node =>
            node.tagName === "P"
        );
  }


  if (!titleNode) {
    return {
      title:
        "Fraud Watch pending",

      copy:
        `Week ${week} Fraud Watch will appear here when the recap publishes.`
    };
  }


  return {
    title:
      cleanText(
        titleNode.textContent
      ),

    copy:
      cleanText(
        copyNode?.textContent
      )
      ||
      `Featured on the Week ${week} Fraud Watch list.`
  };
}


function parseStockUp(
  wrapper,
  week
) {
  const nodes =
    findRecapSection(
      wrapper,
      "Stock Up"
    );

  const listItem =
    nodes
      .flatMap(
        node =>
          node.tagName === "UL" ||
          node.tagName === "OL"
            ? Array.from(
                node.querySelectorAll(
                  ":scope > li"
                )
              )
            : node.tagName === "LI"
              ? [node]
              : []
      )[0];


  if (!listItem) {
    return {
      title:
        "Stock Up pending",

      copy:
        `Week ${week} Stock Up will appear here when the recap publishes.`
    };
  }


  const strong =
    listItem.querySelector(
      "strong"
    );

  const title =
    cleanText(
      strong?.textContent
    ).replace(
      /:$/,
      ""
    );


  let copy =
    cleanText(
      listItem.textContent
    );


  if (
    strong?.textContent
  ) {
    copy =
      cleanText(
        copy.replace(
          strong.textContent,
          ""
        )
      )
        .replace(
          /^:\s*/,
          ""
        );
  }


  return {
    title:
      title ||
      `Week ${week}`,

    copy:
      copy ||
      "Stock is moving up."
  };
}


function parseWeeklyAward(
  wrapper,
  week
) {
  const nodes =
    findRecapSection(
      wrapper,
      "Weekly Awards"
    );


  const listItem =
    nodes
      .flatMap(
        node =>
          node.tagName === "UL" ||
          node.tagName === "OL"
            ? Array.from(
                node.querySelectorAll(
                  ":scope > li"
                )
              )
            : node.tagName === "LI"
              ? [node]
              : []
      )[0];


  if (!listItem) {
    return {
      title:
        "Weekly Award pending",

      copy:
        `The Week ${week} award winner will appear here when the recap publishes.`
    };
  }


  const strong =
    listItem.querySelector(
      "strong"
    );


  const awardName =
    cleanText(
      strong?.textContent
    ).replace(
      /:$/,
      ""
    );


  let copy =
    cleanText(
      listItem.textContent
    );


  if (
    strong?.textContent
  ) {

    copy =
      cleanText(
        copy.replace(
          strong.textContent,
          ""
        )
      )
        .replace(
          /^:\s*/,
          ""
        );
  }


  return {
    title:
      awardName ||
      `Week ${week} Award`,

    copy:
      copy ||
      "This week's award winner."
  };
}


function getWeeklyFeatures(
  recap
) {
  if (!recap) {
    return {
      week: null,

      fraud: {
        title:
          "No suspects yet",

        copy:
          "Fraud Watch will update when the next weekly recap publishes."
      },

      stock: {
        title:
          "Waiting for kickoff",

        copy:
          "Stock Up will update from the newest weekly recap."
      },

      award: {
        title:
          "Award pending",

        copy:
          "The newest weekly award will appear here automatically."
      }
    };
  }


  const wrapper =
    makeRecapWrapper(
      recap
    );


  return {
    week:
      recap.week,

    fraud:
      parseFraudWatch(
        wrapper,
        recap.week
      ),

    stock:
      parseStockUp(
        wrapper,
        recap.week
      ),

    award:
      parseWeeklyAward(
        wrapper,
        recap.week
      )
  };
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


  /*
    Load the newest rankings and newest
    weekly recap together.
  */

  const [
    rankingData,
    recap
  ] =
    await Promise.all([
      loadPowerRankings(),
      loadLatestRecap()
    ]);


  const odds =
    rankingData
      ? officialOdds(
          rankingData,
          data
        )
      : fallbackOdds(
          data.teams
        );


  /*
    =====================================================
    LATEST EDITION CARD
    =====================================================
  */

  let latest = {
    headline:
      "Preseason Headquarters",

    copy:
      "Your generated recap will appear here automatically."
  };


  if (recap) {

    const wrapper =
      makeRecapWrapper(
        recap
      );

    latest = {
      headline:
        recap.headline
        ||
        wrapper
          .querySelector(
            "h2,h3"
          )
          ?.textContent
        ||
        `Week ${recap.week} Recap`,

      copy:
        `Week ${recap.week} has been published on the SBF Network.`
    };
  }


  /*
    =====================================================
    DYNAMIC WEEKLY FEATURES
    =====================================================
  */

  const weeklyFeatures =
    getWeeklyFeatures(
      recap
    );


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
          ${
            weeklyFeatures.week
              ? `• Week ${escapeHTML(
                  weeklyFeatures.week
                )}`
              : ""
          }
        </p>

        <h3>
          ${escapeHTML(
            weeklyFeatures
              .fraud
              .title
          )}
        </h3>

        <p>
          ${escapeHTML(
            weeklyFeatures
              .fraud
              .copy
          )}
        </p>

      </article>


      <article class="panel">

        <span class="icon">
          📈
        </span>

        <p class="eyebrow">
          Stock Up
          ${
            weeklyFeatures.week
              ? `• Week ${escapeHTML(
                  weeklyFeatures.week
                )}`
              : ""
          }
        </p>

        <h3>
          ${escapeHTML(
            weeklyFeatures
              .stock
              .title
          )}
        </h3>

        <p>
          ${escapeHTML(
            weeklyFeatures
              .stock
              .copy
          )}
        </p>

      </article>


      <article class="panel">

        <span class="icon">
          🏆
        </span>

        <p class="eyebrow">
          Weekly Award
          ${
            weeklyFeatures.week
              ? `• Week ${escapeHTML(
                  weeklyFeatures.week
                )}`
              : ""
          }
        </p>

        <h3>
          ${escapeHTML(
            weeklyFeatures
              .award
              .title
          )}
        </h3>

        <p>
          ${escapeHTML(
            weeklyFeatures
              .award
              .copy
          )}
        </p>

      </article>

    </section>
  `;


  container
    .querySelectorAll(
      "[data-route-jump]"
    )
    .forEach(
      button => {

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

      }
    );
}