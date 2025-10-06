const leaderboardEl = document.getElementById("leaderboard");
const resetBtn = document.getElementById("reset");

resetBtn.addEventListener("click", async () => {
  const confirmed = confirm("Reset all lookup counts? This cannot be undone.");
  if (!confirmed) return;
  await chrome.storage.local.set({ lookupCounts: {}, lookupRecords: {} });
  renderLeaderboard({});
});

(async function init() {
  const { lookupRecords = {}, lookupCounts = {} } = await chrome.storage.local.get([
    "lookupRecords",
    "lookupCounts",
  ]);
  const normalizedRecords = normalizeRecords(lookupRecords, lookupCounts);
  renderLeaderboard(normalizedRecords);
})();

function renderLeaderboard(records) {
  leaderboardEl.innerHTML = "";
  const entries = Object.entries(records)
    .filter(([, value]) => value && typeof value.count === "number" && value.count > 0)
    .sort((a, b) => b[1].count - a[1].count);

  if (!entries.length) {
    leaderboardEl.classList.add("empty");
    return;
  }

  leaderboardEl.classList.remove("empty");

  const topCount = entries[0][1].count;
  entries.forEach(([word, data], index) => {
    const card = document.createElement("article");
    card.className = "card";

    const medal = document.createElement("div");
    medal.className = "medal";
    medal.textContent = index + 1;

    const info = document.createElement("div");
    info.className = "word-info";

    const title = document.createElement("h2");
    title.textContent = word;

    const subtitle = document.createElement("p");
    subtitle.textContent = formatDefinition(data.definition);

    info.append(title, subtitle);

    const pill = document.createElement("span");
    pill.className = "count-pill";
    pill.textContent = `${data.count} encounter${data.count > 1 ? "s" : ""}`;

    const progress = document.createElement("div");
    progress.className = "progress";

    const bar = document.createElement("span");
    bar.style.width = `${Math.max(12, (data.count / topCount) * 100)}%`;
    progress.appendChild(bar);

    card.append(medal, info, pill, progress);
    leaderboardEl.appendChild(card);
  });
}

function normalizeRecords(recordMap = {}, countMap = {}) {
  const merged = {};
  const words = new Set([
    ...Object.keys(countMap || {}),
    ...Object.keys(recordMap || {}),
  ]);

  words.forEach((word) => {
    const record = recordMap[word] || {};
    const countFromRecord =
      typeof record.count === "number" ? record.count : undefined;
    const countFromMap = typeof countMap[word] === "number" ? countMap[word] : 0;
    const count = countFromRecord ?? countFromMap;

    if (!count || count <= 0) return;

    merged[word] = {
      count,
      definition: typeof record.definition === "string" ? record.definition : "",
    };
  });

  return merged;
}

function formatDefinition(definition) {
  if (!definition) {
    return "Definition not saved yet. Look it up again to record the meaning.";
  }
  if (definition.length <= 160) {
    return definition;
  }
  return `${definition.slice(0, 157)}…`;
}
