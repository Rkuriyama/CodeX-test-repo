const leaderboardEl = document.getElementById("leaderboard");
const resetBtn = document.getElementById("reset");

resetBtn.addEventListener("click", async () => {
  const confirmed = confirm("Reset all lookup counts? This cannot be undone.");
  if (!confirmed) return;
  await chrome.storage.local.set({ lookupCounts: {} });
  renderLeaderboard({});
});

(async function init() {
  const { lookupCounts = {} } = await chrome.storage.local.get("lookupCounts");
  renderLeaderboard(lookupCounts);
})();

function renderLeaderboard(counts) {
  leaderboardEl.innerHTML = "";
  const entries = Object.entries(counts)
    .filter(([, value]) => typeof value === "number" && value > 0)
    .sort((a, b) => b[1] - a[1]);

  if (!entries.length) {
    leaderboardEl.classList.add("empty");
    return;
  }

  leaderboardEl.classList.remove("empty");

  const topCount = entries[0][1];
  entries.forEach(([word, count], index) => {
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
    subtitle.textContent = generateSubtitle(count);

    info.append(title, subtitle);

    const pill = document.createElement("span");
    pill.className = "count-pill";
    pill.textContent = `${count} encounter${count > 1 ? "s" : ""}`;

    const progress = document.createElement("div");
    progress.className = "progress";

    const bar = document.createElement("span");
    bar.style.width = `${Math.max(12, (count / topCount) * 100)}%`;
    progress.appendChild(bar);

    card.append(medal, info, pill, progress);
    leaderboardEl.appendChild(card);
  });
}

function generateSubtitle(count) {
  if (count >= 15) return "You're mastering this word!";
  if (count >= 8) return "Keep reviewing to make it stick.";
  if (count >= 4) return "Repetition builds confidence.";
  return "A new discovery awaits more practice.";
}
