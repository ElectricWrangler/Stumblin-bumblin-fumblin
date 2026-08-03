
const LEAGUE_ID = "1371503267833475072";
const API = "https://api.sleeper.app/v1";

const $ = (id) => document.getElementById(id);
let leagueRows = [];

async function getJSON(path) {
  const response = await fetch(`${API}${path}`);
  if (!response.ok) throw new Error(`Sleeper API error ${response.status}`);
  return response.json();
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function avatarUrl(user) {
  return user?.avatar
    ? `https://sleepercdn.com/avatars/thumbs/${user.avatar}`
    : "https://sleepercdn.com/images/v2/icons/player_default.webp";
}

function titleFor(user, rosterId) {
  return user?.metadata?.team_name || user?.display_name || `Team ${rosterId}`;
}

function calculatePower(row, maxPoints) {
  const winScore = row.wins * 20;
  const tieScore = row.ties * 8;
  const pointScore = maxPoints ? (row.points / maxPoints) * 35 : 0;
  const base = row.wins === 0 && row.losses === 0 ? 50 : 20;
  return Math.max(1, Math.min(99, Math.round(base + winScore + tieScore + pointScore)));
}

function americanOdds(index, total) {
  const base = 350 + index * 125;
  return `+${Math.min(base, 1600)}`;
}

function standingsMarkup(rows, limit = rows.length) {
  return rows.slice(0,limit).map((row,index) => `
    <div class="standing-row">
      <span class="rank-number">${index + 1}</span>
      <div>
        <span class="team-title">${esc(row.team)}</span>
        <span class="owner-title">${esc(row.owner)}</span>
      </div>
      <div>
        <span class="record">${row.wins}-${row.losses}${row.ties ? `-${row.ties}` : ""}</span>
        <span class="points">${row.points.toFixed(1)} PF</span>
      </div>
    </div>
  `).join("");
}

function oddsMarkup(rows) {
  return rows.slice(0,6).map((row,index) => `
    <div class="odds-row">
      <strong>${esc(row.team)}</strong>
      <strong>${americanOdds(index, rows.length)}</strong>
    </div>
  `).join("");
}

function powerMarkup(rows) {
  const maxPoints = Math.max(...rows.map(r => r.points),1);
  return rows.map((row,index) => {
    const score = calculatePower(row,maxPoints);
    return `
      <div class="power-row">
        <span class="rank-number">${index + 1}</span>
        <div>
          <span class="team-title">${esc(row.team)}</span>
          <span class="owner-title">Power score: ${score}</span>
        </div>
        <div class="power-meter"><span style="width:${score}%"></span></div>
      </div>
    `;
  }).join("");
}

function teamMarkup(rows) {
  return rows.map(row => `
    <article class="team-card">
      <img src="${row.avatar}" alt="">
      <h3>${esc(row.team)}</h3>
      <p>Owner: ${esc(row.owner)}</p>
      <div class="team-stats">
        <div><strong>${row.wins}-${row.losses}</strong><span>Record</span></div>
        <div><strong>${row.points.toFixed(1)}</strong><span>Points For</span></div>
      </div>
    </article>
  `).join("");
}

function draftMarkup(rows) {
  return rows.map((row,index) => `
    <div class="draft-team">
      <span>${index + 1}</span>
      <div>
        <strong>${esc(row.team)}</strong>
        <span class="owner-title">${esc(row.owner)}</span>
      </div>
    </div>
  `).join("");
}

async function loadLeague() {
  try {
    const [league, users, rosters, state] = await Promise.all([
      getJSON(`/league/${LEAGUE_ID}`),
      getJSON(`/league/${LEAGUE_ID}/users`),
      getJSON(`/league/${LEAGUE_ID}/rosters`),
      getJSON("/state/nfl")
    ]);

    const usersById = Object.fromEntries(users.map(u => [u.user_id,u]));
    leagueRows = rosters.map(roster => {
      const user = usersById[roster.owner_id];
      const settings = roster.settings || {};
      return {
        rosterId: roster.roster_id,
        owner: user?.display_name || `Owner ${roster.roster_id}`,
        team: titleFor(user, roster.roster_id),
        avatar: avatarUrl(user),
        wins: settings.wins || 0,
        losses: settings.losses || 0,
        ties: settings.ties || 0,
        points: (settings.fpts || 0) + ((settings.fpts_decimal || 0) / 100)
      };
    }).sort((a,b) => b.wins-a.wins || a.losses-b.losses || b.points-a.points || a.rosterId-b.rosterId);

    $("league-name").textContent = league.name || "Stumblin' Bumblin' & Fumblin'";
    $("league-meta").textContent = `${leagueRows.length} teams • ${league.season || "2026"} season • ${league.status || "preseason"}`;
    $("home-team-count").textContent = leagueRows.length;
    $("home-week").textContent = state.week ?? "—";
    $("standings-team-count").textContent = `${leagueRows.length} teams`;
    $("status-label").textContent = `${String(league.status || "League").toUpperCase()} • WEEK ${state.week ?? "—"}`;

    $("home-standings").innerHTML = standingsMarkup(leagueRows,5);
    $("full-standings").innerHTML = standingsMarkup(leagueRows);
    $("home-odds").innerHTML = oddsMarkup(leagueRows);

    const maxPoints = Math.max(...leagueRows.map(r => r.points),1);
    const ranked = [...leagueRows].sort((a,b) =>
      calculatePower(b,maxPoints)-calculatePower(a,maxPoints)
    );
    $("power-rankings").innerHTML = powerMarkup(ranked);
    $("team-grid").innerHTML = teamMarkup(leagueRows);
    $("draft-teams").innerHTML = draftMarkup(leagueRows);
    $("footer-status").textContent = `Live Sleeper data • League ID ${LEAGUE_ID}`;
  } catch (error) {
    console.error(error);
    $("status-label").textContent = "SITE ONLINE • DATA TEMPORARILY UNAVAILABLE";
    $("league-meta").textContent = "The website is live, but Sleeper did not return league data.";
    ["home-standings","full-standings","home-odds","power-rankings","team-grid","draft-teams"]
      .forEach(id => $(id).textContent = "League data unavailable right now.");
  }
}

function showSection(sectionId) {
  document.querySelectorAll(".page-section").forEach(section =>
    section.classList.toggle("active", section.id === sectionId)
  );
  document.querySelectorAll("[data-section]").forEach(link =>
    link.classList.toggle("active", link.dataset.section === sectionId)
  );
  history.replaceState(null,"",`#${sectionId}`);
  window.scrollTo({top:0,behavior:"smooth"});
  $("main-nav").classList.remove("open");
  $("menu-button").setAttribute("aria-expanded","false");
}

document.querySelectorAll("[data-section]").forEach(link => {
  link.addEventListener("click",event => {
    event.preventDefault();
    showSection(link.dataset.section);
  });
});

document.querySelectorAll("[data-go]").forEach(button => {
  button.addEventListener("click",() => showSection(button.dataset.go));
});

$("menu-button").addEventListener("click",() => {
  const open = $("main-nav").classList.toggle("open");
  $("menu-button").setAttribute("aria-expanded", String(open));
});

const initialSection = location.hash.replace("#","") || "home";
if (document.getElementById(initialSection)) showSection(initialSection);
loadLeague();
