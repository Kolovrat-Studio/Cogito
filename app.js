import {
  notes,
  currentNoteId,
  isDarkMode,
  isAiEnabled,
  isFullWidth,
  isFocusMode,
  setNotes,
  setCurrentNoteId,
} from "./js/state.js";
import {
  initDB,
  loadNotesFromStorage,
  saveNotesToDB,
  saveToLocal,
  persistNotesToLocalStorage,
  getBackupSnapshot,
  autoSave,
  saveImageToDB,
  saveCurrentNoteIdToLocalStorage,
  loadCurrentNoteIdFromLocalStorage,
} from "./js/storage.js";
import {
  renderSidebar,
  toggleRightSidebar,
  closeRightSidebar,
  clearSearch,
  toggleSearchClearBtn,
} from "./js/sidebar.js";
import {
  applyTheme,
  applyFocusMode,
  applyAiState,
  applyFullWidth,
  showToast,
  toggleDarkMode,
  toggleFocusModeStatus,
  toggleAiStatus,
  toggleFullWidth,
  openSettingsModal,
  closeSettingsModal,
  openCoverPicker,
  closeCoverPicker,
  openEmojiPicker,
  closeEmojiPicker,
  openTemplatePicker,
  closeTemplatePicker,
  closeTrashView,
  closeTrashEditor,
  closeConfirmDelete,
} from "./js/ui.js";
import {
  callGemini,
  aiAutoTag,
  aiOrganize,
  askAI,
  clearAiChatHistory,
  saveApiKey,
} from "./js/ai.js";
import {
  createBlockRow,
  loadContentIntoEditor,
  executeSlashCommand,
  updateFullEditorWordCount,
  getEditorPlainContent,
  getEditorHtmlContent,
} from "./js/editor.js";
import { openGraphModal, closeGraphModal } from "./js/graph.js";

// Exports to window to satisfy HTML inline event handlers
window.toggleSidebarTagFilter = window.toggleSidebarTagFilter;
window.renderSidebar = renderSidebar;
window.toggleRightSidebar = toggleRightSidebar;
window.closeRightSidebar = closeRightSidebar;
window.clearSearch = clearSearch;
window.toggleSearchClearBtn = toggleSearchClearBtn;
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.openCoverPicker = openCoverPicker;
window.closeCoverPicker = closeCoverPicker;
window.openEmojiPicker = openEmojiPicker;
window.closeEmojiPicker = closeEmojiPicker;
window.openTemplatePicker = openTemplatePicker;
window.closeTemplatePicker = closeTemplatePicker;
window.closeTrashView = closeTrashView;
window.closeTrashEditor = closeTrashEditor;
window.closeConfirmDelete = closeConfirmDelete;
window.toggleDarkMode = toggleDarkMode;
window.toggleFocusModeStatus = toggleFocusModeStatus;
window.toggleAiStatus = toggleAiStatus;
window.toggleFullWidth = toggleFullWidth;
window.aiAutoTag = aiAutoTag;
window.aiOrganize = aiOrganize;
window.askAI = askAI;
window.executeSlashCommand = executeSlashCommand;
window.openGraphModal = openGraphModal;
window.closeGraphModal = closeGraphModal;
window.renderBacklinks = renderBacklinks;
window.autoSave = autoSave;
window.saveToLocal = saveToLocal;
window.persistNotesToLocalStorage = persistNotesToLocalStorage;

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

window.createNewNote = async (parentId = null) => {
  const note = {
    id: generateId(),
    title: "",
    content: "",
    icon: "📑",
    coverUrl: "",
    tags: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    pinned: false,
    isDeleted: false,
    parentId: parentId,
  };
  notes.unshift(note);
  await saveToLocal();
  renderSidebar();
  selectNote(note.id);
};

window.goToDashboard = () => {
  setCurrentNoteId(null);
  saveCurrentNoteIdToLocalStorage();
  document.getElementById("editorContainer")?.classList.add("hidden");
  document.getElementById("trashView")?.classList.add("hidden");
  document.getElementById("trashEditorContainer")?.classList.add("hidden");
  document.getElementById("emptyState")?.classList.remove("hidden");
  renderSidebar();
};

window.selectNote = (id) => {
  const note = notes.find((n) => n.id === id);
  if (!note || note.isDeleted) return;
  setCurrentNoteId(id);
  saveCurrentNoteIdToLocalStorage();

  document.getElementById("emptyState")?.classList.add("hidden");
  document.getElementById("editorContainer")?.classList.remove("hidden");
  document.getElementById("trashView")?.classList.add("hidden");
  document.getElementById("trashEditorContainer")?.classList.add("hidden");

  const titleInput = document.getElementById("noteTitle");
  if (titleInput) {
    titleInput.value = note.title || "";
    titleInput.style.height = "auto";
    titleInput.style.height = titleInput.scrollHeight + "px";
  }

  syncHeaderTitle();
  loadContentIntoEditor(note.content);

  const iconEl = document.getElementById("noteIcon");
  if (iconEl) iconEl.innerText = note.icon || "📑";

  applyNoteCoverUI(note.coverUrl);
  renderTagsInput(note.tags ? note.tags.split(" ") : []);

  document.getElementById("sidebarCreatedAt").innerText = new Date(
    note.createdAt,
  ).toLocaleString();
  document.getElementById("sidebarUpdatedAt").innerText = new Date(
    note.updatedAt,
  ).toLocaleString();

  const starIcon = document.getElementById("starIcon");
  if (starIcon)
    starIcon.className = note.pinned
      ? "text-amber-400"
      : "text-gray-300 dark:text-zinc-600 hover:text-amber-400";

  clearAiChatHistory();
  renderSidebar();
  renderBacklinks();
};

export function renderBacklinks() {
  const container = document.getElementById("backlinksContainer");
  if (!container || !currentNoteId) return;
  const currentNote = notes.find((n) => n.id === currentNoteId);
  if (!currentNote) return;
  const targetTitle = (currentNote.title || "Untitled").toLowerCase();

  const links = notes.filter((n) => {
    if (n.id === currentNoteId || n.isDeleted || !n.content) return false;
    return n.content.toLowerCase().includes(`[[${targetTitle}]]`);
  });

  if (links.length === 0) {
    container.innerHTML = `<span class="text-gray-400">No backlinks found</span>`;
    return;
  }

  container.innerHTML = "";
  links.forEach((l) => {
    const btn = document.createElement("button");
    btn.className =
      "w-full text-left p-2 rounded hover:bg-gray-100 dark:hover:bg-zinc-900 truncate text-gray-700 dark:text-gray-300 transition-colors";
    btn.innerHTML = `<span class="text-xs mr-1">${l.icon || "📑"}</span>${l.title || "Untitled"}`;
    btn.onclick = () => selectNote(l.id);
    container.appendChild(btn);
  });
}

window.syncHeaderTitle = () => {
  const titleInput = document.getElementById("noteTitle");
  const headerTitle = document.getElementById("headerNoteTitle");
  if (titleInput && headerTitle) {
    headerTitle.innerText = titleInput.value.trim() || "Untitled";
  }
};

window.autoResizeTitle = (el) => {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
};

window.applyNoteCoverUI = (url) => {
  const container = document.getElementById("noteCoverContainer");
  const cover = document.getElementById("noteCover");
  const btn = document.getElementById("btnRemoveCover");
  if (!container || !cover) return;

  if (url) {
    container.classList.remove(
      "h-44",
      "bg-gradient-to-r",
      "from-slate-100",
      "to-gray-200",
      "dark:from-zinc-800",
      "dark:to-zinc-900",
    );
    container.classList.add("h-64");
    cover.style.backgroundImage = url.startsWith("linear")
      ? url
      : `url('${url}')`;
    if (btn) btn.classList.remove("hidden");
  } else {
    container.classList.remove("h-64");
    container.classList.add(
      "h-44",
      "bg-gradient-to-r",
      "from-slate-100",
      "to-gray-200",
      "dark:from-zinc-800",
      "dark:to-zinc-900",
    );
    cover.style.backgroundImage = "none";
    if (btn) btn.classList.add("hidden");
  }
};

window.selectCover = (url) => {
  if (!currentNoteId) return;
  const n = notes.find((x) => x.id === currentNoteId);
  if (n) {
    n.coverUrl = url;
    applyNoteCoverUI(url);
    saveToLocal();
    closeCoverPicker();
  }
};

window.applyCoverUrl = () => {
  const url = document.getElementById("coverUrlInput")?.value.trim();
  if (url) selectCover(url);
};

window.uploadCoverFile = (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    selectCover(dataUrl);

    fetch(dataUrl)
      .then((res) => res.blob())
      .then((blob) => {
        saveImageToDB(`cover_${currentNoteId}`, blob);
      });
  };
  reader.readAsDataURL(file);
};

window.removeNoteCover = () => {
  if (!currentNoteId) return;
  const n = notes.find((x) => x.id === currentNoteId);
  if (n) {
    n.coverUrl = "";
    applyNoteCoverUI("");
    saveToLocal();
    closeCoverPicker();
  }
};

window.selectRandomUnsplashCover = () => {
  const ids = [
    "1519681398601-9025d23053ef",
    "1472214103451-9374bd1c798e",
    "1497250681960-ef046c08a56e",
  ];
  const id = ids[Math.floor(Math.random() * ids.length)];
  selectCover(
    `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1600&q=80`,
  );
};

window.selectEmoji = (emoji) => {
  if (!currentNoteId) return;
  const n = notes.find((x) => x.id === currentNoteId);
  if (n) {
    n.icon = emoji;
    document.getElementById("noteIcon").innerText = emoji;
    saveToLocal();
    renderSidebar();
    closeEmojiPicker();
  }
};

window.removeNoteIcon = () => {
  if (!currentNoteId) return;
  const n = notes.find((x) => x.id === currentNoteId);
  if (n) {
    n.icon = "📑";
    document.getElementById("noteIcon").innerText = "📑";
    saveToLocal();
    renderSidebar();
  }
};

window.togglePinCurrentNote = () => {
  if (!currentNoteId) return;
  const note = notes.find((n) => n.id === currentNoteId);
  if (note) {
    note.pinned = !note.pinned;
    saveToLocal();
    renderSidebar();
    const starIcon = document.getElementById("starIcon");
    if (starIcon)
      starIcon.className = note.pinned
        ? "text-amber-400"
        : "text-gray-300 dark:text-zinc-600 hover:text-amber-400";
    showToast(note.pinned ? "Note pinned" : "Note unpinned");
  }
};

window.deleteCurrentNote = () => {
  const m = document.getElementById("confirmDeleteModal");
  if (m) m.classList.remove("hidden");
};

window.executeMoveToTrash = () => {
  if (!currentNoteId) return;
  const note = notes.find((n) => n.id === currentNoteId);
  if (note) {
    note.isDeleted = true;
    note.pinned = false;
    note.updatedAt = new Date().toISOString();
    saveToLocal();
    closeConfirmDelete();
    closeRightSidebar();
    setCurrentNoteId(null);
    document.getElementById("editorContainer")?.classList.add("hidden");
    document.getElementById("emptyState")?.classList.remove("hidden");
    renderSidebar();
    showToast("Note moved to trash");
  }
};

window.openTrashView = () => {
  document.getElementById("emptyState")?.classList.add("hidden");
  document.getElementById("editorContainer")?.classList.add("hidden");
  document.getElementById("trashEditorContainer")?.classList.add("hidden");
  document.getElementById("trashView")?.classList.remove("hidden");
  renderTrashList();
};

window.renderTrashList = () => {
  const list = document.getElementById("trashList");
  if (!list) return;
  list.innerHTML = "";
  const trashed = notes.filter((n) => n.isDeleted);
  if (trashed.length === 0) {
    list.innerHTML = '<p class="text-gray-400 text-sm">Trash is empty.</p>';
    return;
  }
  trashed.forEach((n) => {
    const item = document.createElement("div");
    item.className =
      "flex justify-between items-center p-4 bg-gray-50 dark:bg-zinc-800/50 rounded-xl border border-gray-200 dark:border-zinc-700 hover:border-gray-300 transition-colors";
    item.innerHTML = `
      <div class="flex-1 cursor-pointer" onclick="viewTrashedNote('${n.id}')">
        <h4 class="font-bold text-sm">${n.icon || "📑"} ${n.title || "Untitled"}</h4>
        <p class="text-xs text-gray-500 mt-1">Deleted: ${new Date(n.updatedAt).toLocaleDateString()}</p>
      </div>
      <div class="flex gap-2">
        <button onclick="restoreNote('${n.id}')" class="text-xs bg-black dark:bg-white text-white dark:text-black px-3 py-1.5 rounded-md font-medium">Restore</button>
        <button onclick="hardDeleteNote('${n.id}')" class="text-xs text-red-500 hover:text-red-700 font-medium px-2">Delete forever</button>
      </div>
    `;
    list.appendChild(item);
  });
};

window.viewTrashedNote = (id) => {
  const note = notes.find((n) => n.id === id);
  if (!note) return;
  setCurrentNoteId(id);
  document.getElementById("trashView")?.classList.add("hidden");
  document.getElementById("trashEditorContainer")?.classList.remove("hidden");
  document.getElementById("trashNoteTitleView").innerText =
    note.title || "Untitled";
  document.getElementById("trashNoteContentView").innerHTML =
    note.content || "<p class='text-gray-400 italic'>Empty note...</p>";
};

window.restoreNote = (id) => {
  const note = notes.find((n) => n.id === id);
  if (note) {
    note.isDeleted = false;
    note.updatedAt = new Date().toISOString();
    saveToLocal();
    renderTrashList();
    renderSidebar();
    showToast("Note restored");
  }
};

window.hardDeleteNote = (id) => {
  if (confirm("Are you sure? This cannot be undone.")) {
    const newNotes = notes.filter((n) => n.id !== id);
    setNotes(newNotes);
    saveToLocal();
    renderTrashList();
    showToast("Note permanently deleted");
  }
};

window.restoreCurrentNote = () => {
  if (currentNoteId) {
    restoreNote(currentNoteId);
    closeTrashEditor();
    selectNote(currentNoteId);
  }
};

window.hardDeleteCurrentNote = () => {
  if (currentNoteId) {
    hardDeleteNote(currentNoteId);
    closeTrashEditor();
    setCurrentNoteId(null);
  }
};

window.emptyTrash = () => {
  if (confirm("Empty all trash? This cannot be undone.")) {
    const newNotes = notes.filter((n) => !n.isDeleted);
    setNotes(newNotes);
    saveToLocal();
    renderTrashList();
    showToast("Trash emptied");
  }
};

window.renderTagsInput = (tagsArray) => {
  const container = document.getElementById("tagsContainer");
  if (!container) return;
  container.innerHTML = "";

  if (!currentNoteId) return;
  const activeNote = notes.find((n) => n.id === currentNoteId);
  if (activeNote) activeNote.tags = tagsArray.join(" ");

  tagsArray.forEach((tag) => {
    const t = tag.trim().replace(/^#/, "");
    if (!t) return;
    const pill = document.createElement("div");
    pill.className =
      "tag-pill flex items-center gap-1 bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded border border-gray-200 dark:border-zinc-700 text-[10px] font-medium";
    pill.innerHTML = `<span>#${t}</span> <button class="hover:text-red-500 ml-1 leading-none" onclick="removeTag(this, '${t}')">✕</button>`;
    container.appendChild(pill);
  });

  const addBtn = document.createElement("button");
  addBtn.className =
    "text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 px-1 py-0.5 border border-dashed border-gray-300 dark:border-zinc-600 rounded";
  addBtn.innerText = "+ Add tag";
  addBtn.onclick = () => {
    const val = prompt("Enter tag name (without #):");
    if (val) {
      const clean = val
        .trim()
        .replace(/^#/, "")
        .replace(/\s+/g, "-")
        .toLowerCase();
      if (clean && !tagsArray.includes(clean)) {
        tagsArray.push(clean);
        renderTagsInput(tagsArray);
        autoSave();
      }
    }
  };
  container.appendChild(addBtn);
};

window.removeTag = (btn, tagToRemove) => {
  const activeNote = notes.find((n) => n.id === currentNoteId);
  if (activeNote) {
    const tagsArray = (activeNote.tags || "")
      .split(" ")
      .filter((t) => t !== tagToRemove && t.trim() !== "");
    renderTagsInput(tagsArray);
    autoSave();
  }
};

window.restoreCurrentNoteBackup = () => {
  if (!currentNoteId) return;
  const backup = getBackupSnapshot(currentNoteId);
  if (backup && backup.note) {
    if (
      confirm(
        `Restore version from ${new Date(backup.timestamp).toLocaleString()}?`,
      )
    ) {
      const activeNote = notes.find((n) => n.id === currentNoteId);
      Object.assign(activeNote, backup.note);
      saveToLocal();
      selectNote(currentNoteId);
      showToast("Previous version restored", "success");
    }
  } else {
    showToast("No backup available for this note.", "info");
  }
};

window.exportMarkdown = () => {
  if (!currentNoteId) return;
  const n = notes.find((x) => x.id === currentNoteId);
  if (!n) return;
  const plainText = getEditorPlainContent();
  const blob = new Blob([plainText], { type: "text/markdown" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${n.title || "Untitled"}.md`;
  a.click();
  showToast("Markdown exported");
};

window.exportHTML = () => {
  if (!currentNoteId) return;
  const n = notes.find((x) => x.id === currentNoteId);
  if (!n) return;
  const htmlContent = getEditorHtmlContent();
  const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${n.title}</title></head><body><h1>${n.title}</h1>${htmlContent}</body></html>`;
  const blob = new Blob([fullHtml], { type: "text/html" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${n.title || "Untitled"}.html`;
  a.click();
  showToast("HTML exported");
};

window.exportBackup = () => {
  const data = JSON.stringify(notes, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `cogito_backup_${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  showToast("Backup exported successfully", "success");
};

window.importBackup = (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const importedNotes = JSON.parse(e.target.result);
      if (Array.isArray(importedNotes)) {
        if (
          confirm(
            "This will merge imported notes with existing ones. Continue?",
          )
        ) {
          const newNotesMap = new Map(notes.map((n) => [n.id, n]));
          importedNotes.forEach((n) => newNotesMap.set(n.id, n));
          setNotes(Array.from(newNotesMap.values()));
          saveToLocal();
          renderSidebar();
          showToast("Backup imported successfully!", "success");
        }
      }
    } catch (err) {
      showToast("Invalid backup file.", "error");
    }
  };
  reader.readAsText(file);
};

window.changeFont = (fontFamily, btn) => {
  document.getElementById("innerContent").style.fontFamily = fontFamily;
  document
    .querySelectorAll(".font-selection-group button")
    .forEach((b) => b.classList.remove("font-active"));
  btn.classList.add("font-active");
};

window.changeFontSize = (size) => {
  document.getElementById("innerContent").style.fontSize = size;
};

window.toggleSidebarMinify = () => {
  const sidebar = document.getElementById("leftSidebar");
  const icon = document.getElementById("tabIcon");
  if (!sidebar || !icon) return;

  if (sidebar.style.width === "64px") {
    sidebar.style.width = "280px";
    icon.innerHTML = "&lt;&lt;";
    document
      .querySelectorAll(".hide-on-mini")
      .forEach((el) => el.classList.remove("hidden"));
    document
      .querySelectorAll(".show-on-mini")
      .forEach((el) => el.classList.add("hidden"));
    document.querySelectorAll(".mini-btn").forEach((el) => {
      el.classList.remove("p-2");
      el.classList.add("py-2", "px-4");
    });
    document.querySelector(".mini-col").classList.remove("flex-col");
  } else {
    sidebar.style.width = "64px";
    icon.innerHTML = "&gt;&gt;";
    document
      .querySelectorAll(".hide-on-mini")
      .forEach((el) => el.classList.add("hidden"));
    document
      .querySelectorAll(".show-on-mini")
      .forEach((el) => el.classList.remove("hidden"));
    document.querySelectorAll(".mini-btn").forEach((el) => {
      el.classList.remove("py-2", "px-4");
      el.classList.add("p-2");
    });
    document.querySelector(".mini-col").classList.add("flex-col");
  }
};

window.applyTemplate = (type) => {
  if (!currentNoteId) return;
  const note = notes.find((n) => n.id === currentNoteId);
  if (!note) return;

  if (type === "daily") {
    note.title = "Daily Journal";
    note.icon = "📅";
    note.content = `<div data-type="h2">Goals for today</div><div data-type="todo" data-checked="false"></div><div data-type="h2">Notes</div><p></p>`;
  } else if (type === "project") {
    note.title = "Project Planner";
    note.icon = "🚀";
    note.content = `<div data-type="h2">Objective</div><p></p><div data-type="h2">Tasks</div><div data-type="todo" data-checked="false"></div>`;
  } else if (type === "meeting") {
    note.title = "Meeting Notes";
    note.icon = "👥";
    note.content = `<div data-type="h2">Agenda</div><div data-type="bullet"></div><div data-type="h2">Action Items</div><div data-type="todo" data-checked="false"></div>`;
  } else if (type === "todo") {
    note.title = "To-Do List";
    note.icon = "☑️";
    note.content = `<div data-type="todo" data-checked="false"></div><div data-type="todo" data-checked="false"></div>`;
  }

  saveToLocal();
  closeTemplatePicker();

  if (typeof selectNote === "function") {
    selectNote(currentNoteId);
  } else if (typeof window.selectNote === "function") {
    window.selectNote(currentNoteId);
  }
};

document.addEventListener("DOMContentLoaded", async () => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("./sw.js")
      .catch((err) => console.error("SW registration failed", err));
  }

  applyTheme();
  applyFocusMode();
  applyAiState();
  applyFullWidth();

  const savedKey = localStorage.getItem("gemini_api_key");
  if (savedKey) {
    const input = document.getElementById("geminiKey");
    if (input) input.value = savedKey;
  }

  try {
    const loadedNotes = await loadNotesFromStorage();
    if (loadedNotes && loadedNotes.length > 0) {
      setNotes(loadedNotes);
    }
  } catch (e) {
    console.error("Storage load failed", e);
  }

  const persistedNoteId = loadCurrentNoteIdFromLocalStorage();
  if (persistedNoteId) {
    setCurrentNoteId(persistedNoteId);
  }

  renderSidebar();

  // Show the dashboard by default unless there is an explicitly selected note.
  if (currentNoteId) {
    const selectedNote = notes.find(
      (n) => n.id === currentNoteId && !n.isDeleted,
    );

    if (selectedNote) {
      if (typeof window.selectNote === "function") {
        window.selectNote(currentNoteId);
      } else if (typeof selectNote === "function") {
        selectNote(currentNoteId);
      }
    } else {
      if (typeof window.goToDashboard === "function") {
        window.goToDashboard();
      } else if (typeof goToDashboard === "function") {
        goToDashboard();
      }
    }
  } else {
    if (typeof window.goToDashboard === "function") {
      window.goToDashboard();
    } else if (typeof goToDashboard === "function") {
      goToDashboard();
    }
  }

  const resizer = document.getElementById("resizer");
  const sidebar = document.getElementById("leftSidebar");
  let isResizing = false;

  window.addEventListener("beforeunload", () => {
    persistNotesToLocalStorage();
  });

  resizer.addEventListener("mousedown", (e) => {
    isResizing = true;
    document.body.style.cursor = "col-resize";
  });

  document.addEventListener("mousemove", (e) => {
    if (!isResizing) return;
    let newWidth = e.clientX;
    if (newWidth < 200) newWidth = 200;
    if (newWidth > 600) newWidth = 600;
    sidebar.style.width = newWidth + "px";
  });

  document.addEventListener("mouseup", () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = "default";
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "s") {
      e.preventDefault();
      saveToLocal();
      showToast("Saved manually");
    }
    if (e.ctrlKey && e.key === "k") {
      e.preventDefault();
      document.getElementById("searchInput")?.focus();
    }
    if (e.ctrlKey && e.key === " ") {
      e.preventDefault();
      document.getElementById("aiQuery")?.focus();
    }
  });

  const apiKeyInput = document.getElementById("geminiKey");
  if (apiKeyInput) {
    apiKeyInput.addEventListener("change", saveApiKey);
  }

  // Exports to window to satisfy HTML inline event handlers are moved to top-level
});
