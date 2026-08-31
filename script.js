// ---------------------------------------------------------------
// PASTE YOUR CLOUDFLARE WORKER URL HERE (see mimi-worker.js setup steps).
// The worker holds your Gemini API key server-side so it never
// appears in this file or anywhere the browser can see it.
// e.g. "https://mimi-chat-proxy.your-subdomain.workers.dev"
const API_ENDPOINT = "https://mimi-chat-proxy.YOUR-SUBDOMAIN.workers.dev";
// ---------------------------------------------------------------

const i18n = {
  en: {
    modelPill: "Mimi · your kitty companion",
    heroTitle: "Hi, I'm Mimi",
    heroSubtitle: "Ask me anything — I'm listening with my whole bow.",
    chip1: "✨ Fun fact", chip2: "🎀 Write a poem", chip3: "📋 Plan my day", chip4: "💡 Explain simply",
    prompt1: "Tell me a fun fact I probably don't know",
    prompt2: "Write me a short, sweet poem about friendship",
    prompt3: "Help me plan a cozy Sunday",
    prompt4: "Explain something complicated in a simple, friendly way: how does the internet work?",
    newChat: "New chat",
    recent: "Recent",
    footer: "Made with 🎀 for you",
    placeholder: "Message Mimi...",
    disclaimer: "Mimi can make mistakes. Double-check important info.",
    newChatTitle: "New chat",
    errorMsg: "Oops, my bow slipped! Something went wrong reaching the server. Please try again in a moment. 🎀",
    languageName: "English",
    noChatsYet: "No chats in this language yet",
    deleteChat: "Delete chat",
    notConfiguredMsg: "Mimi isn't connected to a brain yet! The site owner needs to set up the backend (see mimi-worker.js) before I can chat for real. 🎀"
  },
  fil: {
    modelPill: "Mimi · ang kaibigan mong pusa",
    heroTitle: "Hi, ako si Mimi",
    heroSubtitle: "Itanong mo kahit ano — nakikinig ako nang buong-buo.",
    chip1: "✨ Kwentong kaalaman", chip2: "🎀 Sumulat ng tula", chip3: "📋 Planuhin ang araw ko", chip4: "💡 Ipaliwanag nang simple",
    prompt1: "Sabihan mo ako ng kawili-wiling kaalaman na hindi ko pa alam",
    prompt2: "Sumulat ka ng maikli at malambing na tula tungkol sa pagkakaibigan",
    prompt3: "Tulungan mo akong magplano ng maginhawang Linggo",
    prompt4: "Ipaliwanag mo nang simple at friendly: paano gumagana ang internet?",
    newChat: "Bagong chat",
    recent: "Kamakailan",
    footer: "Ginawa nang may 🎀 para sa'yo",
    placeholder: "Mag-message kay Mimi...",
    disclaimer: "Posibleng magkamali si Mimi. I-double check ang mahahalagang impormasyon.",
    newChatTitle: "Bagong chat",
    errorMsg: "Ay, natanggal ang laso ko! May naganap na error sa server. Subukan ulit sandali. 🎀",
    languageName: "Filipino",
    noChatsYet: "Wala pang chat sa wikang ito",
    deleteChat: "Burahin ang chat",
    notConfiguredMsg: "Hindi pa naka-connect si Mimi sa utak niya! Kailangan munang i-set up ng may-ari ng site ang backend (tingnan ang mimi-worker.js) bago ako makapag-chat nang totoo. 🎀"
  },
  ja: {
    modelPill: "ミミ・あなたの猫の相棒",
    heroTitle: "こんにちは、ミミです",
    heroSubtitle: "なんでも聞いてね。リボンを揺らして耳を澄ませてるよ。",
    chip1: "✨ 豆知識", chip2: "🎀 詩を書く", chip3: "📋 一日の予定", chip4: "💡 やさしく説明",
    prompt1: "私が知らなそうな面白い豆知識を教えて",
    prompt2: "友情についての短くて優しい詩を書いて",
    prompt3: "のんびりした日曜日の過ごし方を考えて",
    prompt4: "インターネットの仕組みをやさしく簡単に説明して",
    newChat: "新しいチャット",
    recent: "最近のチャット",
    footer: "🎀 を込めて作りました",
    placeholder: "ミミにメッセージを送る...",
    disclaimer: "ミミも間違えることがあります。重要な情報は確認してね。",
    newChatTitle: "新しいチャット",
    errorMsg: "あっ、リボンがほどけちゃった！サーバーに問題が発生しました。少し待ってからもう一度お試しください。🎀",
    languageName: "日本語",
    noChatsYet: "この言語のチャットはまだありません",
    deleteChat: "チャットを削除",
    notConfiguredMsg: "まだミミの頭脳が接続されていないよ！ サイトの管理者がバックエンド（mimi-worker.js）を設定する必要があるの。🎀"
  },
  es: {
    modelPill: "Mimi · tu amiga gatita",
    heroTitle: "Hola, soy Mimi",
    heroSubtitle: "Pregúntame lo que quieras — te escucho con todo mi lazo.",
    chip1: "✨ Dato curioso", chip2: "🎀 Escribe un poema", chip3: "📋 Planea mi día", chip4: "💡 Explica algo simple",
    prompt1: "Cuéntame un dato curioso que probablemente no conozca",
    prompt2: "Escríbeme un poema corto y dulce sobre la amistad",
    prompt3: "Ayúdame a planear un domingo tranquilo y acogedor",
    prompt4: "Explica algo complicado de forma simple y amigable: ¿cómo funciona internet?",
    newChat: "Nuevo chat",
    recent: "Recientes",
    footer: "Hecho con 🎀 para ti",
    placeholder: "Escríbele a Mimi...",
    disclaimer: "Mimi puede cometer errores. Verifica la información importante.",
    newChatTitle: "Nuevo chat",
    errorMsg: "¡Ups, se me soltó el lazo! Algo salió mal con el servidor. Intenta de nuevo en un momento. 🎀",
    languageName: "Español",
    noChatsYet: "Aún no hay chats en este idioma",
    deleteChat: "Eliminar chat",
    notConfiguredMsg: "¡Mimi todavía no está conectada a un cerebro! El dueño del sitio debe configurar el backend (ver mimi-worker.js) antes de que pueda chatear de verdad. 🎀"
  },
  ko: {
    modelPill: "미미 · 나의 고양이 친구",
    heroTitle: "안녕, 나는 미미야",
    heroSubtitle: "무엇이든 물어봐 — 리본을 쫑긋 세우고 듣고 있을게.",
    chip1: "✨ 재미있는 사실", chip2: "🎀 시 써주기", chip3: "📋 하루 계획", chip4: "💡 쉽게 설명하기",
    prompt1: "내가 잘 모를 것 같은 재미있는 사실 하나 알려줘",
    prompt2: "우정에 대한 짧고 따뜻한 시를 써줘",
    prompt3: "편안한 일요일을 계획하는 걸 도와줘",
    prompt4: "인터넷이 어떻게 작동하는지 쉽고 친근하게 설명해줘",
    newChat: "새 채팅",
    recent: "최근 채팅",
    footer: "🎀 마음을 담아 만들었어요",
    placeholder: "미미에게 메시지 보내기...",
    disclaimer: "미미도 실수를 할 수 있어요. 중요한 정보는 다시 확인하세요.",
    newChatTitle: "새 채팅",
    errorMsg: "앗, 리본이 풀렸어! 서버에 문제가 생겼어요. 잠시 후 다시 시도해주세요. 🎀",
    languageName: "한국어",
    noChatsYet: "이 언어로 된 채팅이 아직 없어요",
    deleteChat: "채팅 삭제",
    notConfiguredMsg: "미미가 아직 두뇌에 연결되지 않았어요! 사이트 관리자가 백엔드(mimi-worker.js 참고)를 먼저 설정해야 진짜로 대화할 수 있어요. 🎀"
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

let conversations = [];      // {id, title, lang, messages:[{role, content}]}
let currentId = null;

function uid(){ return Math.random().toString(36).slice(2,9); }

function newConversation(){
  const conv = { id: uid(), title: t('newChatTitle'), lang: currentLang, messages: [] };
  conversations.unshift(conv);
  currentId = conv.id;
  renderHistory();
  renderChat();
}

function currentConv(){
  return conversations.find(c => c.id === currentId);
}

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
    title.onclick = () => { currentId = c.id; renderHistory(); renderChat(); closeSidebarMobile(); };

    const delBtn = document.createElement('button');
    delBtn.className = 'history-delete';
    delBtn.setAttribute('aria-label', t('deleteChat'));
    delBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z"/></svg>';
    delBtn.onclick = (e) => { e.stopPropagation(); deleteConversation(c.id); };

    div.appendChild(title);
    div.appendChild(delBtn);
    historyEl.appendChild(div);
  });
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
}

function renderChat(){
  const conv = currentConv();
  chatInner.innerHTML = '';
  if (!conv || conv.messages.length === 0){
    hero.style.display = 'flex';
    return;
  }
  hero.style.display = 'none';
  conv.messages.forEach(m => appendBubble(m.role, m.content, false));
  chatScroll.scrollTop = chatScroll.scrollHeight;
}

function appendBubble(role, text, animate=true){
  const msg = document.createElement('div');
  msg.className = 'msg ' + role;
  const avatar = document.createElement('div');
  avatar.className = 'avatar ' + role;
  if(role === 'ai'){
    avatar.textContent = '🎀';
  } else {
    avatar.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>';
  }
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;
  msg.appendChild(avatar);
  msg.appendChild(bubble);
  if(!animate) msg.style.animation = 'none';
  chatInner.appendChild(msg);
  return bubble;
}

function appendTyping(){
  const msg = document.createElement('div');
  msg.className = 'msg ai';
  msg.id = 'typingMsg';
  const avatar = document.createElement('div');
  avatar.className = 'avatar ai';
  avatar.textContent = '🎀';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';
  msg.appendChild(avatar);
  msg.appendChild(bubble);
  chatInner.appendChild(msg);
  chatScroll.scrollTop = chatScroll.scrollHeight;
  return msg;
}

function autoResize(){
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 150) + 'px';
}
input.addEventListener('input', () => {
  autoResize();
  sendBtn.disabled = input.value.trim().length === 0;
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

async function send(){
  const text = input.value.trim();
  if(!text) return;
  let conv = currentConv();
  if(!conv){ newConversation(); conv = currentConv(); }

  if(conv.messages.length === 0){
    conv.title = text.slice(0, 32) + (text.length > 32 ? '…' : '');
    conv.lang = currentLang;
  }

  hero.style.display = 'none';
  conv.messages.push({ role:'user', content:text });
  appendBubble('user', text);
  input.value = '';
  autoResize();
  sendBtn.disabled = true;
  chatScroll.scrollTop = chatScroll.scrollHeight;
  renderHistory();

  const typingMsg = appendTyping();

  try{
    if(API_ENDPOINT.includes('YOUR-SUBDOMAIN')){
      throw new Error('NOT_CONFIGURED');
    }

    // Gemini expects role "user" or "model" — we send our internal
    // 'ai' role through and let the worker translate it.
    const apiMessages = conv.messages.map(m => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.content
    }));

    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: "You are Mimi, a warm, cheerful, kind AI companion with a cute cat-and-bow personality. Keep replies friendly, clear, and not overly long unless asked. Light, tasteful use of an occasional emoji like 🎀 or 🐾 is welcome but don't overdo it. Always respond in " + t('languageName') + ", regardless of what language the user writes in, unless they explicitly ask you to switch languages.",
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

    conv.messages.push({ role:'ai', content: fullText || "Sorry, I didn't quite catch that — could you try again?" });

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
applyLanguage();
newConversation();
