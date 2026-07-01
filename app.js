const DB_NAME = "voice-journal-db";
const DB_VERSION = 3;

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
  editing: false,
  sheetOpen: false,
  search: "",
  activeBlockId: null,
  recorder: null,
  mediaStream: null,
  recognition: null,
  recordingBlockId: null,
  playingBlockId: null,
  elapsedBeforePause: 0,
  playbackTimers: new Map(),
  chunks: [],
  liveTranscript: "",
  recordingStartedAt: 0,
  timerId: null,
  saveTimer: null
};

const el = {
  saveStatus: document.querySelector("#saveStatus"),
  speechStatus: document.querySelector("#speechStatus"),
  newEntryBtn: document.querySelector("#newEntryBtn"),
  searchInput: document.querySelector("#searchInput"),
  folderNav: document.querySelector("#folderNav"),
  entryList: document.querySelector("#entryList"),
  titleInput: document.querySelector("#titleInput"),
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
  changeCoverBtn: document.querySelector("#changeCoverBtn"),
  resetCoverBtn: document.querySelector("#resetCoverBtn"),
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
  return new Date().toISOString().slice(0, 10);
}

function displayDate(dateText = todayISO()) {
  const date = new Date(`${dateText}T00:00:00`);
  const monthDay = new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(date);
  const weekday = new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(date);
  const diff = Math.round((new Date(todayISO()) - date) / 86400000);
  if (diff === 0) return "今天";
  if (diff === 1) return "昨天";
  return `${monthDay} ${weekday}`;
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

async function seedIfNeeded() {
  const entries = await getAll("entries");
  if (entries.length) return;
  const entry = createEntry();
  entry.title = `${new Date().getMonth() + 1}月${new Date().getDate()}日 · 碎碎念`;
  entry.subtitle = "写下今天的感受...";
  entry.blocks = [
    { id: uid("block"), type: "date", date: todayISO() },
    { id: uid("block"), type: "text", text: "从这里开始记录今天。可以插入文字、图片、日期，也可以把录音放在任意位置。" },
    { id: uid("block"), type: "audio", duration: "00:00", transcript: "声音片段会保留播放器、原始音频和实时转写文字。", createdAt: nowISO() }
  ];
  await putEntry(entry);
}

function createEntry(folderId = "daily") {
  const now = nowISO();
  return {
    id: uid("entry"),
    title: "未命名日记",
    subtitle: "",
    coverImage: "",
    folderId,
    date: todayISO(),
    blocks: [
      { id: uid("block"), type: "date", date: todayISO() },
      { id: uid("block"), type: "text", text: "" }
    ],
    createdAt: now,
    updatedAt: now
  };
}

async function loadData() {
  state.entries = (await getAll("entries")).map(normalizeEntry).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  if (!state.activeEntryId) state.activeEntryId = state.entries[0]?.id || null;
  render();
}

function normalizeEntry(entry) {
  if (Array.isArray(entry.blocks)) {
    return {
      ...entry,
      subtitle: entry.subtitle || "",
      coverImage: entry.coverImage || "",
      blocks: entry.blocks.map((block) => {
        if (block.type !== "audio") return block;
        return {
          audioDataUrl: "",
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
  return {
    ...entry,
    subtitle: entry.subtitle || "",
    coverImage: entry.coverImage || "",
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
  renderFolders();
  renderEntries();
  renderEditor();
  renderAudioDock();
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
  el.entryList.innerHTML = entries.map((entry) => `
    <button class="entry-button ${entry.id === state.activeEntryId ? "active" : ""}" data-entry="${entry.id}" type="button">
      <span>${escapeHtml(entry.title || "未命名日记")}</span>
      <time>${relativeDay(entry.date || entry.createdAt)}</time>
      <small>${escapeHtml(entry.subtitle || previewEntry(entry))}</small>
    </button>
  `).join("");
}

function previewEntry(entry) {
  return entry.blocks.map(blockText).join(" ").replace(/\s+/g, " ").trim().slice(0, 32) || "还没有内容";
}

function renderEditor() {
  const entry = activeEntry();
  if (!entry) return;
  el.titleInput.value = entry.title || "";
  el.subtitleInput.value = entry.subtitle || "";
  el.coverArea.style.backgroundImage = entry.coverImage
    ? `linear-gradient(180deg, rgba(22, 42, 30, 0.16), rgba(22, 42, 30, 0.26)), url("${entry.coverImage}")`
    : "";
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
    return `<section class="block divider-block" data-block="${block.id}"><hr />${menu}</section>`;
  }
  if (block.type === "todo") {
    return `<section class="block todo-block" data-block="${block.id}"><label><input type="checkbox" ${block.checked ? "checked" : ""} data-todo-check="${block.id}" /><span contenteditable="true" data-text-block="${block.id}">${escapeHtml(block.text || "待办事项")}</span></label>${menu}</section>`;
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
        <button type="button" class="more-button" aria-label="更多">${icon("more")}</button>
      </div>
      ${block.audioDataUrl ? `<audio class="sr-audio" preload="metadata" data-audio="${block.id}" src="${block.audioDataUrl}"></audio>` : ""}
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
      <button class="more-button" type="button" aria-label="更多">${icon("more")}</button>
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

function renderMobileView() {
  document.querySelectorAll("[data-mobile-page]").forEach((page) => {
    page.classList.toggle("active", page.dataset.mobilePage === state.mobileTab);
  });
  document.querySelectorAll("[data-mobile-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.mobileTab === state.mobileTab);
  });
}

function renderSyncState() {
  if (!el.syncEmailInput || !el.syncStatus) return;
  el.syncEmailInput.value = state.syncEmail;
  el.syncStatus.textContent = state.syncEmail
    ? `已保存邮箱：${state.syncEmail}。下一步接入云端同步后，这个邮箱会用于电脑和手机互通。`
    : "未登录。当前数据仍保存在本机。";
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
    audio.addEventListener("loadedmetadata", () => {
      if (progress && Number.isFinite(audio.duration)) progress.max = Math.max(1, Math.round(audio.duration));
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

function createBlock(type, payload = {}) {
  if (type === "date") return { id: uid("block"), type, date: payload.date || todayISO() };
  if (type === "image") return { id: uid("block"), type, src: payload.src, caption: payload.caption || "" };
  if (type === "audio") return { id: uid("block"), type, status: payload.status || "idle", duration: "00:00", durationMs: 0, transcript: "", transcriptEdited: "", audioDataUrl: "", createdAt: nowISO() };
  if (type === "divider") return { id: uid("block"), type };
  if (type === "todo") return { id: uid("block"), type, text: payload.text || "待办事项", checked: false };
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

function deleteBlock(blockId) {
  const entry = activeEntry();
  if (!entry) return;
  if (entry.blocks.length <= 1) return;
  entry.blocks = entry.blocks.filter((block) => block.id !== blockId);
  if (state.activeBlockId === blockId) state.activeBlockId = entry.blocks[0]?.id || null;
  touchEntry(entry);
  render();
  queueSave();
}

function touchEntry(entry) {
  entry.updatedAt = nowISO();
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
  state.mediaStream?.getTracks().forEach((track) => track.stop());
  if (state.recorder?.state === "recording" || state.recorder?.state === "paused") {
    state.recorder.stop();
    return;
  }
}

async function finalizeRecording() {
  const durationMs = state.elapsedBeforePause;
  const duration = formatDuration(durationMs);
  const mimeType = state.chunks[0]?.type || "audio/webm";
  const blob = new Blob(state.chunks, { type: mimeType });
  const audioDataUrl = blob.size ? await blobToDataUrl(blob) : "";
  updateBlock(state.recordingBlockId, {
    audioDataUrl,
    duration,
    durationMs,
    transcript: state.liveTranscript || "",
    createdAt: nowISO(),
    status: "done"
  });
  state.recorder = null;
  state.mediaStream = null;
  state.recordingBlockId = null;
  state.chunks = [];
  state.recordingStartedAt = 0;
  state.elapsedBeforePause = 0;
  el.recordBtn.classList.remove("recording");
  el.recordBtn.innerHTML = `${icon("mic")} 开始说话`;
  el.speechStatus.textContent = "准备就绪";
  el.liveTranscript.textContent = state.liveTranscript || "录音已保存。";
  render();
  await saveActiveEntry();
}

function pickMimeType() {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
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
  touchEntry(entry);
  renderEditor();
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
  queueSave();
}

function updateKeyboardOffset() {
  if (!window.visualViewport) return;
  const offset = Math.max(0, window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop);
  document.documentElement.style.setProperty("--keyboard-offset", `${offset}px`);
}

function openInsertSheet() {
  state.sheetOpen = true;
  el.sheetBackdrop.hidden = false;
  el.insertSheet.hidden = false;
}

function closeInsertSheet() {
  state.sheetOpen = false;
  el.sheetBackdrop.hidden = true;
  el.insertSheet.hidden = true;
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
  const entry = activeEntry();
  const block = entry?.blocks.find((item) => item.id === blockId);
  if (!block) return;
  const value = prompt("修改日期，格式 YYYY-MM-DD", block.date || todayISO());
  if (!value) return;
  updateBlock(blockId, { date: value.trim() });
  render();
}

async function toggleAudioPlayback(blockId) {
  const audio = el.blockList.querySelector(`[data-audio="${blockId}"]`);
  if (!audio) return;
  el.blockList.querySelectorAll("[data-audio]").forEach((item) => {
    if (item !== audio) {
      item.pause();
      setAudioButtonState(item.dataset.audio, false);
    }
  });
  if (audio.paused) {
    await audio.play();
    state.playingBlockId = blockId;
    setAudioButtonState(blockId, true);
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

async function copyTranscript(blockId) {
  const block = activeEntry()?.blocks.find((item) => item.id === blockId);
  const text = block?.transcriptEdited || block?.transcript || "";
  if (text) await navigator.clipboard.writeText(text);
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

function bindEvents() {
  el.newEntryBtn.addEventListener("click", async () => {
    const entry = createEntry(state.activeFolderId === "all" ? "daily" : state.activeFolderId);
    state.entries.unshift(entry);
    state.activeEntryId = entry.id;
    await putEntry(entry);
    state.mobileTab = "today";
    render();
    el.titleInput.focus();
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
    const button = event.target.closest("[data-entry]");
    if (!button) return;
    state.activeEntryId = button.dataset.entry;
    state.mobileTab = "today";
    render();
  });

  el.titleInput.addEventListener("input", () => {
    const entry = activeEntry();
    entry.title = el.titleInput.value;
    touchEntry(entry);
  });
  el.titleInput.addEventListener("focus", enterEditing);

  el.subtitleInput.addEventListener("input", () => {
    const entry = activeEntry();
    entry.subtitle = el.subtitleInput.value;
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
    if (textBlock) updateBlock(textBlock.dataset.textBlock, { text: textBlock.textContent });
    const caption = event.target.closest("[data-caption]");
    if (caption) updateBlock(caption.dataset.caption, { caption: caption.textContent });
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
      copyTranscript(copyButton.dataset.copyTranscript);
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

  el.insertDateTopBtn.addEventListener("click", () => insertBlock("date"));
  document.querySelectorAll("[data-mobile-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.mobileTab = button.dataset.mobileTab;
      renderMobileView();
    });
  });
  document.querySelector("[data-mobile-record]")?.addEventListener("click", () => {
    state.mobileTab = "today";
    renderMobileView();
    handleInsert("audio", { autoStart: true });
  });
  document.querySelectorAll("[data-insert-mobile]").forEach((button) => {
    button.addEventListener("click", () => {
      state.mobileTab = "today";
      insertBlock(button.dataset.insertMobile, { text: "新的灵感：" });
      render();
    });
  });
  el.imagePicker.addEventListener("change", () => handleImageFile(el.imagePicker.files[0]));
  el.coverPicker.addEventListener("change", () => handleCoverFile(el.coverPicker.files[0]));
  el.changeCoverBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    el.coverPicker.click();
  });
  el.resetCoverBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    const entry = activeEntry();
    if (!entry) return;
    entry.coverImage = "";
    touchEntry(entry);
    renderEditor();
  });
  el.coverArea.addEventListener("click", (event) => {
    if (event.target.closest(".cover-actions")) return;
    el.coverPicker.click();
  });
  el.sheetBackdrop.addEventListener("click", closeInsertSheet);
  el.insertSheet.addEventListener("click", (event) => {
    const button = event.target.closest("[data-sheet-insert]");
    if (button) handleSheetInsert(button.dataset.sheetInsert);
  });
  let sheetStartY = 0;
  el.insertSheet.addEventListener("touchstart", (event) => {
    sheetStartY = event.touches[0].clientY;
  }, { passive: true });
  el.insertSheet.addEventListener("touchend", (event) => {
    if (event.changedTouches[0].clientY - sheetStartY > 70) closeInsertSheet();
  }, { passive: true });
  el.recordBtn.addEventListener("click", () => toggleRecording().catch(() => {
    el.speechStatus.textContent = "无法访问麦克风，请检查权限";
  }));
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
  hydrateIcons();
  state.db = await openDb();
  await seedIfNeeded();
  state.recognition = setupSpeechRecognition();
  bindEvents();
  await loadData();
  registerServiceWorker();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js?v=23").then((registration) => registration.update()).catch(() => {});
}

init().catch((error) => {
  console.error(error);
  el.saveStatus.textContent = `初始化失败：${error.message || "请刷新重试"}`;
});
