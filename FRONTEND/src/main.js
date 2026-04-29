import './styles.css';

function normalizeUrl(url, fallback) {
  if (!url) return fallback;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

const API = normalizeUrl(import.meta.env.VITE_API_URL, 'http://localhost:3000');

const TOKEN_KEY = 'aura_token';
const USER_KEY = 'aura_user';

const state = {
  user: null,
  token: null,
  view: 'home',
  authTab: 'login',
  musics: [],
  albums: [],
  selectedAlbum: null,
  albumDetail: null,
  currentTrack: null,
  playing: false,
  error: '',
  success: '',
  audioTime: 0,
  audioDuration: 0,
};

function loadSession() {
  try {
    state.token = localStorage.getItem(TOKEN_KEY);
    const u = localStorage.getItem(USER_KEY);
    state.user = u ? JSON.parse(u) : null;
  } catch {
    state.token = null;
    state.user = null;
  }
}

function saveSession(token, user) {
  state.token = token;
  state.user = user;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

async function api(path, options = {}) {
  const headers = { ...options.headers };
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${API}${path}`, { ...options, headers });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text || 'Something went wrong' };
  }
  if (!res.ok) {
    const err = new Error(data.message || res.statusText);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

let audioEl = null;

function ensureAudio() {
  if (!audioEl) {
    audioEl = new Audio();
    audioEl.addEventListener('timeupdate', () => {
      state.audioTime = audioEl.currentTime;
      state.audioDuration = audioEl.duration || 0;
      syncPlayerSeekUi();
    });
    audioEl.addEventListener('ended', () => {
      state.playing = false;
      render();
    });
    audioEl.addEventListener('play', () => {
      state.playing = true;
      render();
    });
    audioEl.addEventListener('pause', () => {
      state.playing = false;
      render();
    });
  }
  return audioEl;
}

function playTrack(track) {
  const url = track?.url;
  if (!url) return;
  ensureAudio();
  if (state.currentTrack && String(state.currentTrack._id) === String(track._id) && audioEl.src) {
    if (state.playing) audioEl.pause();
    else audioEl.play().catch(() => {});
    return;
  }
  state.currentTrack = track;
  audioEl.src = url;
  audioEl.play().catch(() => {});
  render();
}

function seekAudio(ratio) {
  const a = ensureAudio();
  if (!a.duration) return;
  a.currentTime = Math.max(0, Math.min(a.duration, ratio * a.duration));
}

function formatTime(s) {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function syncPlayerSeekUi() {
  const seek = document.getElementById('player-seek');
  if (!seek || seek.matches(':focus')) return;
  const a = audioEl;
  const dur = a?.duration || 0;
  const cur = a?.currentTime ?? 0;
  const pct = dur > 0 ? cur / dur : 0;
  seek.value = String(Math.round(pct * 1000));
  const row = seek.closest('.seek');
  if (row) {
    const spans = row.querySelectorAll('span');
    if (spans[0]) spans[0].textContent = formatTime(cur);
    if (spans[1]) spans[1].textContent = formatTime(dur);
  }
}

function artistName(artist) {
  if (!artist) return 'Unknown';
  if (typeof artist === 'object') return artist.username || artist.email || 'Artist';
  return String(artist);
}

async function refreshLibrary() {
  if (!state.token) return;
  try {
    const [mRes, aRes] = await Promise.all([
      api('/api/music/'),
      api('/api/music/albums'),
    ]);
    state.musics = mRes.musics || [];
    state.albums = aRes.albums || [];
    state.error = '';
  } catch (e) {
    state.error = e.message || 'Could not load library';
  }
  render();
}

async function openAlbum(id) {
  state.view = 'album';
  state.albumDetail = null;
  render();
  try {
    const res = await api(`/api/music/albums/${id}`);
    state.albumDetail = res.album;
  } catch (e) {
    state.error = e.message || 'Album not found';
  }
  render();
}

async function handleLogin(e) {
  e.preventDefault();
  state.error = '';
  const fd = new FormData(e.target);
  const identifier = (fd.get('identifier') || '').trim();
  const payload = {
    username: identifier || undefined,
    email: identifier || undefined,
    password: fd.get('password'),
  };
  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    saveSession(data.token, data.user);
    await refreshLibrary();
    state.view = 'home';
  } catch (err) {
    state.error = err.message || 'Login failed';
  }
  render();
}

async function handleRegister(e) {
  e.preventDefault();
  state.error = '';
  const fd = new FormData(e.target);
  const payload = {
    username: fd.get('username'),
    email: fd.get('email'),
    password: fd.get('password'),
    role: fd.get('role') || 'user',
  };
  try {
    const data = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    saveSession(data.token, data.user);
    await refreshLibrary();
    state.view = 'home';
  } catch (err) {
    state.error = err.message || 'Registration failed';
  }
  render();
}

function logout() {
  saveSession(null, null);
  state.musics = [];
  state.albums = [];
  state.albumDetail = null;
  state.currentTrack = null;
  if (audioEl) {
    audioEl.pause();
    audioEl.src = '';
  }
  state.view = 'home';
  render();
}

async function handleUpload(e) {
  e.preventDefault();
  state.error = '';
  state.success = '';
  const fd = new FormData(e.target);
  const file = fd.get('music');
  if (!file || !file.size) {
    state.error = 'Choose an audio file';
    render();
    return;
  }
  const uploadFd = new FormData();
  uploadFd.append('music', file);
  uploadFd.append('title', fd.get('title') || 'Untitled');
  try {
    await api('/api/music/upload', { method: 'POST', body: uploadFd });
    state.success = 'Track uploaded';
    e.target.reset();
    await refreshLibrary();
  } catch (err) {
    state.error = err.message || 'Upload failed';
  }
  render();
}

async function handleCreateAlbum(e) {
  e.preventDefault();
  state.error = '';
  state.success = '';
  const fd = new FormData(e.target);
  const title = fd.get('title');
  try {
    await api('/api/music/album', {
      method: 'POST',
      body: JSON.stringify({ title, musics: [] }),
    });
    state.success = 'Album created';
    e.target.reset();
    await refreshLibrary();
  } catch (err) {
    state.error = err.message || 'Could not create album';
  }
  render();
}

function iconHome() {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
}
function iconLibrary() {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`;
}
function iconMic() {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
}
function iconPlay() {
  return `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
}
function iconPause() {
  return `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
}

function renderAuth() {
  const isLogin = state.authTab === 'login';
  return `
    <div class="auth-wrap">
      <div class="auth-card">
        <h1>Welcome to Aura</h1>
        <p class="sub">Sign in to browse your library and listen.</p>
        <div class="tabs">
          <button type="button" class="tab ${isLogin ? 'active' : ''}" data-tab="login">Sign in</button>
          <button type="button" class="tab ${!isLogin ? 'active' : ''}" data-tab="register">Create account</button>
        </div>
        ${
          isLogin
            ? `<form id="form-login">
            <div class="field"><label>Email or username</label><input name="identifier" placeholder="you@email.com" autocomplete="username" required /></div>
            <div class="field"><label>Password</label><input type="password" name="password" required autocomplete="current-password" /></div>
            <button type="submit" class="btn-primary">Sign in</button>
          </form>`
            : `<form id="form-register">
            <div class="field"><label>Username</label><input name="username" required autocomplete="username" /></div>
            <div class="field"><label>Email</label><input name="email" type="email" required autocomplete="email" /></div>
            <div class="field"><label>Password</label><input type="password" name="password" required autocomplete="new-password" /></div>
            <div class="field"><label>Account type</label>
              <select name="role">
                <option value="user">Listener</option>
                <option value="artist">Artist (upload tracks)</option>
              </select>
            </div>
            <button type="submit" class="btn-primary">Create account</button>
          </form>`
        }
        ${state.error ? `<div class="msg error">${escapeHtml(state.error)}</div>` : ''}
      </div>
    </div>
  `;
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function renderTrackGrid(tracks) {
  if (!tracks.length) return `<div class="empty">No tracks yet. Artists can upload from Studio.</div>`;
  return `<div class="grid">
    ${tracks
      .map(
        (t) => `
      <article class="card" data-play-id="${t._id}">
        <div class="card-art">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
        </div>
        <h3 class="card-title">${escapeHtml(t.title)}</h3>
        <p class="card-meta">${escapeHtml(artistName(t.artist))}</p>
      </article>`
      )
      .join('')}
  </div>`;
}

function renderAlbumGrid() {
  if (!state.albums.length) return `<div class="empty">No albums yet.</div>`;
  return `<div class="grid">
    ${state.albums
      .map(
        (a) => `
      <article class="card" data-album-id="${a._id}">
        <div class="card-art">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
        </div>
        <h3 class="card-title">${escapeHtml(a.title)}</h3>
        <p class="card-meta">${escapeHtml(artistName(a.artist))}</p>
      </article>`
      )
      .join('')}
  </div>`;
}

function renderAlbumDetail() {
  if (!state.albumDetail) {
    return `<div class="empty">Loading album…</div>`;
  }
  const al = state.albumDetail;
  const tracks = al.musics || [];
  return `
    <button type="button" class="back-link" data-nav="library">← Back to albums</button>
    <h2 class="page-title" style="margin-bottom:1rem">${escapeHtml(al.title)}</h2>
    <p style="color:var(--text-muted);margin-top:-0.5rem;margin-bottom:1.25rem">${escapeHtml(artistName(al.artist))}</p>
    ${
      !tracks.length
        ? `<div class="empty">This album has no tracks yet.</div>`
        : `<div class="list">${tracks
            .map((t, i) => {
              const playing = state.currentTrack && String(state.currentTrack._id) === String(t._id);
              return `<div class="row ${playing ? 'playing' : ''}" data-play-id="${t._id}">
              <span class="row-index">${i + 1}</span>
              <div class="row-body">
                <p class="row-title">${escapeHtml(t.title)}</p>
                <p class="row-artist">${escapeHtml(artistName(t.artist || al.artist))}</p>
              </div>
              <button type="button" class="row-play" aria-label="Play">${iconPlay()}</button>
            </div>`;
            })
            .join('')}</div>`
    }
  `;
}

function renderStudio() {
  return `
    <h2 class="page-title" style="margin-bottom:1rem">Studio</h2>
    <p style="color:var(--text-muted);margin-bottom:1.5rem">Upload audio and organize albums.</p>
    ${state.error ? `<div class="msg error" style="margin-bottom:1rem">${escapeHtml(state.error)}</div>` : ''}
    ${state.success ? `<div class="msg ok" style="margin-bottom:1rem">${escapeHtml(state.success)}</div>` : ''}
    <div class="panel">
      <h2>Upload track</h2>
      <form id="form-upload">
        <div class="field"><label>Title</label><input name="title" placeholder="Song name" required /></div>
        <div class="field"><label>Audio file</label><input name="music" type="file" accept="audio/*" required /></div>
        <button type="submit" class="btn-primary">Upload</button>
      </form>
    </div>
    <div class="panel">
      <h2>New album</h2>
      <form id="form-album">
        <div class="field"><label>Album title</label><input name="title" required placeholder="My EP" /></div>
        <button type="submit" class="btn-primary">Create album</button>
      </form>
    </div>
  `;
}

function renderMainContent() {
  if (state.view === 'library') {
    return `<h2 class="page-title">Albums</h2>${renderAlbumGrid()}`;
  }
  if (state.view === 'album') {
    return renderAlbumDetail();
  }
  if (state.view === 'studio') {
    return renderStudio();
  }
  return `<h2 class="page-title">Discover</h2>${renderTrackGrid(state.musics)}`;
}

function renderLoggedIn() {
  const artist = state.user?.role === 'artist';
  return `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <span class="brand-mark"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#052e1f" stroke-width="2.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></span>
          Aura
        </div>
        <button type="button" class="nav-btn ${state.view === 'home' ? 'active' : ''}" data-nav="home">${iconHome()} Discover</button>
        <button type="button" class="nav-btn ${state.view === 'library' || state.view === 'album' ? 'active' : ''}" data-nav="library">${iconLibrary()} Albums</button>
        ${
          artist
            ? `<button type="button" class="nav-btn ${state.view === 'studio' ? 'active' : ''}" data-nav="studio">${iconMic()} Studio</button>`
            : ''
        }
      </aside>
      <main class="main">
        <div class="topbar">
          <div></div>
          <div class="user-pill">
            <span>
              <strong>${escapeHtml(state.user?.username || 'User')}</strong>
              <span class="role">${escapeHtml(state.user?.role || 'user')}</span>
            </span>
            <button type="button" class="btn-ghost" id="btn-logout">Log out</button>
          </div>
        </div>
        ${renderMainContent()}
      </main>
    </div>
    ${renderPlayer()}
  `;
}

function renderPlayer() {
  const t = state.currentTrack;
  const a = audioEl;
  const dur = a?.duration || state.audioDuration || 0;
  const cur = a?.currentTime ?? state.audioTime ?? 0;
  const pct = dur > 0 ? cur / dur : 0;
  return `
    <footer class="player">
      <div class="player-track">
        <div class="player-art"></div>
        <div class="player-info">
          <h4>${t ? escapeHtml(t.title) : 'Nothing playing'}</h4>
          <p>${t ? escapeHtml(artistName(t.artist)) : 'Pick a track'}</p>
        </div>
      </div>
      <div class="player-controls">
        <div class="control-row">
          <button type="button" class="ctrl main" id="player-toggle" aria-label="Play pause" ${t ? '' : 'disabled style="opacity:0.45;cursor:not-allowed"'}>
            ${state.playing ? iconPause() : iconPlay()}
          </button>
        </div>
        <div class="seek">
          <span>${formatTime(cur)}</span>
          <input type="range" min="0" max="1000" value="${Math.round(pct * 1000)}" id="player-seek" ${t ? '' : 'disabled'} />
          <span>${formatTime(dur)}</span>
        </div>
      </div>
      <div style="width:28%"></div>
    </footer>
  `;
}

function render() {
  const app = document.getElementById('app');
  if (!state.user || !state.token) {
    app.innerHTML = renderAuth();
    bindAuth();
    return;
  }
  app.innerHTML = renderLoggedIn();
  bindMain();
}

function bindAuth() {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.authTab = btn.dataset.tab;
      state.error = '';
      render();
    });
  });
  const loginForm = document.getElementById('form-login');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);
  const regForm = document.getElementById('form-register');
  if (regForm) regForm.addEventListener('submit', handleRegister);
}

function bindMain() {
  document.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.nav;
      state.view = v;
      if (v === 'album') return;
      state.albumDetail = null;
      state.error = '';
      state.success = '';
      render();
      if (v === 'home' || v === 'library') refreshLibrary();
    });
  });

  document.getElementById('btn-logout')?.addEventListener('click', logout);

  document.querySelectorAll('[data-play-id]').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.row-play')) return;
      const id = el.dataset.playId;
      const track = findTrackById(id);
      if (track) playTrack(track);
    });
  });
  document.querySelectorAll('.row-play').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const row = btn.closest('[data-play-id]');
      const id = row?.dataset.playId;
      const track = findTrackById(id);
      if (track) playTrack(track);
    });
  });

  document.querySelectorAll('[data-album-id]').forEach((card) => {
    card.addEventListener('click', () => openAlbum(card.dataset.albumId));
  });

  document.querySelectorAll('.back-link[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.view = btn.dataset.nav;
      state.albumDetail = null;
      render();
      refreshLibrary();
    });
  });

  const uploadForm = document.getElementById('form-upload');
  if (uploadForm) uploadForm.addEventListener('submit', handleUpload);
  const albumForm = document.getElementById('form-album');
  if (albumForm) albumForm.addEventListener('submit', handleCreateAlbum);

  document.getElementById('player-toggle')?.addEventListener('click', () => {
    if (state.currentTrack) playTrack(state.currentTrack);
  });
  const seek = document.getElementById('player-seek');
  if (seek) {
    seek.addEventListener('input', (e) => {
      seekAudio(Number(e.target.value) / 1000);
    });
  }
  syncPlayerSeekUi();
}

function findTrackById(id) {
  const sid = String(id);
  const fromList = state.musics.find((m) => String(m._id) === sid);
  if (fromList) return fromList;
  const al = state.albumDetail;
  if (al?.musics) return al.musics.find((m) => String(m._id) === sid);
  return null;
}

loadSession();
render();
if (state.token && state.user) {
  refreshLibrary();
}
