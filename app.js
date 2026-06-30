const DB_NAME = "voice-journal-db";
const DB_VERSION = 1;
const TRANSCRIBE_ENDPOINT_KEY = "voiceJournalTranscribeEndpoint";
const DEFAULT_TRANSCRIBE_ENDPOINT = "https://voice-journal-nu.vercel.app/api/transcribe";

const defaultFolders = [
  { id: "daily", name: "日常" },
  { id: "ideas", name: "想法" },
  { id: "review", name: "复盘" }
];

const sampleBody = `<h2>今天的记录</h2>
<p>输入 <strong>/今天</strong> 可以插入固定日期；输入 <strong>===</strong> 可以生成白色方块。你也可以直接开始录音，转写文本会自动追加到这里。</p>
<p>- 心情：</p>
<p>- 重要事情：</p>
<p>- 明天继续：</p>`;

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
  liveTranscriptBox: document.querySelector("#liveTranscriptBox"),
  liveTranscriptText: document.querySelector("#liveTranscriptText"),
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

function weekdayName(dateText) {
  return new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(new Date(`${dateText}T00:00:00`));
}

function displayDate(dateText) {
  const date = new Date(`${dateText}T00:00:00`);
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(date);
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

function deleteFromStore(storeName, key) {
  return new Promise((resolve, reject) => {
    const request = tx(storeName, "readwrite").delete(key);
    request.onsuccess = () => resolve();
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
    const text = `${entry.title} ${plainText(entry.body)} ${(entry.segments || []).map((segment) => segment.text).join(" ")}`.toLowerCase();
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
    const preview = (plainText(entry.body) || (entry.segments || []).map((segment) => segment.text).join(" ") || "还没有正文").replace(/\s+/g, " ").trim();
    return `
      <div class="entry-item ${entry.id === state.activeEntryId ? "active" : ""}" data-entry-id="${entry.id}">
        <button class="entry-open" data-open-entry="${entry.id}" type="button">
          <span class="entry-title">${escapeHtml(entry.title || "未命名日记")}</span>
          <span class="entry-preview">${escapeHtml(preview)}</span>
          <span class="entry-date">${escapeHtml(entry.date)} · ${escapeHtml(formatDateTime(entry.updatedAt))}</span>
        </button>
        <button class="entry-delete" data-delete-entry="${entry.id}" type="button" title="删除日记">删除</button>
      </div>
    `;
  }).join("");
}

function renderEditor() {
  const entry = activeEntry();
  const disabled = !entry;
  [el.titleInput, el.entryDateInput, el.entryFolderSelect, el.recordBtn, el.saveSegmentBtn].forEach((node) => {
    node.disabled = disabled;
  });
  el.bodyInput.contentEditable = disabled ? "false" : "true";

  if (!entry) {
    el.titleInput.value = "";
    el.bodyInput.innerHTML = "";
    el.segments.innerHTML = `<div class="empty-state">选择或新建一篇日记。</div>`;
    return;
  }

  if (document.activeElement !== el.titleInput) el.titleInput.value = entry.title;
  if (document.activeElement !== el.bodyInput) {
    el.bodyInput.innerHTML = normalizeBodyHtml(entry.body);
    refreshDateChips();
  }
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

  const sortedSegments = [...segments].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  el.segments.innerHTML = sortedSegments.map((segment, index) => {
    const audioUrl = segment.audio ? URL.createObjectURL(segment.audio) : "";
    return `
      <div class="segment-card">
        <div class="segment-top">
          <span>分段 ${index + 1} · ${escapeHtml(formatDateTime(segment.createdAt))}</span>
          <span class="segment-duration">录音时长 ${escapeHtml(segment.duration || "00:00")}</span>
        </div>
        ${audioUrl ? `<audio controls src="${audioUrl}"></audio>` : ""}
        <p class="segment-text">${escapeHtml(segmentText(segment))}</p>
        <div class="segment-actions">
          <button type="button" data-append-segment="${segment.id}">追加到正文</button>
          ${segment.audio ? `<button type="button" data-transcribe-segment="${segment.id}">${segment.transcriptSource === "cloud" ? "重新生成准确转写" : "生成准确转写"}</button>` : ""}
          ${audioUrl ? `<a href="${audioUrl}" download="${escapeHtml(entry.date)}-${index + 1}.webm">下载录音</a>` : ""}
          <button class="danger-action" type="button" data-delete-segment="${segment.id}">删除分段</button>
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

function segmentText(segment) {
  if (segment.transcriptionStatus === "running") return "正在生成准确转写...";
  if (segment.transcriptionStatus === "error") return segment.transcriptionError || "准确转写失败，可稍后重试。";
  if (segment.transcriptSource === "cloud" && segment.text) return `准确转写：${segment.text}`;
  return segment.text || "这段录音暂时没有转写文字。";
}

function plainText(html) {
  const template = document.createElement("template");
  template.innerHTML = normalizeBodyHtml(html);
  template.content.querySelectorAll(".date-chip[data-date]").forEach((chip) => {
    const date = chip.dataset.date;
    chip.textContent = date === todayISO() ? "今天" : `${displayDate(date)} ${weekdayName(date)}`;
  });
  return template.content.textContent || "";
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

async function replaceSegment(segmentId, patch) {
  const entry = activeEntry();
  if (!entry) return null;
  const segments = (entry.segments || []).map((segment) => (
    segment.id === segmentId ? { ...segment, ...patch } : segment
  ));
  await updateActiveEntry({ segments });
  return segments.find((segment) => segment.id === segmentId) || null;
}

async function deleteActiveEntry(entryId) {
  const entry = state.entries.find((item) => item.id === entryId);
  if (!entry) return;
  const title = entry.title || "未命名日记";
  if (!confirm(`删除「${title}」？这会同时删除里面保存的录音分段。`)) return;

  await deleteFromStore("entries", entryId);
  state.entries = state.entries.filter((item) => item.id !== entryId);
  if (state.activeEntryId === entryId) {
    state.activeEntryId = filteredEntries()[0]?.id || state.entries[0]?.id || null;
  }
  render();
}

async function deleteSegment(segmentId) {
  const entry = activeEntry();
  const segment = entry?.segments?.find((item) => item.id === segmentId);
  if (!entry || !segment) return;
  if (!confirm(`删除这段录音？${segment.duration ? `录音时长 ${segment.duration}` : ""}`)) return;

  const segments = (entry.segments || []).filter((item) => item.id !== segmentId);
  await updateActiveEntry({ segments });
}

function bodyHtml() {
  return el.bodyInput.innerHTML.trim();
}

function normalizeBodyHtml(value) {
  const raw = String(value || "");
  if (!raw.trim()) return "";
  const withDateChips = raw.replace(/&lt;date value="(\d{4}-\d{2}-\d{2})"&gt;.*?&lt;\/date&gt;|<date value="(\d{4}-\d{2}-\d{2})">.*?<\/date>/g, (_match, escapedDate, htmlDate) => dateChipHtml(escapedDate || htmlDate));
  if (/<[a-z][\s\S]*>/i.test(withDateChips)) return cleanLegacyMarkdownHtml(withDateChips);
  return withDateChips
    .split(/\n{2,}/)
    .map((paragraph) => blockFromPlainText(paragraph))
    .join("");
}

function cleanLegacyMarkdownHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = html;
  template.content.querySelectorAll("p, div").forEach((node) => {
    if (node.classList.contains("craft-block")) return;
    const text = node.textContent.trim();
    if (!text) return;
    const replacement = blockFromPlainText(text);
    if (replacement !== `<p>${escapeHtml(text)}</p>`) {
      node.outerHTML = replacement;
    } else {
      node.innerHTML = inlineMarkdownToHtml(text);
    }
  });
  return template.innerHTML;
}

function blockFromPlainText(text) {
  const value = text.trim();
  if (value.startsWith("## ")) return `<h2>${inlineMarkdownToHtml(value.slice(3))}</h2>`;
  if (value.startsWith("> ")) return `<blockquote>${inlineMarkdownToHtml(value.slice(2))}</blockquote>`;
  if (value.startsWith("- [ ] ")) return `<label class="todo-line"><input type="checkbox"> <span>${inlineMarkdownToHtml(value.slice(6))}</span></label>`;
  if (value.startsWith("- ")) return `<ul><li>${inlineMarkdownToHtml(value.slice(2))}</li></ul>`;
  return `<p>${inlineMarkdownToHtml(value).replace(/\n/g, "<br>")}</p>`;
}

function inlineMarkdownToHtml(text) {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function saveBodyFromEditor() {
  refreshDateChips();
  updateActiveEntry({ body: bodyHtml() });
}

function handleEditorShortcuts() {
  const text = el.bodyInput.textContent || "";
  if (text.endsWith("/")) {
    el.slashHelper.hidden = false;
  } else {
    el.slashHelper.hidden = true;
  }

  if (text.endsWith("===") && replaceTrailingEqualsWithBlock()) {
    refreshDateChips();
  }
}

function replaceTrailingEqualsWithBlock() {
  const walker = document.createTreeWalker(el.bodyInput, 4);
  const nodes = [];
  let node = walker.nextNode();
  while (node) {
    nodes.push(node);
    node = walker.nextNode();
  }

  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    const textNode = nodes[i];
    if (!textNode.nodeValue.endsWith("===")) continue;
    textNode.nodeValue = textNode.nodeValue.slice(0, -3);
    const parent = textNode.parentElement || el.bodyInput;
    const target = parent.closest(".caret-spacer") || parent;
    target.insertAdjacentHTML("afterend", `<div class="craft-block"><br></div><p><br></p>`);
    placeCaretAtEnd(el.bodyInput);
    return true;
  }
  return false;
}

function placeCaretAtEnd(node) {
  const range = document.createRange();
  const selection = window.getSelection();
  range.selectNodeContents(node);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function insertAtCursor(html, replaceSlash = false) {
  el.bodyInput.focus();
  if (replaceSlash) deletePreviousCharacter();
  document.execCommand("insertHTML", false, html);
  refreshDateChips();
  saveBodyFromEditor();
}

function deletePreviousCharacter() {
  deletePreviousCharacters(1);
}

function deletePreviousCharacters(count) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  for (let i = 0; i < count; i += 1) {
    const range = selection.getRangeAt(0);
    if (!range.collapsed) {
      range.deleteContents();
      return;
    }
    document.execCommand("delete", false);
  }
}

function fixedDateMarkdown() {
  const entry = activeEntry();
  const date = entry?.date || todayISO();
  return dateChipHtml(date);
}

function dateChipHtml(date) {
  return `<span class="date-chip" contenteditable="false" data-date="${date}">今天</span><span class="caret-spacer">&nbsp;</span>`;
}

function refreshDateChips() {
  el.bodyInput.querySelectorAll(".date-chip[data-date]").forEach((chip) => {
    const date = chip.dataset.date;
    const isToday = date === todayISO();
    chip.classList.toggle("past", !isToday);
    chip.textContent = isToday ? "今天" : `${displayDate(date)} ${weekdayName(date)}`;
  });
}

function applyMarkdown(action) {
  el.bodyInput.focus();
  const selected = window.getSelection()?.toString() || "";
  if (action === "bold" || action === "italic") {
    document.execCommand(action === "bold" ? "bold" : "italic", false);
    if (!selected) insertAtCursor(action === "bold" ? "<strong>加粗文字</strong>" : "<em>斜体文字</em>");
    saveBodyFromEditor();
    return;
  }

  const snippets = {
    heading: `<h2>${escapeHtml(selected || "小标题")}</h2>`,
    quote: `<blockquote>${escapeHtml(selected || "引用")}</blockquote>`,
    list: `<ul><li>${escapeHtml(selected || "列表项")}</li></ul>`,
    check: `<label class="todo-line"><input type="checkbox"> <span>${escapeHtml(selected || "待办")}</span></label>`,
    date: fixedDateMarkdown(),
    divider: `<div class="craft-block"><br></div><p><br></p>`
  };
  insertAtCursor(snippets[action] || "");
}

function runSlashCommand(command) {
  const map = {
    date: fixedDateMarkdown(),
    time: new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date()),
    heading: "<h2><br></h2>",
    todo: `<label class="todo-line"><input type="checkbox"> <span>待办</span></label>`,
    audio: "<p>录音分段见下方</p>"
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
        updateLiveTranscript();
        appendTranscriptToBody(text);
      } else {
        interim = text;
      }
    }
    el.recordHint.textContent = interim ? "正在转写草稿" : "正在监听中文语音";
    updateLiveTranscript(interim);
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
  const prefix = entry.body.trim() ? "" : "";
  const nextBody = `${normalizeBodyHtml(entry.body)}${prefix}<p>${escapeHtml(text)}</p>`;
  entry.body = nextBody;
  el.bodyInput.innerHTML = nextBody;
  refreshDateChips();
  updateActiveEntry({ body: nextBody });
}

function appendHtmlToBody(html) {
  const entry = activeEntry();
  if (!entry || !html) return;
  const nextBody = `${normalizeBodyHtml(entry.body)}${html}`;
  entry.body = nextBody;
  el.bodyInput.innerHTML = nextBody;
  refreshDateChips();
  updateActiveEntry({ body: nextBody });
}

async function transcribeSegment(segmentId) {
  const entry = activeEntry();
  const segment = entry?.segments?.find((item) => item.id === segmentId);
  if (!entry || !segment?.audio) return;

  const endpoint = getTranscribeEndpoint();
  if (!endpoint) return;

  await replaceSegment(segmentId, { transcriptionStatus: "running" });
  try {
    const audioBase64 = await blobToBase64(segment.audio);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audioBase64,
        mimeType: segment.audio.type || "audio/webm",
        filename: `${entry.date}-${segmentId}.webm`,
        language: "zh"
      })
    });

    if (!response.ok) {
      throw new Error(await responseErrorMessage(response));
    }

    const result = await response.json();
    const text = String(result.text || "").trim();
    if (!text) throw new Error("转写服务没有返回文本");

    await replaceSegment(segmentId, {
      text,
      transcriptSource: "cloud",
      transcriptionStatus: "done",
      transcribedAt: new Date().toISOString()
    });
    appendHtmlToBody(`<h3>准确转写 · ${escapeHtml(segment.duration || "00:00")}</h3><p>${escapeHtml(text)}</p>`);
  } catch (error) {
    const message = readableTranscribeError(error);
    await replaceSegment(segmentId, {
      transcriptionStatus: "error",
      transcriptionError: message
    });
    if (confirm(`${message}\n\n要重新填写准确转写服务地址吗？`)) {
      resetTranscribeEndpoint();
    }
  }
}

function getTranscribeEndpoint() {
  const saved = normalizeEndpoint(localStorage.getItem(TRANSCRIBE_ENDPOINT_KEY));
  if (saved) return saved;
  localStorage.removeItem(TRANSCRIBE_ENDPOINT_KEY);

  const sameOriginEndpoint = `${window.location.origin}/api/transcribe`;
  if (!window.location.hostname.endsWith("github.io")) return sameOriginEndpoint;

  localStorage.setItem(TRANSCRIBE_ENDPOINT_KEY, DEFAULT_TRANSCRIBE_ENDPOINT);
  return DEFAULT_TRANSCRIBE_ENDPOINT;
}

function resetTranscribeEndpoint() {
  const endpoint = prompt("粘贴准确转写服务地址", getTranscribeEndpoint());
  const normalized = normalizeEndpoint(endpoint);
  if (!normalized) {
    alert("地址需要是 https 开头，并且以 /api/transcribe 结尾。");
    return;
  }
  localStorage.setItem(TRANSCRIBE_ENDPOINT_KEY, normalized);
}

function normalizeEndpoint(value) {
  const endpoint = String(value || "").trim();
  if (!endpoint) return "";
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") return "";
    if (!url.pathname.endsWith("/api/transcribe")) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function readableTranscribeError(error) {
  const message = String(error?.message || "");
  if (message === "Failed to fetch" || message.includes("NetworkError")) {
    return "准确转写服务连接失败。请检查接口地址、网络、浏览器插件，或稍后重试。";
  }
  return message || "准确转写失败，请稍后重试。";
}

async function responseErrorMessage(response) {
  try {
    const result = await response.json();
    if (result?.error) return result.error;
  } catch {
    try {
      const text = await response.text();
      if (text) return text;
    } catch {
      // Keep the generic status fallback below.
    }
  }
  return `转写失败：${response.status}`;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      resolve(value.includes(",") ? value.split(",").pop() : value);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function updateLiveTranscript(interim = "") {
  const finalText = state.liveTranscript.trim();
  const parts = [];
  if (finalText) parts.push(finalText);
  if (interim) parts.push(`…${interim}`);
  el.liveTranscriptText.textContent = parts.join("\n") || "正在听，请继续说。";
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
  el.liveTranscriptText.textContent = "正在听，请继续说。";
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
  updateLiveTranscript();
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
  el.liveTranscriptText.textContent = text || "这一段没有拿到可用的实时转写。录音已保存，可回听。";
  el.recordHint.textContent = "录音和转写已保存到当前日记";
}

function saveCurrentSegmentWhileRecording() {
  if (state.recorder?.state !== "recording") return;
  state.recorder.requestData();
  window.setTimeout(async () => {
    const text = state.liveTranscript.trim();
    await saveRecordingSegment();
    if (text) {
      appendHtmlToBody(`<h3>分段 ${formatTimer(Date.now() - state.recordingStartedAt)}</h3><p>${escapeHtml(text)}</p>`);
    }
    state.liveTranscript = "";
    state.segmentStartedAt = Date.now();
    el.liveTranscriptText.textContent = "新分段已开始，继续说即可。";
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
    const deleteButton = event.target.closest("[data-delete-entry]");
    if (deleteButton) {
      deleteActiveEntry(deleteButton.dataset.deleteEntry);
      return;
    }

    const openButton = event.target.closest("[data-open-entry]");
    if (!openButton) return;
    state.activeEntryId = openButton.dataset.openEntry;
    render();
  });

  el.searchInput.addEventListener("input", () => {
    state.search = el.searchInput.value;
    renderEntries();
  });

  el.titleInput.addEventListener("input", () => updateActiveEntry({ title: el.titleInput.value }));
  el.bodyInput.addEventListener("input", () => {
    handleEditorShortcuts();
    saveBodyFromEditor();
  });
  el.bodyInput.addEventListener("keyup", () => {
    handleEditorShortcuts();
    saveBodyFromEditor();
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
    const deleteButton = event.target.closest("[data-delete-segment]");
    if (deleteButton) {
      deleteSegment(deleteButton.dataset.deleteSegment);
      return;
    }

    const transcribeButton = event.target.closest("[data-transcribe-segment]");
    if (transcribeButton) {
      transcribeButton.disabled = true;
      transcribeButton.textContent = "转写中...";
      transcribeSegment(transcribeButton.dataset.transcribeSegment).finally(() => {
        transcribeButton.disabled = false;
      });
      return;
    }

    const button = event.target.closest("[data-append-segment]");
    if (!button) return;
    const entry = activeEntry();
    const segment = entry?.segments?.find((item) => item.id === button.dataset.appendSegment);
    if (segment?.text) insertAtCursor(`<p>${escapeHtml(segment.text)}</p>`);
  });

  el.copyTranscriptBtn.addEventListener("click", async () => {
    const text = (activeEntry()?.segments || [])
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((segment) => segment.text)
      .filter(Boolean)
      .join("\n\n");
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
