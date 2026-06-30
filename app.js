const DB_NAME = "voice-journal-db";
const DB_VERSION = 1;

const defaultFolders = [
  { id: "daily", name: "日常" },
  { id: "ideas", name: "想法" },
  { id: "review", name: "复盘" }
];

const sampleBody = `# 今天的记录

/今天 可以插入固定日期。你也可以直接开始录音，转写文本会自动追加到这里。

- 心情：
- 重要事情：
- 明天继续：`;

const state = {
  db: null,
  folders: [],
  entries: [],
  activeFolderId: "all",
  activeEntryId: null,
  search: "",
  recorder: null,
  mediaStream: null,
  recognition: null,
  chunks: [],
  segmentChunks: [],
  liveTranscript: "",
  recordingStartedAt: 0,
  timerId: null,
  segmentStartedAt: null,
  stopRequested: false
};

const el = {
  folderList: document.querySelector("#folderList"),
  entryList: document.querySelector("#entryList"),
  currentFolderName: document.querySelector("#currentFolderName"),
  entryCount: document.querySelector("#entryCount"),
  addFolderBtn: document.querySelector("#addFolderBtn"),
  newEntryBtn: document.querySelector("#newEntryBtn"),
  searchInput: document.querySelector("#searchInput"),
  speechStatus: document.querySelector("#speechStatus"),
  titleInput: document.querySelector("#titleInput"),
  entryDateInput: document.querySelector("#entryDateInput"),
  entryFolderSelect: document.querySelector("#entryFolderSelect"),
  dateTokenBtn: document.querySelector("#dateTokenBtn"),
  recordBtn: document.querySelector("#recordBtn"),
  recordLabel: document.querySelector("#recordLabel"),
  recordTimer: document.querySelector("#recordTimer"),
  recordHint: document.querySelector("#recordHint"),
  saveSegmentBtn: document.querySelector("#saveSegmentBtn"),
  bodyInput: document.querySelector("#bodyInput"),
  slashHelper: document.querySelector("#slashHelper"),
  toolbar: document.querySelector(".toolbar"),
  segments: document.querySelector("#segments"),
  copyTranscriptBtn: document.querySelector("#copyTranscriptBtn")
};

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatTimer(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore("folders", { keyPath: "id" });
      db.createObjectStore("entries", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx(storeName, mode = "readonly") {
  return state.db.transaction(storeName, mode).objectStore(storeName);
}

function getAll(storeName) {
  return new Promise((resolve, reject) => {
    const request = tx(storeName).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function put(storeName, value) {
  return new Promise((resolve, reject) => {
    const request = tx(storeName, "readwrite").put(value);
    request.onsuccess = () => resolve(value);
    request.onerror = () => reject(request.error);
  });
}

async function seedIfNeeded() {
  const folders = await getAll("folders");
  if (!folders.length) {
    await Promise.all(defaultFolders.map((folder) => put("folders", folder)));
  }
  const entries = await getAll("entries");
  if (!entries.length) {
    const entry = createEntry("daily");
    entry.title = "第一篇语音日记";
    entry.body = sampleBody;
    await put("entries", entry);
  }
}

function createEntry(folderId = state.activeFolderId === "all" ? "daily" : state.activeFolderId) {
  const now = new Date().toISOString();
  return {
    id: uid("entry"),
    title: "未命名日记",
    body: "",
    date: todayISO(),
    folderId,
    segments: [],
    createdAt: now,
    updatedAt: now
  };
}

async function loadData() {
  state.folders = await getAll("folders");
  state.entries = (await getAll("entries")).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  if (!state.activeEntryId && state.entries[0]) state.activeEntryId = state.entries[0].id;
  render();
}

function activeEntry() {
  return state.entries.find((entry) => entry.id === state.activeEntryId) || null;
}

function filteredEntries() {
  const search = state.search.trim().toLowerCase();
  return state.entries.filter((entry) => {
    const inFolder = state.activeFolderId === "all" || entry.folderId === state.activeFolderId;
    const text = `${entry.title} ${entry.body} ${(entry.segments || []).map((segment) => segment.text).join(" ")}`.toLowerCase();
    return inFolder && (!search || text.includes(search));
  });
}

function render() {
  renderFolders();
  renderEntries();
  renderEditor();
}

function renderFolders() {
  const allCount = state.entries.length;
  const folders = [{ id: "all", name: "全部日记", count: allCount }, ...state.folders.map((folder) => ({
    ...folder,
    count: state.entries.filter((entry) => entry.folderId === folder.id).length
  }))];

  el.folderList.innerHTML = folders.map((folder) => `
    <button class="folder-item ${folder.id === state.activeFolderId ? "active" : ""}" data-folder-id="${folder.id}" type="button">
      <span class="folder-name">${escapeHtml(folder.name)}</span>
      <span class="folder-count">${folder.count}</span>
    </button>
  `).join("");

  el.entryFolderSelect.innerHTML = state.folders.map((folder) => `
    <option value="${folder.id}">${escapeHtml(folder.name)}</option>
  `).join("");
}

function renderEntries() {
  const entries = filteredEntries();
  const folder = state.folders.find((item) => item.id === state.activeFolderId);
  el.currentFolderName.textContent = state.activeFolderId === "all" ? "全部日记" : folder?.name || "日记";
  el.entryCount.textContent = entries.length;

  if (!entries.length) {
    el.entryList.innerHTML = `<div class="empty-state">这里还没有日记。新建一篇，或换个搜索词。</div>`;
    return;
  }

  el.entryList.innerHTML = entries.map((entry) => {
    const preview = (entry.body || (entry.segments || []).map((segment) => segment.text).join(" ") || "还没有正文").replace(/\s+/g, " ").trim();
    return `
      <button class="entry-item ${entry.id === state.activeEntryId ? "active" : ""}" data-entry-id="${entry.id}" type="button">
        <span class="entry-title">${escapeHtml(entry.title || "未命名日记")}</span>
        <span class="entry-preview">${escapeHtml(preview)}</span>
        <span class="entry-date">${escapeHtml(entry.date)} · ${escapeHtml(formatDateTime(entry.updatedAt))}</span>
      </button>
    `;
  }).join("");
}

function renderEditor() {
  const entry = activeEntry();
  const disabled = !entry;
  [el.titleInput, el.entryDateInput, el.entryFolderSelect, el.bodyInput, el.recordBtn, el.saveSegmentBtn].forEach((node) => {
    node.disabled = disabled;
  });

  if (!entry) {
    el.titleInput.value = "";
    el.bodyInput.value = "";
    el.segments.innerHTML = `<div class="empty-state">选择或新建一篇日记。</div>`;
    return;
  }

  if (document.activeElement !== el.titleInput) el.titleInput.value = entry.title;
  if (document.activeElement !== el.bodyInput) el.bodyInput.value = entry.body;
  el.entryDateInput.value = entry.date;
  el.entryFolderSelect.value = entry.folderId;
  el.dateTokenBtn.textContent = `固定日期 · ${entry.date}`;
  renderSegments(entry);
}

function renderSegments(entry) {
  const segments = entry.segments || [];
  if (!segments.length) {
    el.segments.innerHTML = `<div class="empty-state">录音后会出现音频、时间戳和中文转写分段。</div>`;
    return;
  }

  el.segments.innerHTML = segments.map((segment, index) => {
    const audioUrl = segment.audio ? URL.createObjectURL(segment.audio) : "";
    return `
      <div class="segment-card">
        <div class="segment-top">
          <span>分段 ${index + 1} · ${escapeHtml(formatDateTime(segment.createdAt))}</span>
          <span>${escapeHtml(segment.duration || "00:00")}</span>
        </div>
        ${audioUrl ? `<audio controls src="${audioUrl}"></audio>` : ""}
        <p class="segment-text">${escapeHtml(segment.text || "这段录音暂时没有转写文字。")}</p>
        <div class="segment-actions">
          <button type="button" data-append-segment="${segment.id}">追加到正文</button>
          ${audioUrl ? `<a href="${audioUrl}" download="${escapeHtml(entry.date)}-${index + 1}.webm">下载录音</a>` : ""}
        </div>
      </div>
    `;
  }).join("");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function updateActiveEntry(patch) {
  const entry = activeEntry();
  if (!entry) return;
  Object.assign(entry, patch, { updatedAt: new Date().toISOString() });
  await put("entries", entry);
  state.entries = state.entries.map((item) => item.id === entry.id ? entry : item)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  render();
}

function insertAtCursor(text, replaceSlash = false) {
  const input = el.bodyInput;
  const start = replaceSlash ? Math.max(0, input.selectionStart - 1) : input.selectionStart;
  const end = input.selectionEnd;
  input.value = `${input.value.slice(0, start)}${text}${input.value.slice(end)}`;
  const nextCursor = start + text.length;
  input.focus();
  input.setSelectionRange(nextCursor, nextCursor);
  updateActiveEntry({ body: input.value });
}

function fixedDateMarkdown() {
  const entry = activeEntry();
  const date = entry?.date || todayISO();
  return `<date value="${date}">${date}</date>`;
}

function applyMarkdown(action) {
  const input = el.bodyInput;
  const selected = input.value.slice(input.selectionStart, input.selectionEnd);
  const snippets = {
    bold: `**${selected || "加粗文字"}**`,
    italic: `*${selected || "斜体文字"}*`,
    heading: `\n## ${selected || "小标题"}\n`,
    quote: `\n> ${selected || "引用"}\n`,
    list: `\n- ${selected || "列表项"}\n`,
    check: `\n- [ ] ${selected || "待办"}\n`,
    date: fixedDateMarkdown(),
    divider: `\n---\n`
  };
  insertAtCursor(snippets[action] || "");
}

function runSlashCommand(command) {
  const map = {
    date: fixedDateMarkdown(),
    time: new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date()),
    heading: "## ",
    todo: "- [ ] ",
    audio: "\n[录音分段见下方]\n"
  };
  insertAtCursor(map[command] || "", true);
  el.slashHelper.hidden = true;
}

function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    el.speechStatus.textContent = "当前浏览器不支持实时转写，可保存录音";
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "zh-CN";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const text = event.results[i][0].transcript.trim();
      if (event.results[i].isFinal) {
        state.liveTranscript += `${text}\n`;
        appendTranscriptToBody(text);
      } else {
        interim = text;
      }
    }
    el.recordHint.textContent = interim ? `正在转写：${interim}` : "正在监听中文语音";
  };
  recognition.onerror = () => {
    el.recordHint.textContent = "转写中断，录音仍会保存";
  };
  recognition.onend = () => {
    if (!state.stopRequested && state.recorder?.state === "recording") {
      try {
        recognition.start();
      } catch {
        el.recordHint.textContent = "转写暂不可用，录音继续";
      }
    }
  };
  el.speechStatus.textContent = "支持中文实时转写";
  return recognition;
}

function appendTranscriptToBody(text) {
  const entry = activeEntry();
  if (!entry || !text) return;
  const prefix = entry.body.trim() ? "\n\n" : "";
  const nextBody = `${entry.body}${prefix}${text}`;
  entry.body = nextBody;
  el.bodyInput.value = nextBody;
  updateActiveEntry({ body: nextBody });
}

async function toggleRecording() {
  if (state.recorder?.state === "recording") {
    stopRecording();
    return;
  }
  await startRecording();
}

async function startRecording() {
  const entry = activeEntry();
  if (!entry) return;
  state.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  state.chunks = [];
  state.segmentChunks = [];
  state.liveTranscript = "";
  state.stopRequested = false;
  state.recordingStartedAt = Date.now();
  state.segmentStartedAt = Date.now();
  const mimeType = pickMimeType();
  state.recorder = mimeType
    ? new MediaRecorder(state.mediaStream, { mimeType })
    : new MediaRecorder(state.mediaStream);
  state.recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      state.chunks.push(event.data);
      state.segmentChunks.push(event.data);
    }
  };
  state.recorder.onstop = saveRecordingSegment;
  state.recorder.onerror = () => {
    stopRecording("录音被浏览器中断，已尝试保存已有片段");
  };
  state.mediaStream.getAudioTracks().forEach((track) => {
    track.onended = () => {
      if (state.recorder?.state === "recording") {
        stopRecording("麦克风已被系统停止，已保存已有录音");
      } else {
        resetRecordingUi("麦克风已被系统停止");
      }
    };
  });
  state.recorder.start(1000);

  if (state.recognition) {
    try {
      state.recognition.start();
    } catch {
      el.recordHint.textContent = "转写启动失败，录音会正常保存";
    }
  }

  el.recordBtn.classList.add("recording");
  el.recordLabel.textContent = "停止录音";
  el.recordHint.textContent = "正在录音并实时转写";
  state.timerId = window.setInterval(() => {
    el.recordTimer.textContent = formatTimer(Date.now() - state.recordingStartedAt);
  }, 250);
}

function stopRecording(message = "录音和转写已保存到当前日记") {
  state.stopRequested = true;
  try {
    state.recognition?.stop();
  } catch {
    el.recordHint.textContent = "转写停止失败，正在保存录音";
  }

  try {
    if (state.recorder?.state === "recording") {
      try {
        state.recorder.requestData();
      } catch {
        el.recordHint.textContent = "正在停止录音";
      }
      state.recorder.stop();
    } else {
      saveRecordingSegment();
    }
  } catch {
    saveRecordingSegment();
  } finally {
    state.mediaStream?.getTracks().forEach((track) => {
      track.onended = null;
      if (track.readyState !== "ended") track.stop();
    });
    state.mediaStream = null;
    resetRecordingUi(message);
  }
}

function resetRecordingUi(message) {
  window.clearInterval(state.timerId);
  state.timerId = null;
  el.recordBtn.classList.remove("recording");
  el.recordLabel.textContent = "开始录音";
  el.recordTimer.textContent = "00:00";
  el.recordHint.textContent = message;
}

function pickMimeType() {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

async function saveRecordingSegment() {
  const entry = activeEntry();
  if (!entry || !state.segmentChunks.length) return;
  const mimeType = state.segmentChunks[0]?.type || "audio/webm";
  const audio = new Blob(state.segmentChunks, { type: mimeType });
  const duration = formatTimer(Date.now() - state.segmentStartedAt);
  const text = state.liveTranscript.trim();
  const segment = {
    id: uid("segment"),
    audio,
    text,
    duration,
    createdAt: new Date().toISOString()
  };
  await updateActiveEntry({ segments: [...(entry.segments || []), segment] });
  state.segmentChunks = [];
  state.liveTranscript = "";
  el.recordHint.textContent = "录音和转写已保存到当前日记";
}

function saveCurrentSegmentWhileRecording() {
  if (state.recorder?.state !== "recording") return;
  state.recorder.requestData();
  window.setTimeout(async () => {
    const text = state.liveTranscript.trim();
    await saveRecordingSegment();
    if (text) appendTranscriptToBody(`\n### 分段 ${formatTimer(Date.now() - state.recordingStartedAt)}\n${text}`);
    state.liveTranscript = "";
    state.segmentStartedAt = Date.now();
    el.recordHint.textContent = "已保存一个独立分段，继续录音";
  }, 80);
}

function bindEvents() {
  el.addFolderBtn.addEventListener("click", async () => {
    const name = prompt("文件夹名称");
    if (!name?.trim()) return;
    const folder = { id: uid("folder"), name: name.trim() };
    await put("folders", folder);
    state.folders.push(folder);
    state.activeFolderId = folder.id;
    render();
  });

  el.folderList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-folder-id]");
    if (!button) return;
    state.activeFolderId = button.dataset.folderId;
    render();
  });

  el.newEntryBtn.addEventListener("click", async () => {
    const entry = createEntry();
    await put("entries", entry);
    state.entries.unshift(entry);
    state.activeEntryId = entry.id;
    render();
    el.titleInput.focus();
  });

  el.entryList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-entry-id]");
    if (!button) return;
    state.activeEntryId = button.dataset.entryId;
    render();
  });

  el.searchInput.addEventListener("input", () => {
    state.search = el.searchInput.value;
    renderEntries();
  });

  el.titleInput.addEventListener("input", () => updateActiveEntry({ title: el.titleInput.value }));
  el.bodyInput.addEventListener("input", () => {
    updateActiveEntry({ body: el.bodyInput.value });
    const beforeCursor = el.bodyInput.value.slice(0, el.bodyInput.selectionStart);
    el.slashHelper.hidden = !beforeCursor.endsWith("/");
  });
  el.entryDateInput.addEventListener("change", () => updateActiveEntry({ date: el.entryDateInput.value }));
  el.entryFolderSelect.addEventListener("change", () => updateActiveEntry({ folderId: el.entryFolderSelect.value }));
  el.dateTokenBtn.addEventListener("click", () => insertAtCursor(fixedDateMarkdown()));

  el.toolbar.addEventListener("click", (event) => {
    const button = event.target.closest("[data-md]");
    if (button) applyMarkdown(button.dataset.md);
  });

  el.slashHelper.addEventListener("click", (event) => {
    const button = event.target.closest("[data-command]");
    if (button) runSlashCommand(button.dataset.command);
  });

  el.recordBtn.addEventListener("click", () => {
    toggleRecording().catch(() => {
      el.recordHint.textContent = "无法访问麦克风，请检查浏览器权限";
    });
  });

  el.saveSegmentBtn.addEventListener("click", saveCurrentSegmentWhileRecording);

  el.segments.addEventListener("click", (event) => {
    const button = event.target.closest("[data-append-segment]");
    if (!button) return;
    const entry = activeEntry();
    const segment = entry?.segments?.find((item) => item.id === button.dataset.appendSegment);
    if (segment?.text) insertAtCursor(`\n\n${segment.text}`);
  });

  el.copyTranscriptBtn.addEventListener("click", async () => {
    const text = (activeEntry()?.segments || []).map((segment) => segment.text).filter(Boolean).join("\n\n");
    if (text) await navigator.clipboard.writeText(text);
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

init().catch((error) => {
  console.error(error);
  el.speechStatus.textContent = "初始化失败，请刷新重试";
});

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js").catch(() => {
    el.speechStatus.textContent = "离线缓存暂不可用，其他功能正常";
  });
}
