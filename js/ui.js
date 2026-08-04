import { notes, currentNoteId, isDarkMode, setIsDarkMode, isAiEnabled, setIsAiEnabled, isFullWidth, setIsFullWidth, isFocusMode, setIsFocusMode } from "./state.js";
import { saveToLocal } from "./storage.js";

export function showToast(msg, type = "success") {
  const t = document.createElement("div");
  t.className = `fixed bottom-5 right-5 px-4 py-2 rounded-lg text-sm font-medium shadow-lg transition-all duration-300 transform translate-y-10 opacity-0 z-50 flex items-center gap-2 ${
    type === "success"
      ? "bg-black text-white dark:bg-white dark:text-black"
      : type === "error"
      ? "bg-red-500 text-white"
      : "bg-gray-100 text-gray-800 dark:bg-zinc-800 dark:text-gray-200 border border-gray-200 dark:border-zinc-700"
  }`;
  
  if (type === "success") {
    t.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>${msg}`;
  } else if (type === "error") {
    t.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>${msg}`;
  } else {
    t.innerHTML = `${msg}`;
  }
  
  document.body.appendChild(t);
  setTimeout(() => {
    t.classList.remove("translate-y-10", "opacity-0");
  }, 10);
  setTimeout(() => {
    t.classList.add("translate-y-10", "opacity-0");
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

export function updateAutoSaveStatus(status) {
  const dot = document.getElementById("saveIndicator");
  if (!dot) return;
  if (status === "saving") {
    dot.className = "save-dot saving";
    dot.title = "Saving...";
  } else if (status === "saved") {
    dot.className = "save-dot saved";
    dot.title = "Saved locally";
    setTimeout(() => {
      dot.className = "save-dot idle";
    }, 2000);
  }
}

export function applyTheme() {
  const html = document.documentElement;
  const btnText = document.getElementById("themeBtnText");
  if (isDarkMode) {
    html.classList.add("dark");
    if (btnText) btnText.innerHTML = "☀️ Light mode";
  } else {
    html.classList.remove("dark");
    if (btnText) btnText.innerHTML = "🌙 Dark mode";
  }
}

export function toggleDarkMode() {
  setIsDarkMode(!isDarkMode);
  localStorage.setItem("isDarkMode", isDarkMode);
  applyTheme();
}

export function toggleFocusModeStatus() {
  const toggle = document.getElementById("focusModeToggle");
  if (!toggle) return;
  setIsFocusMode(toggle.checked);
  localStorage.setItem("isFocusMode", isFocusMode);
  applyFocusMode();
}

export function applyFocusMode() {
  const body = document.getElementById("appBody");
  if (!body) return;
  if (isFocusMode) {
    body.classList.add("focus-mode-active");
  } else {
    body.classList.remove("focus-mode-active");
  }
  const toggle = document.getElementById("focusModeToggle");
  if (toggle) toggle.checked = isFocusMode;
}

export function toggleAiStatus() {
  const toggle = document.getElementById("aiToggle");
  if (!toggle) return;
  setIsAiEnabled(toggle.checked);
  localStorage.setItem("isAiEnabled", isAiEnabled);
  const btnAutoTag = document.getElementById("btnAutoTag");
  if (btnAutoTag) btnAutoTag.style.display = isAiEnabled ? "flex" : "none";
  const btnOrganize = document.getElementById("btnOrganize");
  if (btnOrganize) btnOrganize.style.display = isAiEnabled ? "inline-block" : "none";
  const dockedChat = document.getElementById("dockedChat");
  if (dockedChat) dockedChat.style.display = isAiEnabled ? "block" : "none";
  const apiKeyContainer = document.getElementById("apiKeyContainer");
  if (apiKeyContainer) apiKeyContainer.style.display = isAiEnabled ? "block" : "none";
}

export function applyAiState() {
  const toggle = document.getElementById("aiToggle");
  if (toggle) toggle.checked = isAiEnabled;
  const btnAutoTag = document.getElementById("btnAutoTag");
  if (btnAutoTag) btnAutoTag.style.display = isAiEnabled ? "flex" : "none";
  const btnOrganize = document.getElementById("btnOrganize");
  if (btnOrganize) btnOrganize.style.display = isAiEnabled ? "inline-block" : "none";
  const dockedChat = document.getElementById("dockedChat");
  if (dockedChat) dockedChat.style.display = isAiEnabled ? "block" : "none";
  const apiKeyContainer = document.getElementById("apiKeyContainer");
  if (apiKeyContainer) apiKeyContainer.style.display = isAiEnabled ? "block" : "none";
}

export function toggleFullWidth() {
  setIsFullWidth(!isFullWidth);
  localStorage.setItem("isFullWidth", isFullWidth);
  applyFullWidth();
}

export function applyFullWidth() {
  const content = document.getElementById("innerContent");
  const chat = document.getElementById("innerChat");
  const label = document.getElementById("widthLabel");
  if (!content || !chat || !label) return;
  if (isFullWidth) {
    content.classList.remove("max-w-3xl");
    content.classList.add("max-w-full", "px-12");
    chat.classList.remove("max-w-4xl");
    chat.classList.add("max-w-full", "px-12");
    label.innerText = "Centered layout";
  } else {
    content.classList.remove("max-w-full", "px-12");
    content.classList.add("max-w-3xl");
    chat.classList.remove("max-w-full", "px-12");
    chat.classList.add("max-w-4xl");
    label.innerText = "Full width";
  }
}

export function openSettingsModal() {
  const modal = document.getElementById("settingsModal");
  if (modal) modal.classList.remove("hidden");
}

export function closeSettingsModal() {
  const modal = document.getElementById("settingsModal");
  if (modal) modal.classList.add("hidden");
}

export function closeTrashView() {
  const view = document.getElementById("trashView");
  if (view) view.classList.add("hidden");
}

export function closeTrashEditor() {
  const c = document.getElementById("trashEditorContainer");
  if (c) c.classList.add("hidden");
  document.getElementById("trashView").classList.remove("hidden");
}

export function closeConfirmDelete() {
  const m = document.getElementById("confirmDeleteModal");
  if (m) m.classList.add("hidden");
}

export function openCoverPicker() {
  const c = document.getElementById("coverPickerModal");
  if (c) c.classList.remove("hidden");
}

export function closeCoverPicker() {
  const c = document.getElementById("coverPickerModal");
  if (c) c.classList.add("hidden");
}

export function openEmojiPicker() {
  const p = document.getElementById("emojiPickerModal");
  if (p) p.classList.remove("hidden");
}

export function closeEmojiPicker() {
  const p = document.getElementById("emojiPickerModal");
  if (p) p.classList.add("hidden");
}

export function openTemplatePicker() {
  const t = document.getElementById("templatePickerModal");
  if (t) t.classList.remove("hidden");
}

export function closeTemplatePicker() {
  const t = document.getElementById("templatePickerModal");
  if (t) t.classList.add("hidden");
}

export function renderDashboard(allNotes, selectNoteFn) {
  const emptyState = document.getElementById("emptyState");
  if (!emptyState) return;
  emptyState.classList.remove("hidden");
  document.getElementById("editorContainer")?.classList.add("hidden");
  document.getElementById("trashView")?.classList.add("hidden");
  document.getElementById("trashEditorContainer")?.classList.add("hidden");
  emptyState.innerHTML = "";

  const active = allNotes.filter(n => !n.isDeleted);
  
  const header = document.createElement("div");
  header.className = "mb-8 text-center max-w-xl mx-auto mt-4 md:mt-12";
  header.innerHTML = `<h2 class="text-3xl font-bold mb-2">Welcome to Notion Minimal</h2><p class="text-gray-500 dark:text-gray-400">Capture your ideas, manage tasks, and organize your thoughts.</p>`;
  emptyState.appendChild(header);

  const statsGrid = document.createElement("div");
  statsGrid.className = "grid grid-cols-2 gap-4 max-w-2xl mx-auto w-full mb-10";
  
  const notesCount = active.length;
  let wordCount = 0;
  active.forEach(n => {
    const text = n.content ? n.content.replace(/<[^>]*>?/gm, '') : '';
    if(text.trim()) wordCount += text.trim().split(/\s+/).length;
  });

  statsGrid.innerHTML = `
    <div class="bg-gray-50 dark:bg-zinc-800/50 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 text-center">
      <div class="text-4xl font-bold mb-1">${notesCount}</div>
      <div class="text-xs text-gray-500 uppercase tracking-wider font-semibold">Total Notes</div>
    </div>
    <div class="bg-gray-50 dark:bg-zinc-800/50 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 text-center">
      <div class="text-4xl font-bold mb-1">${wordCount}</div>
      <div class="text-xs text-gray-500 uppercase tracking-wider font-semibold">Words Written</div>
    </div>
  `;
  emptyState.appendChild(statsGrid);

  const recent = [...active].sort((a,b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)).slice(0, 4);
  
  if (recent.length > 0) {
    const recentSection = document.createElement("div");
    recentSection.className = "max-w-2xl mx-auto w-full";
    recentSection.innerHTML = `<h3 class="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 px-1">Recently Edited</h3>`;
    
    const grid = document.createElement("div");
    grid.className = "grid grid-cols-1 md:grid-cols-2 gap-3";
    
    recent.forEach(n => {
      const card = document.createElement("div");
      card.className = "p-4 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-gray-400 dark:hover:border-zinc-600 transition-all cursor-pointer shadow-sm hover:shadow group";
      card.onclick = () => selectNoteFn(n.id);
      
      const date = new Date(n.updatedAt).toLocaleDateString();
      const icon = n.icon ? `<span class="mr-2 text-xl">${n.icon}</span>` : '';
      
      card.innerHTML = `
        <div class="flex items-center mb-2">
          ${icon}
          <h4 class="font-bold text-gray-900 dark:text-gray-100 truncate flex-1">${n.title || "Untitled"}</h4>
        </div>
        <p class="text-xs text-gray-500">${date}</p>
      `;
      grid.appendChild(card);
    });
    
    recentSection.appendChild(grid);
    emptyState.appendChild(recentSection);
  }
}
