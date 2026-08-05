import { calculatePower, escapeHTML } from "./data.js";

export function renderStandings(data) {
  const container = document.getElementById("standings");
  const maxPoints = Math.max(...data.teams.map(team => team.pointsFor), 1);
  const ranked = [...data.teams].sort((a,b) =>
    calculatePower(b, maxPoints) - calculatePower(a, maxPoints)
  );

  const standings = data.teams.map((team, index) => `
    <div class="standing-row">
      <span class="rank">${index + 1}</span>
      <div>
        <span class="team-title">${escapeHTML(team.team)}</span>
        <span class="owner-title">${escapeHTML(team.owner)}</span>
      </div>
      <div class="record">${team.wins}-${team.losses}<span class="points">${team.pointsFor.toFixed(1)} PF</span></div>
    </div>
  `).join("");

  const power = ranked.map((team, index) => {
    const score = calculatePower(team, maxPoints);
    return `
      <div class="power-row">
        <span class="rank">${index + 1}</span>
        <div>
          <span class="team-title">${escapeHTML(team.team)}</span>
          <span class="owner-title">Power score ${score}</span>
        </div>
        <div class="power-bar"><span style="width:${score}%"></span></div>
      </div>
    `;
  }).join("");

  container.innerHTML = `
    <header class="page-hero">
      <p class="eyebrow">League Table</p>
      <h1>Standings & Power Rankings</h1>
      <p>Live Sleeper records with an SBF power score.</p>
    </header>
    <section class="content-grid">
      <article class="panel"><div class="heading"><div><p class="eyebrow">Official</p><h2>Standings</h2></div></div>${standings}</article>
      <article class="panel"><div class="heading"><div><p class="eyebrow">SBF Analytics</p><h2>Power Rankings</h2></div></div>${power}</article>
    </section>
  `;
}
