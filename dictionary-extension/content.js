const BUTTON_ID = "dictionary-lookup-floating-button";
const PANEL_ID = "dictionary-lookup-panel";

if (window.top === window) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
}

function initialize() {
  if (document.getElementById(BUTTON_ID)) {
    return;
  }

  injectStyles();
  createFloatingButton();
  createPanel();
}

function injectStyles() {
  const style = document.createElement("style");
  style.id = "dictionary-lookup-styles";
  style.textContent = `
    #${BUTTON_ID} {
      position: fixed;
      right: 24px;
      bottom: 24px;
      z-index: 2147483646;
      background: linear-gradient(135deg, #1e88e5, #3949ab);
      color: #fff;
      border: none;
      border-radius: 999px;
      padding: 12px 20px;
      font-size: 15px;
      font-weight: 600;
      box-shadow: 0 12px 24px rgba(30, 136, 229, 0.35);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    #${BUTTON_ID}:hover {
      transform: translateY(-1px) scale(1.01);
      box-shadow: 0 16px 30px rgba(30, 136, 229, 0.4);
    }

    #${BUTTON_ID}:disabled {
      opacity: 0.6;
      cursor: progress;
      transform: none;
      box-shadow: 0 8px 18px rgba(30, 136, 229, 0.25);
    }

    #${PANEL_ID} {
      position: fixed;
      right: 24px;
      bottom: 96px;
      width: min(380px, calc(100% - 48px));
      max-height: min(480px, calc(100% - 144px));
      background: rgba(17, 24, 39, 0.92);
      backdrop-filter: blur(14px);
      color: #f8fafc;
      border-radius: 18px;
      box-shadow: 0 20px 45px rgba(15, 23, 42, 0.45);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: 2147483646;
      font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      opacity: 0;
      pointer-events: none;
      transform: translateY(12px);
      transition: opacity 0.25s ease, transform 0.25s ease;
    }

    #${PANEL_ID}.visible {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0);
    }

    #${PANEL_ID} header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px 10px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.2);
    }

    #${PANEL_ID} header h1 {
      margin: 0;
      font-size: 17px;
      letter-spacing: 0.01em;
    }

    #${PANEL_ID} header button {
      background: transparent;
      border: none;
      color: rgba(226, 232, 240, 0.8);
      font-size: 18px;
      cursor: pointer;
      padding: 6px;
      border-radius: 8px;
      transition: background 0.2s ease;
    }

    #${PANEL_ID} header button:hover {
      background: rgba(148, 163, 184, 0.15);
      color: #fff;
    }

    #${PANEL_ID} .dictionary-panel-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 18px 12px;
    }

    #${PANEL_ID} .dictionary-panel-actions button {
      background: rgba(37, 99, 235, 0.22);
      border: 1px solid rgba(59, 130, 246, 0.35);
      color: #bfdbfe;
      padding: 8px 14px;
      border-radius: 12px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      transition: background 0.2s ease, transform 0.2s ease;
    }

    #${PANEL_ID} .dictionary-panel-actions button:hover {
      background: rgba(59, 130, 246, 0.35);
      transform: translateY(-1px);
    }

    #${PANEL_ID} .dictionary-panel-status {
      padding: 0 18px 12px;
      font-size: 13px;
      color: rgba(226, 232, 240, 0.8);
    }

    #${PANEL_ID} .dictionary-panel-content {
      flex: 1;
      overflow-y: auto;
      padding: 0 18px 18px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    #${PANEL_ID} .dictionary-placeholder {
      padding: 24px 18px;
      text-align: center;
      color: rgba(226, 232, 240, 0.75);
      font-size: 14px;
      border: 1px dashed rgba(148, 163, 184, 0.3);
      border-radius: 16px;
      background: rgba(30, 41, 59, 0.45);
    }

    #${PANEL_ID} .word-card {
      background: rgba(30, 41, 59, 0.7);
      border-radius: 16px;
      padding: 16px;
      box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.15);
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    #${PANEL_ID} .word-card header {
      border: none;
      padding: 0;
    }

    #${PANEL_ID} .word-title {
      font-size: 20px;
      margin: 0;
      font-weight: 700;
      text-transform: lowercase;
    }

    #${PANEL_ID} .lookup-count {
      font-size: 12px;
      padding: 4px 10px;
      border-radius: 999px;
      background: rgba(96, 165, 250, 0.2);
      color: #bfdbfe;
      font-weight: 600;
    }

    #${PANEL_ID} .definition-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
      background: rgba(15, 23, 42, 0.35);
      border-radius: 14px;
      padding: 12px 14px;
    }

    #${PANEL_ID} .part-of-speech {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: rgba(148, 163, 184, 0.85);
      font-weight: 600;
    }

    #${PANEL_ID} .meanings-list {
      margin: 0;
      padding-left: 18px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 14px;
      line-height: 1.4;
    }

    #${PANEL_ID} .meanings-list li {
      margin: 0;
    }

    #${PANEL_ID} .example {
      display: block;
      margin-top: 4px;
      font-size: 12px;
      color: rgba(191, 219, 254, 0.85);
    }

    #${PANEL_ID} .synonyms {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 6px;
    }

    #${PANEL_ID} .synonym {
      background: rgba(59, 130, 246, 0.28);
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      color: #dbeafe;
    }
  `;
  document.head.appendChild(style);
}

function createFloatingButton() {
  const button = document.createElement("button");
  button.id = BUTTON_ID;
  button.type = "button";
  button.innerHTML =
    '<span class="dictionary-icon" aria-hidden="true">🔍</span> Look up';
  button.addEventListener("click", handleLookupClick);
  document.body.appendChild(button);
}

function createPanel() {
  const panel = document.createElement("section");
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <header>
      <h1>English Learner Dictionary</h1>
      <button type="button" aria-label="Close dictionary panel">✕</button>
    </header>
    <div class="dictionary-panel-actions">
      <button type="button" data-action="rankings">View rankings</button>
    </div>
    <div class="dictionary-panel-status">Highlight a word, then press Look up.</div>
    <div class="dictionary-panel-content"></div>
  `;

  panel
    .querySelector("header button")
    .addEventListener("click", () => panel.classList.remove("visible"));

  panel
    .querySelector('[data-action="rankings"]')
    .addEventListener("click", () => {
      const url = chrome.runtime.getURL("stats.html");
      window.open(url, "_blank", "noopener");
    });

  document.body.appendChild(panel);
}

async function handleLookupClick(event) {
  const button = event.currentTarget;
  const panel = document.getElementById(PANEL_ID);
  const statusEl = panel.querySelector(".dictionary-panel-status");
  const contentEl = panel.querySelector(".dictionary-panel-content");

  button.disabled = true;
  panel.classList.add("visible");
  statusEl.textContent = "Checking the selected text...";
  contentEl.innerHTML = "";

  try {
    const word = extractSelectedWord();
    if (!word) {
      renderPlaceholder(
        contentEl,
        "No word detected. Highlight a single English word and press Look up again."
      );
      statusEl.textContent = "";
      return;
    }

    statusEl.textContent = `Looking up "${word}"...`;

    const data = await fetchDefinition(word);
    if (!data || !data.length) {
      throw new Error("No definitions returned");
    }

    const record = await updateLookupRecord(word, data);
    renderDefinitions(contentEl, word, record.count, data);
    statusEl.textContent =
      "Tap View rankings to review your most encountered words.";
  } catch (error) {
    console.error(error);
    renderPlaceholder(
      contentEl,
      "We couldn't find a definition for that selection. Try another English word."
    );
    statusEl.textContent = "";
  } finally {
    button.disabled = false;
  }
}

function extractSelectedWord() {
  const selection = window.getSelection();
  if (!selection) return "";
  const text = selection.toString().trim();
  return text
    .split(/\s+/)[0]
    ?.replace(/[^a-zA-Z\-']/g, "")
    .toLowerCase();
}

async function fetchDefinition(word) {
  const response = await fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
  );
  if (!response.ok) {
    throw new Error(`Lookup failed: ${response.status}`);
  }
  return response.json();
}

async function updateLookupRecord(word, entries) {
  const { lookupRecords = {}, lookupCounts = {} } = await chrome.storage.local.get([
    "lookupRecords",
    "lookupCounts",
  ]);

  const previousRecord = lookupRecords[word] || {};
  const previousCount =
    typeof previousRecord.count === "number"
      ? previousRecord.count
      : typeof lookupCounts[word] === "number"
      ? lookupCounts[word]
      : 0;

  const definition = extractPrimaryDefinition(entries);
  const nextRecord = {
    count: previousCount + 1,
    definition: definition || previousRecord.definition || "",
  };

  await chrome.storage.local.set({
    lookupRecords: {
      ...lookupRecords,
      [word]: nextRecord,
    },
    lookupCounts: {
      ...lookupCounts,
      [word]: nextRecord.count,
    },
  });

  return nextRecord;
}

function renderDefinitions(container, word, lookupCount, entries) {
  container.innerHTML = "";

  const card = document.createElement("section");
  card.className = "word-card";

  const header = document.createElement("header");
  const title = document.createElement("h2");
  title.className = "word-title";
  title.textContent = word;

  const countPill = document.createElement("span");
  countPill.className = "lookup-count";
  countPill.textContent = `${lookupCount} lookup${lookupCount > 1 ? "s" : ""}`;

  header.append(title, countPill);
  card.appendChild(header);

  entries.forEach((entry) => {
    entry.meanings?.forEach((meaning) => {
      const group = document.createElement("article");
      group.className = "definition-group";

      const partOfSpeech = document.createElement("span");
      partOfSpeech.className = "part-of-speech";
      partOfSpeech.textContent = meaning.partOfSpeech || "Meaning";

      const list = document.createElement("ol");
      list.className = "meanings-list";

      meaning.definitions?.slice(0, 5).forEach((definition) => {
        const item = document.createElement("li");
        item.textContent = definition.definition;
        if (definition.example) {
          const example = document.createElement("span");
          example.className = "example";
          example.textContent = `Example: ${definition.example}`;
          item.appendChild(example);
        }
        list.appendChild(item);
      });

      group.append(partOfSpeech, list);

      if (meaning.synonyms?.length) {
        const synonyms = document.createElement("div");
        synonyms.className = "synonyms";
        meaning.synonyms.slice(0, 10).forEach((syn) => {
          const chip = document.createElement("span");
          chip.className = "synonym";
          chip.textContent = syn;
          synonyms.appendChild(chip);
        });
        group.appendChild(synonyms);
      }

      card.appendChild(group);
    });
  });

  container.appendChild(card);
}

function renderPlaceholder(container, message) {
  container.innerHTML = `<div class="dictionary-placeholder">${message}</div>`;
}

function extractPrimaryDefinition(entries) {
  for (const entry of entries || []) {
    for (const meaning of entry.meanings || []) {
      for (const definition of meaning.definitions || []) {
        if (definition?.definition) {
          return definition.definition;
        }
      }
    }
  }
  return "";
}
