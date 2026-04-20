/* ==========================================================
   Movie-Shock · app.js
   CSV-backed movie & web-series franchise tracker
   Uses TMDB API v3 (free tier)
   ========================================================== */

// ─── CONFIG ────────────────────────────────────────────────
// Your API key is stored in localStorage — no code editing needed!
const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMG_BASE  = 'https://image.tmdb.org/t/p/w342';
const IMG_ORIG  = 'https://image.tmdb.org/t/p/w500';
const STORAGE_API_KEY = 'movieshock_apikey';

function getTMDBKey() {
  return localStorage.getItem(STORAGE_API_KEY) || '273fc15b4bd675aed3c5fc53ecfc945c';
}

function saveAPIKey() {
  const val = document.getElementById('api-key-input').value.trim();
  if (!val) { showToast('⚠️ Please enter a valid API key'); return; }
  localStorage.setItem(STORAGE_API_KEY, val);
  document.getElementById('api-setup-banner').style.display = 'none';
  showToast('✅ API key saved! Try searching now.');
}

// ─── STATE ──────────────────────────────────────────────────
let state = {
  mediaType: 'movie',           // 'movie' | 'tv'
  results: [],                   // current search results
  selected: [],                  // selected media items (to add)
  selectedFranchise: null,       // existing franchise chosen in modal
  newFranchiseName: '',          // new franchise name typed in modal
  collection: [],                // all saved entries [{id, title, year, poster, franchise, type, added_date, overview}]
  dashFilter: '',                // quick dashboard search text
  dashTypeFilter: 'all',
};

// ─── PERSISTENCE (movies.csv via Express API) ────────────────
async function loadDB() {
  try {
    const res = await fetch('/api/movies');
    if (res.ok) state.collection = await res.json();
  } catch { state.collection = []; }
}

async function saveDB() {
  try {
    await fetch('/api/movies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.collection),
    });
  } catch (err) {
    console.error('Failed to save CSV:', err);
    showToast('⚠️ Could not save to movies.csv');
  }
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      if (inQuotes && line[i+1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (line[i] === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += line[i];
    }
  }
  result.push(current);
  return result;
}

// ─── TMDB API ───────────────────────────────────────────────
let searchTimeout = null;

async function tmdbGet(path, params = {}) {
  const key = getTMDBKey();
  if (!key) {
    document.getElementById('api-setup-banner').style.display = 'block';
    throw new Error('No API key');
  }
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set('api_key', key);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error(`TMDB ${resp.status}`);
  return resp.json();
}

async function searchTMDB(query) {
  const endpoint = state.mediaType === 'movie' ? '/search/movie' : '/search/tv';
  const data = await tmdbGet(endpoint, { query, include_adult: false, language: 'en-US', page: 1 });
  return (data.results || []).slice(0, 24);
}

async function fetchDetails(id) {
  const endpoint = state.mediaType === 'movie' ? `/movie/${id}` : `/tv/${id}`;
  return tmdbGet(endpoint, { language: 'en-US' });
}

// ─── SEARCH HANDLER ─────────────────────────────────────────
function handleSearch(query) {
  const clearBtn = document.getElementById('search-clear');
  clearBtn.style.display = query ? 'flex' : 'none';

  clearTimeout(searchTimeout);
  if (!query.trim()) {
    document.getElementById('results-section').style.display = 'none';
    return;
  }
  showSpinner(true);
  searchTimeout = setTimeout(async () => {
    try {
      const results = await searchTMDB(query.trim());
      state.results = results;
      renderResults(results);
    } catch (err) {
      if (err.message === 'No API key') {
        showSpinner(false);
        return;
      }
      console.error(err);
      checkAPIKey();
    } finally {
      showSpinner(false);
    }
  }, 380);
}

function checkAPIKey() {
  const grid = document.getElementById('results-grid');
  const noRes = document.getElementById('no-results');
  document.getElementById('results-section').style.display = 'block';
  grid.innerHTML = '';
  noRes.style.display = 'block';
  noRes.innerHTML = `
    <span>🔑</span>
    <p><strong>API Key needed.</strong><br>
    Open <code>app.js</code> and replace <code>TMDB_KEY</code> with your free key from
    <a href="https://www.themoviedb.org/settings/api" target="_blank" style="color:var(--accent)">themoviedb.org</a></p>
  `;
}

function showSpinner(show) {
  document.getElementById('search-spinner').classList.toggle('visible', show);
}

function clearSearch() {
  document.getElementById('search-input').value = '';
  document.getElementById('search-clear').style.display = 'none';
  document.getElementById('results-section').style.display = 'none';
  state.results = [];
  state.selected = [];
  updateSelectedBar();
}

// ─── MEDIA TYPE TOGGLE ──────────────────────────────────────
function setMediaType(type) {
  state.mediaType = type;
  document.getElementById('type-movie').classList.toggle('active', type === 'movie');
  document.getElementById('type-tv').classList.toggle('active', type === 'tv');
  const val = document.getElementById('search-input').value;
  if (val.trim()) handleSearch(val);
}

// ─── RENDER RESULTS ─────────────────────────────────────────
function renderResults(results) {
  const section = document.getElementById('results-section');
  const grid    = document.getElementById('results-grid');
  const noRes   = document.getElementById('no-results');

  section.style.display = 'block';
  grid.innerHTML = '';

  if (!results.length) {
    noRes.style.display = 'block';
    noRes.innerHTML = `<span>🎬</span><p>No results found. Try a different title.</p>`;
    return;
  }
  noRes.style.display = 'none';

  results.forEach((item, i) => {
    const isMovie   = state.mediaType === 'movie';
    const title     = isMovie ? item.title : item.name;
    const year      = (isMovie ? item.release_date : item.first_air_date || '').slice(0, 4);
    const poster    = item.poster_path ? `${IMG_BASE}${item.poster_path}` : null;
    const alreadyIn = state.collection.find(e => String(e.id) === String(item.id) && e.type === state.mediaType);
    const isSelected = state.selected.find(s => s.id === item.id);

    const card = document.createElement('div');
    card.className = `media-card ${isSelected ? 'selected' : ''}`;
    card.style.animationDelay = `${i * 30}ms`;
    card.dataset.id = item.id;

    card.innerHTML = `
      ${alreadyIn ? `<div class="already-added-badge">✓ In ${alreadyIn.franchise}</div>` : ''}
      ${poster
        ? `<img src="${poster}" alt="${title}" loading="lazy" onerror="this.parentElement.querySelector('.no-poster')?.style && (this.style.display='none')">`
        : `<div class="no-poster"><span>${isMovie ? '🎬' : '📺'}</span>No Poster</div>`}
      <div class="card-info">
        <div class="card-title">${title}</div>
        <div class="card-meta">
          <span class="card-badge ${isMovie ? '' : 'tv'}">${isMovie ? 'Movie' : 'Series'}</span>
          ${year ? `<span>${year}</span>` : ''}
        </div>
      </div>
      <div class="select-check">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-info') || e.target.closest('img') || e.target.closest('.no-poster') || true) {
        toggleSelect(item, card);
      }
    });

    // Long-press / double click for details
    card.addEventListener('dblclick', () => openSidePanel(item));

    grid.appendChild(card);
  });

  document.getElementById('results-title').textContent =
    `${results.length} ${state.mediaType === 'tv' ? 'Series' : 'Movies'} found`;
  updateSelectedBar();
}

// ─── SELECTION ──────────────────────────────────────────────
function toggleSelect(item, card) {
  const idx = state.selected.findIndex(s => s.id === item.id);
  if (idx === -1) {
    const isMovie = state.mediaType === 'movie';
    state.selected.push({
      id: item.id,
      title: isMovie ? item.title : item.name,
      year: (isMovie ? item.release_date : item.first_air_date || '').slice(0, 4),
      poster: item.poster_path || '',
      type: state.mediaType,
      overview: item.overview || '',
    });
    card.classList.add('selected');
  } else {
    state.selected.splice(idx, 1);
    card.classList.remove('selected');
  }
  updateSelectedBar();
}

function updateSelectedBar() {
  const bar   = document.getElementById('selected-bar');
  const count = document.getElementById('selected-count');
  if (state.selected.length > 0) {
    bar.style.display = 'flex';
    count.textContent = `${state.selected.length} selected`;
    document.getElementById('modal-confirm').disabled = false;
  } else {
    bar.style.display = 'none';
  }
}

// ─── ADD-TO-COLLECTION MODAL ────────────────────────────────
function openAddModal() {
  if (!state.selected.length) return;
  state.selectedFranchise = null;
  state.newFranchiseName  = '';

  renderModalPreview();
  renderFranchiseOptions();

  document.getElementById('new-franchise-input').value = '';
  document.getElementById('modal-confirm').disabled = true;
  document.getElementById('modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeAddModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function closeModal(e) {
  if (e.target === document.getElementById('modal-overlay')) closeAddModal();
}

function renderModalPreview() {
  const container = document.getElementById('modal-preview');
  container.innerHTML = state.selected.map(s => `
    <div class="preview-chip">
      ${s.poster
        ? `<img src="${IMG_BASE}${s.poster}" alt="${s.title}">`
        : `<div style="width:24px;height:24px;background:var(--bg-subtle);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:12px">${s.type === 'tv' ? '📺' : '🎬'}</div>`}
      <span>${s.title}</span>
    </div>
  `).join('');
}

function renderFranchiseOptions() {
  const list = document.getElementById('franchise-list');
  const franchises = getUniqueFranchises();
  if (!franchises.length) {
    list.innerHTML = `<p style="font-size:13px;color:var(--text-muted);padding:4px 0">No collections yet — create your first one below!</p>`;
    return;
  }
  list.innerHTML = franchises.map(f => {
    const count = state.collection.filter(e => e.franchise === f).length;
    return `
      <button class="franchise-option" onclick="selectFranchise('${escAttr(f)}', this)">
        <span class="fo-icon">📁</span>
        <span>${f}</span>
        <span class="fo-count">${count} title${count !== 1 ? 's' : ''}</span>
      </button>
    `;
  }).join('');
}

function selectFranchise(name, btn) {
  document.querySelectorAll('.franchise-option').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  state.selectedFranchise = name;
  state.newFranchiseName  = '';
  document.getElementById('new-franchise-input').value = '';
  document.getElementById('modal-confirm').disabled = false;
}

function handleNewFranchiseInput(val) {
  state.newFranchiseName = val.trim();
  state.selectedFranchise = null;
  document.querySelectorAll('.franchise-option').forEach(b => b.classList.remove('selected'));
  document.getElementById('modal-confirm').disabled = !val.trim();
}

async function confirmAdd() {
  const franchise = state.selectedFranchise || state.newFranchiseName;
  if (!franchise) return;

  let added = 0;
  state.selected.forEach(s => {
    const exists = state.collection.find(e => String(e.id) === String(s.id) && e.type === s.type && e.franchise === franchise);
    if (!exists) {
      state.collection.push({
        id: String(s.id),
        title: s.title,
        year: s.year,
        poster_path: s.poster,
        franchise,
        type: s.type,
        added_date: new Date().toISOString().slice(0, 10),
        overview: s.overview,
      });
      added++;
    }
  });

  await saveDB();
  closeAddModal();
  clearSearch();

  if (added > 0) showToast(`✅ Added ${added} title${added !== 1 ? 's' : ''} to "${franchise}"`);
  else showToast('ℹ️ All titles already in this collection');

  renderDashboard();
}

// ─── DASHBOARD ──────────────────────────────────────────────
function renderDashboard() {
  const container = document.getElementById('collections-container');
  const emptyState = document.getElementById('empty-state');
  const totalCount = document.getElementById('dash-total-count');

  let entries = state.collection;

  // Type filter
  if (state.dashTypeFilter !== 'all') {
    entries = entries.filter(e => e.type === state.dashTypeFilter);
  }

  // Text filter
  const q = state.dashFilter.toLowerCase();
  if (q) {
    entries = entries.filter(e =>
      e.title.toLowerCase().includes(q) || e.franchise.toLowerCase().includes(q)
    );
  }

  totalCount.textContent = `${state.collection.length} title${state.collection.length !== 1 ? 's' : ''}`;

  if (!state.collection.length) {
    emptyState.style.display = 'block';
    container.innerHTML = '';
    return;
  }
  emptyState.style.display = 'none';

  // Group by franchise
  const groups = {};
  entries.forEach(e => {
    if (!groups[e.franchise]) groups[e.franchise] = [];
    groups[e.franchise].push(e);
  });

  const sorted = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));

  container.innerHTML = '';
  sorted.forEach(([franchise, items], gi) => {
    const group = document.createElement('div');
    group.className = 'franchise-group';
    group.style.animationDelay = `${gi * 60}ms`;

    group.innerHTML = `
      <div class="franchise-header">
        <div class="franchise-name-wrap">
          <span class="franchise-name">${franchise}</span>
          <span class="franchise-count">${items.length}</span>
        </div>
        <div class="franchise-actions">
          <button onclick="deleteFranchise('${escAttr(franchise)}')">Delete collection</button>
        </div>
      </div>
      <div class="franchise-scroll" id="fs-${slugify(franchise)}"></div>
    `;

    container.appendChild(group);

    const scroll = group.querySelector('.franchise-scroll');
    items.forEach((item, i) => {
      const card = document.createElement('div');
      card.className = 'collection-card';
      card.style.animationDelay = `${(gi * 60) + (i * 20)}ms`;
      const poster = item.poster_path ? `${IMG_BASE}${item.poster_path}` : null;

      card.innerHTML = `
        ${poster
          ? `<img src="${poster}" alt="${item.title}" loading="lazy">`
          : `<div class="no-poster"><span>${item.type === 'tv' ? '📺' : '🎬'}</span>${item.title.slice(0,20)}</div>`}
        <div class="collection-card-info">
          <div class="collection-card-title">${item.title}</div>
          <div class="collection-card-meta">
            <span>${item.type === 'tv' ? '📺 Series' : '🎬 Movie'}</span>
            ${item.year ? `· <span>${item.year}</span>` : ''}
          </div>
        </div>
        <button class="remove-from-col" title="Remove" onclick="removeEntry('${item.id}','${escAttr(item.franchise)}','${item.type}',event)">✕</button>
      `;

      card.addEventListener('click', () => openDetailPanel(item));
      scroll.appendChild(card);
    });
  });
}

function filterDashboard(val) {
  state.dashFilter = val;
  renderDashboard();
}

function filterByType(type, btn) {
  state.dashTypeFilter = type;
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  renderDashboard();
}

async function deleteFranchise(franchise) {
  if (!confirm(`Delete the "${franchise}" collection?\nThis removes all titles in this collection from your tracker.`)) return;
  state.collection = state.collection.filter(e => e.franchise !== franchise);
  await saveDB();
  renderDashboard();
  showToast(`🗑️ Deleted collection "${franchise}"`);
}

async function removeEntry(id, franchise, type, e) {
  e.stopPropagation();
  const title = (state.collection.find(en => String(en.id) === String(id) && en.franchise === franchise && en.type === type) || {}).title || 'this title';
  if (!confirm(`Remove "${title}" from "${franchise}"?`)) return;
  state.collection = state.collection.filter(
    en => !(String(en.id) === String(id) && en.franchise === franchise && en.type === type)
  );
  await saveDB();
  renderDashboard();
  showToast('🗑️ Removed from collection');
}

// ─── SIDE PANEL (detail view) ───────────────────────────────
function openSidePanel(item) {
  const isMovie  = state.mediaType === 'movie';
  const title    = isMovie ? item.title : item.name;
  const year     = (isMovie ? item.release_date : item.first_air_date || '').slice(0, 4);
  const poster   = item.poster_path ? `${IMG_ORIG}${item.poster_path}` : null;
  const overview = item.overview || 'No description available.';
  const inCol    = state.collection.filter(e => String(e.id) === String(item.id));

  renderPanel({ title, year, poster, overview, type: state.mediaType, franchises: inCol.map(e => e.franchise) });
}

function openDetailPanel(item) {
  const inCol = state.collection.filter(e => String(e.id) === String(item.id));
  renderPanel({
    title: item.title,
    year: item.year,
    poster: item.poster_path ? `${IMG_ORIG}${item.poster_path}` : null,
    overview: item.overview || 'No description available.',
    type: item.type,
    franchises: inCol.map(e => e.franchise),
    addedDate: item.added_date,
  });
}

function renderPanel({ title, year, poster, overview, type, franchises = [], addedDate }) {
  const content = document.getElementById('side-panel-content');
  content.innerHTML = `
    ${poster ? `<img class="panel-poster" src="${poster}" alt="${title}">` : ''}
    <div class="panel-title">${title}</div>
    <div class="panel-meta">
      <span class="panel-tag">${type === 'tv' ? '📺 Series' : '🎬 Movie'}</span>
      ${year ? `<span>· ${year}</span>` : ''}
      ${addedDate ? `<span>· Added ${addedDate}</span>` : ''}
    </div>
    <p class="panel-overview">${overview}</p>
    ${franchises.length ? `<div class="panel-franchise">In collection: ${franchises.map(f => `<strong>${f}</strong>`).join(', ')}</div>` : ''}
  `;
  document.getElementById('side-panel-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeSidePanel(e) {
  if (e.target === document.getElementById('side-panel-overlay')) closeSidePanelDirect();
}
function closeSidePanelDirect() {
  document.getElementById('side-panel-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

// ─── VIEW SWITCHING ─────────────────────────────────────────
function switchView(view) {
  const isSearch = view === 'search';
  document.getElementById('view-search').style.display    = isSearch ? 'block' : 'none';
  document.getElementById('view-dashboard').style.display = isSearch ? 'none'  : 'block';
  document.getElementById('tab-search').classList.toggle('active', isSearch);
  document.getElementById('tab-dashboard').classList.toggle('active', !isSearch);
  if (!isSearch) renderDashboard();
}

// ─── HELPERS ────────────────────────────────────────────────
function getUniqueFranchises() {
  return [...new Set(state.collection.map(e => e.franchise))].sort();
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function escAttr(str) {
  return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

// ─── INIT ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadDB();
  renderDashboard();
  document.getElementById('view-dashboard').style.display = 'none';
  if (!getTMDBKey()) {
    document.getElementById('api-setup-banner').style.display = 'block';
  }
});
