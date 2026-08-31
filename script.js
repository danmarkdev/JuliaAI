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
  return `<img src="kitty-icon.png" width="${size}" height="${size}" alt="Kitty" />`;
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

    const contentType = res.headers.get('content-type') || '';

    // If there's no backend at all (static hosting like GitHub Pages, or
    // this page opened directly as a file), the request either 404s or
    // gets routed back to index.html — which is HTML, not JSON.
    if (!contentType.includes('application/json')) {
      throw new Error('NO_BACKEND');
    }

    const data = await res.json();

    if (!res.ok) {
      console.error('API error:', data.error || res.status);
      throw new Error('API_ERROR');
    }

    removeTyping();
    const reply = data.reply || "Mrow? Something got tangled in my whiskers, try again?";
    messages.push({ role: 'assistant', content: reply });
    renderMessage('assistant', reply);
  } catch (err) {
    removeTyping();
    let fallback;
    if (err.message === 'NO_BACKEND') {
      fallback = "I can't reach my brain from here — this page has no backend connected (e.g. it's on GitHub Pages, or opened as a local file). Deploy the full project to Vercel with ANTHROPIC_API_KEY set, then try me on that URL.";
      console.error('No backend detected at /api/chat — deploy this project (with the api/ folder) to a host that runs serverless functions, like Vercel.');
    } else {
      fallback = "Nya... my paws slipped and the message didn't send. Could you try again?";
      console.error(err);
    }
    messages.push({ role: 'assistant', content: fallback });
    renderMessage('assistant', fallback);
  } finally {
    setLoading(false);
  }
}

chatInput.addEventListener('input', () => {
  sendBtn.disabled = loading || !chatInput.value.trim();
});
