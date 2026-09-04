// ---------------------------------------------------------------
// PASTE YOUR CLOUDFLARE WORKER URL HERE (see Mimi worker.js setup steps).
// The worker holds your Gemini API key server-side so it never
// appears in this file or anywhere the browser can see it.
// e.g. "https://julia-ai-chat-proxy.your-subdomain.workers.dev"
const API_ENDPOINT = "https://julia-ai-chat-proxy.kdanmarkrosalejos.workers.dev";
// ---------------------------------------------------------------

const MAX_ATTACHMENTS = 4;
const MAX_ATTACHMENT_MB = 5;
const STORAGE_KEY = 'juliaAiConversations';
const SYNC_CODE_KEY = 'juliaAiSyncCode';

const i18n = {
  en: {
    modelPill: "🎀 Julia AI 🎀 · your kitty companion",
    heroTitle: "Hi, I'm 🎀 Julia AI 🎀",
    heroSubtitle: "Ask me anything, I'm listening with my whole bow.",
    chip1: "✨ Fun fact", chip2: "🎀 Write a poem", chip3: "📋 Plan my day", chip4: "💡 Explain simply",
    prompt1: "Tell me a fun fact I probably don't know",
    prompt2: "Write me a short, sweet poem about friendship",
    prompt3: "Help me plan a cozy Sunday",
    prompt4: "Explain something complicated in a simple, friendly way: how does the internet work?",
    newChat: "New chat",
    recent: "Recent",
    footer: "Made with 🎀 for you",
    placeholder: "Message Julia AI...",
    disclaimer: "Julia AI can make mistakes. Double-check important info.",
    newChatTitle: "New chat",
    errorMsg: "Oops, my bow slipped! Something went wrong reaching the server. Please try again in a moment. 🎀",
    languageName: "English",
    noChatsYet: "No chats in this language yet",
    deleteChat: "Delete chat",
    renameChat: "Rename chat",
    editMessage: "Edit message",
    saveEdit: "Save & resend",
    cancelEdit: "Cancel",
    attachFile: "Attach a file",
    removeAttachment: "Remove",
    attachTooBig: "That file is too big. Please attach images under " + MAX_ATTACHMENT_MB + "MB.",
    attachTooMany: "You can attach up to " + MAX_ATTACHMENTS + " images at once.",
    attachNotImage: "Julia AI can currently only see image files (screenshots, photos, etc).",
    notConfiguredMsg: "Julia AI isn't connected to a brain yet! The site owner needs to set up the backend (see Mimi worker.js) before I can chat for real. 🎀"
  },
  fil: {
    modelPill: "🎀 Julia AI 🎀 · ang kaibigan mong pusa",
    heroTitle: "Hi, ako si Julia AI",
    heroSubtitle: "Itanong mo kahit ano, nakikinig ako nang buong-buo.",
    chip1: "✨ Kwentong kaalaman", chip2: "🎀 Sumulat ng tula", chip3: "📋 Planuhin ang araw ko", chip4: "💡 Ipaliwanag nang simple",
    prompt1: "Sabihan mo ako ng kawili-wiling kaalaman na hindi ko pa alam",
    prompt2: "Sumulat ka ng maikli at malambing na tula tungkol sa pagkakaibigan",
    prompt3: "Tulungan mo akong magplano ng maginhawang Linggo",
    prompt4: "Ipaliwanag mo nang simple at friendly: paano gumagana ang internet?",
    newChat: "Bagong chat",
    recent: "Kamakailan",
    footer: "Ginawa nang may 🎀 para sa'yo",
    placeholder: "Mag-message kay Julia AI...",
    disclaimer: "Posibleng magkamali si Julia AI. I-double check ang mahahalagang impormasyon.",
    newChatTitle: "Bagong chat",
    errorMsg: "Ay, natanggal ang laso ko! May naganap na error sa server. Subukan ulit sandali. 🎀",
    languageName: "Filipino",
    noChatsYet: "Wala pang chat sa wikang ito",
    deleteChat: "Burahin ang chat",
    notConfiguredMsg: "Hindi pa naka-connect si Julia AI sa utak niya! Kailangan munang i-set up ng may-ari ng site ang backend (tingnan ang Mimi worker.js) bago ako makapag-chat nang totoo. 🎀"
  },
  ja: {
    modelPill: "🎀 ジュリアAI 🎀 ・あなたの猫の相棒",
    heroTitle: "こんにちは、ジュリアAIです",
    heroSubtitle: "なんでも聞いてね。リボンを揺らして耳を澄ませてるよ。",
    chip1: "✨ 豆知識", chip2: "🎀 詩を書く", chip3: "📋 一日の予定", chip4: "💡 やさしく説明",
    prompt1: "私が知らなそうな面白い豆知識を教えて",
    prompt2: "友情についての短くて優しい詩を書いて",
    prompt3: "のんびりした日曜日の過ごし方を考えて",
    prompt4: "インターネットの仕組みをやさしく簡単に説明して",
    newChat: "新しいチャット",
    recent: "最近のチャット",
    footer: "🎀 を込めて作りました",
    placeholder: "ジュリアAIにメッセージを送る...",
    disclaimer: "ジュリアAIも間違えることがあります。重要な情報は確認してね。",
    newChatTitle: "新しいチャット",
    errorMsg: "あっ、リボンがほどけちゃった！サーバーに問題が発生しました。少し待ってからもう一度お試しください。🎀",
    languageName: "日本語",
    noChatsYet: "この言語のチャットはまだありません",
    deleteChat: "チャットを削除",
    notConfiguredMsg: "まだジュリアAIの頭脳が接続されていないよ！ サイトの管理者がバックエンド（Mimi worker.js）を設定する必要があるの。🎀"
  },
  es: {
    modelPill: "🎀 Julia AI 🎀 · tu amiga gatita",
    heroTitle: "Hola, soy Julia AI",
    heroSubtitle: "Pregúntame lo que quieras, te escucho con todo mi lazo.",
    chip1: "✨ Dato curioso", chip2: "🎀 Escribe un poema", chip3: "📋 Planea mi día", chip4: "💡 Explica algo simple",
    prompt1: "Cuéntame un dato curioso que probablemente no conozca",
    prompt2: "Escríbeme un poema corto y dulce sobre la amistad",
    prompt3: "Ayúdame a planear un domingo tranquilo y acogedor",
    prompt4: "Explica algo complicado de forma simple y amigable: ¿cómo funciona internet?",
    newChat: "Nuevo chat",
    recent: "Recientes",
    footer: "Hecho con 🎀 para ti",
    placeholder: "Escríbele a Julia AI...",
    disclaimer: "Julia AI puede cometer errores. Verifica la información importante.",
    newChatTitle: "Nuevo chat",
    errorMsg: "¡Ups, se me soltó el lazo! Algo salió mal con el servidor. Intenta de nuevo en un momento. 🎀",
    languageName: "Español",
    noChatsYet: "Aún no hay chats en este idioma",
    deleteChat: "Eliminar chat",
    notConfiguredMsg: "¡Julia AI todavía no está conectada a un cerebro! El dueño del sitio debe configurar el backend (ver Mimi worker.js) antes de que pueda chatear de verdad. 🎀"
  },
  ko: {
    modelPill: "🎀 줄리아 AI 🎀 · 나의 고양이 친구",
    heroTitle: "안녕, 나는 줄리아 AI야",
    heroSubtitle: "무엇이든 물어봐, 리본을 쫑긋 세우고 듣고 있을게.",
    chip1: "✨ 재미있는 사실", chip2: "🎀 시 써주기", chip3: "📋 하루 계획", chip4: "💡 쉽게 설명하기",
    prompt1: "내가 잘 모를 것 같은 재미있는 사실 하나 알려줘",
    prompt2: "우정에 대한 짧고 따뜻한 시를 써줘",
    prompt3: "편안한 일요일을 계획하는 걸 도와줘",
    prompt4: "인터넷이 어떻게 작동하는지 쉽고 친근하게 설명해줘",
    newChat: "새 채팅",
    recent: "최근 채팅",
    footer: "🎀 마음을 담아 만들었어요",
    placeholder: "줄리아 AI에게 메시지 보내기...",
    disclaimer: "줄리아 AI도 실수를 할 수 있어요. 중요한 정보는 다시 확인하세요.",
    newChatTitle: "새 채팅",
    errorMsg: "앗, 리본이 풀렸어! 서버에 문제가 생겼어요. 잠시 후 다시 시도해주세요. 🎀",
    languageName: "한국어",
    noChatsYet: "이 언어로 된 채팅이 아직 없어요",
    deleteChat: "채팅 삭제",
    notConfiguredMsg: "줄리아 AI가 아직 두뇌에 연결되지 않았어요! 사이트 관리자가 백엔드(Mimi worker.js 참고)를 먼저 설정해야 진짜로 대화할 수 있어요. 🎀"
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

document.getElementById('langSelect').addEventListener('change', (e) => {
  currentLang = e.target.value;
  applyLanguage();
  // Each language keeps its own separate list of conversations.
  // Jump to that language's most recent chat, or start a fresh one.
  const existing = conversations.find(c => c.lang === currentLang);
  if(existing){
    currentId = existing.id;
    renderHistory();
    renderChat();
  } else {
    newConversation();
  }
  saveState();
});

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

// ---- Cross-device sync state ----
let syncCode = localStorage.getItem(SYNC_CODE_KEY) || null;
let syncPushTimer = null;

function uid(){ return Math.random().toString(36).slice(2,9); }

// Compact version of the cat-and-bow logo mark, used as Julia's avatar in chat.
const AVATAR_SVG = '<svg viewBox="0 0 100 100" width="20" height="20"><circle cx="50" cy="58" r="29" fill="#ffffff" stroke="#2a0518" stroke-width="4"/><path d="M27 36 Q22 16 39 25" fill="#ffffff" stroke="#2a0518" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M73 36 Q78 16 61 25" fill="#ffffff" stroke="#2a0518" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="34" cy="62" rx="5.5" ry="4.5" fill="#ffb3da" opacity="0.9"/><ellipse cx="66" cy="62" rx="5.5" ry="4.5" fill="#ffb3da" opacity="0.9"/><circle cx="39" cy="54" r="3" fill="#2a0518"/><circle cx="61" cy="54" r="3" fill="#2a0518"/><path d="M46 66 Q50 70 54 66" fill="none" stroke="#2a0518" stroke-width="3" stroke-linecap="round"/><g transform="translate(73,30) rotate(15)"><path d="M0 0 C-13 -10 -18 2 0 6 C-18 10 -13 22 0 12 C13 22 18 10 0 6 C18 2 13 -10 0 0 Z" fill="#fe019a" stroke="#2a0518" stroke-width="2.8" stroke-linejoin="round"/><circle cx="0" cy="6" r="3.8" fill="#ffffff"/></g></svg>';

/* ---------------- Persistence (localStorage) ---------------- */

function saveState(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ conversations, currentId, currentLang }));
  }catch(e){ console.error('Failed to save chat state', e); }
  scheduleSyncPush();
}

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return false;
    const data = JSON.parse(raw);
    if(!data || !Array.isArray(data.conversations) || data.conversations.length === 0) return false;
    conversations = data.conversations;
    currentLang = data.currentLang || 'en';
    currentId = data.currentId;
    if(!conversations.find(c => c.id === currentId)){
      const firstInLang = conversations.find(c => c.lang === currentLang);
      currentId = firstInLang ? firstInLang.id : conversations[0].id;
    }
    return true;
  }catch(e){ console.error('Failed to load chat state', e); return false; }
}

/* ---------------- Cross-device sync (Cloudflare KV via Worker) ---------------- */

function setSyncCode(code){
  syncCode = code;
  localStorage.setItem(SYNC_CODE_KEY, code);
}

function generateSyncCode(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // avoids confusing chars like 0/O, 1/I
  let code = '';
  for(let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function pushToServer(){
  if(!syncCode) return;
  try{
    await fetch(API_ENDPOINT + '/sync/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: syncCode, conversations, currentLang })
    });
  }catch(e){ console.error('Sync push failed', e); }
}

function scheduleSyncPush(){
  if(!syncCode) return;
  clearTimeout(syncPushTimer);
  syncPushTimer = setTimeout(pushToServer, 1200);
}

async function pullFromServer(code){
  try{
    const res = await fetch(API_ENDPOINT + '/sync/load?code=' + encodeURIComponent(code));
    const data = await res.json();
    if(data && data.found){
      conversations = data.conversations || [];
      currentLang = data.currentLang || 'en';
      if(conversations.length) currentId = conversations[0].id;
      return true;
    }
    return false;
  }catch(e){ console.error('Sync pull failed', e); return false; }
}

async function openSyncMenu(){
  const suggestion = syncCode || generateSyncCode();
  const msg = syncCode
    ? `Your current sync code is: ${syncCode}\n\nType the SAME code on your other device to link it, or type a different one to switch.`
    : `This device has no sync code yet.\n\nType this code (or your own 6-character one) and use it on your other device too:`;
  const answer = prompt(msg, suggestion);
  if(answer === null) return;
  const code = answer.trim().toUpperCase();
  if(!/^[A-Z0-9]{6}$/.test(code)){
    alert('Sync code must be exactly 6 letters/numbers. Please try again. 🎀');
    return;
  }
  setSyncCode(code);
  const pulled = await pullFromServer(code);
  if(pulled){
    document.getElementById('langSelect').value = currentLang;
    applyLanguage();
    renderHistory();
    renderChat();
    saveState();
    alert('Synced! Chats from that code are now loaded here. 🎀');
  } else {
    await pushToServer();
    alert('This device is now linked to that code. Enter the same code on your other device to sync. 🎀');
  }
}

document.getElementById('syncBtn').addEventListener('click', openSyncMenu);

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
    const img = document.createElement('img');
    img.src = a.dataUrl || ('data:' + a.mimeType + ';base64,' + a.data);
    img.alt = a.name || 'attachment';
    grid.appendChild(img);
  });
  return grid;
}

function appendBubble(role, text, idx, attachments, animate=true){
  const msg = document.createElement('div');
  msg.className = 'msg ' + role;

  // Only Julia (the AI) gets an avatar — no icon is shown for the user's own messages.
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

  // Only the user's own messages can be edited (and only once we know their index).
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

  // Update the edited message, then drop everything that came after it
  // (its old AI reply and any later turns), since the conversation branches here.
  conv.messages[idx].content = text;
  conv.messages = conv.messages.slice(0, idx + 1);

  renderChat();
  renderHistory();
  saveState();
  getAIResponse(conv);
}

function appendTyping(){
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
  bubble.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';
  col.appendChild(bubble);
  msg.appendChild(avatar);
  msg.appendChild(col);
  chatInner.appendChild(msg);
  chatScroll.scrollTop = chatScroll.scrollHeight;
  return msg;
}

/* ---------------- Attachments (the "+" button) ---------------- */

attachBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async () => {
  const files = Array.from(fileInput.files || []);
  fileInput.value = ''; // allow re-selecting the same file later

  for(const file of files){
    if(pendingAttachments.length >= MAX_ATTACHMENTS){
      appendSystemNotice(t('attachTooMany'));
      break;
    }
    if(!file.type.startsWith('image/')){
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
        mimeType: file.type,
        dataUrl,
        base64
      });
    }catch(e){ console.error('Failed to read file', e); }
  }
  renderAttachPreview();
  sendBtn.disabled = input.value.trim().length === 0 && pendingAttachments.length === 0;
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
    const img = document.createElement('img');
    img.src = a.dataUrl;
    img.alt = a.name;
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
    chip.appendChild(img);
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

async function getAIResponse(conv){
  const typingMsg = appendTyping();

  try{
    if(API_ENDPOINT.includes('YOUR-SUBDOMAIN')){
      throw new Error('NOT_CONFIGURED');
    }

    // Gemini expects role "user" or "model" — we send our internal
    // 'ai' role through and let the worker translate it.
    const apiMessages = conv.messages.map(m => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.content,
      attachments: (m.attachments || []).map(a => ({ mimeType: a.mimeType, data: a.data }))
    }));

    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: "You are Julia AI, a warm, cheerful, kind AI companion with a cute cat-and-bow personality. You can see any images the user attaches (photos, screenshots, etc) — describe or use them naturally when relevant. Keep replies friendly, clear, and not overly long unless asked. Light, tasteful use of an occasional emoji like 🎀 or 🐾 is welcome but don't overdo it. Always respond in " + t('languageName') + ", regardless of what language the user writes in, unless they explicitly ask you to switch languages.",
        messages: apiMessages
      })
    });

    if(!response.ok || !response.body){
      throw new Error('Request failed: ' + response.status);
    }

    typingMsg.remove();
    const bubble = appendBubble('ai', '');
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
          // Gemini streamGenerateContent (alt=sse) shape:
          // { candidates: [ { content: { parts: [ { text: "..." } ] } } ] }
          const piece = evt?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
          if(piece){
            fullText += piece;
            bubble.textContent = fullText;
            chatScroll.scrollTop = chatScroll.scrollHeight;
          }
        }catch(e){ /* ignore partial json */ }
      }
    }

    conv.messages.push({ role:'ai', content: fullText || "Sorry, I didn't quite catch that. Could you try again?" });
    saveState();

  }catch(err){
    console.error(err);
    if(document.getElementById('typingMsg')) typingMsg.remove();
    if(err.message === 'NOT_CONFIGURED'){
      appendBubble('ai', t('notConfiguredMsg'));
    } else {
      appendBubble('ai', t('errorMsg'));
    }
  }
}

// init
(async function init(){
  const loaded = loadState();
  document.getElementById('langSelect').value = currentLang;
  applyLanguage();

  if(syncCode){
    const pulled = await pullFromServer(syncCode);
    if(pulled){
      document.getElementById('langSelect').value = currentLang;
      applyLanguage();
      renderHistory();
      renderChat();
    } else if(loaded){
      renderHistory();
      renderChat();
      pushToServer();
    } else {
      newConversation();
      pushToServer();
    }
  } else if(loaded){
    renderHistory();
    renderChat();
  } else {
    newConversation();
  }
})();
