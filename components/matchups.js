import { escapeHTML } from "./data.js";

export function renderMatchups(matchups, data) {
  const container = document.getElementById("matchups");

  const cards = matchups.length
    ? matchups.map(game => `
        <article class="matchup-card">
          <p class="eyebrow">Matchup ${escapeHTML(game.matchupId)}</p>
          ${game.teams.map(team => `
            <div class="matchup-team">
              <span>${escapeHTML(team.team || "Unknown Team")}</span>
              <strong>${team.score.toFixed(2)}</strong>
            </div>
          `).join("")}
          <div class="matchup-meta">Week ${data.currentWeek}</div>
        </article>
      `).join("")
    : `<article class="panel"><p>No matchup data is available yet.</p></article>`;

  container.innerHTML = `
    <header class="page-hero">
      <p class="eyebrow">Game Center</p>
      <h1>Weekly Matchups</h1>
      <p>Live weekly scoring pulled directly from Sleeper.</p>
    </header>
    <div class="matchup-grid">${cards}</div>
  `;
}
