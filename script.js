const DB_NAME = "noir-reference-board";
const STORE_NAME = "media";
const DB_VERSION = 1;

const listEl = document.querySelector("#inspiration-list");
const filtersEl = document.querySelector("#filters");
const weekLabel = document.querySelector("#week-label");
const previewMedia = document.querySelector("#preview-media");
const previewType = document.querySelector("#preview-type");
const previewTitle = document.querySelector("#preview-title");
const previewCue = document.querySelector("#preview-cue");
const importPanel = document.querySelector("#import-panel");
const openImportButtons = document.querySelectorAll("[data-open-import]");
const mediaInput = document.querySelector("#media-input");
const mediaGrid = document.querySelector("#media-grid");
const dropZone = document.querySelector("#drop-zone");
const boardLab = document.querySelector(".board-lab");
const boardEl = document.querySelector("#infinite-board");
const boardTrack = document.querySelector("#board-track");
const boardModeLabel = document.querySelector("#board-mode-label");
const boardPickCount = document.querySelector("#board-pick-count");
const pickedStrip = document.querySelector("#picked-strip");
const boardNavButtons = document.querySelectorAll("[data-board-nav]");

let references = [];
const PICK_STORAGE_KEY = "noir-reference-picks";
const BOARD_BATCH_SIZE = 56;
const BOARD_APPEND_SIZE = 24;
const BOARD_SPACING = 240;

const state = {
  filter: "all",
  db: null,
  mediaUrls: new Map(),
  boardFrames: [],
  activeBoardIndex: 0,
  picks: new Set()
};

async function init() {
  references = await loadReferences();
  state.picks = loadPicks();
  renderWeekLabel();
  renderFilters();
  renderBoard({ reset: true });
  renderList();
  bindBoardControls();
  bindImportPanel();
  setupDatabase().then(renderMediaGrid).catch(() => {
    mediaGrid.innerHTML = '<p class="empty-state">LOCAL STORAGE UNAVAILABLE</p>';
  });
}

async function loadReferences() {
  const config = window.NOIR_BOARD_CONFIG || {};
  const fallback = normalizeReferences(window.WEEKLY_INSPIRATION || []);

  if (!config.contentUrl) {
    return fallback;
  }

  try {
    const response = await fetch(config.contentUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Content request failed: ${response.status}`);
    }

    const data = await response.json();
    const items = Array.isArray(data) ? data : data.items;
    const remote = normalizeReferences(items || [], config.mediaBaseUrl || "");

    return remote.length ? remote : fallback;
  } catch (error) {
    console.warn("Using local inspiration fallback.", error);
    return fallback;
  }
}

function normalizeReferences(items, mediaBaseUrl = "") {
  return items
    .filter((item) => item && item.title)
    .map((item) => ({
      title: String(item.title),
      type: String(item.type || "moodboards"),
      week: String(item.week || "weekly drop"),
      medium: String(item.medium || "reference"),
      cue: String(item.cue || ""),
      media: resolveMediaUrl(String(item.media || ""), mediaBaseUrl)
    }));
}

function resolveMediaUrl(media, mediaBaseUrl) {
  const fallbackMedia = "assets/monochrome-editorial-bg.png";

  if (!media) {
    return fallbackMedia;
  }

  if (/^(https?:|data:|blob:|file:)/i.test(media)) {
    return media;
  }

  if (mediaBaseUrl) {
    const base = mediaBaseUrl.endsWith("/") ? mediaBaseUrl : `${mediaBaseUrl}/`;
    return new URL(media, base).toString();
  }

  return media;
}

function renderWeekLabel() {
  const newest = references[0]?.week || "WEEKLY DROP";
  weekLabel.textContent = newest.toUpperCase();
}

function renderFilters() {
  const types = ["all", ...new Set(references.map((item) => item.type))];

  filtersEl.innerHTML = types
    .map(
      (type) => `
        <button
          class="filter-button${type === state.filter ? " is-active" : ""}"
          type="button"
          data-filter="${type}"
        >
          ${escapeHtml(type.toUpperCase())}
        </button>
      `
    )
    .join("");

  filtersEl.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      renderFilters();
      renderBoard({ reset: true });
      renderList();
      boardLab.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function getVisibleReferences() {
  return references.filter((item) => state.filter === "all" || item.type === state.filter);
}

function renderList() {
  const visible = getVisibleReferences();

  listEl.innerHTML = visible
    .map((item, index) => {
      const count = String(index + 1).padStart(2, "0");
      return `
        <article
          class="reference-row"
          data-title="${escapeAttribute(item.title)}"
          data-type="${escapeAttribute(item.type)}"
          data-cue="${escapeAttribute(item.cue)}"
          data-media="${escapeAttribute(item.media)}"
          tabindex="0"
        >
          <span class="reference-index">${count}</span>
          <div class="reference-main">
            <h2>${escapeHtml(item.title)}</h2>
            <p>${escapeHtml(item.cue)}</p>
          </div>
          <span class="reference-medium">${escapeHtml(item.medium)}</span>
          <span class="reference-week">${escapeHtml(item.week)}</span>
        </article>
      `;
    })
    .join("");

  listEl.querySelectorAll(".reference-row").forEach((row) => {
    row.addEventListener("mouseenter", () => updatePreview(row));
    row.addEventListener("focus", () => updatePreview(row));
  });
}

function updatePreview(row) {
  const { title, type, cue, media } = row.dataset;

  updatePreviewContent({ title, type, cue, media });
}

function updatePreviewContent(item) {
  const isVideo = isVideoMedia(item.media);
  document.body.classList.add("has-preview");
  previewType.textContent = item.type.toUpperCase();
  previewTitle.textContent = item.title;
  previewCue.textContent = item.cue;
  previewMedia.innerHTML = isVideo
    ? `<video src="${escapeAttribute(item.media)}" muted autoplay loop playsinline></video>`
    : `<img src="${escapeAttribute(item.media)}" alt="" />`;
}

function renderBoard({ reset = false } = {}) {
  const visible = getVisibleReferences();
  const label = state.filter === "all" ? "ALL BOARD" : `${state.filter.toUpperCase()} BOARD`;

  boardModeLabel.textContent = label;
  updatePickCount();

  if (!visible.length) {
    state.boardFrames = [];
    boardTrack.innerHTML = '<p class="board-empty">NO REFERENCES</p>';
    renderPickedStrip();
    return;
  }

  if (reset) {
    state.boardFrames = createBoardFrames(visible, 0, BOARD_BATCH_SIZE);
    state.activeBoardIndex = 0;
  }

  renderBoardTrack();
  renderPickedStrip();

  if (reset) {
    boardEl.scrollLeft = 0;
  }
}

function createBoardFrames(items, startIndex, count) {
  const seed = hashString(state.filter);

  return Array.from({ length: count }, (_, offset) => {
    const index = startIndex + offset;
    const item = items[index % items.length];
    const width = Math.round(188 + randomUnit(index, seed + 13) * 116);
    const ratio = 0.72 + randomUnit(index, seed + 41) * 0.52;
    const topLimit = 420 - width * ratio;
    const top = Math.round(28 + randomUnit(index, seed + 71) * Math.max(120, topLimit));
    const left = Math.round(32 + index * BOARD_SPACING + randomUnit(index, seed + 97) * 74);
    const tilt = (randomUnit(index, seed + 131) * 4 - 2).toFixed(2);

    return {
      item,
      index,
      left,
      top,
      width,
      ratio: ratio.toFixed(3),
      tilt
    };
  });
}

function renderBoardTrack() {
  const lastFrame = state.boardFrames[state.boardFrames.length - 1];
  const trackWidth = lastFrame ? lastFrame.left + lastFrame.width + 160 : 0;

  boardTrack.style.width = `${trackWidth}px`;
  boardTrack.innerHTML = state.boardFrames.map(renderBoardFrame).join("");

  boardTrack.querySelectorAll(".board-frame").forEach((frame) => {
    frame.addEventListener("click", () => {
      selectBoardFrame(Number(frame.dataset.boardIndex), true);
      togglePick(frame.dataset.refId);
    });

    frame.addEventListener("focus", () => {
      selectBoardFrame(Number(frame.dataset.boardIndex), false);
    });
  });
}

function renderBoardFrame(frame) {
  const { item } = frame;
  const refId = getReferenceId(item);
  const picked = state.picks.has(refId);
  const active = frame.index === state.activeBoardIndex;
  const media = isVideoMedia(item.media)
    ? `<video src="${escapeAttribute(item.media)}" muted loop playsinline></video>`
    : `<img src="${escapeAttribute(item.media)}" alt="" loading="lazy" />`;

  return `
    <article
      class="board-frame${picked ? " is-picked" : ""}${active ? " is-active" : ""}"
      data-board-index="${frame.index}"
      data-ref-id="${escapeAttribute(refId)}"
      style="left:${frame.left}px; top:${frame.top}px; width:${frame.width}px; --frame-ratio:${frame.ratio}; --tilt:${frame.tilt}deg;"
      tabindex="0"
      aria-label="${escapeAttribute(item.title)}"
    >
      <div class="board-media">${media}</div>
      <div class="board-caption">
        <span>${escapeHtml(item.type)}</span>
        <strong>${escapeHtml(item.title)}</strong>
      </div>
      <span class="board-pick" aria-hidden="true">${picked ? "x" : "+"}</span>
    </article>
  `;
}

function bindBoardControls() {
  boardNavButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const direction = button.dataset.boardNav === "next" ? 1 : -1;
      selectBoardFrame(state.activeBoardIndex + direction, true);
    });
  });

  boardEl.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;

    event.preventDefault();
    selectBoardFrame(state.activeBoardIndex + (event.key === "ArrowRight" ? 1 : -1), true);
  });

  boardEl.addEventListener(
    "wheel",
    (event) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

      event.preventDefault();
      boardEl.scrollLeft += event.deltaY;
      maybeExtendBoard();
    },
    { passive: false }
  );
}

function selectBoardFrame(index, shouldScroll) {
  if (!state.boardFrames.length) return;

  if (index < 0) {
    index = state.boardFrames.length - 1;
  }

  if (index >= state.boardFrames.length) {
    appendBoardFrames();
  }

  const frame = state.boardFrames[index] || state.boardFrames[0];
  state.activeBoardIndex = frame.index;
  updatePreviewContent(frame.item);
  syncBoardActiveState();

  if (shouldScroll) {
    const targetLeft = Math.max(0, frame.left - boardEl.clientWidth / 2 + frame.width / 2);
    boardEl.scrollTo({ left: targetLeft, behavior: "smooth" });
  }

  maybeExtendBoard();
}

function syncBoardActiveState() {
  boardTrack.querySelectorAll(".board-frame").forEach((frame) => {
    frame.classList.toggle("is-active", Number(frame.dataset.boardIndex) === state.activeBoardIndex);
  });
}

function maybeExtendBoard() {
  if (state.activeBoardIndex > state.boardFrames.length - 8) {
    appendBoardFrames();
  }

  if (boardEl.scrollLeft + boardEl.clientWidth > boardTrack.offsetWidth - 1200) {
    appendBoardFrames();
  }
}

function appendBoardFrames() {
  const visible = getVisibleReferences();
  if (!visible.length) return;

  const startIndex = state.boardFrames.length;
  state.boardFrames.push(...createBoardFrames(visible, startIndex, BOARD_APPEND_SIZE));
  renderBoardTrack();
  syncBoardActiveState();
}

function togglePick(refId) {
  if (state.picks.has(refId)) {
    state.picks.delete(refId);
  } else {
    state.picks.add(refId);
  }

  savePicks();
  updatePickCount();
  renderPickedStrip();

  boardTrack.querySelectorAll(`[data-ref-id="${refId}"]`).forEach((frame) => {
    const picked = state.picks.has(refId);
    frame.classList.toggle("is-picked", picked);
    const marker = frame.querySelector(".board-pick");
    if (marker) marker.textContent = picked ? "x" : "+";
  });
}

function renderPickedStrip() {
  const pickedItems = getUniqueReferences().filter((item) => state.picks.has(getReferenceId(item)));

  if (!pickedItems.length) {
    pickedStrip.innerHTML = '<span class="picked-empty">NO PICKS</span>';
    return;
  }

  pickedStrip.innerHTML = pickedItems
    .map((item) => {
      const refId = getReferenceId(item);
      return `
        <button type="button" class="picked-chip" data-picked-id="${escapeAttribute(refId)}">
          <span>${escapeHtml(item.type)}</span>
          <strong>${escapeHtml(item.title)}</strong>
        </button>
      `;
    })
    .join("");

  pickedStrip.querySelectorAll("[data-picked-id]").forEach((chip) => {
    chip.addEventListener("click", () => {
      const frame = state.boardFrames.find((boardFrame) => getReferenceId(boardFrame.item) === chip.dataset.pickedId);
      if (frame) {
        selectBoardFrame(frame.index, true);
      }
    });
  });
}

function updatePickCount() {
  boardPickCount.textContent = `${state.picks.size} ${state.picks.size === 1 ? "PICK" : "PICKS"}`;
}

function getUniqueReferences() {
  const seen = new Set();

  return references.filter((item) => {
    const refId = getReferenceId(item);
    if (seen.has(refId)) return false;
    seen.add(refId);
    return true;
  });
}

function getReferenceId(item) {
  return slugify(`${item.week}-${item.type}-${item.title}`);
}

function loadPicks() {
  try {
    return new Set(JSON.parse(localStorage.getItem(PICK_STORAGE_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function savePicks() {
  try {
    localStorage.setItem(PICK_STORAGE_KEY, JSON.stringify([...state.picks]));
  } catch {
    return;
  }
}

function isVideoMedia(media = "") {
  return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(media);
}

function hashString(value = "") {
  return [...value].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 2166136261);
}

function randomUnit(index, seed) {
  const value = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function slugify(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function bindImportPanel() {
  openImportButtons.forEach((button) => {
    button.addEventListener("click", () => importPanel.showModal());
  });

  mediaInput.addEventListener("change", () => saveFiles(mediaInput.files));

  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add("is-dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, () => dropZone.classList.remove("is-dragging"));
  });

  dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    saveFiles(event.dataTransfer.files);
  });
}

function setupDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => {
      state.db = request.result;
      resolve();
    };

    request.onerror = () => reject(request.error);
  });
}

async function saveFiles(fileList) {
  const files = [...fileList].filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"));
  if (!files.length || !state.db) return;

  const transaction = state.db.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);

  files.forEach((file) => {
    store.put({
      id: `${Date.now()}-${crypto.randomUUID()}`,
      name: file.name,
      type: file.type,
      file,
      createdAt: new Date().toISOString()
    });
  });

  transaction.oncomplete = renderMediaGrid;
}

function getAllMedia() {
  return new Promise((resolve, reject) => {
    const transaction = state.db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    request.onerror = () => reject(request.error);
  });
}

async function renderMediaGrid() {
  if (!state.db) return;
  const media = await getAllMedia();

  state.mediaUrls.forEach((url) => URL.revokeObjectURL(url));
  state.mediaUrls.clear();

  if (!media.length) {
    mediaGrid.innerHTML = '<p class="empty-state">NO IMPORTS YET</p>';
    return;
  }

  mediaGrid.innerHTML = media
    .map((item) => {
      const url = URL.createObjectURL(item.file);
      state.mediaUrls.set(item.id, url);
      const isVideo = item.type.startsWith("video/");
      const mediaEl = isVideo
        ? `<video src="${url}" muted loop playsinline></video>`
        : `<img src="${url}" alt="" />`;

      return `
        <figure class="media-item">
          ${mediaEl}
          <figcaption>
            <span>${item.name}</span>
            <button type="button" data-remove="${item.id}" aria-label="Remove ${escapeAttribute(item.name)}" title="Remove">x</button>
          </figcaption>
        </figure>
      `;
    })
    .join("");

  mediaGrid.querySelectorAll("video").forEach((video) => {
    video.addEventListener("mouseenter", () => video.play());
    video.addEventListener("mouseleave", () => video.pause());
  });

  mediaGrid.querySelectorAll("[data-remove]").forEach((button) => {
    button.addEventListener("click", () => removeMedia(button.dataset.remove));
  });
}

function removeMedia(id) {
  if (!state.db) return;
  const transaction = state.db.transaction(STORE_NAME, "readwrite");
  transaction.objectStore(STORE_NAME).delete(id);
  transaction.oncomplete = renderMediaGrid;
}

function escapeAttribute(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

init();
