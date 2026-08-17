const fs = require("fs");
const path = require("path");

const LEAGUE_ID =
  "1371503267833475072";

const API =
  "https://api.sleeper.app/v1";

const OUTPUT_DIR =
  path.join(
    process.cwd(),
    "data",
    "draft"
  );

async function getJSON(url) {
  const response =
    await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Request failed ${response.status}: ${url}`
    );
  }

  return response.json();
}

async function main() {
  console.log(
    "Finding Sleeper draft..."
  );

  const drafts =
    await getJSON(
      `${API}/league/${LEAGUE_ID}/drafts`
    );

  if (
    !Array.isArray(drafts) ||
    drafts.length === 0
  ) {
    throw new Error(
      "No drafts were found for this league."
    );
  }

  const completedDraft =
    drafts.find(
      draft =>
        draft.status === "complete"
    ) ||
    drafts[0];

  console.log(
    `Draft found: ${completedDraft.draft_id}`
  );

  console.log(
    `Status: ${completedDraft.status}`
  );

  console.log(
    "Downloading picks..."
  );

  const picks =
    await getJSON(
      `${API}/draft/${completedDraft.draft_id}/picks`
    );

  console.log(
    `Downloaded ${picks.length} picks.`
  );

  const users =
    await getJSON(
      `${API}/league/${LEAGUE_ID}/users`
    );

  const rosters =
    await getJSON(
      `${API}/league/${LEAGUE_ID}/rosters`
    );

  const players =
    await getJSON(
      `${API}/players/nfl`
    );

  const usersById =
    Object.fromEntries(
      users.map(user => [
        user.user_id,
        user
      ])
    );

  const rosterByOwner =
    Object.fromEntries(
      rosters.map(roster => [
        roster.owner_id,
        roster
      ])
    );

  const teams =
    users.map(user => {
      const roster =
        rosterByOwner[
          user.user_id
        ];

      return {
        ownerId:
          user.user_id,

        rosterId:
          roster?.roster_id ||
          null,

        owner:
          user.display_name ||
          "Unknown Owner",

        team:
          user.metadata?.team_name ||
          user.display_name ||
          "Unknown Team"
      };
    });

  const teamsByOwner =
    Object.fromEntries(
      teams.map(team => [
        team.ownerId,
        team
      ])
    );

  const cleanedPicks =
    picks.map(pick => {
      const player =
        players[
          pick.player_id
        ] || {};

      const team =
        teamsByOwner[
          pick.picked_by
        ] || {};

      return {
        pickNumber:
          pick.pick_no,

        round:
          pick.round,

        draftSlot:
          pick.draft_slot,

        playerId:
          pick.player_id,

        player:
          player.full_name ||
          `${player.first_name || ""} ${
            player.last_name || ""
          }`.trim() ||
          pick.metadata?.first_name +
            " " +
            pick.metadata?.last_name,

        position:
          player.position ||
          pick.metadata?.position ||
          "",

        nflTeam:
          player.team ||
          pick.metadata?.team ||
          "",

        fantasyTeam:
          team.team ||
          pick.metadata?.team ||
          "Unknown Team",

        owner:
          team.owner ||
          "Unknown Owner",

        ownerId:
          pick.picked_by ||
          null
      };
    });

  const picksByTeam = {};

  cleanedPicks.forEach(pick => {
    const key =
      pick.fantasyTeam;

    picksByTeam[key] ||= [];

    picksByTeam[key].push(
      pick
    );
  });

  const output = {
    leagueId:
      LEAGUE_ID,

    draftId:
      completedDraft.draft_id,

    season:
      completedDraft.season ||
      "2026",

    status:
      completedDraft.status,

    type:
      completedDraft.type,

    rounds:
      completedDraft.settings
        ?.rounds ||
      null,

    teams,

    picks:
      cleanedPicks,

    picksByTeam
  };

  fs.mkdirSync(
    OUTPUT_DIR,
    {
      recursive: true
    }
  );

  const outputFile =
    path.join(
      OUTPUT_DIR,
      "2026-draft.json"
    );

  fs.writeFileSync(
    outputFile,
    JSON.stringify(
      output,
      null,
      2
    ) + "\n"
  );

  console.log("");
  console.log(
    "Draft import complete."
  );

  console.log(
    "Saved to:"
  );

  console.log(
    "data/draft/2026-draft.json"
  );

  console.log("");

  Object.entries(
    picksByTeam
  ).forEach(
    ([team, teamPicks]) => {
      console.log(
        `${team}: ${teamPicks.length} picks`
      );
    }
  );
}

main().catch(error => {
  console.error("");
  console.error(
    "Draft import failed:"
  );

  console.error(error);

  process.exit(1);
});