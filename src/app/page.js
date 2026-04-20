'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './globals.css';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMG_BASE = 'https://image.tmdb.org/t/p/w342';
const IMG_ORIG = 'https://image.tmdb.org/t/p/w500';
const STORAGE_API_KEY = 'movieshock_apikey';
const STORAGE_THEME = 'movieshock_theme'; // 'light' | 'dark' | 'auto'

// MD3 ease curve
const md3Ease = [0.05, 0.7, 0.1, 1.0];

const pageVar = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: md3Ease } },
  exit: { opacity: 0, y: -16, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }
};

const staggerVar = {
  initial: {},
  animate: { transition: { staggerChildren: 0.04 } }
};

const cardVar = {
  initial: { opacity: 0, scale: 0.95, y: 16 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.35, ease: md3Ease } },
  exit: { opacity: 0, scale: 0.93, transition: { duration: 0.18 } }
};

const modalVar = {
  initial: { opacity: 0, y: 40, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: md3Ease } },
  exit: { opacity: 0, y: 30, scale: 0.97, transition: { duration: 0.2 } }
};

const panelVar = {
  initial: { x: '100%' },
  animate: { x: 0, transition: { duration: 0.4, ease: md3Ease } },
  exit: { x: '100%', transition: { duration: 0.25, ease: [0.4, 0, 1, 1] } }
};

// Derive active theme from preference & time
function getActiveTheme(pref) {
  if (pref === 'light') return 'light';
  if (pref === 'dark') return 'dark';
  // auto: dark 6pm–6am
  const h = new Date().getHours();
  return (h >= 18 || h < 6) ? 'dark' : 'light';
}

export default function Home() {
  const [apiKey, setApiKey] = useState('');
  const [showApiBanner, setShowApiBanner] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');

  const [view, setView] = useState('search');
  const [mediaType, setMediaType] = useState('movie');

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  const [selected, setSelected] = useState([]);

  const [collection, setCollection] = useState([]);
  const [dashFilter, setDashFilter] = useState('');
  const [dashTypeFilter, setDashTypeFilter] = useState('all');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedFranchise, setSelectedFranchise] = useState('');
  const [newFranchiseName, setNewFranchiseName] = useState('');

  const [sidePanelItem, setSidePanelItem] = useState(null);
  const [toastMsg, setToastMsg] = useState('');

  // Theme: 'auto' | 'light' | 'dark'
  const [themePref, setThemePref] = useState('auto');
  const [activeTheme, setActiveTheme] = useState('light');

  const searchTimeoutRef = useRef(null);
  const toastTimeoutRef = useRef(null);

  // ── Theme init & auto-switch ──────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_THEME) || 'auto';
    setThemePref(saved);
    const theme = getActiveTheme(saved);
    setActiveTheme(theme);
    document.documentElement.setAttribute('data-theme', theme);

    // Re-check every minute for auto mode
    const interval = setInterval(() => {
      const pref = localStorage.getItem(STORAGE_THEME) || 'auto';
      if (pref === 'auto') {
        const t = getActiveTheme('auto');
        setActiveTheme(t);
        document.documentElement.setAttribute('data-theme', t);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const cycleTheme = () => {
    // cycle: auto → light → dark → auto
    const next = themePref === 'auto' ? 'light' : themePref === 'light' ? 'dark' : 'auto';
    setThemePref(next);
    localStorage.setItem(STORAGE_THEME, next);
    const resolved = getActiveTheme(next);
    setActiveTheme(resolved);
    document.documentElement.setAttribute('data-theme', resolved);
  };

  const themeIcon = themePref === 'light' ? 'light_mode' : themePref === 'dark' ? 'dark_mode' : 'brightness_auto';
  const themeLabel = themePref === 'light' ? 'Light' : themePref === 'dark' ? 'Dark' : 'Auto';

  // ── Load from DB & API key ────────────────────────────────
  useEffect(() => {
    const envKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
    const key = localStorage.getItem(STORAGE_API_KEY);
    if (envKey || key) {
      setApiKey(envKey || key);
    } else {
      setShowApiBanner(true);
    }

    fetch('/api/movies')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          // Deduplicate (global uniqueness by id+type)
          const seen = new Set();
          const unique = data.filter(item => {
            const k = `${item.id}__${item.type}`;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          });
          setCollection(unique);
          if (data.length !== unique.length) {
            fetch('/api/movies', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(unique),
            });
          }
        }
      })
      .catch(err => console.error(err));
  }, []);

  // ── DB helpers ────────────────────────────────────────────
  const saveDB = async (newData) => {
    try {
      await fetch('/api/movies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newData),
      });
      setCollection(newData);
    } catch {
      showToast('⚠️ Could not save to database');
    }
  };

  const showToast = (msg) => {
    setToastMsg(msg);
    clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToastMsg(''), 4500);
  };

  const saveAPIKey = () => {
    const val = apiKeyInput.trim();
    if (!val) { showToast('⚠️ Please enter a valid API key'); return; }
    localStorage.setItem(STORAGE_API_KEY, val);
    setApiKey(val);
    setShowApiBanner(false);
    showToast('✅ API key saved!');
  };

  // ── TMDB search ───────────────────────────────────────────
  const tmdbGet = async (path, params = {}) => {
    const envKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
    const key = envKey || apiKey || localStorage.getItem(STORAGE_API_KEY) || '273fc15b4bd675aed3c5fc53ecfc945c';
    if (!key) { setShowApiBanner(true); throw new Error('No API key'); }
    const url = new URL(`${TMDB_BASE}${path}`);
    url.searchParams.set('api_key', key);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const resp = await fetch(url.toString());
    if (!resp.ok) throw new Error(`TMDB ${resp.status}`);
    return resp.json();
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    clearTimeout(searchTimeoutRef.current);
    if (!query.trim()) { setResults([]); setHasSearched(false); return; }
    setIsSearching(true);
    setHasSearched(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const endpoint = mediaType === 'movie' ? '/search/movie' : '/search/tv';
        const data = await tmdbGet(endpoint, { query, include_adult: false, language: 'en-US', page: 1 });
        setResults((data.results || []).slice(0, 24));
      } catch (err) {
        if (err.message !== 'No API key') { console.error(err); setShowApiBanner(true); }
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 380);
  };

  const clearSearch = () => { setSearchQuery(''); setResults([]); setHasSearched(false); setSelected([]); };

  const toggleSelect = (item) => {
    const idx = selected.findIndex(s => String(s.id) === String(item.id));
    if (idx === -1) {
      const isMovie = mediaType === 'movie';
      setSelected([...selected, {
        id: String(item.id),
        title: isMovie ? item.title : item.name,
        year: (isMovie ? item.release_date : item.first_air_date || '').slice(0, 4),
        poster: item.poster_path || '',
        type: mediaType,
        overview: item.overview || '',
      }]);
    } else {
      setSelected(selected.filter((_, i) => i !== idx));
    }
  };

  const getUniqueFranchises = () => [...new Set(collection.map(e => e.franchise))].sort();

  const confirmAdd = async () => {
    const franchise = selectedFranchise || newFranchiseName.trim();
    if (!franchise) return;
    let added = 0;
    const newCollection = [...collection];
    selected.forEach(s => {
      const exists = newCollection.find(e => String(e.id) === String(s.id) && e.type === s.type);
      if (!exists) {
        newCollection.push({
          id: String(s.id), title: s.title, year: s.year,
          poster_path: s.poster, franchise, type: s.type,
          added_date: new Date().toISOString().slice(0, 10),
          overview: s.overview,
        });
        added++;
      }
    });
    await saveDB(newCollection);
    setIsAddModalOpen(false);
    clearSearch();
    if (added > 0) showToast(`✅ Added ${added} title${added !== 1 ? 's' : ''} to "${franchise}"`);
    else showToast('ℹ️ All titles already in your collection');
  };

  const deleteFranchise = async (franchise) => {
    if (!window.confirm(`Delete the "${franchise}" collection?\nThis removes all titles in it from your tracker.`)) return;
    await saveDB(collection.filter(e => e.franchise !== franchise));
    showToast(`🗑️ Deleted "${franchise}"`);
  };

  const removeEntry = async (id, franchise, type, e) => {
    e.stopPropagation();
    const title = (collection.find(en => String(en.id) === String(id) && en.franchise === franchise && en.type === type) || {}).title || 'this title';
    if (!window.confirm(`Remove "${title}" from "${franchise}"?`)) return;
    await saveDB(collection.filter(en => !(String(en.id) === String(id) && en.franchise === franchise && en.type === type)));
    showToast('🗑️ Removed from collection');
  };

  // ── Filtering ─────────────────────────────────────────────
  let filteredCollection = collection;
  if (dashTypeFilter !== 'all') filteredCollection = filteredCollection.filter(e => e.type === dashTypeFilter);
  if (dashFilter) {
    const q = dashFilter.toLowerCase();
    filteredCollection = filteredCollection.filter(e => e.title.toLowerCase().includes(q) || e.franchise.toLowerCase().includes(q));
  }
  const groups = {};
  filteredCollection.forEach(e => { if (!groups[e.franchise]) groups[e.franchise] = []; groups[e.franchise].push(e); });
  const sortedDash = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));

  // ─────────────────────────────────────────────────────────
  return (
    <>
      {/* Ambient background orbs */}
      <div className="app-orb-1" />
      <div className="app-orb-2" />

      {/* ── MOBILE TOP BAR ── */}
      <div className="mobile-topbar">
        <button className="mobile-topbar-action" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
        <span className="mobile-topbar-logo">MovieShock</span>
        <button className="mobile-theme-btn" onClick={cycleTheme}>
          <span className="material-symbols-outlined">{themeIcon}</span>
        </button>
      </div>

      {/* ── SIDEBAR NAV ── */}
      <nav className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <span className="sidebar-logo-icon">🎬</span>
          <span className="sidebar-logo-text">MovieShock</span>
        </div>

        {/* Nav items */}
        <div className="sidebar-nav">
          <button
            className={`sidebar-tab ${view === 'search' ? 'active' : ''}`}
            onClick={() => setView('search')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <span className="sidebar-tab-label">Discover</span>
          </button>

          <button
            className={`sidebar-tab ${view === 'dashboard' ? 'active' : ''}`}
            onClick={() => setView('dashboard')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="3" y="3" width="7" height="7" rx="1.5"/>
              <rect x="14" y="3" width="7" height="7" rx="1.5"/>
              <rect x="14" y="14" width="7" height="7" rx="1.5"/>
              <rect x="3" y="14" width="7" height="7" rx="1.5"/>
            </svg>
            <span className="sidebar-tab-label">My Collection</span>
            {collection.length > 0 && (
              <span className="sidebar-badge">{collection.length}</span>
            )}
          </button>
        </div>

        {/* Theme toggle at bottom */}
        <div className="sidebar-bottom">
          <button className="theme-toggle" onClick={cycleTheme} title={`Theme: ${themeLabel}`}>
            <span className="material-symbols-outlined">{themeIcon}</span>
            <span className="theme-toggle-label">{themeLabel}</span>
          </button>
        </div>
      </nav>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="mobile-bottomnav">
        <button
          className={`mobile-nav-btn ${view === 'search' ? 'active' : ''}`}
          onClick={() => setView('search')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          {view === 'search' && <span className="mobile-nav-btn-label">Discover</span>}
        </button>

        <button
          className={`mobile-nav-btn ${view === 'dashboard' ? 'active' : ''}`}
          onClick={() => setView('dashboard')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
             <rect x="3" y="3" width="7" height="7" rx="1.5"/>
             <rect x="14" y="3" width="7" height="7" rx="1.5"/>
             <rect x="14" y="14" width="7" height="7" rx="1.5"/>
             <rect x="3" y="14" width="7" height="7" rx="1.5"/>
          </svg>
          {view === 'dashboard' && <span className="mobile-nav-btn-label">Collection</span>}
        </button>
      </nav>

      {/* ── MAIN CONTENT ── */}
      <div className="app-content">
        <AnimatePresence mode="wait">

        {/* ── DISCOVER VIEW ── */}
        {view === 'search' && (
          <motion.main key="search" className="view" variants={pageVar} initial="initial" animate="animate" exit="exit">
            <div className="hero-section">
              <h1 className="hero-title">
                Discover &amp; <span className="hero-title-accent">Track</span>
              </h1>
              <p className="hero-sub">Search movies and web series, add them to your franchise collection.</p>

              <div className="search-row">
                <div className="search-wrapper">
                  <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search titles, directors, or genres..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                  />
                  <div className={`search-spinner ${isSearching ? 'visible' : ''}`} />
                  {searchQuery && (
                    <button className="search-clear" style={{ display: 'flex' }} onClick={clearSearch}>✕</button>
                  )}
                </div>

                <div className="type-toggle">
                  <button
                    className={`type-btn ${mediaType === 'movie' ? 'active' : ''}`}
                    onClick={() => { setMediaType('movie'); if (searchQuery) handleSearch(searchQuery); }}
                  >
                    Movies
                  </button>
                  <button
                    className={`type-btn ${mediaType === 'tv' ? 'active' : ''}`}
                    onClick={() => { setMediaType('tv'); if (searchQuery) handleSearch(searchQuery); }}
                  >
                    Series
                  </button>
                </div>
              </div>
            </div>

            <AnimatePresence>
              {hasSearched && (
                <motion.section
                  className="results-section"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="results-header">
                    <h2 className="results-title">
                      {results.length} {mediaType === 'tv' ? 'Series' : 'Movies'} found
                    </h2>
                    <AnimatePresence>
                      {selected.length > 0 && (
                        <motion.div
                          className="selected-bar"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                        >
                          <span>{selected.length} selected</span>
                          <button
                            className="btn-primary"
                            onClick={() => {
                              setNewFranchiseName(selected.length > 0 ? selected[0].title : '');
                              setSelectedFranchise('');
                              setIsAddModalOpen(true);
                            }}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                            Add to Collection
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <motion.div className="results-grid" variants={staggerVar} initial="initial" animate="animate">
                    {results.length === 0 ? (
                      <div className="no-results">
                        <span>🎬</span>
                        <p>No results found. Try a different title.</p>
                      </div>
                    ) : (
                      <AnimatePresence>
                        {results.map((item) => {
                          const isMovie = mediaType === 'movie';
                          const title = isMovie ? item.title : item.name;
                          const year = (isMovie ? item.release_date : item.first_air_date || '').slice(0, 4);
                          const poster = item.poster_path ? `${IMG_BASE}${item.poster_path}` : null;
                          const alreadyIn = collection.find(e => String(e.id) === String(item.id) && e.type === mediaType);
                          const isSelected = selected.find(s => String(s.id) === String(item.id));

                          return (
                            <motion.div
                              layout
                              key={item.id}
                              className={`result-card ${isSelected ? 'selected' : ''}`}
                              variants={cardVar}
                              initial="initial"
                              animate="animate"
                              exit="exit"
                              onClick={() => !alreadyIn && toggleSelect(item)}
                              style={{ cursor: alreadyIn ? 'default' : 'pointer' }}
                            >
                              {/* Selected overlay */}
                              <div className="select-overlay">
                                <div className="select-overlay-icon">✓</div>
                              </div>

                              {/* Already in collection badge */}
                              {alreadyIn && (
                                <div style={{
                                  position: 'absolute', top: 8, left: 8, zIndex: 3,
                                  background: 'var(--primary)', color: 'var(--on-primary)',
                                  fontSize: '10px', fontWeight: 700, padding: '3px 8px',
                                  borderRadius: 'var(--r-full)', whiteSpace: 'nowrap',
                                  letterSpacing: '0.3px'
                                }}>
                                  ✓ {alreadyIn.franchise}
                                </div>
                              )}

                              {poster ? (
                                <img src={poster} alt={title} loading="lazy" />
                              ) : (
                                <div className="no-poster-card">
                                  <span>{isMovie ? '🎬' : '📺'}</span>
                                  No Poster
                                </div>
                              )}
                              <div className="result-card-info">
                                <div className="result-card-title">{title}</div>
                                <div className="result-card-meta">
                                  {isMovie ? 'Movie' : 'Series'}{year && ` · ${year}`}
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    )}
                  </motion.div>
                </motion.section>
              )}
            </AnimatePresence>
          </motion.main>
        )}

        {/* ── MY COLLECTION VIEW ── */}
        {view === 'dashboard' && (
          <motion.main key="dashboard" className="view" variants={pageVar} initial="initial" animate="animate" exit="exit">
            <div className="dashboard-view">
              <div className="dashboard-header">
                <h1 className="dashboard-title">
                  My <span className="dashboard-title-accent">Collection</span>
                </h1>
                <div className="dashboard-controls">
                  <input
                    type="text"
                    className="dashboard-search"
                    placeholder="Filter titles or franchises..."
                    value={dashFilter}
                    onChange={(e) => setDashFilter(e.target.value)}
                  />
                  <div className="filter-toggle">
                    <button className={`filter-btn ${dashTypeFilter === 'all' ? 'active' : ''}`} onClick={() => setDashTypeFilter('all')}>All</button>
                    <button className={`filter-btn ${dashTypeFilter === 'movie' ? 'active' : ''}`} onClick={() => setDashTypeFilter('movie')}>Movies</button>
                    <button className={`filter-btn ${dashTypeFilter === 'tv' ? 'active' : ''}`} onClick={() => setDashTypeFilter('tv')}>Series</button>
                  </div>
                </div>
              </div>

              <AnimatePresence mode="popLayout">
                {collection.length === 0 ? (
                  <motion.div key="empty" className="empty-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <span className="empty-icon">🎞️</span>
                    <h3>Your collection is empty</h3>
                    <p>Search for a movie or series and add it here.</p>
                    <button className="btn-primary" onClick={() => setView('search')}>Start Discovering</button>
                  </motion.div>
                ) : (
                  <motion.div key="grid" className="collections-container" variants={staggerVar} initial="initial" animate="animate">
                    <AnimatePresence>
                      {sortedDash.map(([franchise, items]) => (
                        <motion.div layout key={franchise} className="franchise-group" variants={cardVar} initial="initial" animate="animate" exit="exit">
                          <div className="franchise-header">
                            <div className="franchise-name-wrap">
                              <span className="franchise-name">{franchise}</span>
                              <span className="franchise-count">{items.length}</span>
                            </div>
                            <div className="franchise-actions">
                              <button onClick={() => deleteFranchise(franchise)}>Delete container</button>
                            </div>
                          </div>
                          <motion.div className="franchise-scroll" layout>
                            <AnimatePresence>
                              {items.map((item) => {
                                const poster = item.poster_path ? `${IMG_BASE}${item.poster_path}` : null;
                                return (
                                  <motion.div
                                    layout
                                    key={`${item.id}-${item.franchise}`}
                                    className="collection-card"
                                    variants={cardVar}
                                    initial="initial"
                                    animate="animate"
                                    exit="exit"
                                    onClick={() => setSidePanelItem({
                                      ...item,
                                      poster: item.poster_path ? `${IMG_ORIG}${item.poster_path}` : null,
                                      franchises: collection.filter(e => String(e.id) === String(item.id)).map(e => e.franchise)
                                    })}
                                  >
                                    {poster
                                      ? <img src={poster} alt={item.title} loading="lazy" />
                                      : <div className="no-poster"><span>{item.type === 'tv' ? '📺' : '🎬'}</span>{item.title.slice(0, 20)}</div>
                                    }
                                    <div className="collection-card-info">
                                      <div className="collection-card-title">{item.title}</div>
                                      <div className="collection-card-meta">
                                        {item.type === 'tv' ? 'Series' : 'Movie'}{item.year && ` · ${item.year}`}
                                      </div>
                                    </div>
                                    <button className="remove-from-col" title="Remove" onClick={(e) => removeEntry(item.id, item.franchise, item.type, e)}>✕</button>
                                  </motion.div>
                                );
                              })}
                            </AnimatePresence>
                          </motion.div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.main>
        )}
        </AnimatePresence>
      </div> {/* end app-content */}

      {/* ── ADD TO COLLECTION MODAL ── */}
      <AnimatePresence>
        {isAddModalOpen && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) setIsAddModalOpen(false); }}
          >
            <motion.div className="modal" variants={modalVar} initial="initial" animate="animate" exit="exit" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title">Add to Collection</h3>
                <button className="modal-close" onClick={() => setIsAddModalOpen(false)}>✕</button>
              </div>

              <div className="modal-selected-preview">
                {selected.map(s => (
                  <div key={s.id} className="preview-chip">
                    {s.poster
                      ? <img src={`${IMG_BASE}${s.poster}`} alt={s.title} />
                      : <span style={{ fontSize: 18 }}>{s.type === 'tv' ? '📺' : '🎬'}</span>
                    }
                    <span>{s.title}</span>
                  </div>
                ))}
              </div>

              <div className="modal-body">
                <label className="form-label">Choose or create a collection</label>
                <div className="franchise-list">
                  {getUniqueFranchises().length === 0 ? (
                    <p style={{ fontSize: 13, color: 'var(--outline)', padding: '4px 0' }}>
                      No collections yet — create your first one below!
                    </p>
                  ) : (
                    getUniqueFranchises().map(f => {
                      const count = collection.filter(e => e.franchise === f).length;
                      return (
                        <button
                          key={f}
                          className={`franchise-option ${selectedFranchise === f ? 'selected' : ''}`}
                          onClick={() => { setSelectedFranchise(f); setNewFranchiseName(''); }}
                        >
                          <span className="material-symbols-outlined option-icon">
                            {selectedFranchise === f ? 'radio_button_checked' : 'radio_button_unchecked'}
                          </span>
                          <div style={{ flex: 1, textAlign: 'left' }}>
                            <div style={{ fontWeight: 600, fontSize: 15 }}>{f}</div>
                            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>{count} title{count !== 1 ? 's' : ''}</div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="new-franchise-wrap">
                  <input
                    type="text"
                    className="franchise-input"
                    placeholder={selected.length > 0 ? `E.g., ${selected[0].title} Collection` : '+ Create new collection...'}
                    value={newFranchiseName}
                    onChange={(e) => { setNewFranchiseName(e.target.value); setSelectedFranchise(''); }}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn-secondary" onClick={() => setIsAddModalOpen(false)}>Cancel</button>
                <button
                  className="btn-primary"
                  disabled={!selectedFranchise && !newFranchiseName.trim()}
                  onClick={confirmAdd}
                >
                  Add to Collection
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SIDE PANEL ── */}
      <AnimatePresence>
        {sidePanelItem && (
          <motion.div
            className="side-panel-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) setSidePanelItem(null); }}
          >
            <motion.div className="side-panel" variants={panelVar} initial="initial" animate="animate" exit="exit" onClick={e => e.stopPropagation()}>
              <button className="panel-close" onClick={() => setSidePanelItem(null)}>✕</button>
              <div id="side-panel-content">
                {sidePanelItem.poster && <img className="panel-poster" src={sidePanelItem.poster} alt={sidePanelItem.title} />}
                <div style={{ padding: 24 }}>
                  <div className="panel-title">{sidePanelItem.title}</div>
                  <div className="panel-meta">
                    <span className="panel-tag">{sidePanelItem.type === 'tv' ? '📺 Series' : '🎬 Movie'}</span>
                    {sidePanelItem.year && <span>· {sidePanelItem.year}</span>}
                    {sidePanelItem.added_date && <span>· Added {sidePanelItem.added_date}</span>}
                  </div>
                  <p className="panel-overview">{sidePanelItem.overview || 'No description available.'}</p>
                  {sidePanelItem.franchises?.length > 0 && (
                    <div className="panel-franchise">
                      In collection: {sidePanelItem.franchises.map(f => <strong key={f}>{f} </strong>)}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── API BANNER ── */}
      <AnimatePresence>
        {showApiBanner && (
          <motion.div
            className="api-setup-banner"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.3, ease: md3Ease }}
          >
            <div className="api-setup-inner">
              <span className="api-icon">🔑</span>
              <div style={{ flex: 1 }}>
                <strong>Set up your free TMDB API key to enable search</strong>
                <p>Get a free key at <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer">themoviedb.org</a> — it's instant and free.</p>
              </div>
              <div className="api-key-form">
                <input type="text" placeholder="Paste your API key here..." value={apiKeyInput} onChange={e => setApiKeyInput(e.target.value)} />
                <button onClick={saveAPIKey}>Save</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TOAST ── */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            className="toast"
            initial={{ opacity: 0, y: 40, scale: 0.95, x: '-50%' }}
            animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            transition={{ duration: 0.3, ease: md3Ease }}
            style={{ display: 'flex', alignItems: 'center', gap: 16 }}
          >
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                {toastMsg.includes('🗑️') ? 'delete' : toastMsg.includes('⚠️') ? 'warning' : 'check_circle'}
              </span>
              <span>{toastMsg.replace(/[✅🗑️⚠️ℹ️]/g, '').trim()}</span>
            </div>
            <button
              onClick={() => { clearTimeout(toastTimeoutRef.current); setToastMsg(''); }}
              style={{ background: 'transparent', border: 'none', color: 'var(--inverse-primary)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, padding: '4px 2px' }}
            >
              OK
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
