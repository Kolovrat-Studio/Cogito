import { notes, currentNoteId } from "./state.js";
import { updateAutoSaveStatus } from "./ui.js";
import { getEditorHtmlContent } from "./editor.js";

const LOCAL_STORAGE_NOTES_KEY = "notionMinimalNotes";
const LOCAL_STORAGE_CURRENT_NOTE_KEY = "notionMinimalCurrentNoteId";
let db;

export function initDB() {
  if (db) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      return reject(new Error("IndexedDB is not supported in this browser."));
    }

    const openDatabase = (version) =>
      indexedDB.open("NotionMinimalDB", version);
    const request = openDatabase(2);

    request.onupgradeneeded = (e) => {
      const dbInstance = e.target.result;
      if (!dbInstance.objectStoreNames.contains("notes")) {
        dbInstance.createObjectStore("notes", { keyPath: "id" });
      }
      if (!dbInstance.objectStoreNames.contains("images")) {
        dbInstance.createObjectStore("images", { keyPath: "id" });
      }
    };

    request.onsuccess = (e) => {
      db = e.target.result;
      resolve();
    };

    request.onblocked = () => {
      console.warn("IndexedDB open request is blocked by another connection.");
      reject(new Error("IndexedDB is blocked"));
    };

    request.onerror = (e) => {
      const error = e.target?.error || e;
      if (error && error.name === "VersionError") {
        const fallbackRequest = openDatabase();
        fallbackRequest.onupgradeneeded = request.onupgradeneeded;
        fallbackRequest.onsuccess = (evt) => {
          db = evt.target.result;
          resolve();
        };
        fallbackRequest.onerror = (evt) => reject(evt.target?.error || evt);
        fallbackRequest.onblocked = request.onblocked;
        return;
      }
      reject(error);
    };
  });
}

export async function saveNotesToDB(notesArray) {
  if (!db) {
    await initDB();
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction("notes", "readwrite");
    const store = tx.objectStore("notes");
    const clearRequest = store.clear();
    clearRequest.onerror = (e) => reject(e.target.error || e);
    clearRequest.onsuccess = () => {
      notesArray.forEach((note) => store.put(note));
    };
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error || e);
  });
}

function saveNotesToLocalStorage(notesArray) {
  try {
    localStorage.setItem(LOCAL_STORAGE_NOTES_KEY, JSON.stringify(notesArray));
  } catch (error) {
    console.warn("Failed to save notes to localStorage:", error);
  }
}

function loadNotesFromLocalStorage() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_NOTES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Failed to load notes from localStorage:", error);
    return [];
  }
}

function flushCurrentEditorState() {
  if (!currentNoteId) return;
  const activeNote = notes.find((n) => n.id === currentNoteId);
  if (!activeNote) return;
  const titleInput = document.getElementById("noteTitle");
  if (titleInput) activeNote.title = titleInput.value;
  activeNote.content = getEditorHtmlContent();
  activeNote.updatedAt = new Date().toISOString();
}

export function saveCurrentNoteIdToLocalStorage() {
  try {
    if (currentNoteId) {
      localStorage.setItem(LOCAL_STORAGE_CURRENT_NOTE_KEY, currentNoteId);
    } else {
      localStorage.removeItem(LOCAL_STORAGE_CURRENT_NOTE_KEY);
    }
  } catch (error) {
    console.warn("Failed to persist current note ID:", error);
  }
}

export function loadCurrentNoteIdFromLocalStorage() {
  try {
    return localStorage.getItem(LOCAL_STORAGE_CURRENT_NOTE_KEY);
  } catch (error) {
    console.warn("Failed to load current note ID:", error);
    return null;
  }
}

export async function loadNotesFromStorage() {
  const localNotes = loadNotesFromLocalStorage();
  let dbNotes = [];

  try {
    await initDB();
    dbNotes = await new Promise((resolve, reject) => {
      const tx = db.transaction("notes", "readonly");
      const store = tx.objectStore("notes");
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch (error) {
    console.warn("IndexedDB unavailable; using localStorage only.", error);
    return localNotes;
  }

  return chooseBestNotes(localNotes, dbNotes);
}

function getLatestTimestamp(notesArray) {
  if (!notesArray || notesArray.length === 0) return 0;
  return notesArray.reduce((latest, note) => {
    const ts = new Date(note.updatedAt || note.createdAt || 0).getTime();
    return Math.max(latest, isNaN(ts) ? 0 : ts);
  }, 0);
}

function chooseBestNotes(localNotes, dbNotes) {
  if (!dbNotes || dbNotes.length === 0) return localNotes;
  if (!localNotes || localNotes.length === 0) return dbNotes;
  if (localNotes.length !== dbNotes.length) {
    return localNotes.length > dbNotes.length ? localNotes : dbNotes;
  }
  const localLatest = getLatestTimestamp(localNotes);
  const dbLatest = getLatestTimestamp(dbNotes);
  return localLatest >= dbLatest ? localNotes : dbNotes;
}

export async function loadNotesFromDB() {
  const localNotes = loadNotesFromLocalStorage();

  try {
    await initDB();
  } catch (error) {
    console.warn("IndexedDB init failed:", error);
    return localNotes;
  }

  return new Promise((resolve) => {
    const tx = db.transaction("notes", "readonly");
    const store = tx.objectStore("notes");
    const request = store.getAll();
    request.onsuccess = () => {
      const notesFromDB = request.result || [];
      resolve(chooseBestNotes(localNotes, notesFromDB));
    };
    request.onerror = () => {
      resolve(localNotes);
    };
  });
}

export function saveImageToDB(imageId, blob) {
  return new Promise((resolve, reject) => {
    if (!db) return reject();
    const tx = db.transaction("images", "readwrite");
    const store = tx.objectStore("images");
    store.put({ id: imageId, blob: blob });
    tx.oncomplete = resolve;
    tx.onerror = reject;
  });
}

export function getImageFromDB(imageId) {
  return new Promise((resolve, reject) => {
    if (!db) return reject();
    const tx = db.transaction("images", "readonly");
    const store = tx.objectStore("images");
    const req = store.get(imageId);
    req.onsuccess = () => {
      resolve(req.result ? req.result.blob : null);
    };
    req.onerror = reject;
  });
}

export async function saveToLocal() {
  updateAutoSaveStatus("saving");
  if (currentNoteId) {
    const activeNote = notes.find((n) => n.id === currentNoteId);
    if (activeNote) {
      const titleInput = document.getElementById("noteTitle");
      if (titleInput) activeNote.title = titleInput.value;
      activeNote.content = getEditorHtmlContent();
      activeNote.updatedAt = new Date().toISOString();
      saveBackupSnapshot(activeNote.id, activeNote);
    }
  }

  flushCurrentEditorState();
  updateAutoSaveStatus("saving");

  saveNotesToLocalStorage(notes);
  saveCurrentNoteIdToLocalStorage();

  try {
    await saveNotesToDB(notes);
  } catch (error) {
    console.error("Failed saving notes to DB:", error);
  }

  if (window.renderSidebar) window.renderSidebar();
  if (window.syncHeaderTitle) window.syncHeaderTitle();
  if (window.renderBacklinks) window.renderBacklinks();

  updateAutoSaveStatus("saved");
}

export function persistNotesToLocalStorage() {
  flushCurrentEditorState();
  saveNotesToLocalStorage(notes);
  saveCurrentNoteIdToLocalStorage();
}

let autoSaveTimeout = null;
export function autoSave() {
  updateAutoSaveStatus("saving");
  clearTimeout(autoSaveTimeout);
  autoSaveTimeout = setTimeout(() => {
    saveToLocal();
  }, 1000);
}

export function saveBackupSnapshot(noteId, noteData) {
  const backups = JSON.parse(localStorage.getItem("noteBackups") || "{}");
  backups[noteId] = {
    timestamp: Date.now(),
    note: JSON.parse(JSON.stringify(noteData)),
  };
  localStorage.setItem("noteBackups", JSON.stringify(backups));
}

export function getBackupSnapshot(noteId) {
  const backups = JSON.parse(localStorage.getItem("noteBackups") || "{}");
  return backups[noteId] || null;
}
