const fs = require("fs");
const path = require("path");

const LEAGUE_ID = "1604405119";
const YEARS = [2022, 2023, 2024, 2025];

const OUTPUT_DIR = path.join(
  process.cwd(),
  "data",
  "history",
  "raw"
);

function buildUrl(year) {
  const base =
    `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${LEAGUE_ID}`;

  const params = new URLSearchParams();

  [
    "mTeam",
    "mStandings",
    "mMatchup",
    "mSettings",
    "mRoster",
    "mDraftDetail"
  ].forEach(view => {
    params.append("view", view);
  });

  return `${base}?${params.toString()}`;
}

async function fetchSeason(year) {
  const url = buildUrl(year);

  console.log(`Fetching ESPN ${year}...`);

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0"
    }
  });

  if (!response.ok) {
    throw new Error(
      `${year} request failed: ${response.status}`
    );
  }

  return await response.json();
}

async function main() {
  fs.mkdirSync(
    OUTPUT_DIR,
    { recursive: true }
  );

  for (const year of YEARS) {
    try {
      const season = await fetchSeason(year);

      const outputFile = path.join(
        OUTPUT_DIR,
        `${year}.json`
      );

      fs.writeFileSync(
        outputFile,
        JSON.stringify(
          season,
          null,
          2
        ) + "\n"
      );

      console.log(
        `Saved ${year} -> data/history/raw/${year}.json`
      );
    } catch (error) {
      console.error(
        `Failed to import ${year}:`,
        error.message
      );
    }
  }

  console.log("ESPN history import finished.");
}

main().catch(error => {
  console.error(
    "ESPN history import failed:",
    error
  );

  process.exit(1);
});