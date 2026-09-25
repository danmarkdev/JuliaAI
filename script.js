// ---------------------------------------------------------------
// Your Cloudflare Worker URL (see Mimi worker.js setup steps).
// The worker holds your Gemini API key server-side so it never
// appears in this file or anywhere the browser can see it.
const API_ENDPOINT = "https://julia-ai-chat-proxy.kdanmarkrosalejos.workers.dev";
// ---------------------------------------------------------------

const MAX_ATTACHMENTS = 4;
const MAX_ATTACHMENT_MB = 5;
const STORAGE_KEY = 'juliaAiConversations';

// Julia decides on her own, per message, whether the user is asking for a
// picture. When she is, her entire reply is just this marker followed by
// a vivid English description; the client intercepts it, never shows it as
// a chat bubble, and calls the image endpoint instead.
const IMAGE_MARKER_RE = /IMAGE_REQUEST\s*::?\s*([\s\S]+)/i;

const i18n = {
  en: {
    modelPill: "Julia AI · your kitty companion",
    heroTitle: "Hi, I'm Julia AI",
    heroSubtitle: "Ask me anything, I'm listening with my whole heart.",
    chip1: "Fun fact", chip2: "💌 Write a poem", chip3: "📋 Plan my day", chip4: "💡 Explain simply",
    prompt1: "Tell me a fun fact I probably don't know",
    prompt2: "Write me a short, sweet poem about friendship",
    prompt3: "Help me plan a cozy Sunday",
    prompt4: "Explain something complicated in a simple, friendly way: how does the internet work?",
    newChat: "New chat",
    recent: "Recent",
    footer: "Made with love for you",
    placeholder: "Message Julia AI...",
    disclaimer: "Julia AI can make mistakes. Double-check important info.",
    newChatTitle: "New chat",
    errorMsg: "Oops, something slipped! Something went wrong reaching the server. Please try again in a moment.",
    imageErrorMsg: "Oops, I couldn't draw that this time! Please try again in a moment.",
    languageName: "English",
    noChatsYet: "No chats in this language yet",
    deleteChat: "Delete chat",
    renameChat: "Rename chat",
    editMessage: "Edit message",
    copyMessage: "Copy",
    copiedMessage: "Copied!",
    readAloud: "Read aloud", stopReading: "Stop", goodResponse: "Good response", badResponse: "Bad response", retryMessage: "Try again",
    saveEdit: "Save & resend",
    cancelEdit: "Cancel",
    attachFile: "Attach a file",
    removeAttachment: "Remove",
    attachTooBig: "That file is too big. Please attach files under " + MAX_ATTACHMENT_MB + "MB.",
    attachTooMany: "You can attach up to " + MAX_ATTACHMENTS + " files at once.",
    attachNotImage: "Julia AI can currently read images, PDFs, and .txt files.",
    notConfiguredMsg: "Julia AI isn't connected to a brain yet! The site owner needs to set up the backend (see Mimi worker.js) before I can chat for real.",
    generatingImage: "Drawing your image..."
  }
};

let currentLang = 'en';

function t(key){ return (i18n[currentLang] && i18n[currentLang][key]) || i18n.en[key]; }

function applyLanguage(){
  document.getElementById('modelPill').textContent = t('modelPill');
  document.getElementById('heroTitle').textContent = t('heroTitle');
  document.getElementById('heroSubtitle').textContent = t('heroSubtitle');
  document.getElementById('newChatLabel').textContent = t('newChat');
  document.getElementById('recentLabel').textContent = t('recent');
  document.getElementById('sidebarFooter').textContent = t('footer');
  document.getElementById('disclaimerText').textContent = t('disclaimer');
  input.placeholder = t('placeholder');
  attachBtn.setAttribute('aria-label', t('attachFile'));
  document.querySelectorAll('.chip').forEach(chip => {
    const key = chip.dataset.key;
    chip.textContent = t(key);
  });
}

const chatScroll = document.getElementById('chatScroll');
const chatInner = document.getElementById('chatInner');
const hero = document.getElementById('hero');
const input = document.getElementById('input');
const sendBtn = document.getElementById('sendBtn');
const historyEl = document.getElementById('history');
const sidebar = document.getElementById('sidebar');
const menuBtn = document.getElementById('menuBtn');
const overlay = document.getElementById('overlay');
const newChatBtn = document.getElementById('newChatBtn');
const attachBtn = document.getElementById('attachBtn');
const fileInput = document.getElementById('fileInput');
const attachPreview = document.getElementById('attachPreview');

let conversations = [];      // {id, title, lang, customTitle, messages:[{role, content, attachments}]}
let currentId = null;
let pendingAttachments = []; // [{id, name, mimeType, dataUrl, base64}]

function uid(){ return Math.random().toString(36).slice(2,9); }

// Julia's avatar in chat (the kitty image).
const KITTY_IMG = window.KITTY_SRC || 'hello_kitty.png'; // kitty-icon.js is optional
const AVATAR_SVG = '<img src="' + KITTY_IMG + '" alt="">';

/* ---------------- Persistence (localStorage) ---------------- */

function saveState(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ conversations, currentId, currentLang }));
  }catch(e){ console.error('Failed to save chat state', e); }
}

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return false;
    const data = JSON.parse(raw);
    if(!data || !Array.isArray(data.conversations) || data.conversations.length === 0) return false;
    conversations = data.conversations;
    currentLang = 'en';
    conversations.forEach(c => { c.lang = 'en'; });
    currentId = data.currentId;
    if(!conversations.find(c => c.id === currentId)){
      const firstInLang = conversations.find(c => c.lang === currentLang);
      currentId = firstInLang ? firstInLang.id : conversations[0].id;
    }
    return true;
  }catch(e){ console.error('Failed to load chat state', e); return false; }
}

function newConversation(){
  const conv = { id: uid(), title: t('newChatTitle'), lang: currentLang, customTitle: false, messages: [] };
  conversations.unshift(conv);
  currentId = conv.id;
  pendingAttachments = [];
  renderAttachPreview();
  renderHistory();
  renderChat();
  saveState();
}

function currentConv(){
  return conversations.find(c => c.id === currentId);
}

/* ---------------- History list: select / rename / delete ---------------- */

function renderHistory(){
  historyEl.innerHTML = '';
  // Only show conversations that belong to the language currently selected.
  const filtered = conversations.filter(c => c.lang === currentLang);
  if(filtered.length === 0){
    const empty = document.createElement('div');
    empty.className = 'history-empty';
    empty.textContent = t('noChatsYet');
    historyEl.appendChild(empty);
    return;
  }
  filtered.forEach(c => {
    const div = document.createElement('div');
    div.className = 'history-item' + (c.id === currentId ? ' active' : '');

    const title = document.createElement('span');
    title.className = 'history-item-title';
    title.textContent = c.title;
    title.onclick = () => { currentId = c.id; renderHistory(); renderChat(); closeSidebarMobile(); saveState(); };

    const actions = document.createElement('div');
    actions.className = 'history-actions';

    const renameBtn = document.createElement('button');
    renameBtn.className = 'history-rename';
    renameBtn.type = 'button';
    renameBtn.setAttribute('aria-label', t('renameChat'));
    renameBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>';
    renameBtn.onclick = (e) => { e.stopPropagation(); startRenaming(div, c); };

    const delBtn = document.createElement('button');
    delBtn.className = 'history-delete';
    delBtn.type = 'button';
    delBtn.setAttribute('aria-label', t('deleteChat'));
    delBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z"/></svg>';
    delBtn.onclick = (e) => { e.stopPropagation(); deleteConversation(c.id); };

    actions.appendChild(renameBtn);
    actions.appendChild(delBtn);
    div.appendChild(title);
    div.appendChild(actions);
    historyEl.appendChild(div);
  });
}

function startRenaming(itemEl, conv){
  itemEl.classList.add('renaming');
  const titleSpan = itemEl.querySelector('.history-item-title');
  const inputEl = document.createElement('input');
  inputEl.type = 'text';
  inputEl.className = 'history-item-input';
  inputEl.value = conv.title;
  itemEl.replaceChild(inputEl, titleSpan);
  inputEl.focus();
  inputEl.select();

  let finished = false;
  const commit = () => {
    if(finished) return;
    finished = true;
    const val = inputEl.value.trim();
    if(val){
      conv.title = val;
      conv.customTitle = true;
    }
    renderHistory();
    saveState();
  };
  inputEl.addEventListener('keydown', (e) => {
    if(e.key === 'Enter'){ e.preventDefault(); commit(); }
    else if(e.key === 'Escape'){ e.preventDefault(); finished = true; renderHistory(); }
  });
  inputEl.addEventListener('blur', commit);
}

function deleteConversation(id){
  const idx = conversations.findIndex(c => c.id === id);
  if(idx === -1) return;
  const wasActive = conversations[idx].id === currentId;
  conversations.splice(idx, 1);

  if(wasActive){
    const nextInLang = conversations.find(c => c.lang === currentLang);
    if(nextInLang){
      currentId = nextInLang.id;
    } else {
      newConversation();
      return;
    }
  }
  renderHistory();
  renderChat();
  saveState();
}

/* ---------------- Chat rendering ---------------- */

function renderChat(){
  stopSpeaking();
  const conv = currentConv();
  chatInner.innerHTML = '';
  if (!conv || conv.messages.length === 0){
    hero.style.display = 'flex';
    return;
  }
  hero.style.display = 'none';
  conv.messages.forEach((m, idx) => appendBubble(m.role, m.content, idx, m.attachments, false));
  chatScroll.scrollTop = chatScroll.scrollHeight;
}

function attachmentsToHtmlGrid(attachments){
  if(!attachments || attachments.length === 0) return null;
  const grid = document.createElement('div');
  grid.className = 'bubble-attachments';
  attachments.forEach(a => {
    if(a.mimeType && !a.mimeType.startsWith('image/')){
      const badge = document.createElement('div');
      badge.className = 'file-badge';
      badge.textContent = a.name || 'file';
      grid.appendChild(badge);
      return;
    }
    const img = document.createElement('img');
    img.src = a.dataUrl || ('data:' + a.mimeType + ';base64,' + a.data);
    img.alt = a.name || 'attachment';
    if(a.generated) img.classList.add('generated-image');
    grid.appendChild(img);
  });
  return grid;
}

/* ---------------- Message action buttons: read aloud / like / dislike / retry ---------------- */

const ICON_SPEAK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 010 7M19 5a9 9 0 010 14"/></svg>';
const ICON_STOP = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
const ICON_LIKE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>';
const ICON_DISLIKE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/></svg>';
const ICON_RETRY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>';

const SPEECH_LANG = { en:'en-US' };
let speakingBtn = null;

// Browsers don't say which voices are female, so we rank installed voices by name:
// known female names score up, known male names score down.
const FEMALE_VOICE_RE = /zira|aria|jenny|michelle|emma|ava\b|sonia|libby|natasha|clara|samantha|karen|victoria|allison|susan|serena|moira|tessa|fiona|kate|heather|nicky|joanna|salli|ivy|kendra|kimberly|female|woman|blessica|rosa|elvira|dalia|helena|paulina|monica|sabina|laura|paloma|marisol|elena|lucia|kyoko|nanami|haruka|ayumi|mayu|sayaka|o-ren|yuna|sunhi|sun-hi|seoyeon|google us english|google \u65e5\u672c\u8a9e|google espa\u00f1ol|google \ud55c\uad6d\uc758/i;
const MALE_VOICE_RE = /\bmale\b|\bman\b|david|mark\b|guy\b|ryan|james|george|richard|daniel|alex\b|fred\b|tom\b|thomas|eric|christopher|roger|steffan|brian|davis|angelo|jorge|pablo|raul|diego|enrique|ichiro|keita|takumi|naoki|hyunsu|injoon|hemant|rishi/i;

function voiceLangMatches(voice, langKey){
  const l = (voice.lang || '').toLowerCase().replace('_', '-');
  return l.startsWith(langKey);
}
function pickFemaleVoice(langKey){
  if(!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  const candidates = voices.filter(v => voiceLangMatches(v, langKey));
  if(candidates.length === 0) return null;
  const wanted = (SPEECH_LANG[langKey] || '').toLowerCase();
  let best = null, bestScore = -Infinity;
  candidates.forEach(v => {
    let score = 0;
    if(FEMALE_VOICE_RE.test(v.name)) score += 10;
    if(MALE_VOICE_RE.test(v.name)) score -= 10;
    if(/natural|online/i.test(v.name)) score += 3;
    if((v.lang || '').toLowerCase().replace('_', '-') === wanted) score += 2;
    if(score > bestScore){ best = v; bestScore = score; }
  });
  return best;
}
// Some browsers load their voice list a moment after the page opens.
if('speechSynthesis' in window){
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

function makeToolBtn(className, label, iconHtml){
  const b = document.createElement('button');
  b.className = className;
  b.type = 'button';
  b.title = label;
  b.setAttribute('aria-label', label);
  b.innerHTML = iconHtml;
  return b;
}

function resetSpeakBtn(){
  if(speakingBtn){
    speakingBtn.classList.remove('active');
    speakingBtn.innerHTML = ICON_SPEAK;
    speakingBtn.title = t('readAloud');
    speakingBtn = null;
  }
}
function stopSpeaking(){
  if('speechSynthesis' in window) window.speechSynthesis.cancel();
  resetSpeakBtn();
}
function splitForSpeech(text){
  const sentences = text.replace(/[*_#`>~]/g, '').split(/(?<=[.!?。！？])\s+|\n+/).filter(s => s.trim());
  const chunks = [];
  let cur = '';
  sentences.forEach(s => {
    if(cur && (cur + ' ' + s).length > 180){ chunks.push(cur); cur = s; }
    else cur = cur ? cur + ' ' + s : s;
  });
  if(cur) chunks.push(cur);
  return chunks;
}
function toggleSpeak(text, btn){
  if(!('speechSynthesis' in window)) return;
  if(speakingBtn === btn){ stopSpeaking(); return; }
  stopSpeaking();
  const chunks = splitForSpeech(text);
  if(chunks.length === 0) return;
  const voice = pickFemaleVoice(currentLang);
  speakingBtn = btn;
  btn.classList.add('active');
  btn.innerHTML = ICON_STOP;
  btn.title = t('stopReading');
  chunks.forEach((chunk, i) => {
    const u = new SpeechSynthesisUtterance(chunk);
    if(voice){ u.voice = voice; u.lang = voice.lang; }
    else { u.lang = SPEECH_LANG[currentLang] || 'en-US'; }
    const onlyMaleVoice = !voice || (MALE_VOICE_RE.test(voice.name) && !FEMALE_VOICE_RE.test(voice.name));
    u.pitch = onlyMaleVoice ? 1.35 : 1.1;
    if(i === chunks.length - 1){
      u.onend = () => { if(speakingBtn === btn) resetSpeakBtn(); };
      u.onerror = () => { if(speakingBtn === btn) resetSpeakBtn(); };
    }
    window.speechSynthesis.speak(u);
  });
}
window.addEventListener('beforeunload', () => { if('speechSynthesis' in window) window.speechSynthesis.cancel(); });

function removeOldRetryButtons(){
  chatInner.querySelectorAll('.msg-retry-btn').forEach(b => b.remove());
}

// Regenerate the newest reply: drop the AI answer(s) after the last user message and ask again.
function retryLast(conv){
  if(!conv || document.getElementById('typingMsg')) return;
  while(conv.messages.length && conv.messages[conv.messages.length - 1].role === 'ai'){
    conv.messages.pop();
  }
  if(conv.messages.length === 0) return;
  stopSpeaking();
  renderChat();
  saveState();
  getAIResponse(conv);
}

// Adds a "try again" button to an error bubble.
function addRetry(bubble, conv){
  if(!bubble || !bubble.parentElement) return;
  let tools = bubble.parentElement.querySelector('.msg-tools');
  if(!tools){
    tools = document.createElement('div');
    tools.className = 'msg-tools';
    bubble.parentElement.appendChild(tools);
  }
  const retryBtn = makeToolBtn('msg-retry-btn', t('retryMessage'), ICON_RETRY);
  retryBtn.onclick = () => retryLast(conv);
  tools.appendChild(retryBtn);
}

function appendBubble(role, text, idx, attachments, animate=true){
  const msg = document.createElement('div');
  msg.className = 'msg ' + role;

  // Only Julia (the AI) gets an avatar; no icon for the user's own messages.
  let avatar = null;
  if(role === 'ai'){
    avatar = document.createElement('div');
    avatar.className = 'avatar ai';
    avatar.innerHTML = AVATAR_SVG;
  }

  const col = document.createElement('div');
  col.className = 'msg-col';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  const attGrid = attachmentsToHtmlGrid(attachments);
  if(attGrid) bubble.appendChild(attGrid);

  const textNode = document.createElement('span');
  textNode.textContent = text;
  bubble.appendChild(textNode);

  col.appendChild(bubble);

  // User messages: edit button. AI messages: copy button.
  if(role === 'user' && typeof idx === 'number'){
    const tools = document.createElement('div');
    tools.className = 'msg-tools';
    const editBtn = document.createElement('button');
    editBtn.className = 'msg-edit-btn';
    editBtn.type = 'button';
    editBtn.setAttribute('aria-label', t('editMessage'));
    editBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>';
    editBtn.onclick = () => beginEditMessage(idx, col, bubble);
    tools.appendChild(editBtn);
    col.appendChild(tools);
  } else if(role === 'ai' && (text || (attachments && attachments.length))){
    const tools = document.createElement('div');
    tools.className = 'msg-tools';
    const conv = currentConv();
    const stored = (conv && typeof idx === 'number') ? conv.messages[idx] : null;

    // Copy
    const copyBtn = document.createElement('button');
    copyBtn.className = 'msg-copy-btn';
    copyBtn.type = 'button';
    copyBtn.title = t('copyMessage');
    copyBtn.setAttribute('aria-label', t('copyMessage'));
    const copyIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
    const checkIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
    copyBtn.innerHTML = copyIcon;
    const showCopied = () => {
      copyBtn.innerHTML = checkIcon;
      copyBtn.classList.add('copied');
      setTimeout(() => { copyBtn.innerHTML = copyIcon; copyBtn.classList.remove('copied'); }, 1400);
    };
    copyBtn.onclick = async () => {
      try{
        if(text){
          await navigator.clipboard.writeText(text);
        } else if(attachments && attachments.length){
          // No caption (e.g. a generated picture): copy the image itself.
          const a = attachments[0];
          const dataUrl = a.dataUrl || ('data:' + a.mimeType + ';base64,' + a.data);
          const blob = await (await fetch(dataUrl)).blob();
          await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
        }
        showCopied();
      }catch(e){ console.error('Copy failed', e); }
    };
    tools.appendChild(copyBtn);

    // Read aloud
    if(text && 'speechSynthesis' in window){
      const speakBtn = makeToolBtn('msg-speak-btn', t('readAloud'), ICON_SPEAK);
      speakBtn.onclick = () => toggleSpeak(text, speakBtn);
      tools.appendChild(speakBtn);
    }

    // Good / bad response
    if(stored){
      const likeBtn = makeToolBtn('msg-like-btn', t('goodResponse'), ICON_LIKE);
      const dislikeBtn = makeToolBtn('msg-dislike-btn', t('badResponse'), ICON_DISLIKE);
      const paint = () => {
        likeBtn.classList.toggle('active', stored.feedback === 'like');
        dislikeBtn.classList.toggle('active', stored.feedback === 'dislike');
      };
      likeBtn.onclick = () => { stored.feedback = stored.feedback === 'like' ? null : 'like'; paint(); saveState(); };
      dislikeBtn.onclick = () => { stored.feedback = stored.feedback === 'dislike' ? null : 'dislike'; paint(); saveState(); };
      paint();
      tools.appendChild(likeBtn);
      tools.appendChild(dislikeBtn);
    }

    // Try again (only on the newest reply)
    if(stored && conv && idx === conv.messages.length - 1){
      const retryBtn = makeToolBtn('msg-retry-btn', t('retryMessage'), ICON_RETRY);
      retryBtn.onclick = () => retryLast(conv);
      tools.appendChild(retryBtn);
    }

    col.appendChild(tools);
  }

  if(avatar) msg.appendChild(avatar);
  msg.appendChild(col);
  if(!animate) msg.style.animation = 'none';
  chatInner.appendChild(msg);
  return bubble;
}

function beginEditMessage(idx, col, bubble){
  const conv = currentConv();
  if(!conv) return;
  const original = conv.messages[idx];
  if(!original) return;

  bubble.style.display = 'none';

  const box = document.createElement('div');
  box.className = 'edit-box';
  const textarea = document.createElement('textarea');
  textarea.value = original.content;
  box.appendChild(textarea);

  const actions = document.createElement('div');
  actions.className = 'edit-box-actions';
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'edit-cancel-btn';
  cancelBtn.textContent = t('cancelEdit');
  cancelBtn.onclick = () => { box.remove(); bubble.style.display = ''; };
  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'edit-save-btn';
  saveBtn.textContent = t('saveEdit');
  saveBtn.onclick = () => commitEditMessage(idx, textarea.value);
  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);
  box.appendChild(actions);

  col.insertBefore(box, bubble);
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);
}

function commitEditMessage(idx, newText){
  const text = newText.trim();
  if(!text) return;
  const conv = currentConv();
  if(!conv) return;

  // Update the edited message, then drop everything after it,
  // since the conversation branches here.
  conv.messages[idx].content = text;
  conv.messages = conv.messages.slice(0, idx + 1);

  renderChat();
  renderHistory();
  saveState();
  getAIResponse(conv);
}

function appendTyping(label){
  const msg = document.createElement('div');
  msg.className = 'msg ai';
  msg.id = 'typingMsg';
  const avatar = document.createElement('div');
  avatar.className = 'avatar ai';
  avatar.innerHTML = AVATAR_SVG;
  const col = document.createElement('div');
  col.className = 'msg-col';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>' + (label ? '<span class="typing-label">' + label + '</span>' : '');
  col.appendChild(bubble);
  msg.appendChild(avatar);
  msg.appendChild(col);
  chatInner.appendChild(msg);
  chatScroll.scrollTop = chatScroll.scrollHeight;
  return msg;
}

/* ---------------- Attachments (the "+" button) ---------------- */

attachBtn.addEventListener('click', () => fileInput.click());

const ALLOWED_DOC_TYPES = ['application/pdf', 'text/plain'];

function fileMimeType(file){
  if(file.type) return file.type;
  if(/\.pdf$/i.test(file.name)) return 'application/pdf';
  if(/\.txt$/i.test(file.name)) return 'text/plain';
  return '';
}
function isAllowedFile(file){
  const mt = fileMimeType(file);
  return mt.startsWith('image/') || ALLOWED_DOC_TYPES.includes(mt);
}

async function addFiles(files){
  for(const file of files){
    if(pendingAttachments.length >= MAX_ATTACHMENTS){
      appendSystemNotice(t('attachTooMany'));
      break;
    }
    if(!isAllowedFile(file)){
      appendSystemNotice(t('attachNotImage'));
      continue;
    }
    if(file.size > MAX_ATTACHMENT_MB * 1024 * 1024){
      appendSystemNotice(t('attachTooBig'));
      continue;
    }
    try{
      const dataUrl = await readFileAsDataUrl(file);
      const base64 = dataUrl.split(',')[1] || '';
      pendingAttachments.push({
        id: uid(),
        name: file.name,
        mimeType: fileMimeType(file),
        dataUrl,
        base64
      });
    }catch(e){ console.error('Failed to read file', e); }
  }
  renderAttachPreview();
  sendBtn.disabled = input.value.trim().length === 0 && pendingAttachments.length === 0;
}

fileInput.addEventListener('change', () => {
  const files = Array.from(fileInput.files || []);
  fileInput.value = ''; // allow re-selecting the same file later
  addFiles(files);
});

// Drag & drop files anywhere on the page (e.g. straight from Chrome's downloads list)
function hasFiles(e){
  return e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
}
['dragenter','dragover'].forEach(ev => document.addEventListener(ev, (e) => {
  if(!hasFiles(e)) return;
  e.preventDefault();
  document.body.classList.add('dragging');
}));
document.addEventListener('dragleave', (e) => {
  if(!e.relatedTarget) document.body.classList.remove('dragging');
});
document.addEventListener('drop', (e) => {
  if(!hasFiles(e)) return;
  e.preventDefault();
  document.body.classList.remove('dragging');
  addFiles(Array.from(e.dataTransfer.files || []));
});

// Paste screenshots / files straight into the message box
input.addEventListener('paste', (e) => {
  const files = Array.from((e.clipboardData && e.clipboardData.files) || []);
  if(files.length){ e.preventDefault(); addFiles(files); }
});

function readFileAsDataUrl(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderAttachPreview(){
  attachPreview.innerHTML = '';
  pendingAttachments.forEach(a => {
    const chip = document.createElement('div');
    chip.className = 'attach-chip';
    let thumb;
    if(a.mimeType.startsWith('image/')){
      thumb = document.createElement('img');
      thumb.src = a.dataUrl;
      thumb.alt = a.name;
    } else {
      thumb = document.createElement('div');
      thumb.className = 'attach-file';
      thumb.title = a.name;
      thumb.textContent = (a.name.split('.').pop() || 'FILE').slice(0,4).toUpperCase();
    }
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'attach-chip-remove';
    removeBtn.setAttribute('aria-label', t('removeAttachment'));
    removeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    removeBtn.onclick = () => {
      pendingAttachments = pendingAttachments.filter(x => x.id !== a.id);
      renderAttachPreview();
      sendBtn.disabled = input.value.trim().length === 0 && pendingAttachments.length === 0;
    };
    chip.appendChild(thumb);
    chip.appendChild(removeBtn);
    attachPreview.appendChild(chip);
  });
}

// A tiny inline system-style notice for attachment problems (too big, wrong type, etc).
function appendSystemNotice(text){
  const conv = currentConv();
  if(!conv) return;
  hero.style.display = 'none';
  appendBubble('ai', text, undefined, undefined, true);
  chatScroll.scrollTop = chatScroll.scrollHeight;
}

/* ---------------- Composer ---------------- */

function autoResize(){
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 150) + 'px';
}
input.addEventListener('input', () => {
  autoResize();
  sendBtn.disabled = input.value.trim().length === 0 && pendingAttachments.length === 0;
});
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey){
    e.preventDefault();
    if(!sendBtn.disabled) send();
  }
});
sendBtn.addEventListener('click', send);

document.querySelectorAll('.chip').forEach((chip, i) => {
  chip.addEventListener('click', () => {
    input.value = t('prompt' + (i + 1));
    sendBtn.disabled = false;
    send();
  });
});

newChatBtn.addEventListener('click', () => { newConversation(); closeSidebarMobile(); });

menuBtn.addEventListener('click', () => { sidebar.classList.add('open'); overlay.classList.add('show'); });
overlay.addEventListener('click', closeSidebarMobile);
function closeSidebarMobile(){ sidebar.classList.remove('open'); overlay.classList.remove('show'); }

/* ---------------- Sending & AI response ---------------- */

async function send(){
  const text = input.value.trim();
  const attachments = pendingAttachments.map(a => ({ mimeType: a.mimeType, data: a.base64, dataUrl: a.dataUrl, name: a.name }));
  if(!text && attachments.length === 0) return;

  let conv = currentConv();
  if(!conv){ newConversation(); conv = currentConv(); }

  if(conv.messages.length === 0 && !conv.customTitle){
    const titleSource = text || (attachments[0] && attachments[0].name) || t('newChatTitle');
    conv.title = titleSource.slice(0, 32) + (titleSource.length > 32 ? '…' : '');
    conv.lang = currentLang;
  }

  hero.style.display = 'none';
  conv.messages.push({ role:'user', content:text, attachments });
  input.value = '';
  autoResize();
  pendingAttachments = [];
  renderAttachPreview();
  sendBtn.disabled = true;
  renderChat();
  renderHistory();
  saveState();

  await getAIResponse(conv);
}

function buildSystemPrompt(){
  return "You are Julia AI, a warm, cheerful, kind AI companion. Speak naturally and plainly. Never use cat puns, purring or meowing sounds, paw or whisker wordplay, or words like purr-fect, purr, paws or meow. " +
    "You can see any images the user attaches (photos, screenshots, etc) — describe or use them naturally when relevant. " +
    "You can also read PDFs and text files the user attaches, and when the user shares a web link the app opens it for you, so read it and answer; never say you cannot open links. " +
    "Keep replies friendly, clear, and not overly long unless asked. Do not use emojis in your replies. " +
    "Always respond in " + t('languageName') + ", regardless of what language the user writes in, unless they explicitly ask you to switch languages.\n\n" +
    "IMAGE REQUESTS: this app CAN actually generate real images through a separate tool that you trigger yourself — you don't draw them, but you decide when to ask for one. " +
    "If, and only if, the user is directly asking you right now to draw, generate, create, make, or paint a specific picture, image, photo, illustration, drawing, sketch, or artwork (in ANY language, including Filipino/Taglish), reply with ONLY the following and absolutely nothing else — no greeting, no emoji, no explanation, no text before or after it:\n" +
    "IMAGE_REQUEST::<a single vivid, richly detailed image-generation prompt written in English that captures exactly what they asked for>\n" +
    "Do NOT use this format if the user is only asking whether you can generate images, asking about the feature in general, making small talk about pictures, or if their message isn't actually a concrete request for a specific image right now — in those cases just answer normally as Julia, in plain words, with no marker at all.";
}

async function getAIResponse(conv){
  const typingMsg = appendTyping();

  try{
    if(API_ENDPOINT.includes('YOUR-SUBDOMAIN')){
      throw new Error('NOT_CONFIGURED');
    }

    // Gemini expects role "user" or "model"; the worker translates our 'assistant'.
    const apiMessages = conv.messages.map(m => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.content,
      attachments: (m.attachments || []).map(a => ({ mimeType: a.mimeType, data: a.data }))
    }));

    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: buildSystemPrompt(),
        messages: apiMessages
      })
    });

    if(!response.ok || !response.body){
      throw new Error('Request failed: ' + response.status);
    }

    // Buffer the full reply first so an IMAGE_REQUEST:: marker is caught
    // silently and never flashed at the user.
    let fullText = '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while(true){
      const { done, value } = await reader.read();
      if(done) break;
      buffer += decoder.decode(value, { stream:true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for(const line of lines){
        if(!line.startsWith('data:')) continue;
        const dataStr = line.slice(5).trim();
        if(!dataStr || dataStr === '[DONE]') continue;
        try{
          const evt = JSON.parse(dataStr);
          const piece = evt?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
          if(piece) fullText += piece;
        }catch(e){ /* ignore partial json */ }
      }
    }

    const imageMatch = fullText.match(IMAGE_MARKER_RE);
    if(imageMatch && imageMatch[1].trim()){
      const bubble = typingMsg.querySelector('.bubble');
      if(bubble) bubble.innerHTML = '<div class="typing"><span></span><span></span><span></span></div><span class="typing-label">' + t('generatingImage') + '</span>';
      await getImageResponse(conv, imageMatch[1].trim(), typingMsg);
      return;
    }

    typingMsg.remove();
    const finalText = fullText.trim() || "Sorry, I didn't quite catch that. Could you try again?";
    conv.messages.push({ role:'ai', content: finalText });
    removeOldRetryButtons();
    appendBubble('ai', finalText, conv.messages.length - 1);
    saveState();

  }catch(err){
    console.error(err);
    if(document.getElementById('typingMsg')) typingMsg.remove();
    if(err.message === 'NOT_CONFIGURED'){
      appendBubble('ai', t('notConfiguredMsg'));
    } else {
      addRetry(appendBubble('ai', t('errorMsg')), conv);
    }
  }
}

async function getImageResponse(conv, prompt, existingTypingMsg){
  const typingMsg = existingTypingMsg || appendTyping(t('generatingImage'));

  try{
    if(API_ENDPOINT.includes('YOUR-SUBDOMAIN')){
      throw new Error('NOT_CONFIGURED');
    }

    const response = await fetch(API_ENDPOINT + '/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    const data = await response.json();

    if(!response.ok || !data || !data.imageBase64){
      const detail = data && data.error ? data.error : 'Image generation failed';
      console.error('Image generation error:', detail);
      throw new Error(detail);
    }

    typingMsg.remove();

    const caption = data.text && data.text.trim() ? data.text.trim() : '';
    const attachments = [{
      mimeType: data.mimeType || 'image/png',
      data: data.imageBase64,
      generated: true
    }];

    conv.messages.push({ role:'ai', content: caption, attachments });
    removeOldRetryButtons();
    appendBubble('ai', caption, conv.messages.length - 1, attachments);
    saveState();

  }catch(err){
    console.error(err);
    if(document.getElementById('typingMsg')) typingMsg.remove();
    if(err.message === 'NOT_CONFIGURED'){
      appendBubble('ai', t('notConfiguredMsg'));
    } else {
      addRetry(appendBubble('ai', t('imageErrorMsg')), conv);
    }
  }
}

// init
const loaded = loadState();
applyLanguage();
if(loaded){
  renderHistory();
  renderChat();
} else {
  newConversation();
}
