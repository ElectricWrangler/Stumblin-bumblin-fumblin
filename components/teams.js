import { escapeHTML } from "./data.js";

function getRosterCount(team) {
  return Array.isArray(team.players)
    ? team.players.length
    : 0;
}

function getStarterCount(team) {
  return Array.isArray(team.starters)
    ? team.starters.filter(Boolean).length
    : 0;
}

function getReserveCount(team) {
  return Array.isArray(team.reserve)
    ? team.reserve.length
    : 0;
}

function getTaxiCount(team) {
  return Array.isArray(team.taxi)
    ? team.taxi.length
    : 0;
}

export function renderTeams(data) {
  const container =
    document.getElementById("teams");

  const cards = data.teams
    .map(team => {
      const rosterCount =
        getRosterCount(team);

      const starterCount =
        getStarterCount(team);

      const reserveCount =
        getReserveCount(team);

      const taxiCount =
        getTaxiCount(team);

      return `
        <article class="team-card">

          <img
            src="${team.avatar}"
            alt="${escapeHTML(team.team)} avatar"
          >

          <h3>
            ${escapeHTML(team.team)}
          </h3>

          <p>
            Owner:
            <strong>
              ${escapeHTML(team.owner)}
            </strong>
          </p>

          <div class="team-stats">

            <div>
              <strong>
                ${team.wins}-${team.losses}
              </strong>
              <span>Record</span>
            </div>

            <div>
              <strong>
                ${team.pointsFor.toFixed(1)}
              </strong>
              <span>Points For</span>
            </div>

            <div>
              <strong>
                ${team.pointsAgainst.toFixed(1)}
              </strong>
              <span>Points Against</span>
            </div>

          </div>

          <div class="team-stats">

            <div>
              <strong>
                ${rosterCount}
              </strong>
              <span>Roster</span>
            </div>

            <div>
              <strong>
                ${starterCount}
              </strong>
              <span>Starters</span>
            </div>

            <div>
              <strong>
                ${reserveCount}
              </strong>
              <span>Reserve</span>
            </div>

            ${
              taxiCount
                ? `
                  <div>
                    <strong>
                      ${taxiCount}
                    </strong>
                    <span>Taxi</span>
                  </div>
                `
                : ""
            }

          </div>

        </article>
      `;
    })
    .join("");

  container.innerHTML = `

    <header class="page-hero">

      <p class="eyebrow">
        League Headquarters
      </p>

      <h1>
        Teams & Owners
      </h1>

      <p>
        Live franchise information pulled
        directly from Sleeper.
      </p>

    </header>

    <div class="team-grid">
      ${cards}
    </div>

  `;
}