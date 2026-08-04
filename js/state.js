// Application State
export const notes = []; // Sada je const, čuva referencu!
export let currentNoteId = null;
export let isDarkMode = localStorage.getItem("isDarkMode") === "true";
export let isAiEnabled = localStorage.getItem("isAiEnabled") === "true";
export let isFullWidth = localStorage.getItem("isFullWidth") === "true";
export let isFocusMode = localStorage.getItem("isFocusMode") === "true";

export let activeSlashRow = null;
export let slashIndex = 0;

export function setNotes(newNotes) {
  // Ovdje mutiramo postojeći niz umjesto da pravimo novi
  notes.length = 0;
  if (newNotes && newNotes.length > 0) {
    notes.push(...newNotes);
  }
}

export function setCurrentNoteId(id) {
  currentNoteId = id;
}
export function setIsDarkMode(val) {
  isDarkMode = val;
}
export function setIsAiEnabled(val) {
  isAiEnabled = val;
}
export function setIsFullWidth(val) {
  isFullWidth = val;
}
export function setIsFocusMode(val) {
  isFocusMode = val;
}
export function setActiveSlashRow(row) {
  activeSlashRow = row;
}
export function setSlashIndex(idx) {
  slashIndex = idx;
}
