'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './globals.css';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMG_BASE = 'https://image.tmdb.org/t/p/w342';
const IMG_ORIG = 'https://image.tmdb.org/t/p/w500';
const STORAGE_API_KEY = 'movieshock_apikey';

// Authentic Material 3 Motion Curves (Emphasized Decelerate)
const md3Ease = [0.05, 0.7, 0.1, 1.0];

const pageVar = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: md3Ease } },
  exit: { opacity: 0, y: -20, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }
};

const staggerVar = {
  initial: {},
  animate: { transition: { staggerChildren: 0.05 } }
};

const cardVar = {
  initial: { opacity: 0, scale: 0.95, y: 20 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.4, ease: md3Ease } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } }
};

const modalVar = {
  initial: { opacity: 0, y: 50 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: md3Ease } },
  exit: { opacity: 0, y: 50, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }
};

const panelVar = {
  initial: { x: '100%', opacity: 0 },
  animate: { x: 0, opacity: 1, transition: { duration: 0.4, ease: md3Ease } },
  exit: { x: '100%', opacity: 0, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }
};

export default function Home() {
  const [apiKey, setApiKey] = useState('');
  const [showApiBanner, setShowApiBanner] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  
  const [view, setView] = useState('search'); // 'search' | 'dashboard'
  const [mediaType, setMediaType] = useState('movie'); // 'movie' | 'tv'
  
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
  
  const searchTimeoutRef = useRef(null);

  // Load from DB & API Key
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
        if (Array.isArray(data)) setCollection(data);
      })
      .catch(err => console.error(err));
  }, []);

  const saveDB = async (newData) => {
    try {
      await fetch('/api/movies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newData),
      });
      setCollection(newData);
    } catch (err) {
      showToast('⚠️ Could not save to database');
    }
  };

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const saveAPIKey = () => {
    const val = apiKeyInput.trim();
    if (!val) { showToast('⚠️ Please enter a valid API key'); return; }
    localStorage.setItem(STORAGE_API_KEY, val);
    setApiKey(val);
    setShowApiBanner(false);
    showToast('✅ API key saved! Try searching now.');
  };

  const tmdbGet = async (path, params = {}) => {
    const envKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
    const key = envKey || apiKey || localStorage.getItem(STORAGE_API_KEY) || '273fc15b4bd675aed3c5fc53ecfc945c';
    if (!key) {
      setShowApiBanner(true);
      throw new Error('No API key');
    }
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
    if (!query.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    
    setIsSearching(true);
    setHasSearched(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const endpoint = mediaType === 'movie' ? '/search/movie' : '/search/tv';
        const data = await tmdbGet(endpoint, { query, include_adult: false, language: 'en-US', page: 1 });
        setResults((data.results || []).slice(0, 24));
      } catch (err) {
        if (err.message === 'No API key') {
          setResults([]);
        } else {
          console.error(err);
          setResults([]);
          setShowApiBanner(true);
        }
      } finally {
        setIsSearching(false);
      }
    }, 380);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setResults([]);
    setHasSearched(false);
    setSelected([]);
  };

  const toggleSelect = (item) => {
    const idx = selected.findIndex(s => s.id === item.id);
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

  const getUniqueFranchises = () => {
    return [...new Set(collection.map(e => e.franchise))].sort();
  };

  const confirmAdd = async () => {
    const franchise = selectedFranchise || newFranchiseName;
    if (!franchise) return;

    let added = 0;
    const newCollection = [...collection];
    
    selected.forEach(s => {
      const exists = newCollection.find(e => String(e.id) === String(s.id) && e.type === s.type && e.franchise === franchise);
      if (!exists) {
        newCollection.push({
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

    await saveDB(newCollection);
    setIsAddModalOpen(false);
    clearSearch();

    if (added > 0) showToast(`✅ Added ${added} title${added !== 1 ? 's' : ''} to "${franchise}"`);
    else showToast('ℹ️ All titles already in this collection');
  };

  const deleteFranchise = async (franchise) => {
    if (!window.confirm(`Delete the "${franchise}" collection?\nThis removes all titles in this collection from your tracker.`)) return;
    const newCollection = collection.filter(e => e.franchise !== franchise);
    await saveDB(newCollection);
    showToast(`🗑️ Deleted collection "${franchise}"`);
  };

  const removeEntry = async (id, franchise, type, e) => {
    e.stopPropagation();
    const title = (collection.find(en => String(en.id) === String(id) && en.franchise === franchise && en.type === type) || {}).title || 'this title';
    if (!window.confirm(`Remove "${title}" from "${franchise}"?`)) return;
    const newCollection = collection.filter(
      en => !(String(en.id) === String(id) && en.franchise === franchise && en.type === type)
    );
    await saveDB(newCollection);
    showToast('🗑️ Removed from collection');
  };

  // --- Filtering Collection ---
  let filteredCollection = collection;
  if (dashTypeFilter !== 'all') {
    filteredCollection = filteredCollection.filter(e => e.type === dashTypeFilter);
  }
  if (dashFilter) {
    const q = dashFilter.toLowerCase();
    filteredCollection = filteredCollection.filter(e =>
      e.title.toLowerCase().includes(q) || e.franchise.toLowerCase().includes(q)
    );
  }

  const groups = {};
  filteredCollection.forEach(e => {
    if (!groups[e.franchise]) groups[e.franchise] = [];
    groups[e.franchise].push(e);
  });
  const sortedDash = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));

  return (
    <>
      <nav className="topnav tracking-tight">
        <div className="nav-logo">
          <span className="logo-icon">🎬</span>
          <span className="logo-text">MovieShock</span>
        </div>
        <div className="nav-tabs">
          <button className={`nav-tab ${view === 'search' ? 'active' : ''}`} onClick={() => setView('search')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            Discover
          </button>
          <button className={`nav-tab ${view === 'dashboard' ? 'active' : ''}`} onClick={() => setView('dashboard')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>
            My Collection
          </button>
        </div>
      </nav>

      <AnimatePresence mode="wait">
        {view === 'search' && (
          <motion.main key="search" className="view" variants={pageVar} initial="initial" animate="animate" exit="exit">
            <div className="hero-section">
              <h1 className="hero-title">Discover & Track</h1>
              <p className="hero-sub">Search movies and web series, add them to your franchise collection</p>
              <div className="type-toggle">
                <button className={`type-btn ${mediaType === 'movie' ? 'active' : ''}`} onClick={() => { setMediaType('movie'); if (searchQuery) handleSearch(searchQuery); }}>🎬 Movies</button>
                <button className={`type-btn ${mediaType === 'tv' ? 'active' : ''}`} onClick={() => { setMediaType('tv'); if (searchQuery) handleSearch(searchQuery); }}>📺 Web Series</button>
              </div>
              <div className="search-wrapper">
                <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search for a movie, series or franchise..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                />
                <div className={`search-spinner ${isSearching ? 'visible' : ''}`} />
                {searchQuery && <button className="search-clear" style={{ display: 'flex' }} onClick={clearSearch}>✕</button>}
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
                    <h2 className="results-title">{results.length} {mediaType === 'tv' ? 'Series' : 'Movies'} found</h2>
                    <AnimatePresence>
                      {selected.length > 0 && (
                        <motion.div 
                          className="selected-bar"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                        >
                          <span>{selected.length} selected</span>
                          <button className="btn-primary" onClick={() => setIsAddModalOpen(true)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            Add to Collection
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  
                  <motion.div className="results-grid" variants={staggerVar} initial="initial" animate="animate">
                    {results.length === 0 ? (
                      <div className="no-results">
                        <span>🎬</span><p>No results found. Try a different title.</p>
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
                              className={`media-card md-card ${isSelected ? 'selected' : ''}`} 
                              variants={cardVar}
                              initial="initial"
                              animate="animate"
                              exit="exit"
                              onClick={() => toggleSelect(item)}
                            >
                              {alreadyIn && <div className="already-added-badge">✓ In {alreadyIn.franchise}</div>}
                              {poster ? (
                                <img src={poster} alt={title} loading="lazy" />
                              ) : (
                                <div className="no-poster"><span>{isMovie ? '🎬' : '📺'}</span>No Poster</div>
                              )}
                              <div className="card-info">
                                <div className="card-title">{title}</div>
                                <div className="card-meta">
                                  <span>{isMovie ? 'Movie' : 'Series'}</span>
                                  {year && <span>{year}</span>}
                                </div>
                              </div>
                              <div className="select-check">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
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

        {view === 'dashboard' && (
          <motion.main key="dashboard" className="view" variants={pageVar} initial="initial" animate="animate" exit="exit">
            <div className="dashboard-header">
              <div className="dash-title-row">
                <h1 className="dash-title">My Collection</h1>
                <span className="dash-stat">{collection.length} titles</span>
              </div>
              <div className="search-wrapper dash-search">
                <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input
                  type="text"
                  className="search-input"
                  placeholder="Quick filter by title or franchise..."
                  value={dashFilter}
                  onChange={(e) => setDashFilter(e.target.value)}
                />
              </div>
              <div className="filter-row">
                <button className={`pill ${dashTypeFilter === 'all' ? 'active' : ''}`} onClick={() => setDashTypeFilter('all')}>All</button>
                <button className={`pill ${dashTypeFilter === 'movie' ? 'active' : ''}`} onClick={() => setDashTypeFilter('movie')}>🎬 Movies</button>
                <button className={`pill ${dashTypeFilter === 'tv' ? 'active' : ''}`} onClick={() => setDashTypeFilter('tv')}>📺 Series</button>
              </div>
            </div>

            <AnimatePresence mode="popLayout">
              {collection.length === 0 ? (
                <motion.div key="empty" className="empty-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="empty-icon">🎞️</div>
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
                                  className="collection-card md-card" 
                                  variants={cardVar}
                                  initial="initial"
                                  animate="animate"
                                  exit="exit"
                                  onClick={() => setSidePanelItem({...item, poster: item.poster_path ? `${IMG_ORIG}${item.poster_path}` : null, franchises: collection.filter(e => String(e.id) === String(item.id)).map(e => e.franchise) })}
                                >
                                  {poster ? <img src={poster} alt={item.title} loading="lazy" /> : <div className="no-poster"><span>{item.type === 'tv' ? '📺' : '🎬'}</span>{item.title.slice(0, 20)}</div>}
                                  <div className="collection-card-info">
                                    <div className="collection-card-title">{item.title}</div>
                                    <div className="collection-card-meta">
                                      <span>{item.type === 'tv' ? '📺 Series' : '🎬 Movie'}</span>
                                      {item.year && <span>· {item.year}</span>}
                                    </div>
                                  </div>
                                  <button className="remove-from-col" title="Remove" onClick={(e) => removeEntry(item.id, item.franchise, item.type, e)}>✕</button>
                                </motion.div>
                              )
                            })}
                          </AnimatePresence>
                        </motion.div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.main>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAddModalOpen && (
          <div className="modal-overlay open" onClick={(e) => { if(e.target.classList.contains('modal-overlay')) setIsAddModalOpen(false) }}>
            <motion.div className="modal md-card" variants={modalVar} initial="initial" animate="animate" exit="exit" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title">Add to Collection</h3>
                <button className="modal-close" onClick={() => setIsAddModalOpen(false)}>✕</button>
              </div>
              <div className="modal-selected-preview">
                {selected.map(s => (
                  <div key={s.id} className="preview-chip">
                    {s.poster ? <img src={`${IMG_BASE}${s.poster}`} alt={s.title} /> : <div style={{width:'24px', height:'24px', background:'var(--md-sys-color-surface)', borderRadius:'4px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px'}}>{s.type === 'tv' ? '📺' : '🎬'}</div>}
                    <span>{s.title}</span>
                  </div>
                ))}
              </div>
              <div className="modal-body">
                <label className="form-label">Choose or create a franchise</label>
                <div className="franchise-list">
                  {getUniqueFranchises().length === 0 ? (
                    <p style={{fontSize:'13px', color:'var(--md-sys-color-outline)', padding:'4px 0'}}>No collections yet — create your first one below!</p>
                  ) : (
                    getUniqueFranchises().map(f => {
                      const count = collection.filter(e => e.franchise === f).length;
                      return (
                        <button key={f} className={`franchise-option ${selectedFranchise === f ? 'selected' : ''}`} onClick={() => { setSelectedFranchise(f); setNewFranchiseName(''); }}>
                          <span style={{flex: 1}}>{f}</span>
                          <span style={{fontSize:'12px', opacity: 0.8}}>{count} title{count !== 1 ? 's' : ''}</span>
                        </button>
                      )
                    })
                  )}
                </div>
                <div className="new-franchise-wrap">
                  <input
                    type="text"
                    className="franchise-input"
                    placeholder="+ Create new container..."
                    value={newFranchiseName}
                    onChange={(e) => { setNewFranchiseName(e.target.value); setSelectedFranchise(''); }}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn-secondary" onClick={() => setIsAddModalOpen(false)}>Cancel</button>
                <button className="btn-primary" disabled={(!selectedFranchise && !newFranchiseName.trim())} onClick={confirmAdd}>Add to Collection</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sidePanelItem && (
          <div className="side-panel-overlay open" onClick={(e) => { if(e.target.classList.contains('side-panel-overlay')) setSidePanelItem(null) }}>
            <motion.div className="side-panel" variants={panelVar} initial="initial" animate="animate" exit="exit" onClick={e => e.stopPropagation()}>
              <button className="panel-close" onClick={() => setSidePanelItem(null)}>✕</button>
              <div id="side-panel-content">
                {sidePanelItem.poster && <img className="panel-poster" src={sidePanelItem.poster} alt={sidePanelItem.title} />}
                <div className="panel-title">{sidePanelItem.title}</div>
                <div className="panel-meta">
                  <span className="panel-tag">{sidePanelItem.type === 'tv' ? '📺 Series' : '🎬 Movie'}</span>
                  {sidePanelItem.year && <span>· {sidePanelItem.year}</span>}
                  {sidePanelItem.added_date && <span>· Added {sidePanelItem.added_date}</span>}
                </div>
                <p className="panel-overview">{sidePanelItem.overview || 'No description available.'}</p>
                {sidePanelItem.franchises && sidePanelItem.franchises.length > 0 && (
                  <div className="panel-franchise">In collection: {sidePanelItem.franchises.map(f => <strong key={f}>{f} </strong>)}</div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showApiBanner && (
          <div className="api-setup-banner" style={{ display: 'block' }}>
            <div className="api-setup-inner">
              <span className="api-icon">🔑</span>
              <div>
                <strong>Set up your free TMDB API key to enable search</strong>
                <p>Get a free key at <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer">themoviedb.org</a> — it's instant and free.</p>
              </div>
              <div className="api-key-form">
                <input type="text" placeholder="Paste your API key here..." value={apiKeyInput} onChange={e => setApiKeyInput(e.target.value)} />
                <button onClick={saveAPIKey}>Save</button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      <div className={`toast ${toastMsg ? 'show' : ''}`}>{toastMsg}</div>
    </>
  );
}
