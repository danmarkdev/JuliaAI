(function(){
'use strict';

const EXTRAS_VERSION = 'v15';

/* copyhelper (https) */
function copyText(txt){
  return new Promise((resolve, reject) => {
    const legacy = () => {
      try{
        const ta = document.createElement('textarea');
        ta.value = txt;
        ta.setAttribute('readonly', '');
        ta.className = 'copy-helper';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ta.setSelectionRange(0, txt.length);
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error('copy blocked'));
      }catch(e){ reject(e); }
    };
    try{
      if(navigator.clipboard && window.isSecureContext){
        navigator.clipboard.writeText(txt).then(resolve, legacy);
        return;
      }
    }catch(e){}
    legacy();
  });
}

/* Markdown Rendering */
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const NUL = '\u0000';
const LI = /^(\s*)([-*\u2022]|\d+[.)])\s+(.*)$/;
const SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const HR = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;

function inline(s){
  const keep = [];
  const hold = h => NUL + (keep.push(h) - 1) + NUL;
  s = esc(s).replace(/`([^`\n]+)`/g, (m, c) => hold('<code>' + c + '</code>'));
  s = s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, t, u) =>
    hold('<a href="' + u.replace(/"/g, '%22') + '" target="_blank" rel="noopener noreferrer">' + t + '</a>'));
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<]*[^\s<.,;:!?)])/g, (m, p, u) =>
    p + hold('<a href="' + u.replace(/"/g, '%22') + '" target="_blank" rel="noopener noreferrer">' + u + '</a>'));
  s = s.replace(/\*\*([^\n]+?)\*\*/g, '<strong>$1</strong>')
       .replace(/(^|[^*\w])\*([^*\s][^*\n]*?)\*(?!\*)/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (m, i) => keep[i]);
}

function cells(l){ return l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()); }

function md(src){
  const blocks = [];
  src = String(src).replace(/\r/g, '').replace(/```([\w+#.-]*)[^\n]*\n?([\s\S]*?)```/g, (m, l, c) => {
    blocks.push([l, c.replace(/\n$/, '')]);
    return '\n\u0001' + (blocks.length - 1) + '\u0001\n';
  });
  const L = src.split('\n');
  const starts = (l, n) => /^\u0001\d+\u0001$/.test(l) || /^#{1,6}\s/.test(l) || LI.test(l) ||
    /^\s*>/.test(l) || HR.test(l) || (l.includes('|') && SEP.test(n || ''));
  let o = '', i = 0, m;
  while(i < L.length){
    const l = L[i];
    if(!l.trim()){ i++; continue; }
    if((m = l.match(/^\u0001(\d+)\u0001$/))){
      const b = blocks[m[1]];
      o += '<div class="code-block"><div class="code-head"><span>' + esc(b[0] || 'code') +
           '</span><button type="button" class="code-copy">Copy</button></div><pre><code>' + esc(b[1]) + '</code></pre></div>';
      i++; continue;
    }
    if((m = l.match(/^(#{1,6})\s+(.*)$/))){
      const n = Math.min(m[1].length + 2, 6);
      o += '<h' + n + '>' + inline(m[2]) + '</h' + n + '>'; i++; continue;
    }
    if(HR.test(l)){ o += '<hr>'; i++; continue; }
    if(/^\s*>/.test(l)){
      const q = [];
      while(i < L.length && /^\s*>/.test(L[i])) q.push(inline(L[i++].replace(/^\s*>\s?/, '')));
      o += '<blockquote>' + q.join('<br>') + '</blockquote>'; continue;
    }
    if(l.includes('|') && SEP.test(L[i + 1] || '')){
      const h = cells(l); i += 2;
      const rows = [];
      while(i < L.length && L[i].trim() && L[i].includes('|')) rows.push(cells(L[i++]));
      o += '<div class="md-table"><table><thead><tr>' + h.map(c => '<th>' + inline(c) + '</th>').join('') +
           '</tr></thead><tbody>' + rows.map(r => '<tr>' + r.map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') +
           '</tbody></table></div>';
      continue;
    }
    if((m = l.match(LI))){
      const ord = /\d/.test(m[2]);
      const start = ord ? parseInt(m[2], 10) : 1;
      let items = '';
      while(i < L.length && (m = L[i].match(LI))){
        const depth = Math.min(Math.floor(m[1].replace(/\t/g, '  ').length / 2), 4);
        items += '<li' + (depth ? ' class="d' + depth + '"' : '') + '>' + inline(m[3]) + '</li>';
        i++;
      }
      o += (ord ? '<ol start="' + start + '">' : '<ul>') + items + (ord ? '</ol>' : '</ul>');
      continue;
    }
    const p = [];
    while(i < L.length && L[i].trim() && !(p.length && starts(L[i], L[i + 1]))) p.push(inline(L[i++]));
    o += '<p>' + p.join('<br>') + '</p>';
  }
  return o;
}

// AI bubbles render as formatted HTML
const baseAppend = appendBubble;
appendBubble = function(role, text){
  const bubble = baseAppend.apply(null, arguments);
  if(role === 'ai' && text){
    const span = bubble.lastElementChild;
    if(span && span.tagName === 'SPAN'){ span.innerHTML = md(text); bubble.classList.add('md'); }
  }
 
  const att = arguments[3];
  if(!text && att && att.length && bubble.querySelector('.file-card')) bubble.classList.add('file-only');
  return bubble;
};

document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('.code-copy');
  if(!b) return;
  const txt = b.closest('.code-block').querySelector('code').textContent;
  copyText(txt).then(() => {
    b.textContent = 'Copied!';
    setTimeout(() => { b.textContent = 'Copy'; }, 1400);
  }, () => {});
});

/* format rules */
const baseSystemPrompt = buildSystPrompt;
buildSystemPrompt = function(){
  return baseSystemPrompt() +
    "\n\nFORMATTING: your replies are shown as markdown, so match the format to what the person needs. " +
    "Casual chat, feelings, or quick questions: short plain paragraphs, no lists or headings. " +
    "How-to or setup help: a numbered list, one action per step. " +
    "Tips, ideas, or options: a bullet list with the key word in **bold**. " +
    "Comparisons: a markdown table. " +
    "Code, commands, config, or file contents: always a fenced block with the language (```html, ```js, ```bash), complete and ready to paste, with one short sentence before it and the next step after it. If there are several files, put each file name in bold above its block. When asked to fix or change code, give the full updated file, not fragments. " +
    "Emails, messages, captions, or anything they will paste elsewhere: put only the ready-to-send text in a ```text block, then one short line offering changes. " +
    "Homework or math: numbered steps, then the final answer in **bold**. " +
    "Poems and stories: normal lines, never a code block. " +
    "Use headings (##) only for long, multi-part answers. Never wrap a whole reply in a code block.";
};

/* Cross Device Sync */
const LS_CODE = 'juliaSyncCode', LS_DEL = 'juliaSyncDeleted';
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const POLL_MS = 10000;      
const TIMEOUT_MS = 20000;   

const makeCode = () => Array.from(crypto.getRandomValues(new Uint8Array(20)), b => ALPHA[b % 32]).join('');
let code = localStorage.getItem(LS_CODE) || '';
if(!code){
  code = makeCode();
  localStorage.setItem(LS_CODE, code);
}
const fmt = c => c.match(/.{1,4}/g).join('-');
let tomb = {};
try{ tomb = JSON.parse(localStorage.getItem(LS_DEL) || '{}'); }catch(e){ tomb = {}; }
const saveTomb = () => localStorage.setItem(LS_DEL, JSON.stringify(tomb));

const sig = c => JSON.stringify([c.title, c.messages.map(m => [m.role, m.content, m.feedback || 0, (m.attachments || []).length])]);
const sigs = new Map();
let dirty = false, busy = false, queued = false, timer = null, workerOld = false;

function stampAll(mark){
  conversations.forEach(c => {
    const s = sig(c);
    if(sigs.get(c.id) !== s){ if(mark) c.updatedAt = Date.now(); sigs.set(c.id, s); }
    if(!c.updatedAt) c.updatedAt = Date.now();
  });
}

const rawSave = saveState;
saveState = function(){ stampAll(true); rawSave(); dirty = true; clearTimeout(timer); timer = setTimeout(syncNow, 1200); };

const rawDelete = deleteConversation;
deleteConversation = function(id){ tomb[id] = Date.now(); saveTomb(); sigs.delete(id); rawDelete(id); };

// Photos and files syncs both devices
const strip = c => ({ ...c, messages: c.messages.map(m => (m.attachments && m.attachments.length)
  ? { ...m, attachments: m.attachments.map(a => ({ name: (a.name || 'Image') + ' (on other device)', mimeType: 'omitted', omitted: 1 })) }
  : m) });

function merge(r){
  let push = false, changed = false;
  const rc = Array.isArray(r.conversations) ? r.conversations : [];
  const rd = r.deleted || {};
  const prevId = currentId, prevCur = currentConv();
  const prevSig = prevCur ? sig(prevCur) : '';

  Object.keys(rd).forEach(id => { if((tomb[id] || 0) < rd[id]) tomb[id] = rd[id]; });
  Object.keys(tomb).forEach(id => { if(rd[id] !== tomb[id]) push = true; });
  conversations = conversations.filter(c => !(tomb[c.id] > (c.updatedAt || 0)));

  const local = new Map(conversations.map(c => [c.id, c]));
  rc.forEach(x => {
    if(!x || !x.id || !Array.isArray(x.messages) || tomb[x.id] > (x.updatedAt || 0)) return;
    x.lang = 'en';
    const l = local.get(x.id);
    if(!l){ conversations.push(x); changed = true; }
    else if((x.updatedAt || 0) > (l.updatedAt || 0)){
      x.messages.forEach((m, i) => {
        const old = l.messages[i];
        if(old && old.role === m.role && old.attachments && m.attachments && m.attachments.some(a => a.omitted)) m.attachments = old.attachments;
      });
      Object.assign(l, x); changed = true;
    }
  });

  const remote = new Map(rc.map(x => [x.id, x]));
  conversations.forEach(c => {
    if(!c.messages.length) return;
    const x = remote.get(c.id);
    if(!x || (c.updatedAt || 0) > (x.updatedAt || 0)) push = true;
  });

  conversations.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  if(!conversations.find(c => c.id === currentId)){
    if(conversations.length) currentId = conversations[0].id; else newConversation();
  }
  saveTomb(); rawSave(); stampAll(false);

  if(changed || prevId !== currentId){
    if(!document.querySelector('.history-item-input')) renderHistory();
    const cur = currentConv();
    if((prevId !== currentId || !cur || sig(cur) !== prevSig) && !document.querySelector('.edit-box')) renderChat();
  }
  return push;
}

function setStatus(t){ const e = document.getElementById('syncStatus'); if(e) e.textContent = t; }

// stopping the freeze syncing
async function call(path, opts){
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try{
    const r = await fetch(API_ENDPOINT + path, { ...opts, cache: 'no-store', signal: ctl.signal });
    let data = null;
    try{ data = await r.json(); }catch(e){}
    return { ok: r.ok, status: r.status, data };
  }finally{ clearTimeout(to); }
}

const localCount = () => conversations.filter(c => c.messages.length).length;

async function syncNow(manual){
  if(!code) return;
  if(busy){ queued = true; return; }
  if(document.getElementById('typingMsg')){
    dirty = true;
    if(manual === true) setStatus('Julia is still replying. Syncing right after.');
    return;
  }
  busy = true;
  const was = dirty; dirty = false;
  const usedCode = code;
  const head = { 'X-Sync-Key': usedCode };
  try{
    const g = await call('/sync', { headers: head });
    if(!g.ok || !g.data) throw new Error('GET ' + g.status);
    if(usedCode !== code || document.getElementById('typingMsg')){ dirty = true; return; }

    let serverCount = (g.data.conversations || []).length;
    const push = merge(g.data) || was;

    if(push){
      const body = JSON.stringify({ conversations: conversations.filter(c => c.messages.length).map(strip), deleted: tomb });
      const p = await call('/sync', { method: 'PUT', headers: { ...head, 'Content-Type': 'application/json' }, body });
      if(!p.ok) throw new Error('PUT ' + p.status);
      
      if(p.data && Array.isArray(p.data.conversations)){
        workerOld = false;
        serverCount = p.data.conversations.length;
        if(usedCode === code && !document.getElementById('typingMsg')) merge(p.data);
      }else{
        workerOld = true;   // saved chats
      }
    }
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if(workerOld){
      setStatus('PROBLEM: your Cloudflare worker is the OLD version, so devices overwrite each other. In Cloudflare > julia-ai-chat-proxy > Edit code, paste the newest Mimi worker.js and click Deploy.');
    }else{
      setStatus('Synced at ' + time + '. This device: ' + localCount() + ' chats. Server: ' + serverCount + ' chats.');
    }
  }catch(e){
    console.error('Sync failed', e);
    dirty = true;
    setStatus('Could not sync (' + (e.name === 'AbortError' ? 'timed out' : e.message) + '). Retrying...');
  }finally{
    busy = false;
    if(queued){ queued = false; setTimeout(syncNow, 300); }
  }
}

/* sync ui */
const openBtn = document.createElement('button');
openBtn.type = 'button';
openBtn.className = 'new-chat-btn sync-btn';
openBtn.textContent = 'Sync devices';
document.getElementById('sidebarFooter').before(openBtn);

const modal = document.createElement('div');
modal.className = 'sync-modal';
modal.innerHTML =
  '<div class="sync-card"><h3>Sync your chats</h3>' +
  '<p>Chats sync between devices that use the same code. On your other device, tap <b>Sync devices</b> and enter this code.</p>' +
  '<div class="sync-code" id="syncCode"></div>' +
  '<div class="sync-row two"><button type="button" id="syncCopy">Copy code</button><button type="button" class="sync-alt" id="syncNew">New code</button></div>' +
  '<p>Got a code from another device? Enter it here. Chats on this device will be combined with that code\'s chats.</p>' +
  '<div class="sync-row"><input id="syncInput" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" autocomplete="off" autocapitalize="characters" spellcheck="false"><button type="button" id="syncLink">Use code</button></div>' +
  '<div class="sync-status" id="syncStatus"></div>' +
  '<p class="sync-note">Keep this code private, anyone with it can read your chats. Only text syncs; photos and files stay on the device that sent them. It can take up to a minute for a new chat to show on the other device.</p>' +
  '<button type="button" class="sync-close" id="syncClose">Close</button></div>';
document.body.appendChild(modal);

const codeEl = document.getElementById('syncCode');
const showModal = () => { codeEl.textContent = fmt(code); modal.classList.add('show'); setStatus('Syncing...'); syncNow(true); };
const hideModal = () => modal.classList.remove('show');
openBtn.addEventListener('click', () => { closeSidebarMobile(); showModal(); });
document.getElementById('syncClose').addEventListener('click', hideModal);
modal.addEventListener('click', e => { if(e.target === modal) hideModal(); });
document.addEventListener('keydown', e => { if(e.key === 'Escape') hideModal(); });
document.getElementById('syncCopy').addEventListener('click', () => {
  copyText(fmt(code)).then(
    () => setStatus('Code copied: ' + fmt(code)),
    () => setStatus('Copy is blocked here. Press and hold the code above, select it, and copy it by hand.')
  );
});
document.getElementById('syncNew').addEventListener('click', () => {
  if(!window.confirm('Make a brand new code? Your other devices will stop syncing with this one until you enter the new code on them.')) return;
  code = makeCode();
  localStorage.setItem(LS_CODE, code);
  codeEl.textContent = fmt(code);
  dirty = true;
  setStatus('New code ready: ' + fmt(code));
  syncNow(true);
});
document.getElementById('syncLink').addEventListener('click', () => {
  const v = document.getElementById('syncInput').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if(!new RegExp('^[' + ALPHA + ']{20}$').test(v)){ setStatus('That code should be 20 letters and numbers.'); return; }
  code = v;
  localStorage.setItem(LS_CODE, v);
  codeEl.textContent = fmt(v);
  document.getElementById('syncInput').value = '';
  dirty = true;
  setStatus('Linking...');
  syncNow(true);
});


try{
   
i18n.en.placeholder = 'Ask Julia AI...';
input.placeholder = i18n.en.placeholder;

// File cards
const FILE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg>';
function fileParts(a){
  const full = String(a.name || 'file').replace(/\s*\(on other device\)\s*$/i, '');
  const m = full.match(/^(.+)\.([A-Za-z0-9]{1,5})$/);
  let base = full, ext = '';
  if(m){ base = m[1]; ext = m[2].toUpperCase(); }
  else if(a.mimeType === 'application/pdf') ext = 'PDF';
  else if(a.mimeType === 'text/plain') ext = 'TXT';
  return { full, base, ext: ext || 'FILE' };
}
function fileCard(a){
  const p = fileParts(a);
  const card = document.createElement('div');
  card.className = 'file-card';
  card.title = p.full;
  const ico = document.createElement('div');
  ico.className = 'file-ico';
  ico.innerHTML = FILE_ICON;
  const label = document.createElement('span');
  label.textContent = p.ext;
  ico.appendChild(label);
  const title = document.createElement('div');
  title.className = 'file-title';
  title.textContent = p.base;
  card.appendChild(ico);
  card.appendChild(title);
  return card;
}
const baseGrid = attachmentsToHtmlGrid;
attachmentsToHtmlGrid = function(attachments){
  const grid = baseGrid(attachments);
  if(!grid) return grid;
  const files = attachments.filter(a => a.mimeType && !a.mimeType.startsWith('image/'));
  Array.from(grid.querySelectorAll('.file-badge')).forEach((badge, i) => {
    if(files[i]) badge.replaceWith(fileCard(files[i]));
  });
  return grid;
};

// Daily Motivation Quotes
const QUOTES = [
  "Small steps still move you forward.",
  "Be proud of how far you have come, not only how far you have to go.",
  "Rest is part of the plan, not a break from it.",
  "You are allowed to learn at your own pace.",
  "One focused hour beats five distracted ones.",
  "Mistakes are just proof that you are trying.",
  "Start with what you have, right where you are.",
  "A messy first draft is better than a perfect empty page.",
  "You do not need to be perfect to be amazing.",
  "Today's effort is tomorrow's confidence.",
  "Breathe in, breathe out, then begin again.",
  "Your future self is cheering for you right now.",
  "Hard things get easier the more you show up for them.",
  "Drink some water, stretch a little, and keep going.",
  "Progress is quiet, but it adds up.",
  "It is okay to ask for help. That is how everyone learns.",
  "Every expert was once a beginner who kept going.",
  "Be kind to yourself on the days that feel heavy.",
  "You have already made it through every hard day so far.",
  "Curiosity is a superpower. Keep asking questions.",
  "Done is better than perfect, and learning beats both.",
  "Take it one page, one problem, one breath at a time.",
  "Believe in the version of you that keeps trying.",
  "Bad days do not erase your progress.",
  "You are building something good, even when it feels slow.",
  "Choose progress over pressure today.",
  "Your pace is valid. Keep walking.",
  "Make today a little brighter than yesterday.",
  "Courage is trying again after a tough day.",
  "Little by little, it becomes a lot.",
  "You are more capable than you think.",
  "Focus on what you can do right now.",
  "Celebrate the small wins, they count too.",
  "A tired mind needs a break, not a reason to quit.",
  "Dream big, then take one tiny step today.",
  "Your effort matters, even when nobody sees it.",
  "Let today be a fresh start.",
  "Every question you ask makes you smarter.",
  "Do it tired, do it nervous, but be kind to yourself while you do.",
  "Good things take time, and you are on your way.",
  "Trust the process and keep showing up.",
  "Think of how proud you will feel when it is done.",
  "You are doing better than you give yourself credit for.",
  "Stay curious, stay gentle, stay going.",
  "Tough moments grow strong people.",
  "Keep your goals close and your worries light.",
  "Today is a good day to learn something new.",
  "Your best does not have to look like anyone else's.",
  "Slow progress is still progress.",
  "Take the first step, the second one gets easier.",
  "You can do hard things, one at a time.",
  "Enjoy the journey, not just the finish line.",
  "Every day is another chance to grow.",
  "Be patient with yourself, growth takes time.",
  "Pick one thing, give it your full attention, and begin.",
  "Believe it is possible, then work toward it.",
  "Kindness to yourself is never wasted.",
  "Your dreams are worth the effort.",
  "You are not behind. You are on your own path."
];
const FLOWER_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
  '<circle class="dm-petal" cx="12" cy="6" r="3.4"/><circle class="dm-petal" cx="18" cy="10.4" r="3.4"/>' +
  '<circle class="dm-petal" cx="15.7" cy="17.4" r="3.4"/><circle class="dm-petal" cx="8.3" cy="17.4" r="3.4"/>' +
  '<circle class="dm-petal" cx="6" cy="10.4" r="3.4"/><circle class="dm-core" cx="12" cy="12" r="2.6"/></svg>';
const dayNo = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
let dmShift = 0;
const quoteNow = () => QUOTES[(dayNo() + dmShift) % QUOTES.length];
const dm = document.createElement('div');
dm.className = 'dm-card';
dm.setAttribute('role', 'note');
dm.title = 'Tap for another one';
const dmIco = document.createElement('div');
dmIco.className = 'dm-ico';
dmIco.innerHTML = FLOWER_ICON;
const dmBox = document.createElement('div');
dmBox.className = 'dm-box';
const dmLabel = document.createElement('div');
dmLabel.className = 'dm-label';
dmLabel.textContent = "Julia's daily motivation";
const dmText = document.createElement('div');
dmText.className = 'dm-text';
dmText.textContent = quoteNow();
dmBox.appendChild(dmLabel);
dmBox.appendChild(dmText);
dm.appendChild(dmIco);
dm.appendChild(dmBox);

/* Daily Motivation Quote */
const DM_ROTATE_MS = 12000;
const DM_FADE_MS = 350;
let dmTimer = null, dmPaused = false;
function dmNext(){
  dmShift = (dmShift + 1) % QUOTES.length;
  dmText.classList.add('dm-out');
  setTimeout(() => { dmText.textContent = quoteNow(); dmText.classList.remove('dm-out'); }, DM_FADE_MS);
}
function dmStart(){
  clearInterval(dmTimer);
  dmTimer = setInterval(() => { if(!document.hidden && !dmPaused) dmNext(); }, DM_ROTATE_MS);
}
dm.addEventListener('click', () => { dmNext(); dmStart(); });
dm.addEventListener('mouseenter', () => { dmPaused = true; });
dm.addEventListener('mouseleave', () => { dmPaused = false; });
dmStart();
const dmHost = document.querySelector('.topbar');
if(dmHost) dmHost.after(dm); else document.querySelector('.main').prepend(dm);

}catch(e){ console.error('Look-and-feel setup failed', e); }

/* Start  */
stampAll(false);
rawSave();
renderChat();
syncNow();
setInterval(() => { if(!document.hidden) syncNow(); }, POLL_MS);
document.addEventListener('visibilitychange', () => { if(!document.hidden) syncNow(); });
window.addEventListener('focus', () => syncNow());
window.addEventListener('online', () => syncNow());
window.addEventListener('pageshow', () => syncNow());
})();
