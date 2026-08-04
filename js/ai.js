import { getEditorPlainContent, loadContentIntoEditor, updateFullEditorWordCount } from "./editor.js";
import { autoSave } from "./storage.js";
import { showToast } from "./ui.js";

// AI Conversation History
export let aiConversationHistory = [];

export function clearAiChatHistory() {
  aiConversationHistory = [];
  const chatHistory = document.getElementById("chatHistory");
  if (chatHistory) chatHistory.innerHTML = "";
}

export function saveApiKey() {
  const val = document.getElementById("geminiKey")?.value.trim();
  localStorage.setItem("gemini_api_key", val);
  showToast("API key saved.", "success");
}

export async function callGemini(prompt, history = []) {
  const apiKey = localStorage.getItem("gemini_api_key") || document.getElementById("geminiKey")?.value.trim();
  if (!apiKey) {
    showToast("Please enter your Gemini API Key in settings.", "error");
    return null;
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const contents = [...history, { role: "user", parts: [{ text: prompt }] }];

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents }),
    });
    const data = await response.json();
    if (!response.ok) {
      showToast(`AI Error: ${data.error?.message || "Error calling API."}`, "error");
      return null;
    }
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (error) {
    showToast("Network error with AI service.", "error");
    return null;
  }
}

export async function callGeminiStream(prompt, onChunk) {
  const apiKey = localStorage.getItem("gemini_api_key") || document.getElementById("geminiKey")?.value.trim();
  if (!apiKey) {
    showToast("Please enter your Gemini API Key in settings.", "error");
    return null;
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?alt=sse&key=${apiKey}`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    if (!response.ok) {
      const data = await response.json();
      showToast(`AI Error: ${data.error?.message || "Error calling API."}`, "error");
      return null;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        buffer = buffer.trim();
        if (buffer) {
          const finalLines = buffer.split("\n");
          for (const line of finalLines) {
            if (!line) continue;
            if (line.startsWith("data: ")) {
              const payload = line.substring(6).trim();
              if (payload === "[DONE]") continue;
              try {
                const json = JSON.parse(payload);
                const text = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
                if (text) {
                  fullText += text;
                  if (onChunk) onChunk(text, fullText);
                }
              } catch (e) {}
            }
          }
        }
        break;
      }
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      const parts = buffer.split("\n");
      buffer = parts.pop() || "";
      for (const part of parts) {
        const line = part.trim();
        if (!line) continue;
        if (line.startsWith("data: ")) {
          const payload = line.substring(6).trim();
          if (payload === "[DONE]") continue;
          try {
            const json = JSON.parse(payload);
            const text = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
            if (text) {
              fullText += text;
              if (onChunk) onChunk(text, fullText);
            }
          } catch (e) {}
        }
      }
    }
    return fullText;
  } catch (error) {
    showToast("Network error while streaming.", "error");
    return null;
  }
}

export async function aiAutoTag() {
  const textContent = getEditorPlainContent().trim();
  if (!textContent) {
    showToast("Enter note text before generating tags.", "info");
    return;
  }
  const btn = document.getElementById("btnAutoTag");
  if (!btn) return;
  const originalHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span>⏳</span> Generating...`;
  try {
    const prompt = `Analyze the following note and generate 3 to 5 short, relevant tags (space separated without # symbols). Return ONLY those words separated by spaces, without any additional text or quotes: "${textContent}"`;
    const result = await callGemini(prompt);
    if (result) {
      const newTags = result.replace(/#/g, "").split(/[\s,]+/).map((t) => t.trim().toLowerCase()).filter(Boolean);
      const existingTagsContainer = document.getElementById("tagsContainer");
      const currentTags = [];
      if (existingTagsContainer) {
        existingTagsContainer.querySelectorAll(".tag-pill span").forEach((el) => {
          const val = el.innerText.replace(/^#/, "").trim();
          if (val) currentTags.push(val);
        });
      }
      const combined = Array.from(new Set([...currentTags, ...newTags]));
      if (window.renderTagsInput) {
        window.renderTagsInput(combined);
      }
      autoSave();
      showToast(`Generated ${newTags.length} tags!`, "success");
    }
  } catch (error) {
    showToast("An error occurred while generating tags.", "error");
  } finally {
    btn.innerHTML = originalHTML;
    btn.disabled = false;
  }
}

export async function aiOrganize() {
  const textContent = getEditorPlainContent().trim();
  if (!textContent) {
    showToast("Enter text before calling AI.", "info");
    return;
  }
  const btn = document.getElementById("btnOrganize");
  if (!btn) return;
  const originalHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `Thinking...`;
  try {
    const prompt = `Reorganize the following unstructured thoughts into structured notes with H2 headings, clear bullet points, and extracted To-Do items at the end. Be short, effective, and direct. Respond in English. Text: ${textContent}`;
    const result = await callGemini(prompt);
    if (result) {
      loadContentIntoEditor(marked.parse(result));
      updateFullEditorWordCount();
      autoSave();
      showToast("Text organized successfully!", "success");
    }
  } catch (error) {
    showToast("Error organizing text.", "error");
  } finally {
    btn.innerHTML = originalHTML;
    btn.disabled = false;
  }
}

export async function askAI() {
  const queryField = document.getElementById("aiQuery");
  const chatHistory = document.getElementById("chatHistory");
  const sendBtn = document.getElementById("sendAiBtn");
  if (!queryField || !chatHistory) return;
  const contentText = getEditorPlainContent();
  const query = queryField.value.trim();
  if (!query) return;

  queryField.disabled = true;
  if (sendBtn) sendBtn.disabled = true;
  const userMsgHtml = `<div class="bg-gray-100 dark:bg-zinc-800 p-2.5 rounded-lg border border-gray-200 dark:border-zinc-700"><b>You:</b> ${query}</div>`;
  chatHistory.insertAdjacentHTML("beforeend", userMsgHtml);
  queryField.value = "";

  const loadingId = "loading-" + Date.now();
  const loadingHtml = `<div id="${loadingId}" class="flex items-center gap-2 text-gray-400 dark:text-zinc-400 italic p-1.5 text-xs"><span>AI is thinking...</span></div>`;
  chatHistory.insertAdjacentHTML("beforeend", loadingHtml);
  chatHistory.scrollTop = chatHistory.scrollHeight;

  try {
    const promptWithContext = `Active user note:\n"${contentText}"\n\nQuestion/Command: ${query}\n\nInstructions: Answer precisely and concisely to questions about the note content. Use Markdown formatting for better readability. Respond in English. Do not invent facts that are not in the note if the question is directly related to it. Be short, effective, and direct.`;
    const answer = await callGemini(promptWithContext, aiConversationHistory);

    if (answer) {
      aiConversationHistory.push({ role: "user", parts: [{ text: query }] });
      aiConversationHistory.push({ role: "model", parts: [{ text: answer }] });
      
      const MAX_HISTORY = 14;
      if (aiConversationHistory.length > MAX_HISTORY) {
        aiConversationHistory = aiConversationHistory.slice(aiConversationHistory.length - MAX_HISTORY);
      }
      
      const aiMsgHtml = `<div class="bg-blue-50 dark:bg-zinc-800/90 dark:text-blue-200 p-2.5 rounded-lg border border-blue-100 dark:border-zinc-700 leading-relaxed text-sm">${marked.parse(answer)}</div>`;
      chatHistory.insertAdjacentHTML("beforeend", aiMsgHtml);
    }
  } catch (error) {
    const errorHtml = `<div class="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 p-2.5 rounded-lg border border-red-200 dark:border-red-900 text-xs">An error occurred while answering. Please try again.</div>`;
    chatHistory.insertAdjacentHTML("beforeend", errorHtml);
  } finally {
    const loadingEl = document.getElementById(loadingId);
    if (loadingEl) loadingEl.remove();
    queryField.disabled = false;
    if (sendBtn) sendBtn.disabled = false;
    queryField.focus();
    chatHistory.scrollTop = chatHistory.scrollHeight;
  }
}

export async function runInlineAiAction(actionType, rowEditable) {
  const text = rowEditable.innerText.replace(/^\/ai-\w+\s*/, "").trim();
  if (!text) {
    showToast("Enter text for AI processing after the command.", "info");
    return;
  }
  
  const originalHtml = rowEditable.innerHTML;
  rowEditable.innerHTML = `<span class="inline-flex items-center gap-1.5 text-blue-500 italic text-sm"><svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> AI is processing...</span>`;
  
  let prompt = "";
  if (actionType === "fix")
    prompt = `Fix spelling and grammar errors in the following text. Return ONLY the corrected text without additional explanations. Respond in English: "${text}"`;
  else if (actionType === "translate")
    prompt = `Translate the following text to English. Return the exact translation without accompanying text: "${text}"`;
  else if (actionType === "expand")
    prompt = `Expand the following idea in more detail by adding 2-3 meaningful sentences that naturally continue the entered text. Return only the expanded text without additional explanations. Respond in English: "${text}"`;

  const res = await callGemini(prompt);
  if (res) {
    rowEditable.innerText = res.trim();
    updateFullEditorWordCount();
    autoSave();
    showToast("AI action completed!", "success");
  } else {
    rowEditable.innerHTML = originalHtml;
  }
}