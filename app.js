import {
  loadLeagueData,
  loadWeekMatchups
} from "./components/data.js";

import { renderHome } from "./components/home.js";
import { renderStandings } from "./components/standings.js";
import { renderTeams } from "./components/teams.js";
import { renderMatchups } from "./components/matchups.js";
import { renderRecaps } from "./components/recaps.js";
import { renderNFL } from "./components/nfl.js";

const routes = [
  "home",
  "matchups",
  "standings",
  "teams",
  "recaps",
  "nfl"
];

function showRoute(route) {
  const safeRoute =
    routes.includes(route)
      ? route
      : "home";

  document
    .querySelectorAll(".page")
    .forEach(page => {
      page.classList.toggle(
        "active",
        page.id === safeRoute
      );
    });

  document
    .querySelectorAll("[data-route]")
    .forEach(link => {
      link.classList.toggle(
        "active",
        link.dataset.route === safeRoute
      );
    });

  history.replaceState(
    null,
    "",
    `#${safeRoute}`
  );

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

document
  .querySelectorAll("[data-route]")
  .forEach(link => {
    link.addEventListener(
      "click",
      event => {
        event.preventDefault();

        showRoute(
          link.dataset.route
        );
      }
    );
  });

async function start() {
  try {
    const leagueData =
      await loadLeagueData();

    const matchups =
      await loadWeekMatchups(
        leagueData.currentWeek,
        leagueData
      );

    document.getElementById(
      "ticker-status"
    ).textContent =
      `${leagueData.statusLabel.toUpperCase()} • WEEK ${leagueData.currentWeek}`;

    await Promise.all([
      renderHome(leagueData),
      renderStandings(leagueData),
      renderTeams(leagueData),
      renderMatchups(
        matchups,
        leagueData
      ),
      renderRecaps(),
      renderNFL()
    ]);
  } catch (error) {
    console.error(error);

    document.getElementById(
      "ticker-status"
    ).textContent =
      "DATA TEMPORARILY UNAVAILABLE";
  }
}

showRoute(
  location.hash.slice(1) ||
  "home"
);

start();