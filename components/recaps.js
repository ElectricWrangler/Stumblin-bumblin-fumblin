import { escapeHTML } from "./data.js";

const RECAP_API =
  "https://sbf-recap-api.bobbyg9296.workers.dev";

async function fetchJSON(path) {
  const response = await fetch(
    `${path}?ts=${Date.now()}`
  );

  if (!response.ok) {
    throw new Error("Not found");
  }

  return response.json();
}

async function saveRecapToGitHub(
  file,
  recap,
  pin
) {
  const response = await fetch(
    RECAP_API,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json"
      },

      body: JSON.stringify({
        pin,

        file:
          `recaps/${file}`,

        recap
      })
    }
  );

  let result = null;

  try {
    result =
      await response.json();
  } catch {
    result = {
      ok: false,
      error:
        "The save server returned an invalid response."
    };
  }

  if (
    !response.ok ||
    !result.ok
  ) {
    throw new Error(
      result.error ||
      "The recap could not be saved."
    );
  }

  return result;
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

function renderReader(
  recap,
  file
) {
  return `
    <article
      class="panel article recap-featured-reader"
      id="recap-reader"
      data-recap-file="${escapeHTML(file)}"
    >

      <div class="recap-reader-top">

        <p class="eyebrow">
          ${escapeHTML(
            recapLabel(recap)
          )}
        </p>

        <div class="recap-reader-actions">

          <button
            type="button"
            id="edit-recap-button"
            class="recap-edit-button"
          >
            ✏️ Edit Recap
          </button>

          <button
            type="button"
            id="close-recap-reader"
            class="recap-close-button"
          >
            Close ×
          </button>

        </div>

      </div>

      <div id="recap-article-content">
        ${recap.html}
      </div>

    </article>
  `;
}

function renderEditor(
  recap,
  file
) {
  return `
    <article
      class="panel recap-editor"
      id="recap-editor"
      data-recap-file="${escapeHTML(file)}"
    >

      <div class="recap-editor-header">

        <div>

          <p class="eyebrow">
            Commissioner Editor
          </p>

          <h2>
            Edit Recap
          </h2>

        </div>

        <button
          type="button"
          id="cancel-recap-edit"
          class="recap-close-button"
        >
          Cancel ×
        </button>

      </div>


      <div class="recap-editor-field">

        <label for="recap-headline-input">
          Headline
        </label>

        <input
          id="recap-headline-input"
          type="text"
          value="${escapeHTML(
            recap.headline || ""
          )}"
        >

      </div>


      <div class="recap-editor-field">

        <label for="recap-html-input">
          Article
        </label>

        <p class="recap-editor-help">
          Edit wording, headings,
          grades, awards or any other
          part of the recap.
        </p>

        <textarea
          id="recap-html-input"
          spellcheck="true"
        >${escapeHTML(
          recap.html || ""
        )}</textarea>

      </div>


      <div class="recap-editor-field recap-pin-field">

        <label for="recap-pin-input">
          Commissioner PIN
        </label>

        <p class="recap-editor-help">
          Required only when publishing
          changes to the live website.
        </p>

        <input
          id="recap-pin-input"
          type="password"
          inputmode="numeric"
          pattern="[0-9]*"
          maxlength="4"
          autocomplete="off"
          placeholder="••••"
        >

      </div>


      <div class="recap-editor-actions">

        <button
          type="button"
          id="preview-recap-button"
          class="secondary"
        >
          👁 Preview
        </button>

        <button
          type="button"
          id="save-recap-button"
          class="primary"
        >
          💾 Save Changes
        </button>

      </div>


      <div
        id="recap-save-status"
        class="recap-save-status"
      ></div>


      <section
        id="recap-edit-preview"
        class="recap-edit-preview"
      >

        <div class="section-heading">

          <p class="eyebrow">
            Preview
          </p>

          <h2>
            Recap Preview
          </h2>

        </div>

        <article
          class="panel article recap-featured-reader"
        >

          <div
            id="recap-preview-content"
          ></div>

        </article>

      </section>

    </article>
  `;
}

function attachOpenedRecapEvents(
  readerSection,
  recap,
  file
) {
  const closeButton =
    document.getElementById(
      "close-recap-reader"
    );

  const editButton =
    document.getElementById(
      "edit-recap-button"
    );

  if (closeButton) {
    closeButton.addEventListener(
      "click",
      event => {

        event.stopPropagation();

        readerSection.classList.remove(
          "active"
        );

        readerSection.innerHTML = "";

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

  if (editButton) {
    editButton.addEventListener(
      "click",
      event => {

        event.stopPropagation();

        readerSection.innerHTML =
          renderEditor(
            recap,
            file
          );

        attachEditorEvents(
          readerSection,
          recap,
          file
        );

        readerSection.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });

      }
    );
  }
}

function attachEditorEvents(
  readerSection,
  originalRecap,
  file
) {
  const headlineInput =
    document.getElementById(
      "recap-headline-input"
    );

  const htmlInput =
    document.getElementById(
      "recap-html-input"
    );

  const pinInput =
    document.getElementById(
      "recap-pin-input"
    );

  const previewButton =
    document.getElementById(
      "preview-recap-button"
    );

  const saveButton =
    document.getElementById(
      "save-recap-button"
    );

  const cancelButton =
    document.getElementById(
      "cancel-recap-edit"
    );

  const previewSection =
    document.getElementById(
      "recap-edit-preview"
    );

  const previewContent =
    document.getElementById(
      "recap-preview-content"
    );

  const saveStatus =
    document.getElementById(
      "recap-save-status"
    );


  function buildEditedRecap() {
    return {
      ...originalRecap,

      headline:
        headlineInput?.value.trim() ||
        originalRecap.headline ||
        "",

      html:
        htmlInput?.value ||
        originalRecap.html ||
        ""
    };
  }


  if (pinInput) {
    pinInput.addEventListener(
      "input",
      () => {

        pinInput.value =
          pinInput.value
            .replace(/\D/g, "")
            .slice(0, 4);

      }
    );
  }


  if (previewButton) {
    previewButton.addEventListener(
      "click",
      event => {

        event.preventDefault();

        const editedRecap =
          buildEditedRecap();

        if (
          previewContent &&
          previewSection
        ) {

          previewContent.innerHTML = `
            <p class="eyebrow">
              ${escapeHTML(
                recapLabel(
                  editedRecap
                )
              )}
            </p>

            <h2>
              ${escapeHTML(
                editedRecap.headline
              )}
            </h2>

            ${editedRecap.html}
          `;

          previewSection.classList.add(
            "active"
          );

          previewSection.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });

        }

      }
    );
  }


  if (cancelButton) {
    cancelButton.addEventListener(
      "click",
      event => {

        event.preventDefault();

        readerSection.innerHTML =
          renderReader(
            originalRecap,
            file
          );

        attachOpenedRecapEvents(
          readerSection,
          originalRecap,
          file
        );

      }
    );
  }


  if (saveButton) {
    saveButton.addEventListener(
      "click",
      async event => {

        event.preventDefault();

        const pin =
          pinInput?.value || "";

        if (!/^\d{4}$/.test(pin)) {

          if (saveStatus) {
            saveStatus.innerHTML = `
              <strong>
                Enter your 4-digit PIN.
              </strong>

              <span>
                The recap has not been
                changed.
              </span>
            `;
          }

          pinInput?.focus();

          return;
        }

        const editedRecap =
          buildEditedRecap();

        saveButton.disabled = true;

        saveButton.textContent =
          "Saving...";

        if (saveStatus) {
          saveStatus.innerHTML = `
            <strong>
              Publishing recap...
            </strong>

            <span>
              Sending the update securely
              to GitHub.
            </span>
          `;
        }

        try {

          const result =
            await saveRecapToGitHub(
              file,
              editedRecap,
              pin
            );

          if (pinInput) {
            pinInput.value = "";
          }

          if (saveStatus) {
            saveStatus.innerHTML = `
              <strong>
                ✅ Recap saved.
              </strong>

              <span>
                GitHub accepted the update.
                The live site should refresh
                after GitHub Pages deploys.
              </span>
            `;
          }

          console.log(
            "Recap saved:",
            result
          );

          setTimeout(() => {

            readerSection.innerHTML =
              renderReader(
                editedRecap,
                file
              );

            attachOpenedRecapEvents(
              readerSection,
              editedRecap,
              file
            );

          }, 1500);

        } catch (error) {

          console.error(
            "Recap save failed:",
            error
          );

          if (saveStatus) {
            saveStatus.innerHTML = `
              <strong>
                ❌ Save failed.
              </strong>

              <span>
                ${escapeHTML(
                  error.message
                )}
              </span>
            `;
          }

        } finally {

          saveButton.disabled = false;

          saveButton.textContent =
            "💾 Save Changes";

        }

      }
    );
  }
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

            const file =
              card.dataset.file;

            const recap =
              await fetchJSON(
                `recaps/${file}`
              );

            const readerSection =
              document.getElementById(
                "recap-reader-section"
              );

            if (!readerSection) {
              return;
            }

            readerSection.innerHTML =
              renderReader(
                recap,
                file
              );

            readerSection.classList.add(
              "active"
            );

            attachOpenedRecapEvents(
              readerSection,
              recap,
              file
            );

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