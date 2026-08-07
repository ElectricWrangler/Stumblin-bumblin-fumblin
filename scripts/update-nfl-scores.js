const fs = require("fs");
const path = require("path");

const ESPN_URL =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";

const OUTPUT_FILE = path.join(
  process.cwd(),
  "data",
  "nfl-scores.json"
);

function getRecord(competitor) {
  const records = competitor.records || [];

  const overall =
    records.find(
      record => record.name === "overall"
    ) || records[0];

  return overall?.summary || "";
}

function getStatus(competition) {
  const status = competition.status || {};
  const type = status.type || {};

  if (
    type.completed ||
    type.state === "post"
  ) {
    return {
      status: "final",
      detail: type.shortDetail || "Final"
    };
  }

  if (type.state === "in") {
    return {
      status: "live",
      detail:
        type.shortDetail ||
        type.detail ||
        `${
          status.period
            ? `Q${status.period}`
            : ""
        } ${
          status.displayClock || ""
        }`.trim()
    };
  }

  return {
    status: "scheduled",
    detail:
      type.shortDetail ||
      type.detail ||
      ""
  };
}

function getNetwork(competition) {
  const broadcasts =
    competition.broadcasts || [];

  const names =
    broadcasts.flatMap(
      broadcast => broadcast.names || []
    );

  return names[0] || "NFL";
}

function buildTeam(competitor) {
  const team = competitor.team || {};

  return {
    name:
      team.displayName ||
      team.name ||
      "Unknown Team",

    abbr:
      team.abbreviation || "",

    record:
      getRecord(competitor),

    score:
      competitor.score !== undefined &&
      competitor.score !== null &&
      competitor.score !== ""
        ? Number(competitor.score)
        : null,

    logo:
      team.logo || ""
  };
}

function transformGame(event) {
  const competition =
    event.competitions?.[0] || {};

  const competitors =
    competition.competitors || [];

  const away =
    competitors.find(
      team => team.homeAway === "away"
    );

  const home =
    competitors.find(
      team => team.homeAway === "home"
    );

  if (!away || !home) {
    return null;
  }

  const gameStatus =
    getStatus(competition);

  return {
    id: event.id,

    status:
      gameStatus.status,

    detail:
      gameStatus.detail,

    network:
      getNetwork(competition),

    startTime:
      event.date,

    away:
      buildTeam(away),

    home:
      buildTeam(home),

    note:
      competition.notes?.[0]?.headline ||
      ""
  };
}

function buildWeekLabel(data) {
  const seasonType =
    data.season?.type;

  const week =
    data.week?.number;

  if (seasonType === 1) {
    return week
      ? `Preseason ${week}`
      : "Preseason";
  }

  if (seasonType === 3) {
    return week
      ? `Postseason ${week}`
      : "Postseason";
  }

  return week || "—";
}

function readExistingFile() {
  try {
    return JSON.parse(
      fs.readFileSync(
        OUTPUT_FILE,
        "utf8"
      )
    );
  } catch {
    return null;
  }
}

function sameScoreboard(a, b) {
  if (!a || !b) {
    return false;
  }

  return JSON.stringify({
    week: a.week,
    games: a.games
  }) === JSON.stringify({
    week: b.week,
    games: b.games
  });
}

async function main() {
  console.log(
    "Fetching NFL ScoreCenter data..."
  );

  const response =
    await fetch(ESPN_URL);

  if (!response.ok) {
    throw new Error(
      `ESPN request failed: ${response.status}`
    );
  }

  const raw =
    await response.json();

  const games =
    (raw.events || [])
      .map(transformGame)
      .filter(Boolean);

  const nextData = {
    week:
      buildWeekLabel(raw),

    updatedAt:
      new Date().toISOString(),

    games
  };

  const existing =
    readExistingFile();

  if (
    sameScoreboard(
      existing,
      nextData
    )
  ) {
    console.log(
      "No score changes. Keeping existing file."
    );

    return;
  }

  fs.mkdirSync(
    path.dirname(OUTPUT_FILE),
    {
      recursive: true
    }
  );

  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(
      nextData,
      null,
      2
    ) + "\n"
  );

  console.log(
    `Updated ${games.length} NFL game(s).`
  );
}

main().catch(error => {
  console.error(
    "NFL ScoreCenter update failed:",
    error
  );

  process.exit(1);
});