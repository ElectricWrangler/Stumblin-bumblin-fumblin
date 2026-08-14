const fs = require("fs");
const path = require("path");

const YEARS = [2022, 2023, 2024, 2025];

const RAW_DIR = path.join(
  process.cwd(),
  "data",
  "history",
  "raw"
);

const OUTPUT_FILE = path.join(
  process.cwd(),
  "data",
  "history",
  "league-history.json"
);

function loadSeason(year) {
  const file = path.join(
    RAW_DIR,
    `${year}.json`
  );

  if (!fs.existsSync(file)) {
    throw new Error(
      `Missing raw history file for ${year}`
    );
  }

  return JSON.parse(
    fs.readFileSync(file, "utf8")
  );
}

function getTeamName(team) {
  if (team.name) return team.name;

  const location = team.location || "";
  const nickname = team.nickname || "";

  const combined =
    `${location} ${nickname}`.trim();

  return (
    combined ||
    team.abbrev ||
    `Team ${team.id}`
  );
}

function getOwnerNames(team, membersById) {
  const owners =
    Array.isArray(team.owners)
      ? team.owners
      : [];

  const names = owners
    .map(ownerId => {
      const member = membersById[ownerId];

      return (
        member?.displayName ||
        member?.firstName ||
        member?.lastName ||
        ownerId
      );
    })
    .filter(Boolean);

  return names;
}

function getRecord(team) {
  const overall =
    team.record?.overall || {};

  return {
    wins: Number(overall.wins || 0),
    losses: Number(overall.losses || 0),
    ties: Number(overall.ties || 0),
    pointsFor: Number(
      overall.pointsFor || 0
    ),
    pointsAgainst: Number(
      overall.pointsAgainst || 0
    )
  };
}

function buildTeams(season) {
  const members =
    Array.isArray(season.members)
      ? season.members
      : [];

  const membersById =
    Object.fromEntries(
      members.map(member => [
        member.id,
        member
      ])
    );

  const teams =
    Array.isArray(season.teams)
      ? season.teams
      : [];

  return teams.map(team => {
    const record = getRecord(team);

    return {
      id: team.id,
      name: getTeamName(team),
      abbrev: team.abbrev || "",
      owners: getOwnerNames(
        team,
        membersById
      ),
      finalStanding:
        Number(
          team.rankCalculatedFinal ||
          team.playoffSeed ||
          0
        ) || null,
      playoffSeed:
        Number(
          team.playoffSeed || 0
        ) || null,
      ...record
    };
  });
}

function buildMatchups(season) {
  const schedule =
    Array.isArray(season.schedule)
      ? season.schedule
      : [];

  return schedule
    .map(matchup => {
      const home =
        matchup.home || null;

      const away =
        matchup.away || null;

      if (!home || !away) {
        return null;
      }

      const homeScore =
        Number(home.totalPoints ?? 0);

      const awayScore =
        Number(away.totalPoints ?? 0);

      return {
        id: matchup.id,
        week:
          Number(
            matchup.matchupPeriodId || 0
          ) || null,
        winner:
          matchup.winner || null,
        home: {
          teamId: home.teamId,
          score: homeScore
        },
        away: {
          teamId: away.teamId,
          score: awayScore
        },
        margin:
          Math.abs(
            homeScore - awayScore
          )
      };
    })
    .filter(Boolean);
}

function findChampion(teams) {
  return (
    teams.find(
      team =>
        team.finalStanding === 1
    ) || null
  );
}

function findRunnerUp(teams) {
  return (
    teams.find(
      team =>
        team.finalStanding === 2
    ) || null
  );
}

function buildSeasonSummary(year, raw) {
  const teams = buildTeams(raw);
  const matchups = buildMatchups(raw);

  const champion =
    findChampion(teams);

  const runnerUp =
    findRunnerUp(teams);

  const scoredGames =
    matchups.filter(
      game =>
        game.home.score !== 0 ||
        game.away.score !== 0
    );

  const highestGame =
    scoredGames.length
      ? scoredGames.reduce(
          (best, game) => {
            const bestScore =
              Math.max(
                best.home.score,
                best.away.score
              );

            const gameScore =
              Math.max(
                game.home.score,
                game.away.score
              );

            return gameScore > bestScore
              ? game
              : best;
          }
        )
      : null;

  const biggestBlowout =
    scoredGames.length
      ? scoredGames.reduce(
          (best, game) =>
            game.margin > best.margin
              ? game
              : best
        )
      : null;

  const closestGame =
    scoredGames.length
      ? scoredGames.reduce(
          (best, game) =>
            game.margin < best.margin
              ? game
              : best
        )
      : null;

  return {
    year,
    leagueName:
      raw.settings?.name ||
      raw.name ||
      "Stumblin Bumblin and Fumblin",

    teams,

    champion:
      champion
        ? {
            teamId: champion.id,
            name: champion.name,
            owners: champion.owners
          }
        : null,

    runnerUp:
      runnerUp
        ? {
            teamId: runnerUp.id,
            name: runnerUp.name,
            owners: runnerUp.owners
          }
        : null,

    matchups,

    records: {
      highestSingleTeamScore:
        highestGame
          ? Math.max(
              highestGame.home.score,
              highestGame.away.score
            )
          : null,

      biggestBlowout:
        biggestBlowout
          ? {
              week:
                biggestBlowout.week,
              margin:
                biggestBlowout.margin,
              home:
                biggestBlowout.home,
              away:
                biggestBlowout.away
            }
          : null,

      closestGame:
        closestGame
          ? {
              week:
                closestGame.week,
              margin:
                closestGame.margin,
              home:
                closestGame.home,
              away:
                closestGame.away
            }
          : null
    }
  };
}

function buildAllTime(seasons) {
  const byOwner = {};

  seasons.forEach(season => {
    season.teams.forEach(team => {
      const ownerNames =
        team.owners.length
          ? team.owners
          : ["Unknown Owner"];

      ownerNames.forEach(owner => {
        byOwner[owner] ||= {
          owner,
          seasons: 0,
          wins: 0,
          losses: 0,
          ties: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          championships: 0,
          runnerUps: 0
        };

        const row = byOwner[owner];

        row.seasons += 1;
        row.wins += team.wins;
        row.losses += team.losses;
        row.ties += team.ties;
        row.pointsFor += team.pointsFor;
        row.pointsAgainst +=
          team.pointsAgainst;

        if (
          season.champion?.owners?.includes(
            owner
          )
        ) {
          row.championships += 1;
        }

        if (
          season.runnerUp?.owners?.includes(
            owner
          )
        ) {
          row.runnerUps += 1;
        }
      });
    });
  });

  return Object.values(byOwner)
    .map(row => ({
      ...row,
      pointsFor:
        Number(
          row.pointsFor.toFixed(2)
        ),
      pointsAgainst:
        Number(
          row.pointsAgainst.toFixed(2)
        )
    }))
    .sort(
      (a, b) =>
        b.championships -
          a.championships ||
        b.wins - a.wins ||
        b.pointsFor - a.pointsFor
    );
}

function main() {
  const seasons = YEARS.map(year => {
    console.log(
      `Processing ${year}...`
    );

    const raw = loadSeason(year);

    return buildSeasonSummary(
      year,
      raw
    );
  });

  const output = {
    generatedAt:
      new Date().toISOString(),

    seasons,

    allTime:
      buildAllTime(seasons)
  };

  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(
      output,
      null,
      2
    ) + "\n"
  );

  console.log(
    "Created data/history/league-history.json"
  );

  seasons.forEach(season => {
    console.log(
      `${season.year}: Champion = ${
        season.champion?.name ||
        "Not detected"
      }`
    );
  });
}

main();