const DB_NAME = "voice-journal-db";
const DB_VERSION = 5;

if (typeof history !== "undefined" && "scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

const coverPresets = {
  forest: "",
  ocean: "linear-gradient(135deg, #d9f0ec 0%, #92c9c4 48%, #f8f4df 100%)",
  star: "linear-gradient(135deg, #283142 0%, #58728a 54%, #d5d8c2 100%)",
  mountain: "linear-gradient(135deg, #e6eee8 0%, #adc3ad 48%, #6f8b73 100%)",
  city: "linear-gradient(135deg, #e8f1ef 0%, #b7d5cb 45%, #f3d6c6 100%)",
  gradient: "linear-gradient(135deg, #e7f4ed 0%, #9fdbbe 52%, #fffdf8 100%)"
};

const folders = [
  { id: "all", name: "全部日记", icon: "calendar" },
  { id: "daily", name: "碎碎念", icon: "pen" },
  { id: "travel", name: "旅行日记", icon: "image" },
  { id: "read", name: "读书笔记", icon: "book" },
  { id: "review", name: "每日复盘", icon: "check" }
];

const state = {
  db: null,
  entries: [],
  activeEntryId: null,
  activeFolderId: "all",
  mobileTab: "today",
  syncEmail: localStorage.getItem("voiceJournalSyncEmail") || "",
  ideas: [],
  coverImages: [],
  editing: false,
  sheetOpen: false,
  sheetType: "",
  search: "",
  activeBlockId: null,
  recorder: null,
  mediaStream: null,
  recognition: null,
  recordingBlockId: null,
  playingBlockId: null,
  elapsedBeforePause: 0,
  audioUrls: new Map(),
  chunks: [],
  recordingMimeType: "",
  liveTranscript: "",
  dateEditingBlockId: null,
  recordingStartedAt: 0,
  timerId: null,
  saveTimer: null
};

const el = {
  saveStatus: document.querySelector("#saveStatus"),
  homeGreeting: document.querySelector("#homeGreeting"),
  homeRecordBtn: document.querySelector("#homeRecordBtn"),
  homeSearchBtn: document.querySelector("#homeSearchBtn"),
  homeRecentCards: document.querySelector("#homeRecentCards"),
  homeMonthStats: document.querySelector("#homeMonthStats"),
  homeTimeline: document.querySelector("#homeTimeline"),
  speechStatus: document.querySelector("#speechStatus"),
  newEntryBtn: document.querySelector("#newEntryBtn"),
  searchInput: document.querySelector("#searchInput"),
  folderNav: document.querySelector("#folderNav"),
  entryList: document.querySelector("#entryList"),
  titleInput: document.querySelector("#titleInput"),
  editorMeta: document.querySelector("#editorMeta"),
  editorSaveStatus: document.querySelector("#editorSaveStatus"),
  subtitleInput: document.querySelector("#subtitleInput"),
  blockList: document.querySelector("#blockList"),
  imagePicker: document.querySelector("#imagePicker"),
  recordBtn: document.querySelector("#recordBtn"),
  liveTranscript: document.querySelector("#liveTranscript"),
  audioMiniList: document.querySelector("#audioMiniList"),
  audioCount: document.querySelector("#audioCount"),
  insertDateTopBtn: document.querySelector("#insertDateTopBtn"),
  closeHintBtn: document.querySelector("#closeHintBtn"),
  closeDockBtn: document.querySelector("#closeDockBtn"),
  editorToolbar: document.querySelector("#editorToolbar"),
  sheetBackdrop: document.querySelector("#sheetBackdrop"),
  insertSheet: document.querySelector("#insertSheet"),
  coverArea: document.querySelector("#coverArea"),
  coverPicker: document.querySelector("#coverPicker"),
  coverLibraryPicker: document.querySelector("#coverLibraryPicker"),
  coverLibraryBtn: document.querySelector("#coverLibraryBtn"),
  clearCoverLibraryBtn: document.querySelector("#clearCoverLibraryBtn"),
  coverLibraryList: document.querySelector("#coverLibraryList"),
  coverLibraryStatus: document.querySelector("#coverLibraryStatus"),
  changeCoverBtn: document.querySelector("#changeCoverBtn"),
  deleteEntryBtn: document.querySelector("#deleteEntryBtn"),
  dateSheet: document.querySelector("#dateSheet"),
  datePickerInput: document.querySelector("#datePickerInput"),
  coverSheet: document.querySelector("#coverSheet"),
  ideaInput: document.querySelector("#ideaInput"),
  addIdeaBtn: document.querySelector("#addIdeaBtn"),
  ideaList: document.querySelector("#ideaList"),
  syncEmailInput: document.querySelector("#syncEmailInput"),
  saveEmailBtn: document.querySelector("#saveEmailBtn"),
  syncStatus: document.querySelector("#syncStatus")
};

const icons = {
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
  text: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M5 6h14M12 6v12M9 18h6"/></svg>`,
  image: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linejoin="round"><rect x="4" y="5" width="16" height="14" rx="3"/><path d="m7 16 4-4 3 3 2-2 3 3"/><circle cx="9" cy="9" r="1.2"/></svg>`,
  mic: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><rect x="9" y="4" width="6" height="10" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16M8 14h2M12 14h2M16 14h1M8 17h2M12 17h2"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="M4 12h2M18 12h2M12 4v2M12 18v2M6.6 6.6 8 8M16 16l1.4 1.4M17.4 6.6 16 8M8 16l-1.4 1.4"/></svg>`,
  book: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H20v16H7.5A2.5 2.5 0 0 0 5 21V5.5Z"/><path d="M5 5.5A2.5 2.5 0 0 0 2.5 3H2v16h.5A2.5 2.5 0 0 1 5 21"/></svg>`,
  pen: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></svg>`,
  more: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M5 12h.01M12 12h.01M19 12h.01"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>`,
  divider: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M5 12h14"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="5"/><path d="m8 12 3 3 5-6"/></svg>`,
  quote: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M9 7H6.5A2.5 2.5 0 0 0 4 9.5V17h6v-6H7.5M20 7h-2.5A2.5 2.5 0 0 0 15 9.5V17h6v-6h-2.5"/></svg>`,
  play: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8 5.5v13l11-6.5-11-6.5Z"/></svg>`,
  pause: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>`
};

function icon(name) {
  return `<span class="vj-icon" aria-hidden="true">${icons[name] || icons.more}</span>`;
}

function hydrateIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((node) => {
    node.classList.add("vj-icon");
    node.innerHTML = icons[node.dataset.icon] || icons.more;
  });
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function nowISO() {
  return new Date().toISOString();
}

function todayISO() {
  return localDateISO(new Date());
}

function localDateISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateOffsetISO(days) {
  const date = new Date(`${todayISO()}T00:00:00`);
  date.setDate(date.getDate() + days);
  return localDateISO(date);
}

function displayDate(dateText = todayISO()) {
  const date = new Date(`${dateText}T00:00:00`);
  const monthDay = new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(date);
  const weekday = new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(date);
  const diff = Math.round((new Date(todayISO()) - date) / 86400000);
  if (diff === 0) return "今天";
  if (diff === 1) return "昨天";
  if (diff === 2) return "前天";
  return `${monthDay} ${weekday}`;
}

function automaticTitleForDate(dateText = todayISO(), existingEntries = state.entries) {
  const base = relativeTitleBase(dateText);
  const sameDay = existingEntries.filter((entry) => entry.date === dateText && !entry.titleEdited).length;
  return sameDay ? `${base} ${sameDay + 1}` : base;
}

function relativeTitleBase(dateText = todayISO()) {
  const date = new Date(`${dateText}T00:00:00`);
  const diff = Math.round((new Date(todayISO()) - date) / 86400000);
  if (diff === 0) return "今天的说一说";
  if (diff === 1) return "昨天的说一说";
  if (diff === 2) return "前天的说一说";
  const monthDay = new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(date);
  const weekday = new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(date);
  return `${monthDay} ${weekday}的说一说`;
}

function displayEntryTitle(entry) {
  if (!entry) return "未命名日记";
  if (entry.titleEdited) return entry.title || "未命名日记";
  const base = relativeTitleBase(entry.date || todayISO());
  const sameDay = state.entries
    .filter((item) => item.date === entry.date && !item.titleEdited)
    .sort((a, b) => new Date(a.createdAt || a.updatedAt) - new Date(b.createdAt || b.updatedAt));
  const index = sameDay.findIndex((item) => item.id === entry.id);
  return index > 0 ? `${base} ${index + 1}` : base;
}

function formatTime(value) {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function relativeDay(value) {
  const today = new Date(todayISO());
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  const diff = Math.round((today - date) / 86400000);
  if (diff === 0) return "今天";
  if (diff === 1) return "昨天";
  return `${diff}天前`;
}

function formatDuration(ms) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
  const rest = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("entries")) db.createObjectStore("entries", { keyPath: "id" });
      if (!db.objectStoreNames.contains("folders")) db.createObjectStore("folders", { keyPath: "id" });
      if (!db.objectStoreNames.contains("audioBlobs")) db.createObjectStore("audioBlobs", { keyPath: "id" });
      if (!db.objectStoreNames.contains("ideas")) db.createObjectStore("ideas", { keyPath: "id" });
      if (!db.objectStoreNames.contains("coverImages")) db.createObjectStore("coverImages", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function store(name, mode = "readonly") {
  return state.db.transaction(name, mode).objectStore(name);
}

function getAll(name) {
  return new Promise((resolve, reject) => {
    const request = store(name).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function putEntry(entry) {
  return new Promise((resolve, reject) => {
    const request = store("entries", "readwrite").put(entry);
    request.onsuccess = () => resolve(entry);
    request.onerror = () => reject(request.error);
  });
}

function deleteEntryRecord(entryId) {
  return new Promise((resolve, reject) => {
    const request = store("entries", "readwrite").delete(entryId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function putAudioRecord(record) {
  return new Promise((resolve, reject) => {
    const request = store("audioBlobs", "readwrite").put(record);
    request.onsuccess = () => resolve(record);
    request.onerror = () => reject(request.error);
  });
}

function getAudioRecord(audioId) {
  return new Promise((resolve, reject) => {
    const request = store("audioBlobs").get(audioId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

function deleteAudioRecord(audioId) {
  if (!audioId) return Promise.resolve();
  if (state.audioUrls.has(audioId)) {
    URL.revokeObjectURL(state.audioUrls.get(audioId));
    state.audioUrls.delete(audioId);
  }
  return new Promise((resolve, reject) => {
    const request = store("audioBlobs", "readwrite").delete(audioId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function putIdea(idea) {
  return new Promise((resolve, reject) => {
    const request = store("ideas", "readwrite").put(idea);
    request.onsuccess = () => resolve(idea);
    request.onerror = () => reject(request.error);
  });
}

function deleteIdeaRecord(ideaId) {
  return new Promise((resolve, reject) => {
    const request = store("ideas", "readwrite").delete(ideaId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function putCoverImage(record) {
  return new Promise((resolve, reject) => {
    const request = store("coverImages", "readwrite").put(record);
    request.onsuccess = () => resolve(record);
    request.onerror = () => reject(request.error);
  });
}

function deleteCoverImageRecord(coverId) {
  return new Promise((resolve, reject) => {
    const request = store("coverImages", "readwrite").delete(coverId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function seedIfNeeded() {
  const entries = await getAll("entries");
  if (entries.length) return;
  const entry = createEntry();
  entry.subtitle = "";
  entry.blocks = [
    { id: uid("block"), type: "date", date: todayISO() },
    { id: uid("block"), type: "text", text: "从这里开始记录今天。可以插入文字、图片、日期，也可以把录音放在任意位置。" },
    { id: uid("block"), type: "audio", duration: "00:00", transcript: "声音片段会保留播放器、原始音频和实时转写文字。", createdAt: nowISO() }
  ];
  await putEntry(entry);
}

function createEntry(folderId = "daily") {
  const now = nowISO();
  const date = todayISO();
  const cover = nextCoverFromLibrary();
  return {
    id: uid("entry"),
    title: automaticTitleForDate(date),
    titleEdited: false,
    subtitle: "",
    coverImage: cover.src,
    coverPreset: cover.preset,
    folderId,
    date,
    blocks: [
      { id: uid("block"), type: "date", date },
      { id: uid("block"), type: "text", text: "" }
    ],
    createdAt: now,
    updatedAt: now
  };
}

async function ensureTodayEntry() {
  let entry = state.entries
    .filter((item) => item.date === todayISO())
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
  if (entry) return entry;
  entry = createEntry("daily");
  state.entries.unshift(entry);
  state.activeEntryId = entry.id;
  await putEntry(entry);
  return entry;
}

function nextCoverFromLibrary() {
  if (!state.coverImages.length) return { src: "", preset: "forest" };
  const index = Number(localStorage.getItem("voiceJournalCoverRotation") || 0);
  const image = state.coverImages[index % state.coverImages.length];
  localStorage.setItem("voiceJournalCoverRotation", String((index + 1) % state.coverImages.length));
  return { src: image.src, preset: "library" };
}

async function loadData() {
  state.entries = (await getAll("entries")).map(normalizeEntry).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  state.ideas = (await getAll("ideas")).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  state.coverImages = (await getAll("coverImages")).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  if (!state.activeEntryId) state.activeEntryId = state.entries[0]?.id || null;
  render();
}

function normalizeEntry(entry) {
  if (Array.isArray(entry.blocks)) {
    const titleEdited = Boolean(entry.titleEdited);
    const normalizedDate = entry.date || entry.blocks.find((block) => block.type === "date")?.date || todayISO();
    const title = (!titleEdited && (!entry.title || entry.title === "未命名日记"))
      ? automaticTitleForDate(normalizedDate, state.entries.filter((item) => item.id !== entry.id))
      : entry.title;
    return {
      ...entry,
      title,
      titleEdited,
      date: normalizedDate,
      subtitle: entry.subtitle || "",
      coverImage: entry.coverImage || "",
      coverPreset: entry.coverPreset || "forest",
      blocks: entry.blocks.map((block) => {
        if (block.type !== "audio") return block;
        return {
          audioDataUrl: "",
          audioId: "",
          mimeType: "",
          blobSize: 0,
          duration: "00:00",
          durationMs: 0,
          transcript: "",
          transcriptEdited: "",
          createdAt: entry.updatedAt || nowISO(),
          ...block,
          status: block.audioDataUrl ? "done" : (block.status || "idle")
        };
      })
    };
  }
  const blocks = [];
  blocks.push({ id: uid("block"), type: "date", date: entry.date || todayISO() });
  if (entry.body) {
    blocks.push({ id: uid("block"), type: "text", text: htmlToText(entry.body) });
  }
  (entry.segments || []).forEach((segment) => {
    blocks.push({
      id: segment.id || uid("block"),
      type: "audio",
      status: segment.audioDataUrl ? "done" : "idle",
      audioDataUrl: segment.audioDataUrl || "",
      duration: segment.duration || "00:00",
      durationMs: 0,
      transcript: segment.text || "",
      transcriptEdited: "",
      createdAt: segment.createdAt || entry.updatedAt || nowISO()
    });
  });
  if (blocks.length < 2) blocks.push({ id: uid("block"), type: "text", text: "" });
  const normalizedDate = entry.date || todayISO();
  const titleEdited = Boolean(entry.titleEdited);
  return {
    ...entry,
    title: (!titleEdited && (!entry.title || entry.title === "未命名日记")) ? automaticTitleForDate(normalizedDate) : entry.title,
    titleEdited,
    subtitle: entry.subtitle || "",
    coverImage: entry.coverImage || "",
    coverPreset: entry.coverPreset || "forest",
    date: normalizedDate,
    blocks
  };
}

function htmlToText(html) {
  const template = document.createElement("template");
  template.innerHTML = html || "";
  return template.content.textContent.trim();
}

function activeEntry() {
  return state.entries.find((entry) => entry.id === state.activeEntryId) || null;
}

function filteredEntries() {
  const search = state.search.trim().toLowerCase();
  return state.entries.filter((entry) => {
    const inFolder = state.activeFolderId === "all" || entry.folderId === state.activeFolderId;
    const text = `${entry.title} ${entry.subtitle} ${entry.blocks.map(blockText).join(" ")}`.toLowerCase();
    return inFolder && (!search || text.includes(search));
  });
}

function blockText(block) {
  if (block.type === "text") return block.text || "";
  if (block.type === "date") return displayDate(block.date);
  if (block.type === "audio") return block.transcriptEdited || block.transcript || "";
  if (block.type === "image") return block.caption || "";
  if (block.type === "todo" || block.type === "quote") return block.text || "";
  return "";
}

function render() {
  renderHome();
  renderFolders();
  renderEntries();
  renderEditor();
  renderAudioDock();
  renderIdeas();
  renderMobileView();
  renderSyncState();
}

function renderFolders() {
  el.folderNav.innerHTML = folders.map((folder) => {
    const count = folder.id === "all"
      ? state.entries.length
      : state.entries.filter((entry) => entry.folderId === folder.id).length;
    return `
      <button class="folder-button ${state.activeFolderId === folder.id ? "active" : ""}" data-folder="${folder.id}" type="button">
        <span>${icon(folder.icon)}</span>
        <strong>${escapeHtml(folder.name)}</strong>
        <small>${count}</small>
      </button>
    `;
  }).join("");
}

function renderEntries() {
  const entries = filteredEntries();
  if (!entries.length) {
    el.entryList.innerHTML = `<div class="empty-state">没有找到日记</div>`;
    return;
  }
  el.entryList.innerHTML = entries.map((entry) => {
    const visual = entryVisual(entry);
    return `
    <div class="entry-row journal-card-row ${entry.id === state.activeEntryId ? "active" : ""}">
      <button class="entry-button" data-entry="${entry.id}" type="button">
        <span class="journal-thumb" style='${visualStyle(visual)}'>${visual.emoji || ""}</span>
        <span class="journal-copy">
          <strong>${escapeHtml(displayEntryTitle(entry))}</strong>
          <small>${entryStats(entry)} · ${compactDuration(entryAudioMs(entry))}</small>
        </span>
        <time>${relativeDay(entry.date || entry.createdAt)}</time>
      </button>
      <button class="entry-delete" data-delete-entry="${entry.id}" type="button">删除</button>
    </div>
  `;
  }).join("");
}

function previewEntry(entry) {
  return entry.blocks.map(blockText).join(" ").replace(/\s+/g, " ").trim().slice(0, 32) || "还没有内容";
}

function entryStats(entry) {
  const audio = entry.blocks.filter((block) => block.type === "audio").length;
  const images = entry.blocks.filter((block) => block.type === "image").length;
  const parts = [];
  if (audio) parts.push(`${audio}段录音`);
  if (images) parts.push(`${images}张图片`);
  return parts.join(" · ") || displayDate(entry.date);
}

function audioBlocks(entry) {
  return (entry.blocks || []).filter((block) => block.type === "audio");
}

function imageBlocks(entry) {
  return (entry.blocks || []).filter((block) => block.type === "image");
}

function entryAudioMs(entry) {
  return audioBlocks(entry).reduce((sum, block) => sum + (Number(block.durationMs) || durationTextToMs(block.duration)), 0);
}

function durationTextToMs(value = "") {
  const parts = String(value).split(":").map((part) => Number(part));
  if (parts.length !== 2 || parts.some(Number.isNaN)) return 0;
  return ((parts[0] * 60) + parts[1]) * 1000;
}

function compactDuration(ms) {
  const minutes = Math.round((ms || 0) / 60000);
  if (minutes < 60) return `${Math.max(0, minutes)}分钟`;
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours}小时`;
}

function entryVisual(entry) {
  const image = imageBlocks(entry)[0];
  if (image?.src) return { type: "image", value: image.src, emoji: "" };
  const text = `${displayEntryTitle(entry)} ${entry.blocks.map(blockText).join(" ")}`;
  const rules = [
    [/钢琴|练琴|琴/, ["🎹", "linear-gradient(135deg, #322d27 0%, #8f7a5d 52%, #f3dfb7 100%)"]],
    [/植物|花|树|公园/, ["🌿", "linear-gradient(135deg, #dcefe3 0%, #7fbc91 52%, #f7f2da 100%)"]],
    [/咖啡|拿铁|奶茶/, ["☕", "linear-gradient(135deg, #f4dfc7 0%, #b5875f 58%, #fff8e9 100%)"]],
    [/深圳|城市|上班|通勤/, ["☁️", "linear-gradient(135deg, #d9eef8 0%, #7fb5d3 54%, #f5d7c8 100%)"]],
    [/旅行|旅游|出发|酒店|机场/, ["🗺️", "linear-gradient(135deg, #e5f0de 0%, #9cc8b4 45%, #f0cfa5 100%)"]],
    [/吃|饭|菜|酱牛肉|美食/, ["🍲", "linear-gradient(135deg, #fff1d9 0%, #d99a62 55%, #7d4632 100%)"]]
  ];
  const matched = rules.find(([pattern]) => pattern.test(text));
  if (matched) return { type: "generated", emoji: matched[1][0], value: matched[1][1] };
  const gradients = [
    "linear-gradient(135deg, #e7f4ed 0%, #9fdbbe 52%, #fffdf8 100%)",
    "linear-gradient(135deg, #f7eadf 0%, #d7bda4 52%, #fffefa 100%)",
    "linear-gradient(135deg, #e8f1ef 0%, #b7d5cb 45%, #f3d6c6 100%)"
  ];
  return { type: "generated", emoji: "🌱", value: gradients[Math.abs(entry.id.length + (entry.title || "").length) % gradients.length] };
}

function visualStyle(visual) {
  if (visual.type === "image") return `background-image: linear-gradient(180deg, rgba(0,0,0,.05), rgba(0,0,0,.45)), url("${visual.value}")`;
  return `background-image: ${visual.value}`;
}

function renderHome() {
  if (!el.homeRecentCards || !el.homeTimeline || !el.homeMonthStats) return;
  const hour = new Date().getHours();
  const greeting = hour < 11 ? "早上好" : hour < 18 ? "下午好" : "晚上好";
  el.homeGreeting.textContent = `${greeting}，晓燕 ✨`;
  const entries = [...state.entries].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  el.homeRecentCards.innerHTML = entries.slice(0, 8).map((entry) => {
    const visual = entryVisual(entry);
    const audioCount = audioBlocks(entry).length;
    return `
      <button class="memory-card" type="button" data-entry-card="${entry.id}" style='${visualStyle(visual)}'>
        ${visual.emoji ? `<span class="memory-emoji">${visual.emoji}</span>` : ""}
        <span class="memory-title">${escapeHtml(displayEntryTitle(entry))}</span>
        <span class="memory-meta">${audioCount}段录音 · ${compactDuration(entryAudioMs(entry))}</span>
        <time>${escapeHtml(displayDate(entry.date))}</time>
      </button>
    `;
  }).join("") || `<div class="empty-state">还没有记录。先留下今天的第一段声音。</div>`;

  const month = todayISO().slice(0, 7);
  const monthEntries = state.entries.filter((entry) => String(entry.date || "").startsWith(month));
  const days = new Set(monthEntries.map((entry) => entry.date)).size;
  const audios = monthEntries.reduce((sum, entry) => sum + audioBlocks(entry).length, 0);
  const photos = monthEntries.reduce((sum, entry) => sum + imageBlocks(entry).length, 0);
  const audioMs = monthEntries.reduce((sum, entry) => sum + entryAudioMs(entry), 0);
  el.homeMonthStats.innerHTML = `
    <div class="month-jar" aria-hidden="true">
      <span class="jar-lid"></span>
      <span class="jar-glass">
        <i class="jar-plant"></i>
        <i class="jar-photo"></i>
        <i class="jar-note"></i>
      </span>
    </div>
    <div>
      <h2>你在这个月留下了 🌱</h2>
      <div class="month-grid">
        <span><strong>${days}</strong><small>记录天数</small></span>
        <span><strong>${audios}</strong><small>段声音</small></span>
        <span><strong>${photos}</strong><small>张照片</small></span>
        <span><strong>${Math.round((audioMs / 3600000) * 10) / 10}</strong><small>小时声音</small></span>
      </div>
      <p>每一次记录，都是生活送给未来自己的礼物。</p>
    </div>
  `;

  el.homeTimeline.innerHTML = entries.slice(0, 12).map((entry) => {
    const visual = entryVisual(entry);
    const audioCount = audioBlocks(entry).length;
    const images = imageBlocks(entry).length;
    return `
      <article class="timeline-item">
        <div class="timeline-date"><b>${escapeHtml(displayDate(entry.date))}</b><small>${escapeHtml(new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(new Date(`${entry.date}T00:00:00`)))}</small></div>
        <button class="timeline-thumb" type="button" data-entry-card="${entry.id}" style='${visualStyle(visual)}'>${visual.emoji || ""}</button>
        <button class="timeline-copy" type="button" data-entry-card="${entry.id}">
          <strong>${escapeHtml(displayEntryTitle(entry))}</strong>
          <span>🎙 ${audioCount}段 · 📷 ${images}张 · ⏱ ${compactDuration(entryAudioMs(entry))}</span>
        </button>
        <button class="timeline-play" type="button" data-play-entry="${entry.id}" aria-label="播放">${icon("play")}</button>
      </article>
    `;
  }).join("") || `<div class="empty-state">时间轴会在你记录后出现。</div>`;
  hydrateIcons(el.homeTimeline);
}

function coverBackground(entry) {
  if (entry.coverImage) {
    return `linear-gradient(180deg, rgba(22, 42, 30, 0.16), rgba(22, 42, 30, 0.26)), url("${entry.coverImage}")`;
  }
  return coverPresets[entry.coverPreset || "forest"] || "";
}

function renderEditor() {
  const entry = activeEntry();
  if (!entry) return;
  el.titleInput.value = displayEntryTitle(entry);
  if (el.editorMeta) {
    const date = new Date(`${entry.date || todayISO()}T00:00:00`);
    const dateText = new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", weekday: "short" }).format(date);
    el.editorMeta.textContent = `${dateText} · ${formatTime(entry.updatedAt || entry.createdAt || nowISO())}`;
  }
  el.subtitleInput.value = entry.subtitle || "";
  el.subtitleInput.classList.toggle("hidden-subtitle", !entry.subtitle);
  const background = coverBackground(entry);
  document.documentElement.style.setProperty("--journal-bg", background);
  el.coverArea.style.backgroundImage = background;
  if (el.insertDateTopBtn) {
    el.insertDateTopBtn.innerHTML = `${icon("calendar")} ${escapeHtml(displayDate(entry.date || todayISO()))}`;
  }
  el.blockList.innerHTML = entry.blocks.map(renderBlock).join("");
  attachAudioListeners();
  hydrateIcons(el.blockList);
}

function renderBlock(block) {
  const menu = `<div class="block-menu"><button data-delete-block="${block.id}" type="button" aria-label="删除块">${icon("more")}</button></div>`;
  if (block.type === "date") {
    return `<section class="block" data-block="${block.id}"><button class="date-block" data-edit-date="${block.id}" type="button">${icon("calendar")} ${escapeHtml(displayDate(block.date))}</button>${menu}</section>`;
  }
  if (block.type === "divider") {
    return `<section class="block divider-block" data-block="${block.id}"><div class="divider-cards"><span></span><span></span></div>${menu}</section>`;
  }
  if (block.type === "todo") {
    return `<section class="block todo-block" data-block="${block.id}"><label><input type="checkbox" ${block.checked ? "checked" : ""} data-todo-check="${block.id}" /><span contenteditable="true" data-text-block="${block.id}">${escapeHtml(block.text || "")}</span></label>${menu}</section>`;
  }
  if (block.type === "quote") {
    return `<section class="block quote-block" data-block="${block.id}"><blockquote contenteditable="true" data-text-block="${block.id}">${escapeHtml(block.text || "引用一段文字")}</blockquote>${menu}</section>`;
  }
  if (block.type === "image") {
    return `
      <section class="block image-block" data-block="${block.id}">
        <img src="${block.src}" alt="${escapeHtml(block.caption || "日记图片")}" />
        <div class="image-caption" contenteditable="true" data-caption="${block.id}">${escapeHtml(block.caption || "添加图片说明")}</div>
        ${menu}
      </section>
    `;
  }
  if (block.type === "audio") {
    return renderAudioBlock(block, menu);
  }
  return `
    <section class="block" data-block="${block.id}">
      <div class="text-block" contenteditable="true" data-text-block="${block.id}">${escapeHtml(block.text || "")}</div>
      ${menu}
    </section>
  `;
}

function renderAudioBlock(block, menu) {
  const status = block.status || (block.audioDataUrl ? "done" : "idle");
  const duration = status === "recording" ? currentRecordingDuration() : formatDurationFromBlock(block);
  if (status === "recording" || status === "paused") {
    return `
      <section class="block audio-block voice-block ${status}" data-block="${block.id}">
        <div class="audio-top">
          <div class="audio-title"><span class="audio-icon">${icon("mic")}</span><span class="voice-status"><span class="recording-dot"></span>${status === "paused" ? "暂停记录中" : "正在录音"} ${escapeHtml(duration)}</span></div>
          <span class="audio-meta">${escapeHtml(block.createdAt ? formatTime(block.createdAt) : "")}</span>
        </div>
        <div class="waveform">${Array.from({ length: 34 }, () => "<span></span>").join("")}</div>
        <div class="transcript"><strong>正在听你说……</strong><br>${escapeHtml(block.transcript || state.liveTranscript || "")}</div>
        <div class="voice-actions">
          ${status === "paused" ? `<button class="primary-voice-action" type="button" data-resume-recording="${block.id}">继续说</button>` : `<button type="button" data-pause-recording="${block.id}">暂停一下</button>`}
          <button class="primary-voice-action" type="button" data-finish-recording="${block.id}">结束并保存</button>
        </div>
        ${menu}
      </section>
    `;
  }

  if (status === "idle") {
    return `
      <section class="block audio-block voice-block" data-block="${block.id}">
        <div class="audio-top">
          <div class="audio-title"><span class="audio-icon">${icon("mic")}</span><span>声音片段 · 00:00</span></div>
        </div>
        <div class="transcript">准备好了，慢慢说。</div>
        <div class="voice-actions"><button class="primary-voice-action" type="button" data-start-recording="${block.id}">开始说话</button></div>
        ${menu}
      </section>
    `;
  }

  return `
    <section class="block audio-block voice-block" data-block="${block.id}">
      <div class="audio-top">
        <div class="audio-title"><span class="audio-icon">${icon("mic")}</span><span>声音片段 · ${escapeHtml(formatDurationFromBlock(block))}</span></div>
        <span class="audio-meta">${escapeHtml(block.createdAt ? formatTime(block.createdAt) : "")}</span>
      </div>
      ${renderPlayer(block)}
      <div class="transcript"><strong>转写文字：</strong><br>${escapeHtml(block.transcriptEdited || block.transcript || "这段录音暂时没有转写文字。")}</div>
      <div class="voice-actions">
        <button type="button" data-copy-transcript="${block.id}">复制转写</button>
        <button type="button" data-organize-transcript="${block.id}">整理成日记</button>
      </div>
      ${block.audioId || block.audioDataUrl ? `<audio class="sr-audio" preload="metadata" playsinline data-audio="${block.id}" data-audio-id="${escapeHtml(block.audioId || "")}" ${block.audioDataUrl ? `src="${block.audioDataUrl}"` : ""}></audio>` : `<div class="playback-error">这段录音没有可播放文件。</div>`}
      ${menu}
    </section>
  `;
}

function renderPlayer(block) {
  const duration = formatDurationFromBlock(block);
  return `
    <div class="custom-player" data-player="${block.id}">
      <button class="play-button" type="button" data-play-audio="${block.id}" aria-label="播放">${icon(state.playingBlockId === block.id ? "pause" : "play")}</button>
      <span class="player-time" data-current-time="${block.id}">00:00</span>
      <input class="progress" data-progress="${block.id}" type="range" min="0" max="${Math.max(1, Math.round((block.durationMs || 0) / 1000))}" value="0" />
      <span class="player-time">${escapeHtml(duration)}</span>
    </div>
  `;
}

function renderAudioDock() {
  const entry = activeEntry();
  const audioBlocks = (entry?.blocks || []).filter((block) => block.type === "audio");
  el.audioCount.textContent = audioBlocks.length;
  if (!audioBlocks.length) {
    el.audioMiniList.innerHTML = `<div class="empty-state">还没有声音片段</div>`;
    return;
  }
  el.audioMiniList.innerHTML = audioBlocks.map((block) => `
    <div class="mini-audio">
      <b>${icon("play")}</b>
      <span>${escapeHtml(block.transcript || "未转写")}</span>
      <time>${escapeHtml(block.duration || "00:00")}</time>
    </div>
  `).join("");
  hydrateIcons(el.audioMiniList);
}

function renderIdeas() {
  if (!el.ideaList) return;
  if (!state.ideas.length) {
    el.ideaList.innerHTML = `<div class="empty-state">还没有灵感。想到一句话就先丢在这里。</div>`;
    return;
  }
  el.ideaList.innerHTML = state.ideas.map((idea) => `
    <article class="idea-item">
      <p>${escapeHtml(idea.content || "空灵感")}</p>
      <time>${formatTime(idea.createdAt)}</time>
      <button type="button" data-delete-idea="${idea.id}">删除</button>
    </article>
  `).join("");
}

function renderMobileView() {
  document.body.classList.toggle("is-editor-page", state.mobileTab === "editor");
  document.querySelectorAll("[data-mobile-page]").forEach((page) => {
    page.classList.toggle("active", page.dataset.mobilePage === state.mobileTab);
  });
  document.querySelectorAll("[data-mobile-tab]").forEach((button) => {
    const tab = button.dataset.mobileTab;
    button.classList.toggle("active", tab === state.mobileTab || (state.mobileTab === "editor" && tab === "diary"));
  });
}

function scrollPageTop() {
  window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
}

function renderSyncState() {
  if (!el.syncEmailInput || !el.syncStatus) return;
  el.syncEmailInput.value = state.syncEmail;
  el.syncStatus.textContent = state.syncEmail
    ? `已保存邮箱：${state.syncEmail}。下一步接入云端同步后，这个邮箱会用于电脑和手机互通。`
    : "未登录。当前数据仍保存在本机。";
  renderCoverLibrary();
}

function renderCoverLibrary() {
  if (!el.coverLibraryStatus || !el.coverLibraryList) return;
  el.coverLibraryStatus.textContent = state.coverImages.length
    ? `已保存 ${state.coverImages.length} 张备用封面。新建日记会自动轮换使用。`
    : "还没有备用封面。";
  el.coverLibraryList.innerHTML = state.coverImages.map((image) => `
    <figure>
      <img src="${image.src}" alt="${escapeHtml(image.name || "备用封面")}" />
      <button type="button" data-delete-cover-image="${image.id}" aria-label="删除封面图">${icon("close")}</button>
    </figure>
  `).join("");
  hydrateIcons(el.coverLibraryList);
}

function currentRecordingDuration() {
  if (!state.recordingStartedAt) return "00:00";
  const liveMs = state.recordingStartedAt ? Date.now() - state.recordingStartedAt : 0;
  return formatDuration(state.elapsedBeforePause + liveMs);
}

function formatDurationFromBlock(block) {
  if (typeof block.durationMs === "number") return formatDuration(block.durationMs);
  return block.duration || "00:00";
}

function setAudioButtonState(blockId, isPlaying) {
  const button = el.blockList.querySelector(`[data-play-audio="${blockId}"]`);
  if (button) button.innerHTML = icon(isPlaying ? "pause" : "play");
}

function attachAudioListeners() {
  el.blockList.querySelectorAll("[data-audio]").forEach((audio) => {
    const blockId = audio.dataset.audio;
    const progress = el.blockList.querySelector(`[data-progress="${blockId}"]`);
    const current = el.blockList.querySelector(`[data-current-time="${blockId}"]`);
    const block = activeEntry()?.blocks.find((item) => item.id === blockId);
    audio.muted = false;
    audio.volume = 1;
    ensureAudioSource(audio, block).catch(() => showPlaybackError(blockId, "录音文件读取失败，请重新录一段。"));
    audio.addEventListener("loadedmetadata", () => {
      if (progress && Number.isFinite(audio.duration)) progress.max = Math.max(1, Math.round(audio.duration));
      syncBlockDurationFromAudio(blockId, audio.duration);
    });
    audio.addEventListener("timeupdate", () => {
      if (progress) progress.value = Math.round(audio.currentTime);
      if (current) current.textContent = formatDuration(audio.currentTime * 1000);
    });
    audio.addEventListener("ended", () => {
      state.playingBlockId = null;
      setAudioButtonState(blockId, false);
    });
  });
}

function hasAudioSource(audio) {
  const source = audio.getAttribute("src");
  return Boolean(source && source !== window.location.href);
}

async function ensureAudioSource(audio, block) {
  if (!audio || !block) return false;
  if (hasAudioSource(audio)) return true;
  if (block.audioDataUrl) {
    audio.src = block.audioDataUrl;
    audio.load();
    return true;
  }
  if (!block.audioId) return false;
  await hydrateAudioSource(audio, block);
  return hasAudioSource(audio);
}

function syncBlockDurationFromAudio(blockId, durationSeconds) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return;
  const entry = activeEntry();
  const block = entry?.blocks.find((item) => item.id === blockId);
  if (!block) return;
  const actualMs = Math.round(durationSeconds * 1000);
  if (Math.abs((block.durationMs || 0) - actualMs) < 900) return;
  block.durationMs = actualMs;
  block.duration = formatDuration(actualMs);
  touchEntry(entry);
  queueSave();
  const total = el.blockList.querySelector(`[data-player="${blockId}"] .player-time:last-child`);
  const progress = el.blockList.querySelector(`[data-progress="${blockId}"]`);
  if (total) total.textContent = block.duration;
  if (progress) progress.max = Math.max(1, Math.round(durationSeconds));
}

async function hydrateAudioSource(audio, block) {
  if (!block.audioId) return;
  if (state.audioUrls.has(block.audioId)) {
    audio.src = state.audioUrls.get(block.audioId);
    audio.load();
    return;
  }
  const record = await getAudioRecord(block.audioId);
  if (!record?.blob) return;
  const url = URL.createObjectURL(record.blob);
  state.audioUrls.set(block.audioId, url);
  audio.src = url;
  audio.load();
}

function showPlaybackError(blockId, message) {
  const blockEl = el.blockList.querySelector(`[data-block="${blockId}"]`);
  if (!blockEl) return;
  let node = blockEl.querySelector(".playback-error");
  if (!node) {
    node = document.createElement("div");
    node.className = "playback-error";
    blockEl.querySelector(".custom-player")?.after(node);
  }
  node.textContent = message;
}

function setActiveBlock(blockId) {
  state.activeBlockId = blockId;
}

function insertBlock(type, payload = {}) {
  const entry = activeEntry();
  if (!entry) return null;
  const block = createBlock(type, payload);
  const index = entry.blocks.findIndex((item) => item.id === state.activeBlockId);
  entry.blocks.splice(index >= 0 ? index + 1 : entry.blocks.length, 0, block);
  state.activeBlockId = block.id;
  touchEntry(entry);
  render();
  focusBlock(block.id);
  return block;
}

function insertBlockAfter(blockId, type, payload = {}) {
  const entry = activeEntry();
  if (!entry) return null;
  const block = createBlock(type, payload);
  const index = entry.blocks.findIndex((item) => item.id === blockId);
  entry.blocks.splice(index >= 0 ? index + 1 : entry.blocks.length, 0, block);
  state.activeBlockId = block.id;
  touchEntry(entry);
  render();
  focusBlock(block.id);
  return block;
}

function convertBlockToText(blockId) {
  const entry = activeEntry();
  const block = entry?.blocks.find((item) => item.id === blockId);
  if (!entry || !block) return;
  block.type = "text";
  block.text = block.text || "";
  delete block.checked;
  touchEntry(entry);
  render();
  focusBlock(blockId);
}

function createBlock(type, payload = {}) {
  if (type === "date") return { id: uid("block"), type, date: payload.date || todayISO() };
  if (type === "image") return { id: uid("block"), type, src: payload.src, caption: payload.caption || "" };
  if (type === "audio") return { id: uid("block"), type, status: payload.status || "idle", duration: "00:00", durationMs: 0, transcript: "", transcriptEdited: "", audioDataUrl: "", createdAt: nowISO() };
  if (type === "divider") return { id: uid("block"), type };
  if (type === "todo") return { id: uid("block"), type, text: payload.text || "", checked: false };
  if (type === "quote") return { id: uid("block"), type, text: payload.text || "引用一段文字" };
  return { id: uid("block"), type: "text", text: payload.text || "" };
}

function focusBlock(blockId) {
  window.requestAnimationFrame(() => {
    const text = el.blockList.querySelector(`[data-text-block="${blockId}"]`);
    if (text) {
      text.focus();
      placeCaretAtEnd(text);
    }
  });
}

function placeCaretAtEnd(node) {
  const range = document.createRange();
  range.selectNodeContents(node);
  range.collapse(false);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

function updateBlock(blockId, patch) {
  const entry = activeEntry();
  const block = entry?.blocks.find((item) => item.id === blockId);
  if (!entry || !block) return;
  Object.assign(block, patch);
  touchEntry(entry);
  queueSave();
}

function maybeHandleDividerShortcut(blockId, text) {
  if (text.trim() !== "===") return false;
  const entry = activeEntry();
  const index = entry?.blocks.findIndex((block) => block.id === blockId);
  if (!entry || index < 0) return false;
  entry.blocks[index] = { id: blockId, type: "divider" };
  const next = createBlock("text", { text: "" });
  entry.blocks.splice(index + 1, 0, next);
  state.activeBlockId = next.id;
  touchEntry(entry);
  render();
  focusBlock(next.id);
  return true;
}

async function deleteBlock(blockId) {
  const entry = activeEntry();
  if (!entry) return;
  if (entry.blocks.length <= 1) return;
  const block = entry.blocks.find((item) => item.id === blockId);
  if (block?.type === "audio") await deleteAudioRecord(block.audioId);
  entry.blocks = entry.blocks.filter((block) => block.id !== blockId);
  if (state.activeBlockId === blockId) state.activeBlockId = entry.blocks[0]?.id || null;
  touchEntry(entry);
  render();
  queueSave();
}

function deleteBlockFromKeyboard(blockId) {
  const entry = activeEntry();
  if (!entry || entry.blocks.length <= 1) return false;
  const index = entry.blocks.findIndex((item) => item.id === blockId);
  if (index < 0) return false;
  const block = entry.blocks[index];
  if (block.type === "audio" && block.audioId) {
    deleteAudioRecord(block.audioId).catch(() => {});
  }
  entry.blocks.splice(index, 1);
  const focusTarget = entry.blocks[Math.max(0, index - 1)] || entry.blocks[0];
  state.activeBlockId = focusTarget?.id || null;
  touchEntry(entry);
  render();
  if (focusTarget?.type === "text" || focusTarget?.type === "todo" || focusTarget?.type === "quote") {
    focusBlock(focusTarget.id);
  }
  queueSave();
  return true;
}

async function deleteEntry(entryId) {
  const entry = state.entries.find((item) => item.id === entryId);
  if (!entry) return;
  const confirmed = confirm("删除这篇日记？\n删除后无法恢复。");
  if (!confirmed) return;
  await Promise.all(entry.blocks.filter((block) => block.type === "audio").map((block) => deleteAudioRecord(block.audioId)));
  await deleteEntryRecord(entryId);
  state.entries = state.entries.filter((item) => item.id !== entryId);
  if (state.activeEntryId === entryId) {
    state.activeEntryId = state.entries[0]?.id || null;
    state.mobileTab = "diary";
  }
  if (!state.entries.length) {
    const fresh = createEntry();
    state.entries.unshift(fresh);
    state.activeEntryId = fresh.id;
    await putEntry(fresh);
  }
  render();
}

function touchEntry(entry) {
  entry.updatedAt = nowISO();
  if (el.editorSaveStatus) el.editorSaveStatus.textContent = "保存中";
  queueSave();
}

function queueSave() {
  window.clearTimeout(state.saveTimer);
  el.saveStatus.textContent = "正在自动保存...";
  state.saveTimer = window.setTimeout(saveActiveEntry, 260);
}

async function saveActiveEntry() {
  const entry = activeEntry();
  if (!entry) return;
  await putEntry(entry);
  state.entries = state.entries.map((item) => item.id === entry.id ? entry : item).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  el.saveStatus.textContent = `已自动保存 ${formatTime(new Date())}`;
  if (el.editorSaveStatus) el.editorSaveStatus.textContent = "已保存";
  renderHome();
  renderEntries();
}

function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    el.speechStatus.textContent = "浏览器不支持实时转写";
    return null;
  }
  const recognition = new SpeechRecognition();
  recognition.lang = "zh-CN";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.onresult = (event) => {
    let text = "";
    for (let index = 0; index < event.results.length; index += 1) {
      text += event.results[index][0].transcript;
    }
    state.liveTranscript = text.trim();
    el.liveTranscript.textContent = state.liveTranscript || "正在听...";
    if (state.recordingBlockId) updateBlock(state.recordingBlockId, { transcript: state.liveTranscript });
    const transcriptEl = el.blockList.querySelector(`[data-block="${state.recordingBlockId}"] .transcript`);
    if (transcriptEl) transcriptEl.innerHTML = `<strong>正在听你说……</strong><br>${escapeHtml(state.liveTranscript)}`;
    renderAudioDock();
  };
  recognition.onerror = () => {
    el.speechStatus.textContent = "实时转写中断，录音仍会保存";
  };
  return recognition;
}

async function toggleRecording() {
  if (state.recorder?.state === "recording") {
    finishRecording();
    return;
  }
  await startRecording();
}

async function startRecording(blockId = null) {
  const block = blockId ? activeEntry()?.blocks.find((item) => item.id === blockId) : insertBlock("audio", { status: "recording" });
  if (!block) return;
  state.recordingBlockId = block.id;
  state.chunks = [];
  state.liveTranscript = "";
  state.recordingStartedAt = Date.now();
  state.elapsedBeforePause = block.durationMs || 0;
  updateBlock(block.id, { status: "recording", transcript: block.transcript || "", createdAt: block.createdAt || nowISO() });
  try {
    state.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (error) {
    updateBlock(block.id, { status: "idle", durationMs: 0, duration: "00:00" });
    state.recordingBlockId = null;
    state.recordingStartedAt = 0;
    state.elapsedBeforePause = 0;
    render();
    throw error;
  }
  const mimeType = pickMimeType();
  state.recordingMimeType = mimeType;
  state.recorder = new MediaRecorder(state.mediaStream, mimeType ? { mimeType } : undefined);
  state.recorder.ondataavailable = (event) => {
    if (event.data?.size) state.chunks.push(event.data);
  };
  state.recorder.onstop = finalizeRecording;
  state.recorder.start(500);
  try {
    state.recognition?.start();
  } catch {
    // Recognition can throw when already started; recording should continue.
  }
  el.recordBtn.classList.add("recording");
  el.recordBtn.innerHTML = `${icon("mic")} 结束并保存`;
  el.speechStatus.textContent = "正在录音";
  el.liveTranscript.textContent = "正在听你说……";
  state.timerId = window.setInterval(() => {
    const blockEl = el.blockList.querySelector(`[data-block="${state.recordingBlockId}"] .voice-status`);
    if (blockEl) blockEl.innerHTML = `<span class="recording-dot"></span>正在录音 ${currentRecordingDuration()}`;
  }, 500);
}

function pauseRecording() {
  if (state.recorder?.state !== "recording") return;
  state.recorder.pause();
  state.elapsedBeforePause += Date.now() - state.recordingStartedAt;
  state.recordingStartedAt = 0;
  window.clearInterval(state.timerId);
  try {
    state.recognition?.stop();
  } catch {
    // Ignore speech API stop races.
  }
  updateBlock(state.recordingBlockId, { status: "paused", durationMs: state.elapsedBeforePause, duration: formatDuration(state.elapsedBeforePause), transcript: state.liveTranscript || "" });
  render();
}

function resumeRecording() {
  if (state.recorder?.state !== "paused") return;
  state.recorder.resume();
  state.recordingStartedAt = Date.now();
  updateBlock(state.recordingBlockId, { status: "recording" });
  try {
    state.recognition?.start();
  } catch {
    // Recognition may already be active.
  }
  render();
  state.timerId = window.setInterval(() => {
    const blockEl = el.blockList.querySelector(`[data-block="${state.recordingBlockId}"] .voice-status`);
    if (blockEl) blockEl.innerHTML = `<span class="recording-dot"></span>正在录音 ${currentRecordingDuration()}`;
  }, 500);
}

async function finishRecording() {
  window.clearInterval(state.timerId);
  try {
    state.recognition?.stop();
  } catch {
    // Ignore speech API stop races.
  }
  if (state.recordingStartedAt) {
    state.elapsedBeforePause += Date.now() - state.recordingStartedAt;
  }
  if (state.recorder?.state === "recording" || state.recorder?.state === "paused") {
    try {
      state.recorder.requestData();
    } catch {
      // Some browsers do not allow manual data requests in every state.
    }
    state.recorder.stop();
    return;
  }
}

async function finalizeRecording() {
  const durationMs = state.elapsedBeforePause;
  const duration = formatDuration(durationMs);
  const mimeType = state.recordingMimeType || state.chunks[0]?.type || "audio/mp4";
  const blob = new Blob(state.chunks, { type: mimeType });
  if (!blob.size || blob.size < 128) {
    updateBlock(state.recordingBlockId, {
      duration,
      durationMs,
      transcript: state.liveTranscript || "",
      status: "idle"
    });
    cleanupRecordingState("录音文件为空，请重新录一次");
    render();
    return;
  }
  let audioId = uid("audio");
  let audioDataUrl = "";
  try {
    await putAudioRecord({ id: audioId, blob, mimeType, size: blob.size, createdAt: nowISO() });
  } catch {
    audioId = "";
  }
  try {
    audioDataUrl = await blobToDataUrl(blob);
  } catch {
    audioDataUrl = "";
  }
  updateBlock(state.recordingBlockId, {
    audioId,
    audioDataUrl,
    mimeType,
    blobSize: blob.size,
    duration,
    durationMs,
    transcript: state.liveTranscript || "",
    createdAt: nowISO(),
    status: "done"
  });
  cleanupRecordingState("准备就绪");
  el.liveTranscript.textContent = state.liveTranscript || "录音已保存。";
  render();
  await saveActiveEntry();
}

function cleanupRecordingState(statusText = "准备就绪") {
  state.mediaStream?.getTracks().forEach((track) => track.stop());
  state.recorder = null;
  state.mediaStream = null;
  state.recordingBlockId = null;
  state.chunks = [];
  state.recordingMimeType = "";
  state.recordingStartedAt = 0;
  state.elapsedBeforePause = 0;
  el.recordBtn.classList.remove("recording");
  el.recordBtn.innerHTML = `${icon("mic")} 开始说话`;
  el.speechStatus.textContent = statusText;
}

function pickMimeType() {
  const types = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function handleImageFile(file) {
  if (!file) return;
  const src = await blobToDataUrl(file);
  insertBlock("image", { src, caption: file.name });
}

async function handleCoverFile(file) {
  if (!file) return;
  const entry = activeEntry();
  if (!entry) return;
  entry.coverImage = await blobToDataUrl(file);
  entry.coverPreset = "custom";
  touchEntry(entry);
  renderEditor();
}

async function handleCoverLibraryFiles(files) {
  const selected = Array.from(files || []).filter((file) => file.type.startsWith("image/"));
  if (!selected.length) return;
  const records = [];
  for (const file of selected) {
    const src = await blobToDataUrl(file);
    const record = { id: uid("cover"), src, name: file.name, createdAt: nowISO() };
    await putCoverImage(record);
    records.push(record);
  }
  state.coverImages.push(...records);
  state.coverImages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  renderCoverLibrary();
}

async function deleteCoverImage(coverId) {
  await deleteCoverImageRecord(coverId);
  state.coverImages = state.coverImages.filter((image) => image.id !== coverId);
  localStorage.setItem("voiceJournalCoverRotation", "0");
  renderCoverLibrary();
}

async function clearCoverLibrary() {
  if (!state.coverImages.length) return;
  const confirmed = confirm("清空备用封面库？\n已经用在日记里的封面不会被删除。");
  if (!confirmed) return;
  await Promise.all(state.coverImages.map((image) => deleteCoverImageRecord(image.id)));
  state.coverImages = [];
  localStorage.setItem("voiceJournalCoverRotation", "0");
  renderCoverLibrary();
}

function applyCoverChoice(choice) {
  const entry = activeEntry();
  if (!entry) return;
  if (choice === "upload") {
    el.coverPicker.click();
    closeInsertSheet();
    return;
  }
  if (choice === "delete" || choice === "forest") {
    entry.coverImage = "";
    entry.coverPreset = "forest";
  } else {
    entry.coverImage = "";
    entry.coverPreset = choice;
  }
  touchEntry(entry);
  renderEditor();
  closeInsertSheet();
}

async function addIdea(content) {
  const text = content.trim();
  if (!text) return;
  const now = nowISO();
  const idea = { id: uid("idea"), type: "text", content: text, createdAt: now, updatedAt: now };
  state.ideas.unshift(idea);
  await putIdea(idea);
  el.ideaInput.value = "";
  renderIdeas();
}

async function deleteIdea(ideaId) {
  const confirmed = confirm("删除这条灵感？");
  if (!confirmed) return;
  await deleteIdeaRecord(ideaId);
  state.ideas = state.ideas.filter((idea) => idea.id !== ideaId);
  renderIdeas();
}

function enterEditing() {
  state.editing = true;
  document.body.classList.add("editing");
  updateKeyboardOffset();
}

function exitEditing() {
  if (state.sheetOpen) return;
  state.editing = false;
  document.body.classList.remove("editing");
  cleanupEmptyTextBlocks();
  queueSave();
}

function cleanupEmptyTextBlocks() {
  const entry = activeEntry();
  if (!entry) return;
  const originalLength = entry.blocks.length;
  entry.blocks = entry.blocks.filter((block) => {
    if (block.type !== "text") return true;
    if (String(block.text || "").trim()) return true;
    return originalLength <= 1;
  });
  if (entry.blocks.length === originalLength) return;
  if (!entry.blocks.some((block) => block.id === state.activeBlockId)) {
    state.activeBlockId = entry.blocks[entry.blocks.length - 1]?.id || null;
  }
  touchEntry(entry);
  render();
}

function updateKeyboardOffset() {
  if (!window.visualViewport) return;
  const offset = Math.max(0, window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop);
  document.documentElement.style.setProperty("--keyboard-offset", `${offset}px`);
}

function openInsertSheet() {
  state.sheetOpen = true;
  state.sheetType = "insert";
  el.sheetBackdrop.hidden = false;
  el.insertSheet.hidden = false;
  el.dateSheet.hidden = true;
  el.coverSheet.hidden = true;
}

function closeInsertSheet() {
  state.sheetOpen = false;
  state.sheetType = "";
  el.sheetBackdrop.hidden = true;
  el.insertSheet.hidden = true;
  el.dateSheet.hidden = true;
  el.coverSheet.hidden = true;
}

function openDateSheet(blockId = null) {
  state.sheetOpen = true;
  state.sheetType = "date";
  state.dateEditingBlockId = blockId;
  el.sheetBackdrop.hidden = false;
  el.dateSheet.hidden = false;
  el.datePickerInput.value = activeEntry()?.blocks.find((block) => block.id === blockId)?.date || todayISO();
}

function openCoverSheet() {
  state.sheetOpen = true;
  state.sheetType = "cover";
  el.sheetBackdrop.hidden = false;
  el.coverSheet.hidden = false;
}

function handleInsert(type, options = {}) {
  if (type === "image") {
    el.imagePicker.click();
    return;
  }
  if (type === "audio-start") {
    startRecording().catch(() => {
      el.speechStatus.textContent = "无法访问麦克风，请检查权限";
    });
    return;
  }
  if (type === "audio") {
    insertBlock("audio", { status: options.autoStart ? "recording" : "idle" });
    if (options.autoStart) {
      startRecording(state.activeBlockId).catch(() => {
        el.speechStatus.textContent = "无法访问麦克风，请检查权限";
      });
    }
    return;
  }
  insertBlock(type);
}

function handleSheetInsert(type) {
  closeInsertSheet();
  handleInsert(type);
  enterEditing();
}

function editDateBlock(blockId) {
  openDateSheet(blockId);
}

function setDateBlock(dateValue) {
  const blockId = state.dateEditingBlockId;
  if (!blockId) return;
  const entry = activeEntry();
  updateBlock(blockId, { date: dateValue });
  if (entry?.blocks[0]?.id === blockId) {
    entry.date = dateValue;
    if (!entry.titleEdited) entry.title = automaticTitleForDate(dateValue, state.entries.filter((item) => item.id !== entry.id));
    touchEntry(entry);
  }
  render();
}

async function toggleAudioPlayback(blockId) {
  const audio = el.blockList.querySelector(`[data-audio="${blockId}"]`);
  if (!audio) return;
  const block = activeEntry()?.blocks.find((item) => item.id === blockId);
  const ready = await ensureAudioSource(audio, block);
  if (!ready) {
    showPlaybackError(blockId, "播放失败，没有找到这段录音文件。");
    return;
  }
  audio.muted = false;
  audio.volume = 1;
  el.blockList.querySelectorAll("[data-audio]").forEach((item) => {
    if (item !== audio) {
      item.pause();
      setAudioButtonState(item.dataset.audio, false);
    }
  });
  if (audio.paused) {
    try {
      await audio.play();
      state.playingBlockId = blockId;
      setAudioButtonState(blockId, true);
    } catch {
      state.playingBlockId = null;
      setAudioButtonState(blockId, false);
      showPlaybackError(blockId, "播放失败，请重新点击或检查录音文件。");
    }
  } else {
    audio.pause();
    state.playingBlockId = null;
    setAudioButtonState(blockId, false);
  }
}

function seekAudio(blockId, seconds) {
  const audio = el.blockList.querySelector(`[data-audio="${blockId}"]`);
  if (!audio) return;
  audio.currentTime = Number(seconds) || 0;
}

function fallbackCopyText(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);
  const copied = document.execCommand("copy");
  textarea.remove();
  return copied;
}

function flashButtonLabel(button, label) {
  if (!button) return;
  const original = button.textContent;
  button.textContent = label;
  window.setTimeout(() => {
    button.textContent = original;
  }, 1400);
}

async function copyTranscript(blockId, button) {
  const block = activeEntry()?.blocks.find((item) => item.id === blockId);
  const text = block?.transcriptEdited || block?.transcript || "";
  if (!text.trim()) {
    flashButtonLabel(button, "无转写");
    return;
  }
  insertBlockAfter(blockId, "text", { text });
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else if (!fallbackCopyText(text)) {
      throw new Error("copy failed");
    }
    flashButtonLabel(button, "已插入");
  } catch (error) {
    if (fallbackCopyText(text)) {
      flashButtonLabel(button, "已插入");
      return;
    }
    flashButtonLabel(button, "已插入");
  }
}

function organizeTranscript(blockId) {
  const block = activeEntry()?.blocks.find((item) => item.id === blockId);
  const text = block?.transcriptEdited || block?.transcript || "";
  if (!text) return;
  state.activeBlockId = blockId;
  insertBlock("text", { text });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function openEntryEditor(entryId) {
  state.activeEntryId = entryId;
  state.mobileTab = "editor";
  render();
}

async function startHomeRecording() {
  const entry = await ensureTodayEntry();
  state.activeEntryId = entry.id;
  state.mobileTab = "editor";
  state.activeBlockId = entry.blocks[entry.blocks.length - 1]?.id || null;
  render();
  await startRecording();
}

function bindEvents() {
  el.newEntryBtn.addEventListener("click", async () => {
    const entry = createEntry(state.activeFolderId === "all" ? "daily" : state.activeFolderId);
    state.entries.unshift(entry);
    state.activeEntryId = entry.id;
    await putEntry(entry);
    state.mobileTab = "editor";
    render();
    el.titleInput.focus();
  });

  el.homeRecordBtn?.addEventListener("click", () => {
    startHomeRecording().catch(() => {
      el.speechStatus.textContent = "无法访问麦克风，请检查权限";
    });
  });

  el.homeSearchBtn?.addEventListener("click", () => {
    state.mobileTab = "diary";
    renderMobileView();
    window.setTimeout(() => el.searchInput?.focus(), 60);
  });

  document.querySelector(".home-page")?.addEventListener("click", (event) => {
    const entryCard = event.target.closest("[data-entry-card]");
    if (entryCard) {
      openEntryEditor(entryCard.dataset.entryCard);
      return;
    }
    const playButton = event.target.closest("[data-play-entry]");
    if (playButton) {
      const entry = state.entries.find((item) => item.id === playButton.dataset.playEntry);
      const firstAudio = audioBlocks(entry || {})[0];
      openEntryEditor(playButton.dataset.playEntry);
      if (firstAudio) window.setTimeout(() => toggleAudioPlayback(firstAudio.id), 160);
    }
  });

  el.searchInput.addEventListener("input", () => {
    state.search = el.searchInput.value;
    renderEntries();
  });

  el.folderNav.addEventListener("click", (event) => {
    const button = event.target.closest("[data-folder]");
    if (!button) return;
    state.activeFolderId = button.dataset.folder;
    render();
  });

  el.entryList.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-delete-entry]");
    if (deleteButton) {
      event.preventDefault();
      event.stopPropagation();
      deleteEntry(deleteButton.dataset.deleteEntry);
      return;
    }
    const row = event.target.closest(".entry-row");
    if (row?.classList.contains("swiped")) {
      row.classList.remove("swiped");
      return;
    }
    const button = event.target.closest("[data-entry]");
    if (!button) return;
    openEntryEditor(button.dataset.entry);
  });
  let entryTouchX = 0;
  el.entryList.addEventListener("touchstart", (event) => {
    const row = event.target.closest(".entry-row");
    if (!row) return;
    entryTouchX = event.touches[0].clientX;
  }, { passive: true });
  el.entryList.addEventListener("touchend", (event) => {
    const row = event.target.closest(".entry-row");
    if (!row) return;
    const diff = event.changedTouches[0].clientX - entryTouchX;
    document.querySelectorAll(".entry-row.swiped").forEach((item) => {
      if (item !== row) item.classList.remove("swiped");
    });
    if (diff < -36) row.classList.add("swiped");
    if (diff > 28) row.classList.remove("swiped");
  }, { passive: true });

  el.titleInput.addEventListener("input", () => {
    const entry = activeEntry();
    entry.title = el.titleInput.value;
    entry.titleEdited = true;
    touchEntry(entry);
  });
  el.titleInput.addEventListener("focus", enterEditing);

  el.subtitleInput.addEventListener("input", () => {
    const entry = activeEntry();
    entry.subtitle = el.subtitleInput.value;
    el.subtitleInput.classList.toggle("hidden-subtitle", !entry.subtitle);
    touchEntry(entry);
  });
  el.subtitleInput.addEventListener("focus", enterEditing);

  el.blockList.addEventListener("focusin", (event) => {
    const block = event.target.closest("[data-block]");
    if (block) setActiveBlock(block.dataset.block);
    enterEditing();
  });

  el.blockList.addEventListener("input", (event) => {
    const textBlock = event.target.closest("[data-text-block]");
    if (textBlock) {
      if (maybeHandleDividerShortcut(textBlock.dataset.textBlock, textBlock.textContent)) return;
      updateBlock(textBlock.dataset.textBlock, { text: textBlock.textContent });
    }
    const caption = event.target.closest("[data-caption]");
    if (caption) updateBlock(caption.dataset.caption, { caption: caption.textContent });
  });

  el.blockList.addEventListener("keydown", (event) => {
    const textBlock = event.target.closest("[data-text-block]");
    if (!textBlock) return;
    const blockId = textBlock.dataset.textBlock;
    const block = activeEntry()?.blocks.find((item) => item.id === blockId);
    if (!block) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const nextType = block.type === "todo" ? "todo" : "text";
      insertBlockAfter(blockId, nextType);
      return;
    }
    if (event.key === "Backspace" && !textBlock.textContent.trim() && block.type === "todo") {
      event.preventDefault();
      convertBlockToText(blockId);
      return;
    }
    if (event.key === "Backspace" && !textBlock.textContent.trim()) {
      event.preventDefault();
      deleteBlockFromKeyboard(blockId);
    }
  });

  el.blockList.addEventListener("click", (event) => {
    const block = event.target.closest("[data-block]");
    if (block) setActiveBlock(block.dataset.block);
    const dateButton = event.target.closest("[data-edit-date]");
    if (dateButton) {
      editDateBlock(dateButton.dataset.editDate);
      return;
    }
    const todoCheck = event.target.closest("[data-todo-check]");
    if (todoCheck) {
      updateBlock(todoCheck.dataset.todoCheck, { checked: todoCheck.checked });
      return;
    }
    const startButton = event.target.closest("[data-start-recording]");
    if (startButton) {
      startRecording(startButton.dataset.startRecording).catch(() => {
        el.speechStatus.textContent = "无法访问麦克风，请检查权限";
      });
      return;
    }
    const pauseButton = event.target.closest("[data-pause-recording]");
    if (pauseButton) {
      pauseRecording();
      return;
    }
    const resumeButton = event.target.closest("[data-resume-recording]");
    if (resumeButton) {
      resumeRecording();
      return;
    }
    const finishButton = event.target.closest("[data-finish-recording]");
    if (finishButton) {
      finishRecording();
      return;
    }
    const playButton = event.target.closest("[data-play-audio]");
    if (playButton) {
      toggleAudioPlayback(playButton.dataset.playAudio);
      return;
    }
    const copyButton = event.target.closest("[data-copy-transcript]");
    if (copyButton) {
      copyTranscript(copyButton.dataset.copyTranscript, copyButton);
      return;
    }
    const organizeButton = event.target.closest("[data-organize-transcript]");
    if (organizeButton) {
      organizeTranscript(organizeButton.dataset.organizeTranscript);
      return;
    }
    const deleteButton = event.target.closest("[data-delete-block]");
    if (!deleteButton) return;
    if (confirm("删除这个块吗？")) deleteBlock(deleteButton.dataset.deleteBlock);
  });

  el.blockList.addEventListener("input", (event) => {
    const progress = event.target.closest("[data-progress]");
    if (progress) seekAudio(progress.dataset.progress, progress.value);
  });

  document.querySelector(".floating-toolbar").addEventListener("click", (event) => {
    if (event.target.closest("[data-open-insert-menu]")) {
      openInsertSheet();
      return;
    }
    const button = event.target.closest("[data-insert]");
    if (!button) return;
    handleInsert(button.dataset.insert);
  });

  el.insertDateTopBtn?.addEventListener("click", () => {
    const entry = activeEntry();
    let block = entry?.blocks.find((item) => item.type === "date");
    if (!block) block = insertBlock("date");
    openDateSheet(block?.id);
  });
  document.querySelectorAll("[data-mobile-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.mobileTab = button.dataset.mobileTab;
      renderMobileView();
      scrollPageTop();
    });
  });
  el.imagePicker.addEventListener("change", () => handleImageFile(el.imagePicker.files[0]));
  el.coverPicker.addEventListener("change", () => handleCoverFile(el.coverPicker.files[0]));
  el.coverLibraryPicker?.addEventListener("change", () => {
    handleCoverLibraryFiles(el.coverLibraryPicker.files);
    el.coverLibraryPicker.value = "";
  });
  el.coverLibraryBtn?.addEventListener("click", () => el.coverLibraryPicker?.click());
  el.clearCoverLibraryBtn?.addEventListener("click", clearCoverLibrary);
  el.coverLibraryList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete-cover-image]");
    if (button) deleteCoverImage(button.dataset.deleteCoverImage);
  });
  el.changeCoverBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    openCoverSheet();
  });
  el.deleteEntryBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    const entry = activeEntry();
    if (entry) deleteEntry(entry.id);
  });
  el.coverArea.addEventListener("click", (event) => {
    if (event.target.closest(".cover-actions")) return;
    openCoverSheet();
  });
  el.sheetBackdrop.addEventListener("click", closeInsertSheet);
  el.insertSheet.addEventListener("click", (event) => {
    const button = event.target.closest("[data-sheet-insert]");
    if (button) handleSheetInsert(button.dataset.sheetInsert);
  });
  el.dateSheet.addEventListener("click", (event) => {
    const button = event.target.closest("[data-date-choice]");
    if (!button) return;
    const choices = {
      today: todayISO(),
      yesterday: dateOffsetISO(-1),
      "before-yesterday": dateOffsetISO(-2)
    };
    setDateBlock(choices[button.dataset.dateChoice]);
    closeInsertSheet();
  });
  el.datePickerInput.addEventListener("change", () => {
    if (!el.datePickerInput.value) return;
    setDateBlock(el.datePickerInput.value);
    closeInsertSheet();
  });
  el.coverSheet.addEventListener("click", (event) => {
    const button = event.target.closest("[data-cover-choice]");
    if (button) applyCoverChoice(button.dataset.coverChoice);
  });
  let sheetStartY = 0;
  document.querySelectorAll(".insert-sheet").forEach((sheet) => {
    sheet.addEventListener("touchstart", (event) => {
      sheetStartY = event.touches[0].clientY;
    }, { passive: true });
    sheet.addEventListener("touchend", (event) => {
      if (event.changedTouches[0].clientY - sheetStartY > 70) closeInsertSheet();
    }, { passive: true });
  });
  el.recordBtn.addEventListener("click", () => toggleRecording().catch(() => {
    el.speechStatus.textContent = "无法访问麦克风，请检查权限";
  }));
  el.addIdeaBtn?.addEventListener("click", () => addIdea(el.ideaInput.value));
  el.ideaInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") addIdea(el.ideaInput.value);
  });
  el.ideaList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete-idea]");
    if (button) deleteIdea(button.dataset.deleteIdea);
  });
  el.saveEmailBtn?.addEventListener("click", () => {
    state.syncEmail = el.syncEmailInput.value.trim();
    if (state.syncEmail) {
      localStorage.setItem("voiceJournalSyncEmail", state.syncEmail);
    } else {
      localStorage.removeItem("voiceJournalSyncEmail");
    }
    renderSyncState();
  });
  el.closeHintBtn?.addEventListener("click", () => el.closeHintBtn.closest(".hint-card").hidden = true);
  el.closeDockBtn?.addEventListener("click", () => document.querySelector(".record-dock").hidden = true);

  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "r") {
      event.preventDefault();
      toggleRecording().catch(() => {
        el.speechStatus.textContent = "无法访问麦克风，请检查权限";
      });
    }
  });
  document.addEventListener("pointerdown", (event) => {
    const insideEditor = event.target.closest(".paper") || event.target.closest(".editor-toolbar") || event.target.closest(".insert-sheet");
    if (!insideEditor) exitEditing();
  });
  window.visualViewport?.addEventListener("resize", updateKeyboardOffset);
  window.visualViewport?.addEventListener("scroll", updateKeyboardOffset);
}

async function init() {
  scrollPageTop();
  hydrateIcons();
  state.db = await openDb();
  await seedIfNeeded();
  state.recognition = setupSpeechRecognition();
  bindEvents();
  await loadData();
  scrollPageTop();
  registerServiceWorker();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js?v=40").then((registration) => registration.update()).catch(() => {});
}

init().catch((error) => {
  console.error(error);
  el.saveStatus.textContent = `初始化失败：${error.message || "请刷新重试"}`;
});
