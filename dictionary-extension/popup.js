const resultsEl = document.getElementById("results");
const statusEl = document.getElementById("status");
const statsBtn = document.getElementById("open-stats");

statsBtn.addEventListener("click", async () => {
  const url = chrome.runtime.getURL("stats.html");
  await chrome.tabs.create({ url });
});

document.addEventListener("DOMContentLoaded", async () => {
  statusEl.textContent = "Fetching selected text...";
  const word = await getSelectedWord();

  if (!word) {
    renderPlaceholder(
      "No word detected. Highlight a single English word and reopen the extension."
    );
    statusEl.textContent = "";
    return;
  }

  statusEl.textContent = `Looking up \"${word}\"...`;

  try {
    const data = await fetchDefinition(word);
    if (!data || !data.length) {
      throw new Error("No definitions returned");
    }

    const lookupCount = await bumpLookupCount(word);
    renderDefinitions(word, lookupCount, data);
    statusEl.textContent = "Tap the Rankings button to review your most encountered words.";
  } catch (error) {
    console.error(error);
    renderPlaceholder(
      "We couldn't find a definition for that selection. Try another English word."
    );
    statusEl.textContent = "";
  }
});

async function getSelectedWord() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return "";

  try {
    const [{ result } = {}] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection().toString().trim(),
    });
    return (result || "").split(/\s+/)[0]?.replace(/[^a-zA-Z\-']/g, "").toLowerCase();
  } catch (error) {
    console.error("Unable to retrieve selected text", error);
    return "";
  }
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

async function bumpLookupCount(word) {
  const { lookupCounts = {} } = await chrome.storage.local.get("lookupCounts");
  const nextValue = (lookupCounts[word] || 0) + 1;
  await chrome.storage.local.set({
    lookupCounts: {
      ...lookupCounts,
      [word]: nextValue,
    },
  });
  return nextValue;
}

function renderDefinitions(word, lookupCount, entries) {
  resultsEl.innerHTML = "";

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

  resultsEl.appendChild(card);
}

function renderPlaceholder(message) {
  resultsEl.innerHTML = `<div class="placeholder">${message}</div>`;
}
