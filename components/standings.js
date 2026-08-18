import {
  calculatePower,
  escapeHTML
} from "./data.js";

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
        "Invalid power rankings"
      );
    }

    return result;

  } catch (error) {

    console.warn(
      "Using fallback power rankings:",
      error
    );

    return null;
  }
}

export async function renderStandings(
  data
) {
  const container =
    document.getElementById(
      "standings"
    );

  if (!container) {
    return;
  }

  const maxPoints =
    Math.max(
      ...data.teams.map(
        team =>
          team.pointsFor
      ),
      1
    );

  const rankingData =
    await loadPowerRankings();

  const rankingByRoster =
    rankingData
      ? Object.fromEntries(
          rankingData.teams.map(
            team => [
              Number(
                team.roster_id
              ),
              team
            ]
          )
        )
      : {};


  /*
    =====================================================
    NORMAL POWER RANKING ORDER
    =====================================================
  */

  let ranked;

  if (rankingData) {

    ranked =
      [...data.teams]
        .sort(
          (a, b) => {

            const rankA =
              rankingByRoster[
                Number(
                  a.rosterId
                )
              ]?.rank ?? 999;

            const rankB =
              rankingByRoster[
                Number(
                  b.rosterId
                )
              ]?.rank ?? 999;

            return (
              rankA -
              rankB
            );
          }
        );

  } else {

    ranked =
      [...data.teams]
        .sort(
          (a, b) =>
            calculatePower(
              b,
              maxPoints
            )
            -
            calculatePower(
              a,
              maxPoints
            )
        );
  }


  /*
    =====================================================
    PRESEASON COMMISSIONER OVERRIDE
    =====================================================

    Muth Juice is temporarily placed
    at #3.

    As soon as actual fantasy scoring
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
    (
      !rankingData ||
      rankingData.mode ===
        "preseason"
    );

  if (
    preseasonOverrideActive
  ) {

    const muthIndex =
      ranked.findIndex(
        team =>
          Number(
            team.rosterId
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
      ] = ranked.splice(
        muthIndex,
        1
      );

      ranked.splice(
        2,
        0,
        muthJuice
      );
    }
  }


  /*
    =====================================================
    OFFICIAL STANDINGS
    =====================================================
  */

  const standings =
    data.teams
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

                ${team.pointsFor.toFixed(
                  1
                )}
                PF

              </span>

            </div>

          </div>
        `
      )
      .join("");


  /*
    =====================================================
    POWER RANKINGS
    =====================================================
  */

  const power =
    ranked
      .map(
        (team, index) => {

          const official =
            rankingByRoster[
              Number(
                team.rosterId
              )
            ];

          const score =
            official
              ?.power_score
            ??
            calculatePower(
              team,
              maxPoints
            );

          /*
            When the preseason override
            is active, use the actual
            displayed order as the rank.

            Otherwise use the official
            generated rank.
          */

          const rank =
            preseasonOverrideActive
              ? index + 1
              : (
                  official?.rank
                  ??
                  index + 1
                );

          const reason =
            official?.reason
            || "";

          return `
            <div class="power-row">

              <span class="rank">
                ${rank}
              </span>

              <div>

                <span class="team-title">

                  ${escapeHTML(
                    team.team
                  )}

                </span>

                <span class="owner-title">

                  Power score
                  ${score}

                  ${
                    reason
                      ? `
                        •
                        ${escapeHTML(
                          reason
                        )}
                      `
                      : ""
                  }

                </span>

              </div>

              <div class="power-bar">

                <span
                  style="
                    width:
                    ${Math.max(
                      1,
                      Math.min(
                        99,
                        Number(
                          score
                        )
                        || 1
                      )
                    )}%
                  "
                ></span>

              </div>

            </div>
          `;
        }
      )
      .join("");


  /*
    =====================================================
    RANKING LABEL
    =====================================================
  */

  let rankingMode;

  if (
    preseasonOverrideActive
  ) {

    rankingMode =
      "Preseason roster-based rankings";

  } else if (
    rankingData?.mode ===
    "preseason"
  ) {

    rankingMode =
      "Preseason roster-based rankings";

  } else if (
    rankingData
  ) {

    rankingMode =
      `Week ${rankingData.week} rankings`;

  } else {

    rankingMode =
      "Fallback power formula";
  }


  /*
    =====================================================
    PAGE
    =====================================================
  */

  container.innerHTML = `

    <header class="page-hero">

      <p class="eyebrow">
        League Table
      </p>

      <h1>
        Standings & Power Rankings
      </h1>

      <p>
        Live Sleeper records with
        SBF Network power analysis.
      </p>

    </header>


    <section class="content-grid">


      <article class="panel">

        <div class="heading">

          <div>

            <p class="eyebrow">
              Official
            </p>

            <h2>
              Standings
            </h2>

          </div>

        </div>

        ${standings}

      </article>


      <article class="panel">

        <div class="heading">

          <div>

            <p class="eyebrow">
              SBF Analytics
            </p>

            <h2>
              Power Rankings
            </h2>

            <p class="owner-title">

              ${escapeHTML(
                rankingMode
              )}

            </p>

          </div>

        </div>

        ${power}

      </article>


    </section>
  `;
}