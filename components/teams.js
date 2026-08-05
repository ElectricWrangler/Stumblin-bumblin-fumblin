import { escapeHTML } from "./data.js";

export function renderTeams(data) {
  const container = document.getElementById("teams");
  const cards = data.teams.map(team => `
    <article class="team-card">
      <img src="${team.avatar}" alt="">
      <h3>${escapeHTML(team.team)}</h3>
      <p>Owner: ${escapeHTML(team.owner)}</p>
      <div class="team-stats">
        <div><strong>${team.wins}-${team.losses}</strong><span>Record</span></div>
        <div><strong>${team.pointsFor.toFixed(1)}</strong><span>Points For</span></div>
        <div><strong>${team.pointsAgainst.toFixed(1)}</strong><span>Points Against</span></div>
      </div>
    </article>
  `).join("");

  container.innerHTML = `
    <header class="page-hero">
      <p class="eyebrow">League Headquarters</p>
      <h1>Teams & Owners</h1>
      <p>Every franchise and owner in one place.</p>
    </header>
    <div class="team-grid">${cards}</div>
  `;
}
