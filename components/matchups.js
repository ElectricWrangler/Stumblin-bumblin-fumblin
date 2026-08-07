import {
  escapeHTML,
  loadTransactions,
  loadNFLPlayers,
  getPlayerName
} from "./data.js";

function renderMatchupCards(matchups, data) {
  if (!matchups.length) {
    return `
      <article class="panel">
        <p class="eyebrow">Week ${data.currentWeek}</p>
        <h3>No matchups available yet</h3>
        <p>
          Sleeper has not published matchup data for this week yet.
          Once the season starts, live scores will appear here automatically.
        </p>
      </article>
    `;
  }

  return matchups.map(game => `
    <article class="matchup-card">
      <p class="eyebrow">
        Matchup ${escapeHTML(game.matchupId)}
      </p>

      ${game.teams.map(team => `
        <div class="matchup-team">
          <div>
            <span class="team-title">
              ${escapeHTML(team.team || "Unknown Team")}
            </span>

            <span class="owner-title">
              ${escapeHTML(team.owner || "")}
            </span>
          </div>

          <strong>
            ${team.score.toFixed(2)}
          </strong>
        </div>
      `).join("")}

      <div class="matchup-meta">
        Week ${data.currentWeek}
      </div>
    </article>
  `).join("");
}

function describeTransaction(
  transaction,
  data,
  players
) {
  const rosterIds =
    transaction.roster_ids || [];

  const teams = rosterIds
    .map(id => data.teamByRoster[id])
    .filter(Boolean);

  const teamNames =
    teams.length
      ? teams
          .map(team => team.team)
          .join(", ")
      : "League transaction";

  const adds =
    transaction.adds
      ? Object.keys(transaction.adds)
          .map(playerId =>
            getPlayerName(
              playerId,
              players
            )
          )
      : [];

  const drops =
    transaction.drops
      ? Object.keys(transaction.drops)
          .map(playerId =>
            getPlayerName(
              playerId,
              players
            )
          )
      : [];

  let typeLabel = "Transaction";

  if (transaction.type === "trade") {
    typeLabel = "Trade";
  }

  if (transaction.type === "waiver") {
    typeLabel = "Waiver Claim";
  }

  if (
    transaction.type === "free_agent"
  ) {
    typeLabel = "Free Agent Move";
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
  players
) {
  if (!transactions.length) {
    return `
      <article class="panel">
        <p>
          No completed transactions are available for Week
          ${data.currentWeek}.
        </p>
      </article>
    `;
  }

  return transactions
    .slice(0, 8)
    .map(transaction => {
      const details =
        describeTransaction(
          transaction,
          data,
          players
        );

      return `
        <article class="panel transaction-card">

          <p class="eyebrow">
            ${escapeHTML(details.typeLabel)}
          </p>

          <h3>
            ${escapeHTML(details.teamNames)}
          </h3>

          ${
            details.adds.length
              ? `
                <p>
                  <strong>Added:</strong><br>
                  ${details.adds
                    .map(name =>
                      `➕ ${escapeHTML(name)}`
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
                  <strong>Dropped:</strong><br>
                  ${details.drops
                    .map(name =>
                      `➖ ${escapeHTML(name)}`
                    )
                    .join("<br>")}
                </p>
              `
              : ""
          }

        </article>
      `;
    })
    .join("");
}

export async function renderMatchups(
  matchups,
  data
) {
  const container =
    document.getElementById(
      "matchups"
    );

  const [
    transactions,
    players
  ] = await Promise.all([
    loadTransactions(
      data.currentWeek
    ),
    loadNFLPlayers()
  ]);

  const matchupCards =
    renderMatchupCards(
      matchups,
      data
    );

  const transactionCards =
    renderTransactions(
      transactions,
      data,
      players
    );

  container.innerHTML = `

    <header class="page-hero">
      <p class="eyebrow">
        League HQ
      </p>

      <h1>
        League Center
      </h1>

      <p>
        Live Sleeper scores, league activity,
        standings data and weekly movement.
      </p>
    </header>

    <section>
      <div class="heading">
        <div>
          <p class="eyebrow">
            Week ${data.currentWeek}
          </p>

          <h2>
            Matchups
          </h2>
        </div>
      </div>

      <div class="matchup-grid">
        ${matchupCards}
      </div>
    </section>

    <section style="margin-top: 32px;">
      <div class="heading">
        <div>
          <p class="eyebrow">
            League Activity
          </p>

          <h2>
            Recent Transactions
          </h2>
        </div>
      </div>

      <div class="archive-grid">
        ${transactionCards}
      </div>
    </section>

  `;
}