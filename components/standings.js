import {
  calculatePower,
  escapeHTML,
  loadWeekMatchups
} from "./data.js";


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


/*
  =====================================================
  LEAGUE MEDIAN
  =====================================================

  In a 10-team league:

  1. Sort all 10 scores.
  2. Take the middle two scores.
  3. Average them.

  Teams above the median get a median win.
  Teams below it get a median loss.
  An exact tie counts as a tie.
  =====================================================
*/


function calculateLeagueMedian(
  scores
) {
  const validScores =
    scores
      .map(Number)
      .filter(
        Number.isFinite
      )
      .sort(
        (a, b) =>
          a - b
      );

  if (!validScores.length) {
    return null;
  }


  const middle =
    Math.floor(
      validScores.length / 2
    );


  if (
    validScores.length % 2 === 1
  ) {
    return validScores[
      middle
    ];
  }


  return (
    validScores[
      middle - 1
    ]
    +
    validScores[
      middle
    ]
  ) / 2;
}


function emptyMedianRecord() {
  return {
    wins: 0,
    losses: 0,
    ties: 0,
    weeks: []
  };
}


function formatRecord(
  record
) {
  const wins =
    Number(
      record?.wins || 0
    );

  const losses =
    Number(
      record?.losses || 0
    );

  const ties =
    Number(
      record?.ties || 0
    );


  if (ties > 0) {
    return `${wins}-${losses}-${ties}`;
  }

  return `${wins}-${losses}`;
}


async function loadMedianAnalytics(
  data
) {
  const currentWeek =
    Math.max(
      1,
      Number(
        data.currentWeek || 1
      )
    );


  /*
    Sleeper advances to the next week
    after the previous fantasy week is
    complete.

    Because of that, currentWeek - 1
    gives us the latest safely completed
    fantasy week.

    Example:

    Sleeper Week 4
    =
    Weeks 1-3 are complete.
  */

  const completedThrough =
    Math.max(
      0,
      currentWeek - 1
    );


  const records =
    Object.fromEntries(
      data.teams.map(
        team => [
          Number(
            team.rosterId
          ),
          emptyMedianRecord()
        ]
      )
    );


  if (
    completedThrough === 0
  ) {
    return {
      records,
      weeks: [],
      latestWeek: null,
      latestMedian: null
    };
  }


  const weekNumbers =
    Array.from(
      {
        length:
          completedThrough
      },
      (
        _,
        index
      ) =>
        index + 1
    );


  const loadedWeeks =
    await Promise.all(
      weekNumbers.map(
        async week => {

          try {

            const matchups =
              await loadWeekMatchups(
                week,
                data
              );

            return {
              week,
              matchups
            };

          } catch (error) {

            console.warn(
              `Median data unavailable for Week ${week}:`,
              error
            );

            return null;
          }
        }
      )
    );


  const completedWeeks =
    [];


  loadedWeeks
    .filter(Boolean)
    .forEach(
      weekData => {

        /*
          Flatten the five fantasy
          matchups into the 10 teams.
        */

        const teamsByRoster =
          new Map();


        (
          weekData.matchups ||
          []
        ).forEach(
          matchup => {

            (
              matchup.teams ||
              []
            ).forEach(
              team => {

                teamsByRoster.set(
                  Number(
                    team.rosterId
                  ),
                  team
                );

              }
            );

          }
        );


        const weeklyTeams =
          Array.from(
            teamsByRoster.values()
          );


        /*
          Don't calculate a median unless
          we have all league teams.

          This prevents incomplete data
          from creating a false result.
        */

        if (
          weeklyTeams.length <
          data.teams.length
        ) {
          return;
        }


        const scores =
          weeklyTeams.map(
            team =>
              Number(
                team.score || 0
              )
          );


        /*
          Ignore an empty / unplayed week.
        */

        const hasScores =
          scores.some(
            score =>
              score > 0
          );


        if (!hasScores) {
          return;
        }


        const median =
          calculateLeagueMedian(
            scores
          );


        if (
          median === null
        ) {
          return;
        }


        weeklyTeams.forEach(
          team => {

            const rosterId =
              Number(
                team.rosterId
              );

            const score =
              Number(
                team.score || 0
              );

            const record =
              records[
                rosterId
              ];


            if (!record) {
              return;
            }


            let result;


            /*
              Tiny tolerance prevents
              floating-point weirdness
              around an exact tie.
            */

            if (
              Math.abs(
                score - median
              ) < 0.005
            ) {

              record.ties += 1;

              result = "T";

            } else if (
              score > median
            ) {

              record.wins += 1;

              result = "W";

            } else {

              record.losses += 1;

              result = "L";

            }


            record.weeks.push({
              week:
                weekData.week,

              score,

              median,

              result
            });

          }
        );


        completedWeeks.push({
          week:
            weekData.week,

          median
        });

      }
    );


  completedWeeks.sort(
    (a, b) =>
      a.week - b.week
  );


  const latest =
    completedWeeks[
      completedWeeks.length - 1
    ] || null;


  return {
    records,
    weeks:
      completedWeeks,

    latestWeek:
      latest?.week ?? null,

    latestMedian:
      latest?.median ?? null
  };
}


function calculateHeadToHeadRecord(
  team,
  medianRecord
) {
  /*
    Sleeper's displayed record in a
    league-median setup includes both:

      head-to-head result
      +
      median result

    Subtracting our calculated median
    record reveals the actual H2H record.
  */

  return {
    wins:
      Math.max(
        0,
        Number(
          team.wins || 0
        )
        -
        Number(
          medianRecord?.wins || 0
        )
      ),

    losses:
      Math.max(
        0,
        Number(
          team.losses || 0
        )
        -
        Number(
          medianRecord?.losses || 0
        )
      ),

    ties:
      Math.max(
        0,
        Number(
          team.ties || 0
        )
        -
        Number(
          medianRecord?.ties || 0
        )
      )
  };
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


  /*
    Load power rankings and every
    completed week's matchup data
    at the same time.
  */

  const [
    rankingData,
    medianAnalytics
  ] =
    await Promise.all([
      loadPowerRankings(),
      loadMedianAnalytics(
        data
      )
    ]);


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
      ] =
        ranked.splice(
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
        (
          team,
          index
        ) => {

          const medianRecord =
            medianAnalytics
              .records[
                Number(
                  team.rosterId
                )
              ]
            ||
            emptyMedianRecord();


          const h2hRecord =
            calculateHeadToHeadRecord(
              team,
              medianRecord
            );


          return `
            <div
              class="standing-row"
            >

              <span class="rank">
                ${index + 1}
              </span>


              <div>

                <span
                  class="team-title"
                >
                  ${escapeHTML(
                    team.team
                  )}
                </span>


                <span
                  class="owner-title"
                >
                  ${escapeHTML(
                    team.owner
                  )}
                </span>


                <span
                  class="owner-title"
                >
                  H2H
                  ${escapeHTML(
                    formatRecord(
                      h2hRecord
                    )
                  )}
                  •
                  vs Median
                  ${escapeHTML(
                    formatRecord(
                      medianRecord
                    )
                  )}
                </span>

              </div>


              <div
                class="record"
              >

                ${team.wins}-${team.losses}${
                  Number(
                    team.ties || 0
                  ) > 0
                    ? `-${team.ties}`
                    : ""
                }

                <span
                  class="points"
                >

                  ${team.pointsFor.toFixed(
                    1
                  )}
                  PF

                </span>

              </div>

            </div>
          `;
        }
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
        (
          team,
          index
        ) => {

          const official =
            rankingByRoster[
              Number(
                team.rosterId
              )
            ];


          const isMuthJuice =
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
              );


          const normalScore =
            official
              ?.power_score
            ??
            calculatePower(
              team,
              maxPoints
            );


          const score =
            preseasonOverrideActive &&
            isMuthJuice
              ? 88
              : normalScore;


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
            <div
              class="power-row"
            >

              <span class="rank">
                ${rank}
              </span>


              <div>

                <span
                  class="team-title"
                >

                  ${escapeHTML(
                    team.team
                  )}

                </span>


                <span
                  class="owner-title"
                >

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


              <div
                class="power-bar"
              >

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
    MEDIAN HEADER
    =====================================================
  */


  let medianSummary;


  if (
    medianAnalytics.latestWeek !==
      null
    &&
    medianAnalytics.latestMedian !==
      null
  ) {

    medianSummary = `
      <article
        class="panel"
        style="margin-bottom: 24px;"
      >

        <div class="heading">

          <div>

            <p class="eyebrow">
              SBF Analytics
            </p>

            <h2>
              Week
              ${escapeHTML(
                medianAnalytics
                  .latestWeek
              )}
              League Median:
              ${escapeHTML(
                medianAnalytics
                  .latestMedian
                  .toFixed(2)
              )}
            </h2>

            <p class="owner-title">
              Median records use completed
              fantasy weeks only.
            </p>

          </div>

        </div>

      </article>
    `;

  } else {

    medianSummary = `
      <article
        class="panel"
        style="margin-bottom: 24px;"
      >

        <p class="eyebrow">
          SBF Analytics
        </p>

        <h2>
          League Median
        </h2>

        <p>
          Median records will appear
          after the first completed week.
        </p>

      </article>
    `;
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
        Live Sleeper records,
        league-median results and
        SBF Network power analysis.
      </p>

    </header>


    ${medianSummary}


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

            <p class="owner-title">
              Overall record includes
              head-to-head + league median.
            </p>

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