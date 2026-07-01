const DB_NAME = "voice-journal-db";
const DB_VERSION = 3;

const folders = [
  { id: "all", name: "全部日记", icon: "▦" },
  { id: "daily", name: "碎碎念", icon: "✦" },
  { id: "travel", name: "旅行日记", icon: "♧" },
  { id: "read", name: "读书笔记", icon: "♢" },
  { id: "review", name: "每日复盘", icon: "☼" }
];

const state = {
  db: null,
  entries: [],
  activeEntryId: null,
  activeFolderId: "all",
  search: "",
  activeBlockId: null,
  recorder: null,
  mediaStream: null,
  recognition: null,
  recordingBlockId: null,
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
  closeDockBtn: document.querySelector("#closeDockBtn")
};

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
  return dateText === todayISO() ? "今天" : `${monthDay} ${weekday}`;
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
  if (Array.isArray(entry.blocks)) return entry;
  const blocks = [];
  blocks.push({ id: uid("block"), type: "date", date: entry.date || todayISO() });
  if (entry.body) {
    blocks.push({ id: uid("block"), type: "text", text: htmlToText(entry.body) });
  }
  (entry.segments || []).forEach((segment) => {
    blocks.push({
      id: segment.id || uid("block"),
      type: "audio",
      audioDataUrl: segment.audioDataUrl || "",
      duration: segment.duration || "00:00",
      transcript: segment.text || "",
      createdAt: segment.createdAt || entry.updatedAt || nowISO()
    });
  });
  if (blocks.length < 2) blocks.push({ id: uid("block"), type: "text", text: "" });
  return {
    ...entry,
    subtitle: entry.subtitle || "",
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
  if (block.type === "audio") return block.transcript || "";
  if (block.type === "image") return block.caption || "";
  return "";
}

function render() {
  renderFolders();
  renderEntries();
  renderEditor();
  renderAudioDock();
}

function renderFolders() {
  el.folderNav.innerHTML = folders.map((folder) => {
    const count = folder.id === "all"
      ? state.entries.length
      : state.entries.filter((entry) => entry.folderId === folder.id).length;
    return `
      <button class="folder-button ${state.activeFolderId === folder.id ? "active" : ""}" data-folder="${folder.id}" type="button">
        <span>${folder.icon}</span>
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
  el.blockList.innerHTML = entry.blocks.map(renderBlock).join("");
}

function renderBlock(block) {
  const menu = `<div class="block-menu"><button data-delete-block="${block.id}" type="button">···</button></div>`;
  if (block.type === "date") {
    return `<section class="block" data-block="${block.id}"><div class="date-block">▦ ${escapeHtml(displayDate(block.date))}</div>${menu}</section>`;
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
    const recording = state.recordingBlockId === block.id;
    return `
      <section class="block audio-block" data-block="${block.id}">
        <div class="audio-top">
          <div class="audio-title"><span class="audio-icon">🎙</span><span>声音片段 · ${escapeHtml(block.duration || "00:00")}</span></div>
          <span class="audio-meta">${escapeHtml(block.createdAt ? formatTime(block.createdAt) : "")}</span>
        </div>
        ${recording ? `<div class="recording-chip">正在录音 ${escapeHtml(currentRecordingDuration())}</div>` : ""}
        ${block.audioDataUrl ? `<audio controls src="${block.audioDataUrl}"></audio>` : ""}
        <div class="transcript">${escapeHtml(block.transcript || "开始录音后，实时转写会保存在这里。")}</div>
        ${menu}
      </section>
    `;
  }
  return `
    <section class="block" data-block="${block.id}">
      <div class="text-block" contenteditable="true" data-text-block="${block.id}">${escapeHtml(block.text || "")}</div>
      ${menu}
    </section>
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
      <b>▷</b>
      <span>${escapeHtml(block.transcript || "未转写")}</span>
      <time>${escapeHtml(block.duration || "00:00")}</time>
    </div>
  `).join("");
}

function currentRecordingDuration() {
  if (!state.recordingStartedAt) return "00:00";
  return formatDuration(Date.now() - state.recordingStartedAt);
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
  if (type === "audio") return { id: uid("block"), type, duration: "00:00", transcript: "", audioDataUrl: "", createdAt: nowISO() };
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
    renderAudioDock();
  };
  recognition.onerror = () => {
    el.speechStatus.textContent = "实时转写中断，录音仍会保存";
  };
  return recognition;
}

async function toggleRecording() {
  if (state.recorder?.state === "recording") {
    stopRecording();
    return;
  }
  await startRecording();
}

async function startRecording() {
  const block = insertBlock("audio");
  state.recordingBlockId = block.id;
  state.chunks = [];
  state.liveTranscript = "";
  state.recordingStartedAt = Date.now();
  state.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = pickMimeType();
  state.recorder = new MediaRecorder(state.mediaStream, mimeType ? { mimeType } : undefined);
  state.recorder.ondataavailable = (event) => {
    if (event.data?.size) state.chunks.push(event.data);
  };
  state.recorder.onstop = finishRecording;
  state.recorder.start(500);
  try {
    state.recognition?.start();
  } catch {
    // Recognition can throw when already started; recording should continue.
  }
  el.recordBtn.classList.add("recording");
  el.recordBtn.textContent = "停止录音";
  el.speechStatus.textContent = "正在录音";
  el.liveTranscript.textContent = "正在听...";
  state.timerId = window.setInterval(() => {
    const blockEl = el.blockList.querySelector(`[data-block="${state.recordingBlockId}"] .recording-chip`);
    if (blockEl) blockEl.textContent = `正在录音 ${currentRecordingDuration()}`;
  }, 500);
}

function stopRecording() {
  if (state.recorder?.state === "recording") state.recorder.stop();
}

async function finishRecording() {
  window.clearInterval(state.timerId);
  try {
    state.recognition?.stop();
  } catch {
    // Ignore speech API stop races.
  }
  state.mediaStream?.getTracks().forEach((track) => track.stop());
  const duration = formatDuration(Date.now() - state.recordingStartedAt);
  const mimeType = state.chunks[0]?.type || "audio/webm";
  const blob = new Blob(state.chunks, { type: mimeType });
  const audioDataUrl = blob.size ? await blobToDataUrl(blob) : "";
  updateBlock(state.recordingBlockId, {
    audioDataUrl,
    duration,
    transcript: state.liveTranscript || "",
    createdAt: nowISO()
  });
  state.recorder = null;
  state.mediaStream = null;
  state.recordingBlockId = null;
  state.chunks = [];
  state.recordingStartedAt = 0;
  el.recordBtn.classList.remove("recording");
  el.recordBtn.textContent = "🎙 开始说话";
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
    render();
  });

  el.titleInput.addEventListener("input", () => {
    const entry = activeEntry();
    entry.title = el.titleInput.value;
    touchEntry(entry);
  });

  el.subtitleInput.addEventListener("input", () => {
    const entry = activeEntry();
    entry.subtitle = el.subtitleInput.value;
    touchEntry(entry);
  });

  el.blockList.addEventListener("focusin", (event) => {
    const block = event.target.closest("[data-block]");
    if (block) setActiveBlock(block.dataset.block);
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
    const deleteButton = event.target.closest("[data-delete-block]");
    if (!deleteButton) return;
    if (confirm("删除这个块吗？")) deleteBlock(deleteButton.dataset.deleteBlock);
  });

  document.querySelector(".floating-toolbar").addEventListener("click", (event) => {
    const button = event.target.closest("[data-insert]");
    if (!button) return;
    const type = button.dataset.insert;
    if (type === "image") {
      el.imagePicker.click();
      return;
    }
    if (type === "audio") {
      startRecording().catch(() => {
        el.speechStatus.textContent = "无法访问麦克风，请检查权限";
      });
      return;
    }
    insertBlock(type);
  });

  el.insertDateTopBtn.addEventListener("click", () => insertBlock("date"));
  el.imagePicker.addEventListener("change", () => handleImageFile(el.imagePicker.files[0]));
  el.recordBtn.addEventListener("click", () => toggleRecording().catch(() => {
    el.speechStatus.textContent = "无法访问麦克风，请检查权限";
  }));
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
}

async function init() {
  state.db = await openDb();
  await seedIfNeeded();
  state.recognition = setupSpeechRecognition();
  bindEvents();
  await loadData();
  registerServiceWorker();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js?v=21").then((registration) => registration.update()).catch(() => {});
}

init().catch((error) => {
  console.error(error);
  el.saveStatus.textContent = `初始化失败：${error.message || "请刷新重试"}`;
});
