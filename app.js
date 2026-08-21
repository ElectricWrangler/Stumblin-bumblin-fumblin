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
import { renderHistory } from "./components/history.js";

const routes = [
  "home",
  "matchups",
  "standings",
  "teams",
  "recaps",
  "nfl",
  "history"
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

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function findHomeSection(label) {
  const home =
    document.getElementById("home");

  if (!home) {
    return null;
  }

  const wanted =
    normalizeText(label);

  const candidates =
    home.querySelectorAll(
      "h1, h2, h3, .eyebrow"
    );

  const heading =
    Array.from(candidates).find(
      element =>
        normalizeText(
          element.textContent
        ).includes(wanted)
    );

  if (!heading) {
    return null;
  }

  return (
    heading.closest(".panel") ||
    heading.closest("section") ||
    heading.closest("article") ||
    heading
  );
}

function openHomeSection(label) {
  showRoute("home");

  window.setTimeout(() => {
    const target =
      findHomeSection(label);

    if (!target) {
      console.warn(
        `Home section not found: ${label}`
      );

      return;
    }

    target.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }, 100);
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

document
  .querySelectorAll("[data-home-section]")
  .forEach(link => {
    link.addEventListener(
      "click",
      event => {
        event.preventDefault();

        openHomeSection(
          link.dataset.homeSection
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
      renderNFL(leagueData),
      renderHistory()
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