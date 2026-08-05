import { escapeHTML } from "./data.js";

function standingsRows(teams, limit = 5) {
  return teams.slice(0, limit).map((team, index) => `
    <div class="standing-row">
      <span class="rank">${index + 1}</span>
      <div>
        <span class="team-title">${escapeHTML(team.team)}</span>
        <span class="owner-title">${escapeHTML(team.owner)}</span>
      </div>
      <div class="record">
        ${team.wins}-${team.losses}
        <span class="points">${team.pointsFor.toFixed(1)} PF</span>
      </div>
    </div>
  `).join("");
}

export async function renderHome(data) {
  const container = document.getElementById("home");
  const odds = data.teams.slice(0, 6).map((team, index) => `
    <div class="odds-row">
      <strong>${escapeHTML(team.team)}</strong>
      <strong>+${350 + index * 125}</strong>
    </div>
  `).join("");

  let latest = {
    headline: "Preseason Headquarters",
    copy: "Your generated recap will appear here automatically."
  };

  try {
    const response = await fetch(`recaps/latest.json?ts=${Date.now()}`);
    if (response.ok) {
      const recap = await response.json();
      const wrapper = document.createElement("div");
      wrapper.innerHTML = recap.html || "";
      latest = {
        headline: wrapper.querySelector("h2,h3")?.textContent || recap.headline || `Week ${recap.week} Recap`,
        copy: `Week ${recap.week} has been published automatically.`
      };
    }
  } catch {}

  container.innerHTML = `
    <section class="hero">
      <div>
        <p class="eyebrow">Official League Media Home</p>
        <h1>${escapeHTML(data.league.name)}</h1>
        <p>${data.teams.length} teams • ${escapeHTML(data.season)} season • ${escapeHTML(data.status)}</p>
        <div class="actions">
          <button class="primary" data-route-jump="recaps">Latest recap</button>
          <button class="secondary" data-route-jump="standings">Standings</button>
        </div>
      </div>
      <article class="latest-card">
        <span>Latest Edition</span>
        <h2>${escapeHTML(latest.headline)}</h2>
        <p>${escapeHTML(latest.copy)}</p>
        <button data-route-jump="recaps">Read story →</button>
      </article>
    </section>

    <section class="quick-stats">
      <article class="stat-card"><span>Teams</span><strong>${data.teams.length}</strong></article>
      <article class="stat-card"><span>Week</span><strong>${data.currentWeek}</strong></article>
      <article class="stat-card"><span>Status</span><strong>${escapeHTML(data.status.slice(0,6).toUpperCase())}</strong></article>
    </section>

    <section class="content-grid">
      <article class="panel">
        <div class="heading"><div><p class="eyebrow">League Table</p><h2>Standings</h2></div></div>
        ${standingsRows(data.teams)}
      </article>
      <article class="panel">
        <div class="heading"><div><p class="eyebrow">The Book</p><h2>Championship Odds</h2></div></div>
        ${odds}
        <small>Entertainment only.</small>
      </article>
    </section>

    <section class="feature-row">
      <article class="panel"><span class="icon">🚨</span><p class="eyebrow">Fraud Watch</p><h3>No suspects yet</h3><p>Everyone is innocent until the games begin.</p></article>
      <article class="panel"><span class="icon">📈</span><p class="eyebrow">Stock Up</p><h3>League engagement</h3><p>The site and recap engine are both live.</p></article>
      <article class="panel"><span class="icon">🏆</span><p class="eyebrow">Weekly Award</p><h3>Preseason Optimist</h3><p>Every manager currently thinks they built a champion.</p></article>
    </section>
  `;

  container.querySelectorAll("[data-route-jump]").forEach(button => {
    button.addEventListener("click", () => {
      const route = button.dataset.routeJump;
      document.querySelector(`[data-route="${route}"]`)?.click();
    });
  });
}
