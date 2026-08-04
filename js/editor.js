import { notes, currentNoteId, activeSlashRow, slashIndex, setActiveSlashRow, setSlashIndex } from "./state.js";
import { saveToLocal, autoSave, saveImageToDB } from "./storage.js";
import { runInlineAiAction } from "./ai.js";
import { showToast, closeTemplatePicker } from "./ui.js";
import { renderSidebar } from "./sidebar.js";

export function createBlockRow(html = "", type = "p") {
  const row = document.createElement("div");
  row.className = "editor-row group flex items-start -ml-8";
  
  const controls = document.createElement("div");
  controls.className = "flex items-center gap-0.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity w-8 justify-center select-none";
  
  const addBtn = document.createElement("button");
  addBtn.className = "text-gray-400 hover:text-black dark:hover:text-white text-lg leading-none cursor-pointer p-0.5 add-btn";
  addBtn.innerText = "+";
  addBtn.title = "Add block";
  addBtn.onclick = (e) => {
    const newRow = createBlockRow();
    row.parentNode.insertBefore(newRow, row.nextSibling);
    newRow.querySelector(".editable").focus();
  };
  
  const dragHandle = document.createElement("div");
  dragHandle.className = "text-gray-400 hover:text-black dark:hover:text-white cursor-grab p-0.5 drag-handle active:cursor-grabbing";
  dragHandle.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>`;
  dragHandle.title = "Drag to move";
  
  controls.appendChild(addBtn);
  controls.appendChild(dragHandle);
  row.appendChild(controls);

  const contentWrapper = document.createElement("div");
  contentWrapper.className = "flex-1 relative";

  if (type === "todo") {
    row.dataset.type = "todo";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "absolute left-0 top-1.5 w-4 h-4 rounded border-gray-300 text-black dark:text-white focus:ring-0 cursor-pointer";
    checkbox.onchange = autoSave;
    contentWrapper.appendChild(checkbox);
    const editable = document.createElement("div");
    editable.className = "editable pl-6 outline-none py-0.5 min-h-[24px] text-gray-800 dark:text-gray-200 transition-all focus:bg-gray-50/50 dark:focus:bg-zinc-800/30 rounded";
    editable.contentEditable = "true";
    editable.innerHTML = html;
    editable.dataset.placeholder = "To-Do...";
    contentWrapper.appendChild(editable);
  } else if (type === "callout") {
    row.dataset.type = "callout";
    const calloutWrapper = document.createElement("div");
    calloutWrapper.className = "flex gap-3 bg-gray-50 dark:bg-zinc-800/60 p-4 rounded-xl border border-gray-200 dark:border-zinc-700 w-full";
    const iconSpan = document.createElement("span");
    iconSpan.innerText = "💡";
    iconSpan.className = "text-xl select-none";
    calloutWrapper.appendChild(iconSpan);
    const editableCall = document.createElement("div");
    editableCall.className = "editable flex-1 outline-none text-gray-800 dark:text-gray-200";
    editableCall.contentEditable = "true";
    editableCall.innerHTML = html;
    editableCall.setAttribute("data-placeholder", "Enter important notice...");
    calloutWrapper.appendChild(editableCall);
    contentWrapper.appendChild(calloutWrapper);
  } else if (type === "divider") {
    row.dataset.type = "divider";
    const hr = document.createElement("hr");
    hr.className = "my-4 border-gray-200 dark:border-zinc-800";
    contentWrapper.appendChild(hr);
    const editable = document.createElement("div");
    editable.className = "editable hidden";
    contentWrapper.appendChild(editable);
  } else {
    const editable = document.createElement("div");
    editable.className = "editable outline-none py-0.5 min-h-[24px] text-gray-800 dark:text-gray-200 transition-all focus:bg-gray-50/50 dark:focus:bg-zinc-800/30 rounded";
    if (type === "h1") editable.classList.add("text-3xl", "font-bold", "mt-6", "mb-2");
    if (type === "h2") editable.classList.add("text-2xl", "font-bold", "mt-5", "mb-1");
    if (type === "h3") editable.classList.add("text-xl", "font-semibold", "mt-4", "mb-1");
    if (type === "quote") editable.classList.add("border-l-4", "border-black", "dark:border-white", "pl-4", "italic", "text-gray-600", "dark:text-gray-400", "my-2");
    if (type === "bullet") editable.classList.add("list-item", "list-disc", "ml-5");
    if (type === "number") editable.classList.add("list-item", "list-decimal", "ml-5");
    
    editable.contentEditable = "true";
    editable.innerHTML = html;
    editable.dataset.placeholder = type.startsWith("h") ? "Heading..." : type === "quote" ? "Empty quote" : "Type '/' for commands";
    contentWrapper.appendChild(editable);
  }
  
  row.appendChild(contentWrapper);
  attachEditorRowEvents(row);
  return row;
}

export function executeSlashCommand(cmd) {
  if (!activeSlashRow) return;
  const editable = activeSlashRow.querySelector(".editable");
  if (!editable) return;
  
  let val = editable.innerText;
  const match = val.match(/\/\w*$/);
  if (match) {
    val = val.substring(0, match.index);
  }
  
  let newRow;
  if (["p", "h1", "h2", "h3", "quote", "bullet", "number", "todo", "callout", "divider"].includes(cmd)) {
    newRow = createBlockRow(val, cmd);
    activeSlashRow.parentNode.replaceChild(newRow, activeSlashRow);
    const newEditable = newRow.querySelector(".editable");
    if (cmd !== "divider") {
      newEditable.focus();
      placeCaretAtEnd(newEditable);
    }
  } else if (cmd === "template") {
    newRow = createBlockRow(val, "p");
    activeSlashRow.parentNode.replaceChild(newRow, activeSlashRow);
    const m = document.getElementById("slashMenu");
    if (m) m.classList.add("hidden");
    const tp = document.getElementById("templatePickerModal");
    if (tp) tp.classList.remove("hidden");
    return;
  } else if (cmd.startsWith("ai-")) {
    editable.innerText = val + " /" + cmd + " ";
    editable.focus();
    placeCaretAtEnd(editable);
  }
  
  const menu = document.getElementById("slashMenu");
  if (menu) menu.classList.add("hidden");
  setActiveSlashRow(null);
  autoSave();
}

function placeCaretAtEnd(el) {
  el.focus();
  if (typeof window.getSelection !== "undefined" && typeof document.createRange !== "undefined") {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

function attachEditorRowEvents(row) {
  const editable = row.querySelector(".editable");
  if (!editable) return;
  
  editable.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const text = editable.innerText.trim();
      if (text.startsWith("/ai-fix ") || text.startsWith("/ai-translate ") || text.startsWith("/ai-expand ")) {
        const action = text.split(" ")[0].replace("/ai-", "");
        runInlineAiAction(action, editable);
        return;
      }
      const newRow = createBlockRow();
      row.parentNode.insertBefore(newRow, row.nextSibling);
      newRow.querySelector(".editable").focus();
      autoSave();
    } else if (e.key === "Backspace" && editable.innerText === "") {
      e.preventDefault();
      const prev = row.previousElementSibling;
      if (prev && prev.classList.contains("editor-row")) {
        const prevEdit = prev.querySelector(".editable");
        if (prevEdit) {
          prevEdit.focus();
          placeCaretAtEnd(prevEdit);
        }
        row.remove();
        autoSave();
      }
    }
  });

  editable.addEventListener("input", (e) => {
    const text = editable.innerText;
    if (text.endsWith("/")) {
      showSlashMenu(editable);
    } else {
      const match = text.match(/\/\w*$/);
      if (match) {
        filterSlashMenu(match[0].substring(1));
      } else {
        const menu = document.getElementById("slashMenu");
        if (menu) menu.classList.add("hidden");
      }
    }
    autoSave();
    updateFullEditorWordCount();
  });
}

function showSlashMenu(editableElement) {
  const menu = document.getElementById("slashMenu");
  if (!menu) return;
  const row = editableElement.closest(".editor-row");
  setActiveSlashRow(row);
  const rect = editableElement.getBoundingClientRect();
  menu.style.left = `${rect.left}px`;
  menu.style.top = `${rect.bottom + window.scrollY + 5}px`;
  menu.classList.remove("hidden");
  
  const items = menu.querySelectorAll(".slash-item");
  items.forEach(i => i.classList.remove("bg-gray-100", "dark:bg-zinc-800"));
  if (items.length > 0) items[0].classList.add("bg-gray-100", "dark:bg-zinc-800");
  setSlashIndex(0);
}

function filterSlashMenu(term) {
  const menu = document.getElementById("slashMenu");
  if (!menu) return;
  const items = menu.querySelectorAll(".slash-item");
  let hasVisible = false;
  items.forEach(item => {
    const text = item.innerText.toLowerCase();
    if (text.includes(term.toLowerCase())) {
      item.style.display = "flex";
      hasVisible = true;
    } else {
      item.style.display = "none";
    }
    item.classList.remove("bg-gray-100", "dark:bg-zinc-800");
  });
  if (hasVisible) {
    const visibleItems = Array.from(items).filter(i => i.style.display !== "none");
    if (visibleItems.length > 0) visibleItems[0].classList.add("bg-gray-100", "dark:bg-zinc-800");
    setSlashIndex(0);
  } else {
    menu.classList.add("hidden");
  }
}

export function updateFullEditorWordCount() {
  const content = document.getElementById("noteContent");
  const counter = document.getElementById("wordCounter");
  if (!content || !counter) return;
  let text = "";
  content.querySelectorAll(".editable").forEach((el) => {
    text += el.innerText + " ";
  });
  text = text.trim();
  const words = text ? text.split(/\s+/).length : 0;
  const chars = text.length;
  const readingTime = Math.ceil(words / 200);
  counter.innerText = `${words} words • ${chars} chars • ${readingTime} min read`;
}

export function getEditorHtmlContent() {
  const content = document.getElementById("noteContent");
  if (!content) return "";
  let html = "";
  let currentListType = null;
  content.querySelectorAll(".editor-row").forEach(row => {
    const type = row.dataset.type || "p";
    const editable = row.querySelector(".editable");
    const val = editable ? editable.innerHTML : "";
    
    if (type !== "bullet" && type !== "number" && currentListType) {
      html += `</${currentListType}>`;
      currentListType = null;
    }
    
    if (type === "todo") {
      const isChecked = row.querySelector("input[type='checkbox']")?.checked;
      html += `<div data-type="todo" data-checked="${isChecked}">${val}</div>`;
    } else if (type === "callout") {
      html += `<div data-type="callout">${val}</div>`;
    } else if (type === "divider") {
      html += `<div data-type="divider"></div>`;
    } else if (type === "h1") html += `<h1>${val}</h1>`;
    else if (type === "h2") html += `<h2>${val}</h2>`;
    else if (type === "h3") html += `<h3>${val}</h3>`;
    else if (type === "quote") html += `<blockquote>${val}</blockquote>`;
    else if (type === "bullet") {
      if (currentListType !== "ul") {
        if (currentListType) html += `</${currentListType}>`;
        html += `<ul>`;
        currentListType = "ul";
      }
      html += `<li>${val}</li>`;
    }
    else if (type === "number") {
      if (currentListType !== "ol") {
        if (currentListType) html += `</${currentListType}>`;
        html += `<ol>`;
        currentListType = "ol";
      }
      html += `<li>${val}</li>`;
    }
    else html += `<p>${val}</p>`;
  });
  
  if (currentListType) {
    html += `</${currentListType}>`;
  }
  
  return html;
}

export function getEditorPlainContent() {
  const content = document.getElementById("noteContent");
  if (!content) return "";
  let text = "";
  content.querySelectorAll(".editable").forEach(el => {
    text += el.innerText + "\n";
  });
  return text;
}

export function loadContentIntoEditor(htmlString) {
  const container = document.getElementById("noteContent");
  if (!container) return;
  container.innerHTML = "";
  if (!htmlString || htmlString.trim() === "") {
    container.appendChild(createBlockRow());
    return;
  }
  const temp = document.createElement("div");
  temp.innerHTML = htmlString;
  temp.childNodes.forEach(node => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      let tag = node.tagName.toLowerCase();
      let val = node.innerHTML;
      if (node.hasAttribute("data-type")) {
        const type = node.getAttribute("data-type");
        const row = createBlockRow(val, type);
        if (type === "todo" && node.getAttribute("data-checked") === "true") {
          row.querySelector("input[type='checkbox']").checked = true;
        }
        container.appendChild(row);
      } else if (tag === "h1") container.appendChild(createBlockRow(val, "h1"));
      else if (tag === "h2") container.appendChild(createBlockRow(val, "h2"));
      else if (tag === "h3") container.appendChild(createBlockRow(val, "h3"));
      else if (tag === "blockquote") container.appendChild(createBlockRow(val, "quote"));
      else if (tag === "ul") {
        node.querySelectorAll("li").forEach(li => container.appendChild(createBlockRow(li.innerHTML, "bullet")));
      }
      else if (tag === "ol") {
        node.querySelectorAll("li").forEach(li => container.appendChild(createBlockRow(li.innerHTML, "number")));
      }
      else if (tag === "hr") container.appendChild(createBlockRow("", "divider"));
      else container.appendChild(createBlockRow(val, "p"));
    }
  });
  if (container.children.length === 0) {
    container.appendChild(createBlockRow());
  }
  updateFullEditorWordCount();
}
