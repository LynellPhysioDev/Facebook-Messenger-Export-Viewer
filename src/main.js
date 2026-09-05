// Shared Utils
function fixFbEncoding(str) {
  if (!str) return '';
  try {
    const bytes = new Uint8Array(str.split('').map(c => c.charCodeAt(0)));
    return new TextDecoder('utf-8').decode(bytes);
  } catch (e) {
    return str;
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatTime(ms) {
  return new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatAudioDuration(secs) {
  if (isNaN(secs) || secs < 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function formatDateSeparator(ms) {
  return new Date(ms).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function isSameDay(ms1, ms2) {
  const d1 = new Date(ms1), d2 = new Date(ms2);
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 55%, 42%)`;
}

function getInitials(name) {
  if (!name || name === '?') return '?';
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

function makeAvatar(name, size = 44) {
  const div = document.createElement('div');
  div.className = 'avatar';
  div.style.width = size + 'px';
  div.style.height = size + 'px';
  div.style.fontSize = Math.floor(size * 0.38) + 'px';
  div.style.backgroundColor = stringToColor(name || '?');
  div.textContent = getInitials(name);
  return div;
}

// App State
let myName = localStorage.getItem('fb-viewer-my-name') || '';
let favoriteSignatures = new Set(JSON.parse(localStorage.getItem('fb-viewer-favorites') || '[]'));
let currentTheme = localStorage.getItem('fb-viewer-theme') || 'dark';
let currentFont = localStorage.getItem('fb-viewer-font') || 'medium';

let dateFilterStart = null;
let dateFilterEnd = null;

let fbConversations = [];
let msgConversations = [];
let basenameMap = new Map();
const objectUrlCache = new WeakMap();

let activeSource = 'fb';
let currentConversation = null;
let activeMediaFilter = 'all';
let searchMatches = [];
let searchIndex = -1;
let currentLightboxMsgIdx = null;
let currentLightboxFile = null;

// Performance Optimization State
let loadedMessageCount = 80; // Render in batches of 80
let searchDebounceTimer = null;

// Tab-independent Search State
const tabSearchState = {
  fb: { term: '', pill: 'all' },
  msg: { term: '', pill: 'all' },
  fav: { term: '', pill: 'all' }
};

// Apply saved settings
document.body.setAttribute('data-theme', currentTheme);
document.body.setAttribute('data-font', currentFont);

// DOM Elements
const sidebar = document.getElementById('sidebar');
const resizer = document.getElementById('resizer');
const btnLoadFb = document.getElementById('btn-load-fb');
const btnLoadMsg = document.getElementById('btn-load-msg');
const sourceTabs = document.getElementById('source-tabs');
const nameInput = document.getElementById('my-name-input');
const nameOptions = document.getElementById('my-name-options');
const chatSearchInput = document.getElementById('chat-search-input');
const searchFilterPills = document.getElementById('search-filter-pills');
const chatListEl = document.getElementById('chat-list');
const chatTitleEl = document.getElementById('current-chat-title');
const chatHeaderAvatar = document.getElementById('chat-header-avatar');
const chatHeaderActions = document.getElementById('chat-header-actions');
const favoriteBtn = document.getElementById('favorite-btn');
const exportChatBtn = document.getElementById('export-chat-btn');
const viewport = document.getElementById('messages-viewport');
const quickJumpControls = document.getElementById('quick-jump-controls');
const jumpTopBtn = document.getElementById('jump-top-btn');
const jumpBottomBtn = document.getElementById('jump-bottom-btn');

const guideBtn = document.getElementById('guide-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const settingsClose = document.getElementById('settings-close');
const settingTheme = document.getElementById('setting-theme');
const settingFont = document.getElementById('setting-font');
const btnSaveSettings = document.getElementById('btn-save-settings');
const btnResetSettings = document.getElementById('btn-reset-settings');

// Welcome / Export Guide Modal Elements
const welcomeModal = document.getElementById('welcome-modal');
const welcomeClose = document.getElementById('welcome-close');
const welcomeScreen1 = document.getElementById('welcome-screen-1');
const welcomeScreen2 = document.getElementById('welcome-screen-2');
const welcomeScreen3 = document.getElementById('welcome-screen-3');

const gotoScreen2Btn = document.getElementById('goto-screen-2-btn');
const gotoScreen3Btn = document.getElementById('goto-screen-3-btn');
const backToScreen1Btn = document.getElementById('back-to-screen-1-btn');
const backToScreen2Btn = document.getElementById('back-to-screen-2-btn');
const getStartedBtn = document.getElementById('get-started-btn');
const dontShowAgainChk = document.getElementById('dont-show-again-chk');

const guideTabFb = document.getElementById('guide-tab-fb');
const guideTabMsg = document.getElementById('guide-tab-msg');
const guideTabFbContent = document.getElementById('guide-tab-fb-content');
const guideTabMsgContent = document.getElementById('guide-tab-msg-content');

const msgSearchBtn = document.getElementById('msg-search-btn');
const msgSearchBar = document.getElementById('msg-search-bar');
const msgSearchInput = document.getElementById('msg-search-input');
const msgSearchCount = document.getElementById('msg-search-count');
const msgSearchPrev = document.getElementById('msg-search-prev');
const msgSearchNext = document.getElementById('msg-search-next');
const msgSearchClose = document.getElementById('msg-search-close');

const infoBtn = document.getElementById('info-btn');
const infoPanel = document.getElementById('info-panel');
const infoPanelClose = document.getElementById('info-panel-close');
const infoPanelAvatarWrap = document.getElementById('info-panel-avatar-wrap');
const infoPanelName = document.getElementById('info-panel-name');
const infoPanelParticipants = document.getElementById('info-panel-participants');
const mediaToggle = document.getElementById('media-toggle');
const mediaSection = document.getElementById('media-section');
const mediaFilterPills = document.getElementById('media-filter-pills');
const galleryGrid = document.getElementById('gallery-grid');

const timelineToggle = document.getElementById('timeline-toggle');
const timelineSection = document.getElementById('timeline-section');
const dateStartInput = document.getElementById('date-start');
const dateEndInput = document.getElementById('date-end');
const btnApplyDateFilter = document.getElementById('btn-apply-date-filter');
const btnClearDateFilter = document.getElementById('btn-clear-date-filter');

const specificDayToggle = document.getElementById('specific-day-toggle');
const specificDaySection = document.getElementById('specific-day-section');
const infoDateJumper = document.getElementById('info-date-jumper');

const lightbox = document.getElementById('lightbox');
const lightboxContent = document.getElementById('lightbox-content');
const lightboxClose = document.getElementById('lightbox-close');
const lightboxJumpBtn = document.getElementById('lightbox-jump-btn');
const lightboxRevealBtn = document.getElementById('lightbox-reveal-btn');

settingTheme.value = currentTheme;
settingFont.value = currentFont;

// Listen for dynamic updates to Name Input
if (nameInput) {
  nameInput.value = myName;
  nameInput.addEventListener('input', () => {
    myName = nameInput.value;
    localStorage.setItem('fb-viewer-my-name', myName);
    if (currentConversation) {
      renderMessages(currentConversation, false);
    }
    applyFilters();
  });
}

// Infinite Scroll Pagination for Huge Chat Logs
viewport.addEventListener('scroll', () => {
  if (viewport.scrollTop === 0 && currentConversation) {
    if (loadedMessageCount < currentConversation.messages.length) {
      const oldHeight = viewport.scrollHeight;
      loadedMessageCount += 80;
      renderMessages(currentConversation, false);
      viewport.scrollTop = viewport.scrollHeight - oldHeight; // Keep scroll position stable
    }
  }
});

// --- Onboarding / Welcome Guide Flow ---
function showWelcomeModal(screen = 1) {
  welcomeScreen1.style.display = screen === 1 ? 'flex' : 'none';
  welcomeScreen2.style.display = screen === 2 ? 'flex' : 'none';
  welcomeScreen3.style.display = screen === 3 ? 'flex' : 'none';
  welcomeModal.style.display = 'flex';
}

function hideWelcomeModal() {
  if (dontShowAgainChk.checked) {
    localStorage.setItem('fb-viewer-skip-welcome', 'true');
  }
  welcomeModal.style.display = 'none';
}

if (localStorage.getItem('fb-viewer-skip-welcome') !== 'true') {
  showWelcomeModal(1);
}

guideBtn.addEventListener('click', () => showWelcomeModal(1));
welcomeClose.addEventListener('click', hideWelcomeModal);

gotoScreen2Btn.addEventListener('click', () => showWelcomeModal(2));
backToScreen1Btn.addEventListener('click', () => showWelcomeModal(1));
gotoScreen3Btn.addEventListener('click', () => showWelcomeModal(3));
backToScreen2Btn.addEventListener('click', () => showWelcomeModal(2));
getStartedBtn.addEventListener('click', hideWelcomeModal);

guideTabFb.addEventListener('click', () => {
  guideTabFb.classList.add('active');
  guideTabMsg.classList.remove('active');
  guideTabFbContent.style.display = 'block';
  guideTabMsgContent.style.display = 'none';
});

guideTabMsg.addEventListener('click', () => {
  guideTabMsg.classList.add('active');
  guideTabFb.classList.remove('active');
  guideTabMsgContent.style.display = 'block';
  guideTabFbContent.style.display = 'none';
});

// Native Drag and Drop Folder Listener
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', async (e) => {
  e.preventDefault();
  const items = e.dataTransfer.items;
  if (!items || !items.length) return;

  const files = [];
  for (let i = 0; i < items.length; i++) {
    const entry = items[i].webkitGetAsEntry ? items[i].webkitGetAsEntry() : null;
    if (entry) {
      await traverseFileTree(entry, files);
    }
  }

  if (files.length > 0) {
    chatListEl.innerHTML = '<p class="placeholder-text">Processing dropped folder...</p>';
    setTimeout(async () => {
      const parsedFb = await parseFacebookExport(files);
      if (parsedFb.conversations.length > 0) {
        fbConversations = parsedFb.conversations;
        populateNameOptions(parsedFb.names);
        btnLoadFb.classList.add('loaded');
        btnLoadFb.textContent = `✓ Facebook Export (${fbConversations.length} chats)`;
        sourceTabs.style.display = 'flex';
        switchSource('fb');
        return;
      }

      const parsedMsg = await parseMessengerExport(files);
      if (parsedMsg.conversations.length > 0) {
        msgConversations = parsedMsg.conversations;
        populateNameOptions(parsedMsg.names);
        btnLoadMsg.classList.add('loaded');
        btnLoadMsg.textContent = `✓ Messenger Export (${msgConversations.length} chats)`;
        sourceTabs.style.display = 'flex';
        switchSource('msg');
      }
    }, 50);
  }
});

async function traverseFileTree(item, fileList, path = '') {
  if (item.isFile) {
    return new Promise((resolve) => {
      item.file((file) => {
        fileList.push(file);
        resolve();
      });
    });
  } else if (item.isDirectory) {
    const dirReader = item.createReader();
    const entries = await new Promise((resolve) => dirReader.readEntries(resolve));
    for (const entry of entries) {
      await traverseFileTree(entry, fileList, path + item.name + '/');
    }
  }
}

function indexFiles(files) {
  const mediaExtensions = /\.(jpeg|jpg|png|webp|gif|mp4|mov|webm|mp3|wav|ogg|m4a|pdf|docx?|xlsx?|txt|zip)$/i;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!mediaExtensions.test(file.name)) continue;
    const path = (file.webkitRelativePath || file.name).replace(/\\/g, '/').toLowerCase();
    const basename = file.name.toLowerCase();
    if (!basenameMap.has(basename)) basenameMap.set(basename, []);
    const candidates = basenameMap.get(basename);
    if (!candidates.some(c => c.path === path)) candidates.push({ path, file });
  }
}

function resolveMediaFile(uri) {
  if (!uri) return null;
  const cleanUri = uri.replace(/^\.\//, '').replace(/\\/g, '/').toLowerCase();
  const filename = cleanUri.split('/').pop();
  const candidates = basenameMap.get(filename);
  return candidates && candidates.length > 0 ? candidates[0].file : null;
}

function getObjectUrl(file) {
  if (!file) return null;
  if (objectUrlCache.has(file)) return objectUrlCache.get(file);
  const url = URL.createObjectURL(file);
  objectUrlCache.set(file, url);
  return url;
}

function isVideoUri(uri) { return /\.(mp4|mov|webm)$/i.test(uri || ''); }

// Settings Handlers
settingsBtn.addEventListener('click', () => {
  settingTheme.value = currentTheme;
  settingFont.value = currentFont;
  settingsModal.style.display = 'flex';
});

settingsClose.addEventListener('click', () => settingsModal.style.display = 'none');

btnSaveSettings.addEventListener('click', () => {
  currentTheme = settingTheme.value;
  currentFont = settingFont.value;
  document.body.setAttribute('data-theme', currentTheme);
  document.body.setAttribute('data-font', currentFont);
  localStorage.setItem('fb-viewer-theme', currentTheme);
  localStorage.setItem('fb-viewer-font', currentFont);
  settingsModal.style.display = 'none';
});

btnResetSettings.addEventListener('click', () => {
  currentTheme = 'dark';
  currentFont = 'medium';
  settingTheme.value = 'dark';
  settingFont.value = 'medium';
  document.body.setAttribute('data-theme', 'dark');
  document.body.setAttribute('data-font', 'medium');
  localStorage.setItem('fb-viewer-theme', 'dark');
  localStorage.setItem('fb-viewer-font', 'medium');
});

// Quick Jump Navigation
jumpTopBtn.addEventListener('click', () => {
  if (currentConversation) {
    loadedMessageCount = currentConversation.messages.length;
    renderMessages(currentConversation, false);
    viewport.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

jumpBottomBtn.addEventListener('click', () => {
  viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
});

function jumpToMessageIndex(idx) {
  if (currentConversation && idx < (currentConversation.messages.length - loadedMessageCount)) {
    loadedMessageCount = currentConversation.messages.length - idx + 20;
    renderMessages(currentConversation, false);
  }

  const targetRow = viewport.querySelector(`[data-msg-index="${idx}"]`);
  if (targetRow) {
    targetRow.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const bubble = targetRow.querySelector('.message-bubble');
    if (bubble) {
      bubble.classList.add('search-active');
      setTimeout(() => bubble.classList.remove('search-active'), 2000);
    }
  }
}

// Specific Day Section Toggle & Jumper
specificDayToggle.addEventListener('click', () => {
  specificDaySection.style.display = specificDaySection.style.display === 'none' ? 'flex' : 'none';
  if (specificDaySection.style.display === 'flex') {
    specificDaySection.style.flexDirection = 'column';
  }
});

infoDateJumper.addEventListener('change', (e) => {
  const selectedDateStr = e.target.value;
  if (!selectedDateStr || !currentConversation) return;

  const targetTime = new Date(selectedDateStr + 'T00:00:00').getTime();
  const targetIdx = currentConversation.messages.findIndex(m => m.timestamp_ms >= targetTime);

  if (targetIdx !== -1) {
    jumpToMessageIndex(targetIdx);
  } else {
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
  }
});

// Timeline Filter Logic
timelineToggle.addEventListener('click', () => {
  timelineSection.style.display = timelineSection.style.display === 'none' ? 'flex' : 'none';
  if (timelineSection.style.display === 'flex') {
    timelineSection.style.flexDirection = 'column';
  }
});

btnApplyDateFilter.addEventListener('click', () => {
  const startVal = dateStartInput.value;
  const endVal = dateEndInput.value;
  dateFilterStart = startVal ? new Date(startVal + 'T00:00:00').getTime() : null;
  dateFilterEnd = endVal ? new Date(endVal + 'T23:59:59').getTime() : null;

  if (currentConversation) renderMessages(currentConversation, true);
});

btnClearDateFilter.addEventListener('click', () => {
  dateStartInput.value = '';
  dateEndInput.value = '';
  dateFilterStart = null;
  dateFilterEnd = null;

  if (currentConversation) renderMessages(currentConversation, true);
});

// Parsers
async function parseFacebookExport(files) {
  indexFiles(files);
  const jsonEntries = files.filter(f => f.name.endsWith('.json'));
  const groups = new Map();

  for (const file of jsonEntries) {
    const relPath = (file.webkitRelativePath || file.name).replace(/\\/g, '/');
    if (!file.name.startsWith('message_')) continue;
    const folderPath = relPath.substring(0, relPath.lastIndexOf('/'));
    if (!groups.has(folderPath)) groups.set(folderPath, []);
    groups.get(folderPath).push(file);
  }

  const result = [];
  const allNames = new Set();

  for (const [folderPath, groupFiles] of groups.entries()) {
    let title = '';
    const participants = new Set();
    let messages = [];

    for (const file of groupFiles) {
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.title && !title) title = fixFbEncoding(data.title);
        if (data.participants) data.participants.forEach(p => participants.add(fixFbEncoding(p.name).trim()));
        if (data.messages) messages.push(...data.messages);
      } catch (e) {}
    }

    if (messages.length === 0) continue;
    messages.forEach(m => { if (m.sender_name) participants.add(fixFbEncoding(m.sender_name).trim()); });
    participants.forEach(p => allNames.add(p));
    messages.sort((a, b) => a.timestamp_ms - b.timestamp_ms);

    result.push({
      id: folderPath,
      signature: `fb_${folderPath}`,
      title: title || [...participants].join(', ') || 'Conversation',
      participants,
      messages,
      folderPath
    });
  }
  return { conversations: result, names: allNames };
}

async function parseMessengerExport(files) {
  indexFiles(files);
  const jsonEntries = files.filter(f => f.name.endsWith('.json'));
  const result = [];
  const allNames = new Set();

  for (const file of jsonEntries) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      let rawMsgs = data.messages || (Array.isArray(data) ? data : []);
      if (rawMsgs.length === 0) continue;

      const participants = new Set();
      if (data.participants) {
        data.participants.forEach(p => {
          const name = typeof p === 'string' ? p : p.name;
          if (name) participants.add(fixFbEncoding(name).trim());
        });
      }

      const normalizedMessages = rawMsgs.map(rawMsg => {
        const sender = fixFbEncoding(rawMsg.senderName || rawMsg.sender_name || '');
        if (sender) participants.add(sender);

        let rawTs = rawMsg.timestamp || rawMsg.timestamp_ms || 0;
        let ts = typeof rawTs === 'string' ? parseInt(rawTs, 10) : rawTs;
        if (ts < 10000000000) ts = ts * 1000;

        let photos = [], videos = [], audio_files = [], files_list = [];
        const mediaArr = rawMsg.media || rawMsg.photos || rawMsg.videos || rawMsg.files || [];
        if (Array.isArray(mediaArr)) {
          mediaArr.forEach(m => {
            const uri = m.uri || '';
            if (/\.(mp4|mov|webm)$/i.test(uri)) videos.push(m);
            else if (/\.(mp3|wav|ogg|m4a)$/i.test(uri)) audio_files.push(m);
            else if (/\.(jpeg|jpg|png|webp|gif)$/i.test(uri)) photos.push(m);
            else if (uri) files_list.push(m);
          });
        }

        return {
          sender_name: sender,
          timestamp_ms: ts,
          content: fixFbEncoding(rawMsg.text || rawMsg.content || ''),
          sticker: rawMsg.sticker || null,
          photos, videos, audio_files, files: files_list, gifs: rawMsg.gifs || []
        };
      });

      participants.forEach(p => allNames.add(p));
      normalizedMessages.sort((a, b) => a.timestamp_ms - b.timestamp_ms);

      const title = data.threadName ? fixFbEncoding(data.threadName).replace(/_[0-9]+$/, '') : file.name.replace(/\.json$/i, '').replace(/_[0-9]+$/, '');

      result.push({
        id: file.name,
        signature: `msg_${file.name}`,
        title,
        participants,
        messages: normalizedMessages,
        folderPath: file.webkitRelativePath || file.name
      });
    } catch (e) {}
  }
  return { conversations: result, names: allNames };
}

btnLoadFb.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.webkitdirectory = true;
  input.onchange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    chatListEl.innerHTML = '<p class="placeholder-text">Processing Facebook Export...</p>';
    setTimeout(async () => {
      const parsed = await parseFacebookExport(files);
      fbConversations = parsed.conversations;
      populateNameOptions(parsed.names);
      btnLoadFb.classList.add('loaded');
      btnLoadFb.textContent = `✓ Facebook Export (${fbConversations.length} chats)`;
      sourceTabs.style.display = 'flex';
      switchSource('fb');
    }, 50);
  };
  input.click();
});

btnLoadMsg.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.webkitdirectory = true;
  input.onchange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    chatListEl.innerHTML = '<p class="placeholder-text">Processing Messenger Export...</p>';
    setTimeout(async () => {
      const parsed = await parseMessengerExport(files);
      msgConversations = parsed.conversations;
      populateNameOptions(parsed.names);
      btnLoadMsg.classList.add('loaded');
      btnLoadMsg.textContent = `✓ Messenger Export (${msgConversations.length} chats)`;
      sourceTabs.style.display = 'flex';
      switchSource('msg');
    }, 50);
  };
  input.click();
});

function populateNameOptions(namesSet) {
  namesSet.forEach(name => {
    if (![...nameOptions.options].some(o => o.value === name)) {
      const opt = document.createElement('option');
      opt.value = name;
      nameOptions.appendChild(opt);
    }
  });
  nameInput.style.display = 'block';
  chatSearchInput.style.display = 'block';
  searchFilterPills.style.display = 'none';

  if (!myName && namesSet.size > 0) {
    myName = [...namesSet][0];
    nameInput.value = myName;
    localStorage.setItem('fb-viewer-my-name', myName);
  } else nameInput.value = myName;
}

sourceTabs.addEventListener('click', (e) => {
  const btn = e.target.closest('.source-btn');
  if (btn) switchSource(btn.dataset.source);
});

function switchSource(source) {
  activeSource = source;
  sourceTabs.querySelectorAll('.source-btn').forEach(b => b.classList.toggle('active', b.dataset.source === source));

  chatSearchInput.value = tabSearchState[activeSource].term;
  updateActivePillUI(tabSearchState[activeSource].pill);

  if (!chatSearchInput.value.trim()) {
    searchFilterPills.style.display = 'none';
  } else {
    searchFilterPills.style.display = 'flex';
  }

  applyFilters();
}

function updateActivePillUI(activePill) {
  searchFilterPills.querySelectorAll('.pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.pill === activePill);
  });
}

searchFilterPills.addEventListener('click', (e) => {
  const btn = e.target.closest('.pill-btn');
  if (!btn) return;
  const pill = btn.dataset.pill;
  tabSearchState[activeSource].pill = pill;
  updateActivePillUI(pill);
  applyFilters();
});

chatSearchInput.addEventListener('focus', () => {
  searchFilterPills.style.display = 'flex';
});

// Debounced Search Input for Fast Typing
chatSearchInput.addEventListener('input', () => {
  searchFilterPills.style.display = 'flex';
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    tabSearchState[activeSource].term = chatSearchInput.value;
    applyFilters();
  }, 200);
});

document.addEventListener('click', (e) => {
  const isSearchClick = e.target.closest('.search-box') || e.target.closest('#search-filter-pills');
  if (!isSearchClick && !chatSearchInput.value.trim()) {
    searchFilterPills.style.display = 'none';
  }
});

function applyFilters() {
  let list = [];
  if (activeSource === 'fb') list = fbConversations;
  else if (activeSource === 'msg') list = msgConversations;
  else if (activeSource === 'fav') {
    list = [...fbConversations, ...msgConversations].filter(c => favoriteSignatures.has(c.signature));
  }

  const term = tabSearchState[activeSource].term.trim().toLowerCase();
  const pill = tabSearchState[activeSource].pill;

  if (!term) {
    renderChatList(list);
    return;
  }

  if (pill === 'people') {
    const results = list.filter(conv => [...conv.participants].some(p => p.toLowerCase().includes(term)));
    renderChatList(results);
  } else if (pill === 'groups') {
    const results = list.filter(conv => conv.participants.size > 2 && conversationDisplayName(conv).toLowerCase().includes(term));
    renderChatList(results);
  } else if (pill === 'messages') {
    renderMessageSearchResults(list, term);
  } else {
    const peopleMatches = list.filter(conv => [...conv.participants].some(p => p.toLowerCase().includes(term)));
    const groupMatches = list.filter(conv => conv.participants.size > 2 && conversationDisplayName(conv).toLowerCase().includes(term));
    renderAllSearchResults(peopleMatches, groupMatches, list, term);
  }
}

function conversationDisplayName(conv) {
  const cleanMyName = (myName || '').trim().toLowerCase();
  const others = [...conv.participants].filter(p => p.trim().toLowerCase() !== cleanMyName);
  if (others.length === 1) return others[0];
  if (conv.title && conv.title !== 'Conversation') return conv.title;
  return [...conv.participants].join(', ') || 'Conversation';
}

function renderChatList(list) {
  chatListEl.innerHTML = '';
  if (list.length === 0) {
    chatListEl.innerHTML = `<p class="placeholder-text">No chats found.</p>`;
    return;
  }

  const fragment = document.createDocumentFragment();

  list.forEach(conv => {
    const lastMsg = conv.messages.at(-1);
    const displayName = conversationDisplayName(conv);
    const isFav = favoriteSignatures.has(conv.signature);

    const item = document.createElement('div');
    item.className = 'chat-item' + (currentConversation === conv ? ' active' : '');
    item.appendChild(makeAvatar(displayName, 44));

    let preview = '';
    if (lastMsg) {
      const cleanSender = fixFbEncoding(lastMsg.sender_name || '').trim().toLowerCase();
      const cleanMyName = (myName || '').trim().toLowerCase();
      const isMe = cleanSender !== '' && cleanSender === cleanMyName;
      const prefix = isMe ? 'You: ' : '';
      if (lastMsg.content) preview = prefix + fixFbEncoding(lastMsg.content);
      else if (lastMsg.photos && lastMsg.photos.length) preview = prefix + '📷 Photo';
      else if (lastMsg.videos && lastMsg.videos.length) preview = prefix + '🎥 Video';
      else if (lastMsg.audio_files && lastMsg.audio_files.length) preview = prefix + '🎵 Audio';
    }

    const textWrap = document.createElement('div');
    textWrap.className = 'chat-item-text';
    textWrap.innerHTML = `
      <div class="chat-item-title">${escapeHtml(displayName)} ${isFav ? '<span style="color:#ffd400;">★</span>' : ''}</div>
      <div class="chat-item-preview">${escapeHtml(preview)}</div>
    `;
    item.appendChild(textWrap);

    item.addEventListener('click', () => openConversation(conv));
    fragment.appendChild(item);
  });

  chatListEl.appendChild(fragment);
}

function renderMessageSearchResults(conversations, term) {
  chatListEl.innerHTML = '';
  let matchCount = 0;
  const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  const fragment = document.createDocumentFragment();

  conversations.forEach(conv => {
    const matchingMsgs = conv.messages.filter(m => fixFbEncoding(m.content || '').toLowerCase().includes(term));
    if (matchingMsgs.length === 0) return;

    matchCount++;
    const displayName = conversationDisplayName(conv);
    const lastMatch = matchingMsgs.at(-1);

    const item = document.createElement('div');
    item.className = 'chat-item' + (currentConversation === conv ? ' active' : '');
    item.appendChild(makeAvatar(displayName, 44));

    const textWrap = document.createElement('div');
    textWrap.className = 'chat-item-text';
    const highlightedSnippet = escapeHtml(fixFbEncoding(lastMatch.content || '')).replace(re, m => `<mark>${m}</mark>`);

    textWrap.innerHTML = `
      <div class="chat-item-title">${escapeHtml(displayName)}</div>
      <div class="chat-item-preview" style="color:var(--accent); font-weight:600;">${matchingMsgs.length} matched message${matchingMsgs.length > 1 ? 's' : ''}</div>
      <div class="chat-item-preview">${highlightedSnippet}</div>
    `;

    item.appendChild(textWrap);
    item.addEventListener('click', () => openConversation(conv));
    fragment.appendChild(item);
  });

  if (matchCount === 0) {
    chatListEl.innerHTML = `<p class="placeholder-text">No messages containing "${escapeHtml(term)}".</p>`;
  } else {
    chatListEl.appendChild(fragment);
  }
}

function renderAllSearchResults(peopleMatches, groupMatches, list, term) {
  chatListEl.innerHTML = '';
  let totalFound = 0;
  const fragment = document.createDocumentFragment();

  if (peopleMatches.length > 0) {
    const hdr = document.createElement('div');
    hdr.className = 'search-section-header';
    hdr.textContent = 'People';
    fragment.appendChild(hdr);
    peopleMatches.forEach(conv => {
      totalFound++;
      appendChatItemToFragment(conv, fragment);
    });
  }

  if (groupMatches.length > 0) {
    const hdr = document.createElement('div');
    hdr.className = 'search-section-header';
    hdr.textContent = 'Groups';
    fragment.appendChild(hdr);
    groupMatches.forEach(conv => {
      totalFound++;
      appendChatItemToFragment(conv, fragment);
    });
  }

  const msgMatchedConvs = list.filter(conv => conv.messages.some(m => fixFbEncoding(m.content || '').toLowerCase().includes(term)));
  if (msgMatchedConvs.length > 0) {
    const hdr = document.createElement('div');
    hdr.className = 'search-section-header';
    hdr.textContent = 'Messages';
    fragment.appendChild(hdr);

    msgMatchedConvs.forEach(conv => {
      totalFound++;
      const matchingMsgs = conv.messages.filter(m => fixFbEncoding(m.content || '').toLowerCase().includes(term));
      const displayName = conversationDisplayName(conv);
      const lastMatch = matchingMsgs.at(-1);

      const item = document.createElement('div');
      item.className = 'chat-item' + (currentConversation === conv ? ' active' : '');
      item.appendChild(makeAvatar(displayName, 44));

      const textWrap = document.createElement('div');
      textWrap.className = 'chat-item-text';
      const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const highlightedSnippet = escapeHtml(fixFbEncoding(lastMatch.content || '')).replace(re, m => `<mark>${m}</mark>`);

      textWrap.innerHTML = `
        <div class="chat-item-title">${escapeHtml(displayName)}</div>
        <div class="chat-item-preview" style="color:var(--accent); font-weight:600;">${matchingMsgs.length} matched message${matchingMsgs.length > 1 ? 's' : ''}</div>
        <div class="chat-item-preview">${highlightedSnippet}</div>
      `;

      item.appendChild(textWrap);
      item.addEventListener('click', () => openConversation(conv));
      fragment.appendChild(item);
    });
  }

  if (totalFound === 0) {
    chatListEl.innerHTML = `<p class="placeholder-text">No matches found for "${escapeHtml(term)}".</p>`;
  } else {
    chatListEl.appendChild(fragment);
  }
}

function appendChatItemToFragment(conv, fragment) {
  const displayName = conversationDisplayName(conv);
  const isFav = favoriteSignatures.has(conv.signature);
  const lastMsg = conv.messages.at(-1);

  const item = document.createElement('div');
  item.className = 'chat-item' + (currentConversation === conv ? ' active' : '');
  item.appendChild(makeAvatar(displayName, 44));

  let preview = '';
  if (lastMsg) {
    const cleanSender = fixFbEncoding(lastMsg.sender_name || '').trim().toLowerCase();
    const cleanMyName = (myName || '').trim().toLowerCase();
    const isMe = cleanSender !== '' && cleanSender === cleanMyName;
    const prefix = isMe ? 'You: ' : '';
    if (lastMsg.content) preview = prefix + fixFbEncoding(lastMsg.content);
    else if (lastMsg.photos && lastMsg.photos.length) preview = prefix + '📷 Photo';
  }

  const textWrap = document.createElement('div');
  textWrap.className = 'chat-item-text';
  textWrap.innerHTML = `
    <div class="chat-item-title">${escapeHtml(displayName)} ${isFav ? '<span style="color:#ffd400;">★</span>' : ''}</div>
    <div class="chat-item-preview">${escapeHtml(preview)}</div>
  `;
  item.appendChild(textWrap);
  item.addEventListener('click', () => openConversation(conv));
  fragment.appendChild(item);
}

function updateFavoriteButtonUI() {
  if (!currentConversation) return;
  const isFav = favoriteSignatures.has(currentConversation.signature);
  favoriteBtn.textContent = isFav ? '★' : '☆';
  favoriteBtn.style.color = isFav ? '#ffd400' : 'var(--text-main)';
}

favoriteBtn.addEventListener('click', () => {
  if (!currentConversation) return;
  const sig = currentConversation.signature;
  if (favoriteSignatures.has(sig)) favoriteSignatures.delete(sig);
  else favoriteSignatures.add(sig);
  localStorage.setItem('fb-viewer-favorites', JSON.stringify([...favoriteSignatures]));
  updateFavoriteButtonUI();
  applyFilters();
});

// Export Chat Log
exportChatBtn.addEventListener('click', () => {
  if (!currentConversation) return;
  let log = `Chat Log: ${conversationDisplayName(currentConversation)}\nExported: ${new Date().toLocaleString()}\n----------------------------------------\n\n`;
  currentConversation.messages.forEach(m => {
    const time = new Date(m.timestamp_ms).toLocaleString();
    const sender = fixFbEncoding(m.sender_name);
    const content = fixFbEncoding(m.content);
    log += `[${time}] ${sender}: ${content || '[Media Attachment]'}\n`;
  });

  const blob = new Blob([log], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${conversationDisplayName(currentConversation)}_chat_log.txt`;
  a.click();
});

function openConversation(conv) {
  currentConversation = conv;
  loadedMessageCount = 80; // Reset batch window on new conversation
  const displayName = conversationDisplayName(conv);
  chatTitleEl.textContent = displayName;
  chatHeaderAvatar.innerHTML = '';
  chatHeaderAvatar.appendChild(makeAvatar(displayName, 36));
  chatHeaderActions.style.display = 'flex';
  quickJumpControls.style.display = 'flex';
  infoDateJumper.value = '';
  updateFavoriteButtonUI();
  closeSearch();
  infoPanel.style.display = 'none';
  applyFilters();
  renderMessages(conv, true);
}

// Custom Waveform Voice Note Player
function createCustomAudioPlayer(url) {
  const audio = new Audio(url);
  const card = document.createElement('div');
  card.className = 'voice-note-card';

  const playBtn = document.createElement('button');
  playBtn.className = 'voice-play-btn';
  playBtn.textContent = '▶';

  const body = document.createElement('div');
  body.className = 'voice-body';

  const waveformContainer = document.createElement('div');
  waveformContainer.className = 'voice-waveform-container';

  const barHeights = [40, 70, 30, 90, 50, 80, 100, 60, 40, 85, 95, 45, 60, 75, 50, 30, 80, 65, 40, 20];
  const barEls = [];

  barHeights.forEach(h => {
    const bar = document.createElement('div');
    bar.className = 'voice-wave-bar';
    bar.style.height = `${h}%`;
    waveformContainer.appendChild(bar);
    barEls.push(bar);
  });

  const meta = document.createElement('div');
  meta.className = 'voice-meta';

  const timeLabel = document.createElement('span');
  timeLabel.textContent = '0:00';

  const speedBtn = document.createElement('button');
  speedBtn.className = 'voice-speed-btn';
  speedBtn.textContent = '1x';

  const speeds = [1, 1.25, 1.5, 2];
  let speedIdx = 0;

  speedBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    speedIdx = (speedIdx + 1) % speeds.length;
    const s = speeds[speedIdx];
    audio.playbackRate = s;
    speedBtn.textContent = `${s}x`;
  });

  meta.appendChild(timeLabel);
  meta.appendChild(speedBtn);

  body.appendChild(waveformContainer);
  body.appendChild(meta);

  card.appendChild(playBtn);
  card.appendChild(body);

  playBtn.addEventListener('click', () => {
    if (audio.paused) {
      document.querySelectorAll('audio').forEach(a => { if (a !== audio) a.pause(); });
      audio.play();
    } else {
      audio.pause();
    }
  });

  audio.addEventListener('play', () => { playBtn.textContent = '❚❚'; });
  audio.addEventListener('pause', () => { playBtn.textContent = '▶'; });
  audio.addEventListener('ended', () => {
    playBtn.textContent = '▶';
    barEls.forEach(b => b.classList.remove('played'));
    timeLabel.textContent = formatAudioDuration(audio.duration);
  });

  audio.addEventListener('loadedmetadata', () => {
    timeLabel.textContent = formatAudioDuration(audio.duration);
  });

  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    const progress = audio.currentTime / audio.duration;
    timeLabel.textContent = formatAudioDuration(audio.currentTime);

    const playedBars = Math.floor(progress * barEls.length);
    barEls.forEach((bar, idx) => {
      bar.classList.toggle('played', idx <= playedBars);
    });
  });

  waveformContainer.addEventListener('click', (e) => {
    if (!audio.duration) return;
    const rect = waveformContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    audio.currentTime = percentage * audio.duration;
  });

  return card;
}

// Fast Single-Pass Batch Message Renderer
function renderMessages(conv, scrollToBottom = true) {
  viewport.innerHTML = '';
  const cleanMyName = (myName || '').trim().toLowerCase();

  if (!cleanMyName) {
    viewport.innerHTML = '<div class="placeholder-text">Type your name in the box above to tell messages apart.</div>';
    return;
  }

  let filteredMessages = conv.messages;
  if (dateFilterStart || dateFilterEnd) {
    filteredMessages = filteredMessages.filter(m => {
      if (dateFilterStart && m.timestamp_ms < dateFilterStart) return false;
      if (dateFilterEnd && m.timestamp_ms > dateFilterEnd) return false;
      return true;
    });
  }

  // Slice to render chunked latest window
  const startIndex = Math.max(0, filteredMessages.length - loadedMessageCount);
  const visibleMessages = filteredMessages.slice(startIndex);

  let lastDateShown = null;
  let renderedCount = 0;
  const fragment = document.createDocumentFragment();

  visibleMessages.forEach((msg) => {
    const hasPhotos = msg.photos && msg.photos.length > 0;
    const hasVideos = msg.videos && msg.videos.length > 0;
    const hasAudio = msg.audio_files && msg.audio_files.length > 0;
    const hasFiles = msg.files && msg.files.length > 0;
    const hasGifs = msg.gifs && msg.gifs.length > 0;
    const hasContent = msg.content || hasPhotos || hasVideos || hasAudio || hasFiles || hasGifs || msg.sticker;

    if (!hasContent) return;
    renderedCount++;

    const globalIdx = conv.messages.indexOf(msg);

    if (lastDateShown === null || !isSameDay(lastDateShown, msg.timestamp_ms)) {
      const sep = document.createElement('div');
      sep.className = 'date-separator';
      sep.textContent = formatDateSeparator(msg.timestamp_ms);
      fragment.appendChild(sep);
      lastDateShown = msg.timestamp_ms;
    }

    const sender = fixFbEncoding(msg.sender_name || '');
    const cleanSender = sender.trim().toLowerCase();
    const isOutgoing = cleanSender !== '' && cleanSender === cleanMyName;

    const row = document.createElement('div');
    row.className = `message-row ${isOutgoing ? 'outgoing' : 'incoming'}`;
    row.dataset.msgIndex = globalIdx;

    const senderLabel = document.createElement('div');
    senderLabel.className = 'message-sender';
    senderLabel.textContent = isOutgoing ? 'You' : sender;
    row.appendChild(senderLabel);

    if (msg.content) {
      const bubble = document.createElement('div');
      bubble.className = `message-bubble ${isOutgoing ? 'outgoing' : 'incoming'}`;
      const textDiv = document.createElement('div');
      textDiv.className = 'message-text';
      textDiv.textContent = fixFbEncoding(msg.content);
      bubble.appendChild(textDiv);
      row.appendChild(bubble);
    }

    if (msg.sticker) {
      const file = resolveMediaFile(msg.sticker.uri);
      const url = getObjectUrl(file);
      if (url) {
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble sticker-bubble';
        const img = document.createElement('img');
        img.className = 'sticker-media';
        img.src = url;
        img.addEventListener('click', () => openLightbox(url, false, globalIdx, file));
        bubble.appendChild(img);
        row.appendChild(bubble);
      }
    }

    const visualItems = [...(msg.photos || []), ...(msg.videos || []), ...(msg.gifs || [])];
    if (visualItems.length > 0) {
      const bubble = document.createElement('div');
      bubble.className = 'message-bubble empty-media-bubble';
      visualItems.forEach(m => {
        const file = resolveMediaFile(m.uri);
        const url = getObjectUrl(file);
        if (!url) return;
        const video = isVideoUri(m.uri);
        const el = document.createElement(video ? 'video' : 'img');
        el.className = 'message-media';
        el.src = url;
        if (video) el.controls = true;
        el.addEventListener('click', () => openLightbox(url, video, globalIdx, file));
        bubble.appendChild(el);
      });
      row.appendChild(bubble);
    }

    if (msg.audio_files) {
      msg.audio_files.forEach(a => {
        const file = resolveMediaFile(a.uri);
        const url = getObjectUrl(file);
        if (!url) return;
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble empty-media-bubble';
        const player = createCustomAudioPlayer(url);
        bubble.appendChild(player);
        row.appendChild(bubble);
      });
    }

    if (msg.files) {
      msg.files.forEach(f => {
        const file = resolveMediaFile(f.uri);
        const url = getObjectUrl(file);
        const bubble = document.createElement('div');
        bubble.className = `message-bubble ${isOutgoing ? 'outgoing' : 'incoming'}`;
        const fileName = f.uri ? f.uri.split('/').pop() : 'Attached File';
        if (url) {
          bubble.innerHTML = `📄 <a href="${url}" download="${fileName}" style="color:inherit; font-weight:600; text-decoration:underline;">${escapeHtml(fileName)}</a>`;
        } else {
          bubble.innerHTML = `📄 ${escapeHtml(fileName)}`;
        }
        row.appendChild(bubble);
      });
    }

    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-timestamp';
    timeDiv.textContent = formatTime(msg.timestamp_ms);
    row.appendChild(timeDiv);

    fragment.appendChild(row);
  });

  if (renderedCount === 0) {
    viewport.innerHTML = '<div class="placeholder-text">No messages found within the selected date range.</div>';
  } else {
    viewport.appendChild(fragment);
    if (scrollToBottom) viewport.scrollTop = viewport.scrollHeight;
  }
}

// Search Features
msgSearchBtn.addEventListener('click', () => {
  msgSearchBar.style.display = msgSearchBar.style.display === 'none' ? 'flex' : 'none';
  if (msgSearchBar.style.display === 'flex') msgSearchInput.focus();
});

msgSearchClose.addEventListener('click', closeSearch);

function closeSearch() {
  msgSearchBar.style.display = 'none';
  msgSearchInput.value = '';
  clearSearchHighlights();
  searchMatches = [];
  searchIndex = -1;
  msgSearchCount.textContent = '';
}

msgSearchInput.addEventListener('input', () => runSearch(msgSearchInput.value));

function clearSearchHighlights() {
  viewport.querySelectorAll('.message-bubble.search-active').forEach(el => el.classList.remove('search-active'));
  viewport.querySelectorAll('.message-text mark').forEach(mark => mark.replaceWith(document.createTextNode(mark.textContent)));
}

function runSearch(term) {
  clearSearchHighlights();
  searchMatches = [];
  searchIndex = -1;
  if (!term) { msgSearchCount.textContent = ''; return; }

  const lowerTerm = term.toLowerCase();
  const rows = viewport.querySelectorAll('.message-row');

  rows.forEach(row => {
    const idx = Number(row.dataset.msgIndex);
    const msg = currentConversation.messages[idx];
    if (!msg.content) return;
    const content = fixFbEncoding(msg.content);
    if (!content.toLowerCase().includes(lowerTerm)) return;

    const textDiv = row.querySelector('.message-text');
    if (textDiv) {
      const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      textDiv.innerHTML = escapeHtml(content).replace(re, match => `<mark>${match}</mark>`);
    }
    searchMatches.push(row);
  });

  msgSearchCount.textContent = searchMatches.length ? `0 / ${searchMatches.length}` : 'No matches';
  if (searchMatches.length > 0) { searchIndex = 0; jumpToMatch(); }
}

function jumpToMatch() {
  viewport.querySelectorAll('.message-bubble.search-active').forEach(el => el.classList.remove('search-active'));
  const row = searchMatches[searchIndex];
  if (!row) return;
  row.querySelector('.message-bubble').classList.add('search-active');
  row.scrollIntoView({ block: 'center', behavior: 'smooth' });
  msgSearchCount.textContent = `${searchIndex + 1} / ${searchMatches.length}`;
}

msgSearchNext.addEventListener('click', () => {
  if (!searchMatches.length) return;
  searchIndex = (searchIndex + 1) % searchMatches.length;
  jumpToMatch();
});

msgSearchPrev.addEventListener('click', () => {
  if (!searchMatches.length) return;
  searchIndex = (searchIndex - 1 + searchMatches.length) % searchMatches.length;
  jumpToMatch();
});

// Info Panel & Media Gallery
infoBtn.addEventListener('click', () => {
  if (!currentConversation) return;
  const displayName = conversationDisplayName(currentConversation);
  infoPanelAvatarWrap.innerHTML = '';
  infoPanelAvatarWrap.appendChild(makeAvatar(displayName, 80));
  infoPanelName.textContent = displayName;
  infoPanelParticipants.textContent = [...currentConversation.participants].join(', ');
  activeMediaFilter = 'all';
  updateActiveMediaPillUI('all');
  populateGallery(currentConversation, activeMediaFilter);
  infoPanel.style.display = 'flex';
});

infoPanelClose.addEventListener('click', () => infoPanel.style.display = 'none');
mediaToggle.addEventListener('click', () => {
  mediaSection.style.display = mediaSection.style.display === 'none' ? 'block' : 'none';
});

mediaFilterPills.addEventListener('click', (e) => {
  const btn = e.target.closest('.media-pill-btn');
  if (!btn || !currentConversation) return;
  activeMediaFilter = btn.dataset.mediaType;
  updateActiveMediaPillUI(activeMediaFilter);
  populateGallery(currentConversation, activeMediaFilter);
});

function updateActiveMediaPillUI(type) {
  mediaFilterPills.querySelectorAll('.media-pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mediaType === type);
  });
}

function populateGallery(conv, filter = 'all') {
  galleryGrid.innerHTML = '';
  let totalItems = 0;
  const fragment = document.createDocumentFragment();

  conv.messages.forEach((msg, idx) => {
    const photos = msg.photos || [];
    const videos = msg.videos || [];
    const audioFiles = msg.audio_files || [];
    const files = msg.files || [];

    if (filter === 'all' || filter === 'images') {
      photos.forEach(p => {
        const file = resolveMediaFile(p.uri);
        const url = getObjectUrl(file);
        if (!url) return;
        totalItems++;
        const img = document.createElement('img');
        img.src = url;
        img.addEventListener('click', () => openLightbox(url, false, idx, file));
        fragment.appendChild(img);
      });
    }

    if (filter === 'all' || filter === 'videos') {
      videos.forEach(v => {
        const file = resolveMediaFile(v.uri);
        const url = getObjectUrl(file);
        if (!url) return;
        totalItems++;
        const video = document.createElement('video');
        video.src = url;
        video.muted = true;
        video.addEventListener('click', () => openLightbox(url, true, idx, file));
        fragment.appendChild(video);
      });
    }

    if (filter === 'all' || filter === 'audio') {
      audioFiles.forEach(a => {
        const file = resolveMediaFile(a.uri);
        totalItems++;
        const fileName = a.uri ? a.uri.split('/').pop() : 'Voice Message';
        const card = document.createElement('div');
        card.className = 'gallery-media-card';
        card.innerHTML = `
          <div class="gallery-media-title">🎵 ${escapeHtml(fileName)}</div>
          <div class="gallery-media-sub">Click to jump to message</div>
        `;
        card.addEventListener('click', () => jumpToMessageIndex(idx));
        fragment.appendChild(card);
      });
    }

    if (filter === 'all' || filter === 'files') {
      files.forEach(f => {
        const file = resolveMediaFile(f.uri);
        totalItems++;
        const fileName = f.uri ? f.uri.split('/').pop() : 'Attached File';
        const card = document.createElement('div');
        card.className = 'gallery-media-card';
        card.innerHTML = `
          <div class="gallery-media-title">📄 ${escapeHtml(fileName)}</div>
          <div class="gallery-media-sub">Click to jump to message</div>
        `;
        card.addEventListener('click', () => jumpToMessageIndex(idx));
        fragment.appendChild(card);
      });
    }
  });

  if (totalItems === 0) {
    galleryGrid.innerHTML = '<p class="placeholder-text" style="grid-column: span 3;">No items found in this category.</p>';
  } else {
    galleryGrid.appendChild(fragment);
  }
}

// Lightbox with dual actions
function openLightbox(url, isVideo, msgIdx = null, fileObj = null) {
  lightboxContent.innerHTML = '';
  const el = document.createElement(isVideo ? 'video' : 'img');
  el.src = url;
  if (isVideo) { el.controls = true; el.autoplay = true; }
  lightboxContent.appendChild(el);

  currentLightboxMsgIdx = msgIdx;
  currentLightboxFile = fileObj;

  lightboxJumpBtn.style.display = (msgIdx !== null && msgIdx !== undefined) ? 'block' : 'none';
  lightboxRevealBtn.style.display = 'block';

  lightbox.style.display = 'flex';
}

lightboxJumpBtn.addEventListener('click', () => {
  if (currentLightboxMsgIdx === null) return;
  lightbox.style.display = 'none';
  lightboxContent.innerHTML = '';
  jumpToMessageIndex(currentLightboxMsgIdx);
});

lightboxRevealBtn.addEventListener('click', () => {
  if (!currentLightboxFile) return;

  if (currentLightboxFile.path && window.electronAPI && window.electronAPI.showItemInFolder) {
    window.electronAPI.showItemInFolder(currentLightboxFile.path);
    return;
  }

  const relPath = currentLightboxFile.webkitRelativePath || currentLightboxFile.name;
  if (relPath) {
    alert(`File relative location:\n${relPath}\n\n(Direct Windows Explorer selection requires running inside the compiled Electron .exe)`);
  } else {
    const a = document.createElement('a');
    a.href = getObjectUrl(currentLightboxFile);
    a.download = currentLightboxFile.name;
    a.click();
  }
});

lightboxClose.addEventListener('click', () => { lightbox.style.display = 'none'; lightboxContent.innerHTML = ''; });
lightbox.addEventListener('click', (e) => { if (e.target === lightbox) { lightbox.style.display = 'none'; lightboxContent.innerHTML = ''; } });

// Sidebar Resizer
let isResizing = false;
resizer.addEventListener('mousedown', () => {
  isResizing = true;
  resizer.classList.add('resizing');
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
});

document.addEventListener('mousemove', (e) => {
  if (!isResizing) return;
  const newWidth = e.clientX;
  if (newWidth >= 260 && newWidth <= 600) sidebar.style.width = `${newWidth}px`;
});

document.addEventListener('mouseup', () => {
  if (isResizing) {
    isResizing = false;
    resizer.classList.remove('resizing');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }
});