import { notes, currentNoteId, setNotes } from "./state.js";
import { saveToLocal } from "./storage.js";
import { renderDashboard } from "./ui.js";

const activeTagFilters = new Set();
let isMouseDown = false;
let isDragging = false;
let startX = 0;
let scrollLeft = 0;
let targetScrollLeft = 0;
let animationFrameId = null;

let draggedNoteId = null;

window.toggleSidebarTagFilter = (tag) => {
  if (activeTagFilters.has(tag)) activeTagFilters.delete(tag);
  else activeTagFilters.add(tag);
  if (window.renderSidebar) window.renderSidebar();
};

function updateTagsFadeMask(container) {
  const wrapper = container.parentElement;
  if (!wrapper) return;
  const currentScroll = container.scrollLeft;
  const maxScroll = container.scrollWidth - container.clientWidth;
  if (maxScroll <= 2) {
    wrapper.style.webkitMaskImage = "none";
    wrapper.style.maskImage = "none";
    return;
  }
  const isAtStart = currentScroll <= 6;
  const isAtEnd = currentScroll >= maxScroll - 6;
  const fadeWidth = "24px";
  let mask = "";
  if (isAtStart)
    mask = `linear-gradient(to right, black 0%, black calc(100% - ${fadeWidth}), transparent 100%)`;
  else if (isAtEnd)
    mask = `linear-gradient(to right, transparent 0%, black ${fadeWidth}, black 100%)`;
  else
    mask = `linear-gradient(to right, transparent 0%, black ${fadeWidth}, black calc(100% - ${fadeWidth}), transparent 100%)`;
  wrapper.style.webkitMaskImage = mask;
  wrapper.style.maskImage = mask;
}

function animateScroll(container) {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  function step() {
    const maxScroll = container.scrollWidth - container.clientWidth;
    const diff = targetScrollLeft - container.scrollLeft;
    if (Math.abs(diff) > 0.4) {
      container.scrollLeft += diff * 0.25;
      updateTagsFadeMask(container);
      animationFrameId = requestAnimationFrame(step);
    } else {
      if (targetScrollLeft <= 5) container.scrollLeft = 0;
      else if (targetScrollLeft >= maxScroll - 5)
        container.scrollLeft = maxScroll;
      else container.scrollLeft = targetScrollLeft;
      updateTagsFadeMask(container);
      animationFrameId = null;
    }
  }
  animationFrameId = requestAnimationFrame(step);
}

function setupDragAndWheelScroll(container) {
  if (!container || container.dataset.scrollInitialized) return;
  container.dataset.scrollInitialized = "true";
  container.addEventListener("scroll", () => {
    if (!isMouseDown && !animationFrameId)
      targetScrollLeft = container.scrollLeft;
    updateTagsFadeMask(container);
  });
  container.addEventListener(
    "wheel",
    (e) => {
      if (e.deltaY !== 0 || e.deltaX !== 0) {
        e.preventDefault();
        const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
        const maxScroll = container.scrollWidth - container.clientWidth;
        if (!animationFrameId) targetScrollLeft = container.scrollLeft;
        let newTarget = targetScrollLeft + delta * 0.85;
        if (newTarget <= 10 || (delta < 0 && container.scrollLeft <= 15))
          newTarget = -20;
        else if (
          newTarget >= maxScroll - 10 ||
          (delta > 0 && container.scrollLeft >= maxScroll - 15)
        )
          newTarget = maxScroll + 20;
        targetScrollLeft = Math.max(-20, Math.min(maxScroll + 20, newTarget));
        animateScroll(container);
      }
    },
    { passive: false },
  );
  container.addEventListener("mousedown", (e) => {
    isMouseDown = true;
    isDragging = false;
    startX = e.pageX - container.offsetLeft;
    scrollLeft = container.scrollLeft;
    targetScrollLeft = container.scrollLeft;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
  });
  container.addEventListener("mouseleave", () => {
    isMouseDown = false;
    isDragging = false;
    container.classList.remove("cursor-grabbing");
  });
  container.addEventListener("mouseup", () => {
    isMouseDown = false;
    setTimeout(() => {
      isDragging = false;
    }, 50);
    container.classList.remove("cursor-grabbing");
  });
  container.addEventListener("mousemove", (e) => {
    if (!isMouseDown) return;
    const x = e.pageX - container.offsetLeft;
    const walk = x - startX;
    if (Math.abs(walk) > 3) {
      isDragging = true;
      container.classList.add("cursor-grabbing");
      e.preventDefault();
      container.scrollLeft = scrollLeft - walk;
      targetScrollLeft = container.scrollLeft;
      updateTagsFadeMask(container);
    }
  });
}

function buildNoteTree(allNotes, parentId, query, onSelectNote, depth = 0) {
  const currentLevelNotes = allNotes.filter((n) => {
    const pId = n.parentId || null;
    return pId === parentId;
  });

  if (currentLevelNotes.length === 0 && depth > 0) return null;

  const fragment = document.createDocumentFragment();

  currentLevelNotes.forEach((note) => {
    const itemContainer = document.createElement("div");
    itemContainer.className = "note-hierarchy-item-wrapper";

    const item = document.createElement("div");
    const isCurrent = note.id === currentNoteId;

    item.className = `group/sidebar flex items-center justify-between mx-2 my-0.5 p-2 rounded cursor-pointer text-sm font-medium transition-all relative select-none note-sidebar-item ${
      isCurrent
        ? "bg-gray-200 dark:bg-zinc-800 text-gray-900 dark:text-white font-semibold"
        : "text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-900/60 hover:text-gray-900 dark:hover:text-gray-200"
    }`;

    item.style.paddingLeft = `${Math.max(8, depth * 16)}px`;
    item.dataset.noteId = note.id;
    item.draggable = true;

    item.onclick = (e) => {
      if (e.target.closest(".add-subpage-btn")) return;
      onSelectNote(note.id);
    };

    item.addEventListener("dragstart", (e) => {
      draggedNoteId = note.id;
      e.dataTransfer.setData("text/plain", note.id);
      item.classList.add("opacity-40");
      e.stopPropagation();
    });

    item.addEventListener("dragend", (e) => {
      item.classList.remove("opacity-40");
      document.querySelectorAll(".note-sidebar-item").forEach((el) => {
        el.classList.remove(
          "drag-over-nested",
          "drag-over-top",
          "drag-over-bottom",
        );
      });
      draggedNoteId = null;
      e.stopPropagation();
    });

    item.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (draggedNoteId === note.id) return;
      if (isDescendant(draggedNoteId, note.id, allNotes)) return;

      const rect = item.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;

      document
        .querySelectorAll(".note-sidebar-item")
        .forEach((el) =>
          el.classList.remove(
            "drag-over-nested",
            "drag-over-top",
            "drag-over-bottom",
          ),
        );

      if (relativeY < rect.height * 0.25) {
        item.classList.add("drag-over-top");
      } else if (relativeY > rect.height * 0.75) {
        item.classList.add("drag-over-bottom");
      } else {
        item.classList.add("drag-over-nested");
      }
    });

    item.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const sourceId = e.dataTransfer.getData("text/plain");
      if (!sourceId || sourceId === note.id) return;
      if (isDescendant(sourceId, note.id, allNotes)) return;

      const rect = item.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;

      const updatedNotes = [...allNotes];
      const sourceNote = updatedNotes.find((n) => n.id === sourceId);
      const targetIndex = updatedNotes.findIndex((n) => n.id === note.id);

      if (relativeY < rect.height * 0.25) {
        sourceNote.parentId = note.parentId || null;
        const cleanNotes = updatedNotes.filter((n) => n.id !== sourceId);
        const currTargetIdx = cleanNotes.findIndex((n) => n.id === note.id);
        cleanNotes.splice(currTargetIdx, 0, sourceNote);
        setNotes(cleanNotes);
      } else if (relativeY > rect.height * 0.75) {
        sourceNote.parentId = note.parentId || null;
        const cleanNotes = updatedNotes.filter((n) => n.id !== sourceId);
        const currTargetIdx = cleanNotes.findIndex((n) => n.id === note.id);
        cleanNotes.splice(currTargetIdx + 1, 0, sourceNote);
        setNotes(cleanNotes);
      } else {
        sourceNote.parentId = note.id;
        const cleanNotes = updatedNotes.filter((n) => n.id !== sourceId);
        cleanNotes.unshift(sourceNote);
        setNotes(cleanNotes);
      }

      saveToLocal();
      renderSidebar(onSelectNote);
    });

    const hasChildren = allNotes.some(
      (n) => n.parentId === note.id && !n.isDeleted,
    );
    const contentDiv = document.createElement("div");
    contentDiv.className = "flex items-center flex-1 truncate";

    if (hasChildren) {
      const chevron = document.createElement("span");
      chevron.className =
        "mr-1 text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-transform cursor-pointer flex-shrink-0 text-[10px] rotate-90";
      chevron.innerHTML = "▶";
      chevron.onclick = (e) => {
        e.stopPropagation();
        chevron.classList.toggle("rotate-90");
        const childrenContainer = itemContainer.querySelector(
          ".note-children-container",
        );
        if (childrenContainer) childrenContainer.classList.toggle("hidden");
      };
      contentDiv.appendChild(chevron);
    } else {
      const spacer = document.createElement("span");
      spacer.className = "w-3 mr-1 inline-block flex-shrink-0";
      contentDiv.appendChild(spacer);
    }

    const iconDisplay = note.icon ? `${note.icon} ` : "";
    const textSpan = document.createElement("span");
    textSpan.className = "truncate flex-1";
    textSpan.innerHTML =
      `<span class="mr-1 text-xs select-none">${iconDisplay}</span>` +
      (note.title || "Untitled");

    contentDiv.appendChild(textSpan);
    item.appendChild(contentDiv);

    const addSubpageBtn = document.createElement("button");
    addSubpageBtn.className =
      "add-subpage-btn opacity-0 group-hover/sidebar:opacity-100 text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 px-1 text-sm font-bold transition-opacity ml-2";
    addSubpageBtn.innerText = "+";
    addSubpageBtn.title = "Create subpage";
    addSubpageBtn.onclick = (e) => {
      e.stopPropagation();
      if (window.createNewNote) window.createNewNote(note.id);
    };
    item.appendChild(addSubpageBtn);

    itemContainer.appendChild(item);

    const childrenFragment = buildNoteTree(
      allNotes,
      note.id,
      query,
      onSelectNote,
      depth + 1,
    );
    if (childrenFragment) {
      const childrenContainer = document.createElement("div");
      childrenContainer.className = "note-children-container";
      childrenContainer.appendChild(childrenFragment);
      itemContainer.appendChild(childrenContainer);
    }

    fragment.appendChild(itemContainer);
  });

  return fragment;
}

function isDescendant(parentCandidateId, childId, allNotes) {
  let current = allNotes.find((n) => n.id === childId);
  while (current && current.parentId) {
    if (current.parentId === parentCandidateId) return true;
    current = allNotes.find((n) => n.id === current.parentId);
  }
  return false;
}

export function renderTagsBar(onSelectNote) {
  const container = document.getElementById("sidebarTagsContainer");
  if (!container) return;
  const allTags = new Set();
  notes.forEach((note) => {
    if (note.isDeleted || !note.tags) return;
    note.tags.split(" ").forEach((t) => {
      const clean = t.replace(/^#/, "").trim();
      if (clean) allTags.add(clean);
    });
  });

  for (const tag of activeTagFilters) {
    if (!allTags.has(tag)) {
      activeTagFilters.delete(tag);
    }
  }
  if (allTags.size === 0) {
    container.innerHTML =
      '<span class="text-[11px] text-gray-400 dark:text-zinc-500 pl-1">No tags</span>';
    updateTagsFadeMask(container);
    return;
  }
  container.innerHTML = "";
  allTags.forEach((tag) => {
    const isActive = activeTagFilters.has(tag);
    const pill = document.createElement("button");
    pill.className = `text-[11px] px-2 py-0.5 rounded-md border transition-all flex-shrink-0 font-medium select-none ${
      isActive
        ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white"
        : "bg-white dark:bg-zinc-900 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-zinc-800 hover:border-gray-400 dark:hover:border-zinc-600"
    }`;
    pill.innerText = `#${tag}`;
    pill.onclick = (e) => {
      if (isDragging) return;
      if (isActive) activeTagFilters.delete(tag);
      else activeTagFilters.add(tag);
      renderSidebar(onSelectNote);
    };
    container.appendChild(pill);
  });
  setupDragAndWheelScroll(container);
}

export function renderSidebar(onSelectNote) {
  const noteList = document.getElementById("noteList");
  if (!noteList) return;

  const selectNoteFn = onSelectNote || window.selectNote;
  const searchInput = document.getElementById("searchInput");
  const query = searchInput ? searchInput.value.toLowerCase().trim() : "";

  renderTagsBar(selectNoteFn);

  const filteredNotes = notes.filter((note) => {
    if (note.isDeleted) return false;
    const titleMatch = (note.title || "").toLowerCase().includes(query);
    const contentMatch = (note.content || "").toLowerCase().includes(query);
    const tagsMatch = (note.tags || "").toLowerCase().includes(query);
    const matchesQuery =
      query === "" || titleMatch || contentMatch || tagsMatch;

    let matchesTags = true;
    if (activeTagFilters.size > 0) {
      const noteTags = (note.tags || "")
        .split(" ")
        .map((t) => t.trim().toLowerCase());
      matchesTags = Array.from(activeTagFilters).every((filterTag) =>
        noteTags.includes(filterTag.toLowerCase()),
      );
    }
    return matchesQuery && matchesTags;
  });

  noteList.innerHTML = "";

  if (filteredNotes.length === 0) {
    noteList.innerHTML =
      '<p class="text-xs text-gray-400 text-center mt-8">No notes found.</p>';
    if (!currentNoteId && query === "" && activeTagFilters.size === 0) {
      renderDashboard(notes, selectNoteFn);
    }
    return;
  }

  const pinnedNotes = filteredNotes.filter((n) => n.pinned);

  if (pinnedNotes.length > 0 && query === "" && activeTagFilters.size === 0) {
    const pinnedLabel = document.createElement("div");
    pinnedLabel.className =
      "text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-4 mt-2 mb-1";
    pinnedLabel.innerText = "Pinned";
    noteList.appendChild(pinnedLabel);

    const pinnedFragment = document.createDocumentFragment();
    pinnedNotes.forEach((note) => {
      const item = document.createElement("div");
      const isCurrent = note.id === currentNoteId;
      const iconDisplay = note.icon ? `${note.icon} ` : "";
      item.className = `group flex items-center justify-between mx-2 my-0.5 p-2 rounded cursor-pointer text-sm font-medium truncate ${
        isCurrent
          ? "bg-gray-200 dark:bg-zinc-800 text-gray-900 dark:text-white font-semibold"
          : "text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-900/60"
      }`;
      item.innerHTML = `<span class="truncate flex-1"><span class="text-amber-400 mr-1.5 text-[10px]">★</span><span class="mr-1 text-xs select-none">${iconDisplay}</span>${note.title || "Untitled"}</span>`;
      item.onclick = () => selectNoteFn(note.id);
      pinnedFragment.appendChild(item);
    });
    noteList.appendChild(pinnedFragment);

    const allNotesLabel = document.createElement("div");
    allNotesLabel.className =
      "text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-4 mt-4 mb-1";
    allNotesLabel.innerText = "All notes";
    noteList.appendChild(allNotesLabel);
  }

  const unpinnedNotes = filteredNotes.filter(
    (n) => !n.pinned || query !== "" || activeTagFilters.size > 0,
  );

  if (query !== "" || activeTagFilters.size > 0) {
    const flatFragment = document.createDocumentFragment();
    filteredNotes.forEach((note) => {
      const item = document.createElement("div");
      const isCurrent = note.id === currentNoteId;
      const iconDisplay = note.icon ? `${note.icon} ` : "";
      item.className = `mx-2 my-0.5 p-2 rounded cursor-pointer text-sm font-medium truncate ${
        isCurrent
          ? "bg-gray-200 dark:bg-zinc-800 text-gray-900 dark:text-white"
          : "text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-900"
      }`;
      item.innerHTML = `<span class="mr-1 text-xs select-none">${iconDisplay}</span>${note.title || "Untitled"}`;
      item.onclick = () => selectNoteFn(note.id);
      flatFragment.appendChild(item);
    });
    noteList.appendChild(flatFragment);
  } else {
    const tree = buildNoteTree(filteredNotes, null, query, selectNoteFn, 0);
    if (tree) {
      noteList.appendChild(tree);
    } else if (pinnedNotes.length === 0) {
      noteList.innerHTML =
        '<p class="text-xs text-gray-400 text-center mt-8">Create your first note.</p>';
    }
  }

  if (!currentNoteId) {
    renderDashboard(notes, selectNoteFn);
  }
}

export function toggleRightSidebar(e) {
  if (e) e.stopPropagation();
  const sidebar = document.getElementById("rightSidebar");
  if (sidebar) sidebar.classList.toggle("translate-x-full");
}

export function closeRightSidebar() {
  const sidebar = document.getElementById("rightSidebar");
  if (sidebar) sidebar.classList.add("translate-x-full");
}

export function clearSearch() {
  const input = document.getElementById("searchInput");
  if (input) {
    input.value = "";
    toggleSearchClearBtn();
    renderSidebar();
  }
}

export function toggleSearchClearBtn() {
  const input = document.getElementById("searchInput");
  const btn = document.getElementById("clearSearchBtn");
  if (!input || !btn) return;
  if (input.value.trim().length > 0) btn.classList.remove("hidden");
  else btn.classList.add("hidden");
}
