import { escapeHTML } from "./data.js";

async function fetchJSON(path) {
  const response = await fetch(
    `${path}?ts=${Date.now()}`
  );

  if (!response.ok) {
    throw new Error("Not found");
  }

  return response.json();
}

function recapLabel(recap) {
  if (recap?.type === "draft") {
    return `${recap.season} Draft Edition`;
  }

  return `Week ${recap?.week} • ${recap?.season}`;
}

function archiveLabel(recap) {
  if (recap?.type === "draft") {
    return "🏈 Draft Special";
  }

  return `Week ${recap?.week}`;
}

function renderDraftFeature(draft) {
  if (!draft) {
    return "";
  }

  return `
    <section class="draft-special-section">

      <div class="section-heading">

        <p class="eyebrow">
          SBF Network Special
        </p>

        <h2>
          Draft Edition
        </h2>

      </div>

      <article
        class="draft-special-card"
        data-file="draft-2026.json"
      >

        <div class="draft-special-badge">
          2026 Draft Special
        </div>

        <h2>
          ${escapeHTML(
            draft.headline ||
            "2026 SBF Draft Recap"
          )}
        </h2>

        <p>
          Draft grades, steals,
          questionable decisions,
          preseason contenders and
          everything that happened
          across 15 rounds.
        </p>

        <div class="draft-special-stats">

          <div>
            <strong>10</strong>
            <span>Teams</span>
          </div>

          <div>
            <strong>150</strong>
            <span>Picks</span>
          </div>

          <div>
            <strong>15</strong>
            <span>Rounds</span>
          </div>

        </div>

        <button type="button">
          Read Draft Recap →
        </button>

      </article>

    </section>
  `;
}

function renderArchiveCard(
  item,
  file,
  isDraft = false
) {
  const date =
    item.generated_at
      ? new Date(
          item.generated_at
        ).toLocaleDateString()
      : "";

  return `
    <article
      class="archive-card ${
        isDraft
          ? "draft-archive-card"
          : ""
      }"
      data-file="${escapeHTML(file)}"
    >

      <p class="eyebrow">
        ${escapeHTML(
          archiveLabel(item)
        )}
      </p>

      <h3>
        ${escapeHTML(
          item.headline ||
          (
            isDraft
              ? "2026 Draft Recap"
              : `Week ${item.week} Recap`
          )
        )}
      </h3>

      <p>
        ${
          date ||
          (
            isDraft
              ? "2026 Draft Edition"
              : "Published recap"
          )
        }
      </p>

    </article>
  `;
}

function renderReader(recap) {
  return `
    <article
      class="panel article recap-featured-reader"
      id="recap-reader"
    >

      <div class="recap-reader-top">

        <p class="eyebrow">
          ${escapeHTML(
            recapLabel(recap)
          )}
        </p>

        <button
          type="button"
          id="close-recap-reader"
          class="recap-close-button"
        >
          Close ×
        </button>

      </div>

      ${recap.html}

    </article>
  `;
}

function attachReaderEvents(
  container
) {
  container
    .querySelectorAll(
      "[data-file]"
    )
    .forEach(card => {

      card.addEventListener(
        "click",
        async () => {

          try {

            const recap =
              await fetchJSON(
                `recaps/${card.dataset.file}`
              );

            const readerSection =
              document.getElementById(
                "recap-reader-section"
              );

            if (!readerSection) {
              return;
            }

            readerSection.innerHTML =
              renderReader(recap);

            readerSection.classList.add(
              "active"
            );

            const closeButton =
              document.getElementById(
                "close-recap-reader"
              );

            if (closeButton) {

              closeButton.addEventListener(
                "click",
                event => {

                  event.stopPropagation();

                  readerSection.classList.remove(
                    "active"
                  );

                  readerSection.innerHTML =
                    "";

                  document
                    .querySelector(
                      ".draft-special-section"
                    )
                    ?.scrollIntoView({
                      behavior: "smooth",
                      block: "start"
                    });

                }
              );

            }

            readerSection.scrollIntoView({
              behavior: "smooth",
              block: "start"
            });

          } catch (error) {

            console.error(
              "Could not load recap:",
              error
            );

          }

        }
      );

    });
}

export async function renderRecaps() {
  const container =
    document.getElementById(
      "recaps"
    );

  if (!container) {
    return;
  }

  container.innerHTML = `
    <article class="panel">

      <p class="eyebrow">
        SBF Network
      </p>

      <h2>
        Loading recaps...
      </h2>

    </article>
  `;

  let latest = null;
  let draft = null;
  let archiveItems = [];

  /*
    Draft Special
  */
  try {

    draft =
      await fetchJSON(
        "recaps/draft-2026.json"
      );

  } catch (error) {

    console.warn(
      "Draft recap unavailable:",
      error
    );

  }

  /*
    Latest weekly recap
  */
  try {

    latest =
      await fetchJSON(
        "recaps/latest.json"
      );

  } catch (error) {

    console.warn(
      "Latest recap unavailable:",
      error
    );

  }

  /*
    Weekly recap archive
  */
  try {

    const index =
      await fetchJSON(
        "recaps/index.json"
      );

    if (
      Array.isArray(index.items)
    ) {

      archiveItems =
        index.items
          .slice()
          .sort(
            (a, b) =>
              Number(b.week || 0) -
              Number(a.week || 0)
          );

    }

  } catch (error) {

    /*
      No index yet is okay.
    */

  }

  /*
    Fallback until index.json exists.
  */
  if (
    archiveItems.length === 0 &&
    latest
  ) {

    archiveItems = [
      {
        ...latest,
        file: "latest.json"
      }
    ];

  }

  let weeklyArchiveHTML = "";

  if (
    archiveItems.length > 0
  ) {

    weeklyArchiveHTML =
      archiveItems
        .map(item => {

          const file =
            item.file ||
            `week-${item.week}.json`;

          return renderArchiveCard(
            item,
            file,
            false
          );

        })
        .join("");

  } else {

    weeklyArchiveHTML = `
      <article class="panel">

        <p>
          Weekly recaps begin after
          Week 1.
        </p>

      </article>
    `;

  }

  const draftArchiveHTML =
    draft
      ? renderArchiveCard(
          draft,
          "draft-2026.json",
          true
        )
      : "";

  container.innerHTML = `

    <header class="page-hero">

      <p class="eyebrow">
        The Stumblin' Bumblin' Times
      </p>

      <h1>
        SBF Recaps
      </h1>

      <p>
        Draft specials, weekly recaps,
        league chaos and every edition
        of the SBF Network season.
      </p>

    </header>


    ${renderDraftFeature(draft)}


    <section
      id="recap-reader-section"
      class="recap-reader-section"
    ></section>


    <section class="recap-archive-section">

      <div class="section-heading">

        <p class="eyebrow">
          The Archives
        </p>

        <h2>
          All Editions
        </h2>

      </div>

      <div class="archive-grid">

        ${draftArchiveHTML}

        ${weeklyArchiveHTML}

      </div>

    </section>

  `;

  attachReaderEvents(
    container
  );
}