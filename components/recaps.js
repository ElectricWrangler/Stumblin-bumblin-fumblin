import { escapeHTML } from "./data.js";

async function fetchJSON(path) {
  const response = await fetch(`${path}?ts=${Date.now()}`);
  if (!response.ok) throw new Error("Not found");
  return response.json();
}

export async function renderRecaps() {
  const container = document.getElementById("recaps");

  let latestHTML = `
    <article class="panel article">
      <p class="eyebrow">Latest Edition</p>
      <h2>Waiting for the first published recap</h2>
      <p>Run the GitHub Action and the article will appear here.</p>
    </article>
  `;
  let archiveHTML = `<article class="panel"><p>No archive entries yet.</p></article>`;

  try {
    const latest = await fetchJSON("recaps/latest.json");
    latestHTML = `
      <article class="panel article" id="recap-reader">
        <p class="eyebrow">Week ${latest.week} • ${escapeHTML(latest.season)}</p>
        ${latest.html}
      </article>
    `;
  } catch {}

  try {
    const index = await fetchJSON("recaps/index.json");
    archiveHTML = index.items
      .sort((a,b) => b.week - a.week)
      .map(item => `
        <article class="archive-card" data-file="${escapeHTML(item.file)}">
          <p class="eyebrow">Week ${item.week}</p>
          <h3>${escapeHTML(item.headline || `Week ${item.week} Recap`)}</h3>
          <p>${new Date(item.generated_at).toLocaleDateString()}</p>
        </article>
      `).join("");
  } catch {
    try {
      const latest = await fetchJSON("recaps/latest.json");
      archiveHTML = `
        <article class="archive-card" data-file="latest.json">
          <p class="eyebrow">Week ${latest.week}</p>
          <h3>${escapeHTML(latest.headline || `Week ${latest.week} Recap`)}</h3>
          <p>Latest published recap</p>
        </article>
      `;
    } catch {}
  }

  container.innerHTML = `
    <header class="page-hero">
      <p class="eyebrow">The Stumblin' Bumblin' Times</p>
      <h1>Weekly Recaps</h1>
      <p>Every generated newsletter is archived here automatically.</p>
    </header>
    ${latestHTML}
    <h2>Archive</h2>
    <div class="archive-grid">${archiveHTML}</div>
  `;

  container.querySelectorAll("[data-file]").forEach(card => {
    card.addEventListener("click", async () => {
      try {
        const recap = await fetchJSON(`recaps/${card.dataset.file}`);
        const reader = document.getElementById("recap-reader");
        if (reader) {
          reader.innerHTML = `
            <p class="eyebrow">Week ${recap.week} • ${escapeHTML(recap.season)}</p>
            ${recap.html}
          `;
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      } catch {}
    });
  });
}
