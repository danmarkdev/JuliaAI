// ---- Kitty Chat frontend logic ----
// Frontend and backend both live in this same Vercel project, so a relative
// path just works — no separate backend URL or CORS setup needed.

const sidebar = document.getElementById('sidebar');
const collapseBtn = document.getElementById('collapseBtn');
const expandBtn = document.getElementById('expandBtn');
const newChatBtn = document.getElementById('newChatBtn');

const greetingView = document.getElementById('greetingView');
const chatView = document.getElementById('chatView');
const chatScroll = document.getElementById('chatScroll');
const starters = document.getElementById('starters');

const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');

let messages = []; // { role: 'user' | 'assistant', content: string }
let loading = false;

// ---- Sidebar toggle ----
collapseBtn.addEventListener('click', () => {
  sidebar.classList.add('collapsed');
  expandBtn.hidden = false;
});
expandBtn.addEventListener('click', () => {
  sidebar.classList.remove('collapsed');
  expandBtn.hidden = true;
});

// ---- New chat ----
newChatBtn.addEventListener('click', resetChat);

function resetChat() {
  messages = [];
  chatScroll.innerHTML = '';
  chatView.hidden = true;
  greetingView.hidden = false;
  chatInput.value = '';
}

// ---- Starter cards ----
starters.addEventListener('click', (e) => {
  const card = e.target.closest('.starter-card');
  if (!card) return;
  sendMessage(card.dataset.text);
});

// ---- Send button / Enter key ----
sendBtn.addEventListener('click', () => sendMessage());
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

function catAvatarSVG(size) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 120 110"><use href="#catIcon"></use></svg>`;
}

function renderMessage(role, content) {
  const row = document.createElement('div');
  row.className = `msg-row ${role}`;

  if (role === 'assistant') {
    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.innerHTML = catAvatarSVG(32);
    row.appendChild(avatar);
  }

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.textContent = content;
  row.appendChild(bubble);

  chatScroll.appendChild(row);
  chatScroll.scrollTop = chatScroll.scrollHeight;
  return row;
}

function renderTyping() {
  const row = document.createElement('div');
  row.className = 'msg-row assistant';
  row.id = 'typingRow';

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.innerHTML = catAvatarSVG(32);
  row.appendChild(avatar);

  const bubble = document.createElement('div');
  bubble.className = 'typing-bubble';
  bubble.innerHTML = '<span></span><span></span><span></span>';
  row.appendChild(bubble);

  chatScroll.appendChild(row);
  chatScroll.scrollTop = chatScroll.scrollHeight;
}

function removeTyping() {
  const row = document.getElementById('typingRow');
  if (row) row.remove();
}

function setLoading(state) {
  loading = state;
  sendBtn.disabled = loading || !chatInput.value.trim();
  chatInput.disabled = loading;
}

async function sendMessage(overrideText) {
  const text = (overrideText ?? chatInput.value).trim();
  if (!text || loading) return;

  if (greetingView.hidden === false) {
    greetingView.hidden = true;
    chatView.hidden = false;
  }

  messages.push({ role: 'user', content: text });
  renderMessage('user', text);
  chatInput.value = '';
  setLoading(true);
  renderTyping();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });

    if (!res.ok) throw new Error('Request failed');

    const data = await res.json();
    removeTyping();
    const reply = data.reply || "Mrow? Something got tangled in my whiskers, try again?";
    messages.push({ role: 'assistant', content: reply });
    renderMessage('assistant', reply);
  } catch (err) {
    removeTyping();
    const fallback = "Nya... my paws slipped and the message didn't send. Could you try again?";
    messages.push({ role: 'assistant', content: fallback });
    renderMessage('assistant', fallback);
    console.error(err);
  } finally {
    setLoading(false);
  }
}

chatInput.addEventListener('input', () => {
  sendBtn.disabled = loading || !chatInput.value.trim();
});
