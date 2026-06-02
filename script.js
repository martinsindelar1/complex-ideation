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

let references = [];
const state = {
  filter: "all",
  db: null,
  mediaUrls: new Map()
};

async function init() {
  references = await loadReferences();
  renderWeekLabel();
  renderFilters();
  renderList();
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
      renderList();
    });
  });
}

function renderList() {
  const visible = references.filter((item) => state.filter === "all" || item.type === state.filter);

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
  const isVideo = /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(media);

  document.body.classList.add("has-preview");
  previewType.textContent = type.toUpperCase();
  previewTitle.textContent = title;
  previewCue.textContent = cue;
  previewMedia.innerHTML = isVideo
    ? `<video src="${media}" muted autoplay loop playsinline></video>`
    : `<img src="${media}" alt="" />`;
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
