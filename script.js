// MaKandra — script.js  (API-connected)
'use strict';

const API = 'http://localhost:3000';

let currentUser = null;
let allWorkers  = [];
let activeCat   = null;
let calYear     = new Date().getFullYear();
let calMonth    = new Date().getMonth();
let calBookings = [];
let bookingModalEl = null;

// ─────────────────────────────────────────
// INIT
// ─────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('mkd_user');
  if (saved) { currentUser = JSON.parse(saved); afterLogin(); }

  injectDashCSS();
  setupReveal();
  loadHomeData();
  buildDistrictFilters();

  document.getElementById('auth-overlay')?.addEventListener('click', closeAuthModal);
  document.getElementById('tab-btn-login')?.addEventListener('click', () => switchAuthTab('login'));
  document.getElementById('tab-btn-signup')?.addEventListener('click', () => switchAuthTab('signup'));
  document.getElementById('tab-btn-provider')?.addEventListener('click', () => switchAuthTab('provider'));

  document.querySelector('#tab-login .btn-primary')?.addEventListener('click', handleLogin);
  document.querySelector('#tab-signup .btn-primary')?.addEventListener('click', handleSignup);
  document.querySelector('#tab-provider .btn-primary')?.addEventListener('click', handleProviderSignup);

  // nav-auth buttons have their own inline onclick — no extra listener needed

  document.getElementById('browse-search')?.addEventListener('input', applyFilters);
  document.getElementById('filter-district')?.addEventListener('change', applyFilters);
  document.getElementById('filter-sort')?.addEventListener('change', applyFilters);

  document.getElementById('review-overlay')?.addEventListener('click', closeReviewModal);
  document.querySelector('#review-modal .modal-x')?.addEventListener('click', () => {
    document.getElementById('review-overlay').classList.add('hidden');
  });
  document.getElementById('star-selector')?.addEventListener('input', e => updateSlider(e.target.value));

  // Close dropdown when clicking outside the user-pill area
  document.addEventListener('click', e => {
    const pill     = document.querySelector('.user-pill');
    const dropdown = document.getElementById('user-dropdown');
    if (dropdown && !pill?.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });

  window.addEventListener('scroll', () => {
    document.getElementById('navbar')?.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });

  if (currentUser) {
    pollNotifications();
    setInterval(pollNotifications, 30000);
  }
});

// ─────────────────────────────────────────
// AUTH MODAL
// ─────────────────────────────────────────

function openAuthModal(tab) {
  document.getElementById('auth-overlay').classList.remove('hidden');
  switchAuthTab(tab || 'login');
}
window.openAuthModal = openAuthModal;

function closeAuthModal(e) {
  if (!e || e.target === document.getElementById('auth-overlay')) {
    document.getElementById('auth-overlay').classList.add('hidden');
  }
}

function switchAuthTab(tab) {
  ['login', 'signup', 'provider'].forEach(t => {
    document.getElementById('tab-btn-' + t)?.classList.toggle('active', t === tab);
    document.getElementById('tab-' + t)?.classList.toggle('hidden', t !== tab);
  });
}

async function handleLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  errEl.textContent = '';

  if (!email)    { errEl.textContent = 'Voer uw e-mailadres in.'; return; }
  if (!password) { errEl.textContent = 'Voer uw wachtwoord in.'; return; }

  try {
    const r    = await fetch(API + '/login', { method: 'POST', headers: ct(), body: JSON.stringify({ email, password }) });
    const data = await r.json();
    if (!r.ok) { errEl.textContent = data.error; return; }
    currentUser = data.user;
    localStorage.setItem('mkd_user', JSON.stringify(currentUser));
    document.getElementById('auth-overlay').classList.add('hidden');
    afterLogin();
    showToast('Welkom terug, ' + currentUser.name + '!', 'success');
    pollNotifications();
    setInterval(pollNotifications, 30000);
  } catch { errEl.textContent = 'Verbindingsfout.'; }
}

async function handleSignup() {
  const firstName = document.getElementById('su-firstname').value.trim();
  const lastName  = document.getElementById('su-lastname').value.trim();
  const email     = document.getElementById('su-email').value.trim();
  const password  = document.getElementById('su-password').value;
  const buurt     = document.getElementById('su-district').value;
  const errEl     = document.getElementById('signup-error');
  errEl.textContent = '';

  if (!firstName)              { errEl.textContent = 'Voornaam is verplicht.'; return; }
  if (!email)                  { errEl.textContent = 'E-mailadres is verplicht.'; return; }
  if (!/\S+@\S+\.\S+/.test(email)) { errEl.textContent = 'Voer een geldig e-mailadres in.'; return; }
  if (!password)               { errEl.textContent = 'Wachtwoord is verplicht.'; return; }
  if (password.length < 6)     { errEl.textContent = 'Wachtwoord moet minimaal 6 tekens zijn.'; return; }
  if (!buurt)                  { errEl.textContent = 'Selecteer een district.'; return; }

  const name = lastName ? firstName + ' ' + lastName : firstName;
  try {
    const r    = await fetch(API + '/signup', { method: 'POST', headers: ct(), body: JSON.stringify({ name, email, password, role: 'klant', buurt }) });
    const data = await r.json();
    if (!r.ok) { errEl.textContent = data.error; return; }
    if (data.user) {
      currentUser = data.user;
      localStorage.setItem('mkd_user', JSON.stringify(currentUser));
      document.getElementById('auth-overlay').classList.add('hidden');
      afterLogin();
      showToast('Account aangemaakt!', 'success');
    } else {
      switchAuthTab('login');
      showToast('Account aangemaakt! Log nu in.', 'success');
    }
  } catch { errEl.textContent = 'Verbindingsfout.'; }
}

async function handleProviderSignup() {
  const firstName    = document.getElementById('pv-firstname').value.trim();
  const lastName     = document.getElementById('pv-lastname').value.trim();
  const email        = document.getElementById('pv-email').value.trim();
  const password     = document.getElementById('pv-password').value;
  const buurt        = document.getElementById('pv-district').value;
  const category     = document.getElementById('pv-category').value;
  const bio          = document.getElementById('pv-tagline')?.value.trim() || '';
  const hourly_rate  = document.getElementById('pv-price')?.value || null;
  const phone        = document.getElementById('pv-phone')?.value.trim() || null;
  const working_hours = document.getElementById('pv-hours')?.value.trim() || null;
  const errEl        = document.getElementById('provider-error');
  errEl.textContent  = '';

  if (!firstName)              { errEl.textContent = 'Voornaam is verplicht.'; return; }
  if (!email)                  { errEl.textContent = 'E-mailadres is verplicht.'; return; }
  if (!/\S+@\S+\.\S+/.test(email)) { errEl.textContent = 'Voer een geldig e-mailadres in.'; return; }
  if (!password)               { errEl.textContent = 'Wachtwoord is verplicht.'; return; }
  if (password.length < 6)     { errEl.textContent = 'Wachtwoord moet minimaal 6 tekens zijn.'; return; }
  if (!buurt)                  { errEl.textContent = 'Selecteer een district.'; return; }
  if (!category)               { errEl.textContent = 'Selecteer een categorie.'; return; }

  const name = lastName ? firstName + ' ' + lastName : firstName;
  try {
    const r    = await fetch(API + '/signup', { method: 'POST', headers: ct(), body: JSON.stringify({ name, email, password, role: 'dienstverlener', buurt, category, bio, hourly_rate, phone, working_hours }) });
    const data = await r.json();
    if (!r.ok) { errEl.textContent = data.error; return; }
    if (data.user) {
      currentUser = data.user;
      localStorage.setItem('mkd_user', JSON.stringify(currentUser));
      document.getElementById('auth-overlay').classList.add('hidden');
      afterLogin();
      showToast('Profiel aangemaakt!', 'success');
    } else {
      switchAuthTab('login');
      showToast('Account aangemaakt! Log nu in.', 'success');
    }
  } catch { errEl.textContent = 'Verbindingsfout.'; }
}

// ─────────────────────────────────────────
// NAV / SESSION
// ─────────────────────────────────────────

function afterLogin() {
  document.getElementById('nav-auth')?.classList.add('hidden');
  document.getElementById('nav-user')?.classList.remove('hidden');
  const av = document.getElementById('nav-avatar');
  if (av) av.textContent = ini(currentUser.name);
  const un = document.getElementById('nav-username');
  if (un) un.textContent = currentUser.name;

  // Add "Mijn Profiel" link for dienstverleners
  const dropdown = document.getElementById('user-dropdown');
  if (dropdown && currentUser.role === 'dienstverlener') {
    const existing = dropdown.querySelector('.dv-profile-link');
    if (!existing) {
      const link = document.createElement('a');
      link.className = 'dv-profile-link';
      link.innerHTML = '<span>&#128100;</span> Mijn Profiel';
      link.onclick = () => { showProviderProfile(currentUser.id); toggleUserMenu(); };
      dropdown.insertBefore(link, dropdown.firstChild);
    }
  }
}

function toggleUserMenu() {
  document.getElementById('user-dropdown')?.classList.toggle('hidden');
}
window.toggleUserMenu = toggleUserMenu;

function toggleMobileMenu() {
  document.getElementById('mobile-menu')?.classList.toggle('hidden');
}
window.toggleMobileMenu = toggleMobileMenu;

function showFavorites() {
  showView('favorites');
}
window.showFavorites = showFavorites;

function logout() {
  currentUser = null;
  localStorage.removeItem('mkd_user');
  document.getElementById('nav-auth')?.classList.remove('hidden');
  document.getElementById('nav-user')?.classList.add('hidden');
  document.getElementById('user-dropdown')?.classList.add('hidden');
  showView('home');
  showToast('Uitgelogd.', 'info');
}
window.logout = logout;

// ─────────────────────────────────────────
// VIEWS
// ─────────────────────────────────────────

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById('view-' + name);
  if (target) { target.classList.add('active'); window.scrollTo({ top: 0, behavior: 'smooth' }); }

  if (name === 'browse')    loadWorkers();
  if (name === 'favorites') renderFavoritesView();
  if (name === 'dashboard') renderDashboard();

  setTimeout(setupReveal, 50);
}
window.showView = showView;

// ─────────────────────────────────────────
// HOME
// ─────────────────────────────────────────

async function loadHomeData() {
  try {
    const [workersRes, catsRes] = await Promise.all([
      fetch(API + '/dienstverleners'),
      fetch(API + '/categories'),
    ]);
    allWorkers = await workersRes.json();

    const grid = document.getElementById('top-providers-grid');
    if (grid) grid.innerHTML = allWorkers.slice(0, 6).map((w, i) => providerCard(w, i + 1)).join('');

    const cats = catsRes.ok ? await catsRes.json() : [];
    renderCategoryGrid(cats);

    setTimeout(setupReveal, 80);
  } catch (e) { console.error('Home data:', e); }
}

const CAT_ICONS = {
  'Schilders': '🖌️', 'Elektriciens': '⚡', 'Hoveniers': '🌿',
  'Bank- & Mattenreiniging': '🛋️', 'Fotografie': '📷', 'Video & Animatie': '🎬',
  'Muziek & Audio': '🎵', 'Coaching & Training': '🎯', 'Schoonheid & Wellness': '💆',
  'Evenementen': '🎉', 'Grafisch Ontwerp': '🎨', 'Bouw & Constructie': '🏗️', 'Overig': '🔧',
};

// Maps category name → CSS class suffix used in style.css
const CAT_CSS = {
  'Schilders':               'schilders',
  'Elektriciens':            'elektriciens',
  'Hoveniers':               'hoveniers',
  'Bank- & Mattenreiniging': 'bank-mattenreiniging',
  'Fotografie':              'fotografie',
  'Video & Animatie':        'video-animatie',
  'Muziek & Audio':          'muziek-audio',
  'Coaching & Training':     'coaching-training',
  'Schoonheid & Wellness':   'schoonheid-wellness',
  'Evenementen':             'evenementen',
  'Grafisch Ontwerp':        'grafisch-ontwerp',
  'Bouw & Constructie':      'bouw-constructie',
};

function renderCategoryGrid(cats) {
  const grid = document.getElementById('categories-grid');
  if (!grid) return;

  // Merge API data with known CSS classes; fill in missing categories from CAT_CSS
  const apiMap = {};
  cats.forEach(c => { apiMap[c.category] = c; });

  const allCats = Object.keys(CAT_CSS).map(name => ({
    name,
    provider_count: apiMap[name]?.provider_count || 0,
    booking_count:  apiMap[name]?.booking_count  || 0,
  }));

  // Sort: categories with most bookings first
  allCats.sort((a, b) => b.booking_count - a.booking_count);

  grid.innerHTML = allCats.map(c => {
    const cls   = CAT_CSS[c.name] || '';
    const count = c.provider_count;
    const icon = CAT_ICONS[c.name] || '🔧';
    return '<div class="cat-card card-' + cls + ' reveal" onclick="browseByCategory(\'' + esc(c.name) + '\')" tabindex="0">' +
      '<div class="cat-icon">' + icon + '</div>' +
      '<div class="cat-name">' + esc(c.name) + '</div>' +
      '<div class="cat-count">' + count + ' dienstverlener' + (count !== 1 ? 's' : '') + '</div>' +
    '</div>';
  }).join('');
}

// ─────────────────────────────────────────
// BROWSE
// ─────────────────────────────────────────

async function loadWorkers() {
  try {
    const r = await fetch(API + '/dienstverleners');
    allWorkers = await r.json();
    buildSidebarCats();
    applyFilters();
  } catch (e) { console.error('Load workers:', e); }
}

function applyFilters() {
  const search   = (document.getElementById('browse-search')?.value || '').toLowerCase();
  const district = document.getElementById('filter-district')?.value || '';
  const sort     = document.getElementById('filter-sort')?.value || '';

  let filtered = allWorkers.filter(w => {
    const matchSearch   = !search   || w.name.toLowerCase().includes(search) || (w.category || '').toLowerCase().includes(search) || (w.bio || '').toLowerCase().includes(search);
    const matchDistrict = !district || w.buurt === district;
    const matchCat      = !activeCat || w.category === activeCat;
    return matchSearch && matchDistrict && matchCat;
  });

  if (sort === 'price-asc')  filtered.sort((a, b) => (a.hourly_rate || 0) - (b.hourly_rate || 0));
  if (sort === 'price-desc') filtered.sort((a, b) => (b.hourly_rate || 0) - (a.hourly_rate || 0));
  if (sort === 'name')       filtered.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === 'score')      filtered.sort((a, b) => (b.avg_score || 0) - (a.avg_score || 0));
  if (sort === 'reviews')    filtered.sort((a, b) => (b.review_count || 0) - (a.review_count || 0));

  const grid  = document.getElementById('browse-grid');
  const empty = document.getElementById('browse-empty');
  const count = document.getElementById('results-count');

  if (count) count.textContent = filtered.length + ' resultaten';

  if (filtered.length === 0) {
    if (grid)  grid.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
  } else {
    if (empty) empty.classList.add('hidden');
    if (grid)  grid.innerHTML = filtered.map((w, i) => providerCard(w, i + 1)).join('');
    setTimeout(setupReveal, 50);
  }
}

function buildSidebarCats() {
  const sidebar = document.getElementById('sidebar-cats');
  if (!sidebar) return;
  const cats = [...new Set(allWorkers.map(w => w.category).filter(Boolean))];
  sidebar.innerHTML =
    '<div class="sidebar-cat-item' + (!activeCat ? ' active' : '') + '" onclick="setSidebarCat(null,this)">Alle categorieen</div>' +
    cats.map(c => '<div class="sidebar-cat-item' + (activeCat === c ? ' active' : '') + '" onclick="setSidebarCat(\'' + esc(c) + '\',this)">' + esc(c) + '</div>').join('');
}

function setSidebarCat(cat, el) {
  activeCat = cat;
  document.querySelectorAll('.sidebar-cat-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
  applyFilters();
}
window.setSidebarCat = setSidebarCat;

function resetFilters() {
  const search = document.getElementById('browse-search');
  const district = document.getElementById('filter-district');
  const sort = document.getElementById('filter-sort');
  if (search) search.value = '';
  if (district) district.value = '';
  if (sort) sort.value = '';
  activeCat = null;
  document.querySelectorAll('.sidebar-cat-item').forEach(i => i.classList.remove('active'));
  applyFilters();
}
window.resetFilters = resetFilters;

function browseByCategory(cat) {
  activeCat = cat;
  showView('browse');
}
window.browseByCategory = browseByCategory;

function browseByDistrict(dist) {
  showView('browse');
  setTimeout(() => {
    const sel = document.getElementById('filter-district');
    if (sel) { sel.value = dist; applyFilters(); }
  }, 100);
}
window.browseByDistrict = browseByDistrict;

function buildDistrictFilters() {
  const opts = distOpts('');
  // filter-district is in the browse view; su/pv-district are auth form selects
  ['filter-district', 'su-district', 'pv-district'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts;
  });
}

// Hero search (if hero has search fields)
function heroSearch() {
  const q    = document.getElementById('hero-search')?.value || '';
  const dist = document.getElementById('hero-district')?.value || '';
  showView('browse');
  setTimeout(() => {
    const bs = document.getElementById('browse-search');
    const fd = document.getElementById('filter-district');
    if (bs) { bs.value = q; }
    if (fd) { fd.value = dist; }
    applyFilters();
  }, 80);
}
window.heroSearch = heroSearch;

// ─────────────────────────────────────────
// PROVIDER CARD
// ─────────────────────────────────────────

function providerCard(w, rank) {
  const favs  = getFavs();
  const isFav = favs.includes(w.id);
  const price     = w.hourly_rate ? 'SRD ' + w.hourly_rate + '/u' : '';
  const rankBadge = rank && rank <= 3 ? '<span class="rank-badge">#' + rank + '</span>' : '';
  const score     = w.avg_score ? '<span class="meta-score">&#9733; ' + w.avg_score + '</span>' : '';

  return '<div class="provider-card reveal" onclick="showProviderProfile(' + w.id + ')" tabindex="0">' +
    '<div class="provider-card-top">' +
    rankBadge +
    '<div class="provider-avatar">' + ini(w.name) + '</div>' +
    '</div>' +
    '<div class="provider-card-body">' +
    '<div class="provider-name">' + esc(w.name) + '</div>' +
    '<div class="provider-tagline">' + esc(w.bio || '') + '</div>' +
    '<div class="provider-meta">' +
    (w.category ? '<span class="meta-chip">' + esc(w.category) + '</span>' : '') +
    (w.buurt    ? '<span class="meta-chip">' + esc(w.buurt)    + '</span>' : '') +
    score +
    '</div>' +
    (price ? '<div class="provider-price">' + price + '</div>' : '') +
    '<div class="provider-card-actions">' +
    '<button class="btn-view-profile" onclick="event.stopPropagation();showProviderProfile(' + w.id + ')">Bekijk profiel</button>' +
    '<button class="btn-fav' + (isFav ? ' active' : '') + '" onclick="event.stopPropagation();toggleFav(' + w.id + ',this)" title="Favoriet">' +
    (isFav ? '&#10084;' : '&#9825;') +
    '</button>' +
    '</div>' +
    '</div>' +
    '</div>';
}

// ─────────────────────────────────────────
// FAVORITES
// ─────────────────────────────────────────

function getFavs() { return JSON.parse(localStorage.getItem('mkd_fav') || '[]'); }

function toggleFav(id, btn) {
  let favs = getFavs();
  const isProfile = btn && btn.classList.contains('btn-fav-profile');
  if (favs.includes(id)) {
    favs = favs.filter(f => f !== id);
    if (btn) {
      btn.classList.remove('active');
      btn.innerHTML = isProfile ? '&#9825; Opslaan' : '&#9825;';
    }
    showToast('Verwijderd uit favorieten.', 'info');
  } else {
    favs.push(id);
    if (btn) {
      btn.classList.add('active');
      btn.innerHTML = isProfile ? '&#10084; Favoriet' : '&#10084;';
    }
    showToast('Toegevoegd aan favorieten!', 'success');
  }
  localStorage.setItem('mkd_fav', JSON.stringify(favs));
}
window.toggleFav = toggleFav;

function renderFavoritesView() {
  const el = document.getElementById('favorites-content');
  if (!el) return;
  const favs  = getFavs();
  if (favs.length === 0) {
    el.innerHTML = '<div class="favorites-empty"><div class="favorites-empty-icon">&#9825;</div><p>Je hebt nog geen favorieten opgeslagen.</p></div>';
    return;
  }
  const faved = allWorkers.filter(w => favs.includes(w.id));
  if (faved.length === 0) {
    fetch(API + '/dienstverleners')
      .then(r => r.json())
      .then(ws => {
        allWorkers = ws;
        const f2 = ws.filter(w => favs.includes(w.id));
        el.innerHTML = f2.length
          ? f2.map(w => providerCard(w, 0)).join('')
          : '<div class="favorites-empty"><div class="favorites-empty-icon">&#9825;</div><p>Geen favorieten gevonden.</p></div>';
        setTimeout(setupReveal, 50);
      });
  } else {
    el.innerHTML = faved.map(w => providerCard(w, 0)).join('');
    setTimeout(setupReveal, 50);
  }
}

// ─────────────────────────────────────────
// PROVIDER PROFILE
// ─────────────────────────────────────────

function showProviderProfile(id) {
  const w = allWorkers.find(x => x.id === id);
  if (!w) {
    fetch(API + '/dienstverleners')
      .then(r => r.json())
      .then(ws => { allWorkers = ws; _renderProfile(ws.find(x => x.id === id)); });
    return;
  }
  _renderProfile(w);
}
window.showProviderProfile = showProviderProfile;

function _renderProfile(w) {
  if (!w) return;
  const el = document.getElementById('profile-content');
  if (!el) return;

  const favs  = getFavs();
  const isFav = favs.includes(w.id);
  const price = w.hourly_rate ? 'SRD ' + w.hourly_rate + ' / uur' : 'Prijs op aanvraag';
  const canBook = currentUser && currentUser.role === 'klant';

  el.innerHTML =
    '<div class="profile-header-bg">' +
      '<div class="profile-header-inner">' +
        '<button class="profile-back" onclick="showView(\'browse\')">&#8592; Terug</button>' +
        '<div class="profile-top">' +
          '<div class="profile-avatar-lg">' + ini(w.name) + '</div>' +
          '<div class="profile-header-info">' +
            '<h2>' + esc(w.name) + '</h2>' +
            (w.category ? '<div class="profile-cat">' + esc(w.category) + '</div>' : '') +
            (w.buurt    ? '<div class="profile-district">' + esc(w.buurt)    + '</div>' : '') +
          '</div>' +
          '<div class="profile-header-side">' +
            '<div class="profile-price">' + price + '</div>' +
            '<div class="profile-action-btns">' +
              (canBook ? '<button class="btn-contact" onclick="openBookingModal(' + w.id + ',\'' + esc(w.name) + '\')">Boek nu</button>' : '') +
              '<button class="btn-fav-profile' + (isFav ? ' active' : '') + '" onclick="toggleFav(' + w.id + ',this)">' +
              (isFav ? '&#10084; Favoriet' : '&#9825; Opslaan') + '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="profile-body">' +
      '<div class="profile-section">' +
        '<div class="profile-section-title">Over mij</div>' +
        '<div class="profile-description">' + esc(w.bio || 'Geen beschrijving beschikbaar.') + '</div>' +
      '</div>' +
      (currentUser && currentUser.role === 'klant'
        ? '<div class="profile-section">' +
            '<div class="profile-section-title">Review plaatsen</div>' +
            '<button class="btn-contact" onclick="openReviewModal(' + w.id + ')">Review schrijven</button>' +
          '</div>'
        : '') +
      '<div class="profile-section" id="reviews-section">' +
        '<div class="profile-section-title">Beoordelingen</div>' +
        '<div id="reviews-list"><p>Beoordelingen laden...</p></div>' +
      '</div>' +
    '</div>';

  showView('profile');
  _loadReviews(w.id);
}

async function _loadReviews(providerId) {
  const container = document.getElementById('reviews-list');
  if (!container) return;
  try {
    const r = await fetch(API + '/reviews/' + providerId);
    const reviews = await r.json();
    if (!reviews.length) {
      container.innerHTML = '<p>Nog geen beoordelingen.</p>';
      return;
    }
    container.innerHTML = reviews.map(rv =>
      '<div class="review-item">' +
        '<div class="review-header">' +
          '<strong>' + esc(rv.reviewer_name || 'Anoniem') + '</strong>' +
          '<span class="review-score">' + rv.score + '/10</span>' +
        '</div>' +
        '<p>' + esc(rv.text) + '</p>' +
      '</div>'
    ).join('');
  } catch {
    container.innerHTML = '<p>Kon beoordelingen niet laden.</p>';
  }
}

// ─────────────────────────────────────────
// BOOKING MODAL (created dynamically)
// ─────────────────────────────────────────

function openBookingModal(workerId, workerName) {
  if (!currentUser) { openAuthModal('login'); return; }
  if (!bookingModalEl) _createBookingModal();

  document.getElementById('bk-worker-name').textContent = workerName;
  bookingModalEl.dataset.workerId   = workerId;
  bookingModalEl.dataset.workerName = workerName;
  document.getElementById('bk-error').textContent = '';
  document.getElementById('bk-overlay').classList.remove('hidden');
}
window.openBookingModal = openBookingModal;

function _createBookingModal() {
  const overlay = document.createElement('div');
  overlay.id        = 'bk-overlay';
  overlay.className = 'overlay hidden';
  overlay.innerHTML =
    '<div class="modal" id="bk-modal">' +
      '<button class="modal-x" id="bk-close">&#10005;</button>' +
      '<h3>Boeking bij <span id="bk-worker-name"></span></h3>' +
      '<div class="form-group"><label>Datum</label><input type="date" id="bk-date"></div>' +
      '<div class="form-group"><label>Tijd</label><input type="time" id="bk-time"></div>' +
      '<div class="form-group"><label>Duur (minuten)</label><input type="number" id="bk-dur" value="60" min="30" step="30"></div>' +
      '<div class="form-group"><label>Bericht (optioneel)</label><textarea id="bk-msg" rows="3"></textarea></div>' +
      '<div class="form-error" id="bk-error"></div>' +
      '<button class="btn-primary btn-full" id="bk-submit">Verstuur aanvraag</button>' +
    '</div>';
  document.body.appendChild(overlay);
  bookingModalEl = document.getElementById('bk-modal');

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.add('hidden'); });
  document.getElementById('bk-close').addEventListener('click', () => overlay.classList.add('hidden'));
  document.getElementById('bk-submit').addEventListener('click', submitBooking);
}

async function submitBooking() {
  const workerId         = bookingModalEl.dataset.workerId;
  const date             = document.getElementById('bk-date').value;
  const time             = document.getElementById('bk-time').value;
  const duration_minutes = parseInt(document.getElementById('bk-dur').value) || 60;
  const message          = document.getElementById('bk-msg').value.trim();
  const errEl            = document.getElementById('bk-error');

  if (!date) { errEl.textContent = 'Kies een datum.'; return; }
  if (new Date(date) < new Date(new Date().toDateString())) { errEl.textContent = 'Kies een datum in de toekomst.'; return; }

  try {
    const r = await fetch(API + '/bookings', {
      method: 'POST', headers: ct(),
      body: JSON.stringify({ klant_id: currentUser.id, dienstverlener_id: parseInt(workerId), date, time, duration_minutes, message }),
    });
    const data = await r.json();
    if (!r.ok) { errEl.textContent = data.error; return; }
    document.getElementById('bk-overlay').classList.add('hidden');
    showToast('Boeking aangevraagd!', 'success');
  } catch { errEl.textContent = 'Verbindingsfout.'; }
}

// ─────────────────────────────────────────
// REVIEW MODAL
// ─────────────────────────────────────────

function openReviewModal(providerId) {
  if (!currentUser) { openAuthModal('login'); return; }
  document.getElementById('review-target-id').value = providerId;
  document.getElementById('review-text').value      = '';
  document.getElementById('review-error').textContent = '';
  updateSlider(5);
  document.getElementById('review-overlay').classList.remove('hidden');
}
window.openReviewModal = openReviewModal;

function closeReviewModal(e) {
  if (e.target === document.getElementById('review-overlay')) {
    document.getElementById('review-overlay').classList.add('hidden');
  }
}

function updateSlider(val) {
  const slider  = document.getElementById('star-selector');
  const hidden  = document.getElementById('review-rating');
  const display = document.getElementById('review-rating-display');
  if (slider)  slider.value       = val;
  if (hidden)  hidden.value       = val;
  if (display) display.textContent = val + '/10';
}

async function submitReview() {
  if (submitReview._running) return;
  submitReview._running = true;
  setTimeout(() => { submitReview._running = false; }, 2000);
  const targetId = document.getElementById('review-target-id').value;
  const score    = document.getElementById('review-rating').value;
  const text     = document.getElementById('review-text').value.trim();
  const errEl    = document.getElementById('review-error');

  if (!text) { errEl.textContent = 'Schrijf een review.'; return; }

  try {
    const r = await fetch(API + '/reviews', {
      method: 'POST', headers: ct(),
      body: JSON.stringify({ reviewer_id: currentUser.id, provider_id: parseInt(targetId), score: parseInt(score), text }),
    });
    const data = await r.json();
    if (!r.ok) { errEl.textContent = data.error; return; }
    document.getElementById('review-overlay').classList.add('hidden');
    showToast('Review geplaatst!', 'success');
  } catch { errEl.textContent = 'Verbindingsfout.'; }
  submitReview._running = false;
}
window.submitReview = submitReview;

// ─────────────────────────────────────────
// NOTIFICATIONS POLL
// ─────────────────────────────────────────

async function pollNotifications() {
  if (!currentUser) return;
  try {
    const r      = await fetch(API + '/notifications/' + currentUser.id);
    const notifs = await r.json();
    const unread = notifs.filter(n => !n.is_read).length;
    const badge  = document.getElementById('notif-badge');
    const badge2 = document.getElementById('dropdown-notif-badge');
    if (badge)  { badge.textContent  = unread; badge.classList.toggle('hidden',  unread === 0); }
    if (badge2) { badge2.textContent = unread; badge2.classList.toggle('hidden', unread === 0); }
  } catch { /* silent */ }
}

// ─────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────

function renderDashboard() {
  if (!currentUser) { showView('home'); openAuthModal('login'); return; }
  const el = document.getElementById('dashboard-content');
  if (!el) return;
  currentUser.role === 'dienstverlener' ? renderDVDash(el) : renderKlantDash(el);
}

// ── Dienstverlener ────────────────────────

function renderDVDash(el) {
  el.innerHTML =
    '<div class="dashboard-grid">' +
      '<aside class="dashboard-sidebar">' +
        '<div class="dash-card">' +
          '<div class="dash-avatar">' + ini(currentUser.name) + '</div>' +
          '<div class="dash-name">'   + esc(currentUser.name) + '</div>' +
          '<div class="dash-role-tag">Dienstverlener</div>' +
        '</div>' +
        '<nav>' +
          '<div class="dash-menu-item active" onclick="dvTab(\'overzicht\',this)">Overzicht</div>' +
          '<div class="dash-menu-item" onclick="dvTab(\'boekingen\',this)">Boekingen</div>' +
          '<div class="dash-menu-item" onclick="dvTab(\'agenda\',this)">Agenda</div>' +
          '<div class="dash-menu-item" onclick="dvTab(\'notificaties\',this)">Notificaties</div>' +
          '<div class="dash-menu-item" onclick="dvTab(\'profiel\',this)">Profiel bewerken</div>' +
          '<div class="dash-menu-item" onclick="dvTab(\'account\',this)">Account</div>' +
        '</nav>' +
      '</aside>' +
      '<div class="dashboard-panel">' +
        _dvOverzicht() + _dvBoekingen() + _dvAgenda() + _dvNotifs() + _dvProfiel() + _dvAccount() +
      '</div>' +
    '</div>';

  loadBookingsDV();
  loadDVNotifications();
  renderCalendar();
}

function dvTab(panel, el) {
  document.querySelectorAll('#dashboard-content .dash-menu-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('#dashboard-content .dash-panel').forEach(p => p.classList.add('hidden'));
  const target = document.getElementById('dv-p-' + panel);
  if (target) target.classList.remove('hidden');
  if (panel === 'boekingen')    loadBookingsDV();
  if (panel === 'agenda')       renderCalendar();
  if (panel === 'notificaties') loadDVNotifications();
}
window.dvTab = dvTab;

function _dvOverzicht() {
  return '<div class="dash-panel" id="dv-p-overzicht">' +
    '<div class="dashboard-panel-title">Welkom, ' + esc(currentUser.name) + '</div>' +
    '<div class="dash-stat-row">' +
      '<div class="dash-card">Categorie<br><strong>' + esc(currentUser.category || '-') + '</strong></div>' +
      '<div class="dash-card">Buurt<br><strong>'     + esc(currentUser.buurt    || '-') + '</strong></div>' +
      '<div class="dash-card">Tarief<br><strong>'    + (currentUser.hourly_rate ? 'SRD ' + currentUser.hourly_rate + '/u' : '-') + '</strong></div>' +
    '</div>' +
  '</div>';
}

function _dvBoekingen() {
  return '<div class="dash-panel hidden" id="dv-p-boekingen">' +
    '<div class="dashboard-panel-title">Boekingen</div>' +
    '<div id="dv-bk-list"><p>Laden...</p></div>' +
  '</div>';
}

function _dvAgenda() {
  return '<div class="dash-panel hidden" id="dv-p-agenda">' +
    '<div class="dashboard-panel-title">Agenda</div>' +
    '<div class="cal-nav">' +
      '<button onclick="calPrev()">&#8249;</button>' +
      '<span id="cal-label"></span>' +
      '<button onclick="calNext()">&#8250;</button>' +
    '</div>' +
    '<div class="cal-grid-header">' +
      ['Ma','Di','Wo','Do','Vr','Za','Zo'].map(d => '<div class="cal-day-label">' + d + '</div>').join('') +
    '</div>' +
    '<div class="cal-grid" id="cal-grid"></div>' +
  '</div>';
}

function _dvNotifs() {
  return '<div class="dash-panel hidden" id="dv-p-notificaties">' +
    '<div class="dashboard-panel-title">Notificaties</div>' +
    '<div id="dv-notif-list"><p>Laden...</p></div>' +
  '</div>';
}

function _dvProfiel() {
  return '<div class="dash-panel hidden" id="dv-p-profiel">' +
    '<div class="dashboard-panel-title">Profiel bewerken</div>' +
    '<div class="form-group"><label>Naam</label><input type="text" id="dv-name" value="' + esc(currentUser.name) + '"></div>' +
    '<div class="form-group"><label>Categorie</label><input type="text" id="dv-cat" value="' + esc(currentUser.category || '') + '"></div>' +
    '<div class="form-group"><label>Ervaring</label><input type="text" id="dv-exp" value="' + esc(currentUser.experience || '') + '"></div>' +
    '<div class="form-group"><label>Bio</label><textarea id="dv-bio" rows="4">' + esc(currentUser.bio || '') + '</textarea></div>' +
    '<div class="form-group"><label>Uurtarief (SRD)</label><input type="number" id="dv-rate" value="' + (currentUser.hourly_rate || '') + '"></div>' +
    '<div class="form-group"><label>Telefoon</label><input type="tel" id="dv-phone" value="' + esc(currentUser.phone || '') + '" placeholder="+597 ..."></div>' +
    '<div class="form-group"><label>Werktijden</label><input type="text" id="dv-hours" value="' + esc(currentUser.working_hours || '') + '" placeholder="bijv. Ma–Vr 08:00–17:00"></div>' +
    '<div class="form-group"><label>Buurt</label><select id="dv-buurt">' + distOpts(currentUser.buurt) + '</select></div>' +
    '<button class="btn-primary" onclick="saveProfile()">Opslaan</button>' +
    '<div class="form-error" id="dv-prof-msg"></div>' +
  '</div>';
}

function _dvAccount() {
  return '<div class="dash-panel hidden" id="dv-p-account">' +
    '<div class="dashboard-panel-title">Account instellingen</div>' +
    '<div class="form-group"><label>Nieuw e-mailadres</label><input type="email" id="dv-new-email" placeholder="' + esc(currentUser.email) + '"></div>' +
    '<div class="form-group"><label>Huidig wachtwoord</label><input type="password" id="dv-cur-pw"></div>' +
    '<div class="form-group"><label>Nieuw wachtwoord</label><input type="password" id="dv-new-pw"></div>' +
    '<button class="btn-primary" onclick="saveAccountDV()">Opslaan</button>' +
    '<div class="form-error" id="dv-acc-msg"></div>' +
  '</div>';
}

// ── Klant ─────────────────────────────────

function renderKlantDash(el) {
  el.innerHTML =
    '<div class="dashboard-grid">' +
      '<aside class="dashboard-sidebar">' +
        '<div class="dash-card">' +
          '<div class="dash-avatar">' + ini(currentUser.name) + '</div>' +
          '<div class="dash-name">'   + esc(currentUser.name) + '</div>' +
          '<div class="dash-role-tag">Klant</div>' +
        '</div>' +
        '<nav>' +
          '<div class="dash-menu-item active" onclick="klantTab(\'overzicht\',this)">Overzicht</div>' +
          '<div class="dash-menu-item" onclick="klantTab(\'boekingen\',this)">Mijn boekingen</div>' +
          '<div class="dash-menu-item" onclick="klantTab(\'notificaties\',this)">Notificaties</div>' +
          '<div class="dash-menu-item" onclick="klantTab(\'account\',this)">Account</div>' +
        '</nav>' +
      '</aside>' +
      '<div class="dashboard-panel">' +
        _klantOverzicht() + _klantBoekingen() + _klantNotifs() + _klantAccount() +
      '</div>' +
    '</div>';

  loadKlantBookings();
  loadKlantNotifications();
}

function klantTab(panel, el) {
  document.querySelectorAll('#dashboard-content .dash-menu-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('#dashboard-content .dash-panel').forEach(p => p.classList.add('hidden'));
  const target = document.getElementById('kl-p-' + panel);
  if (target) target.classList.remove('hidden');
  if (panel === 'boekingen')    loadKlantBookings();
  if (panel === 'notificaties') loadKlantNotifications();
}
window.klantTab = klantTab;

function _klantOverzicht() {
  return '<div class="dash-panel" id="kl-p-overzicht">' +
    '<div class="dashboard-panel-title">Welkom, ' + esc(currentUser.name) + '</div>' +
    '<div class="dash-stat-row">' +
      '<div class="dash-card">Buurt<br><strong>' + esc(currentUser.buurt || '-') + '</strong></div>' +
    '</div>' +
  '</div>';
}

function _klantBoekingen() {
  return '<div class="dash-panel hidden" id="kl-p-boekingen">' +
    '<div class="dashboard-panel-title">Mijn boekingen</div>' +
    '<div id="kl-bk-list"><p>Laden...</p></div>' +
  '</div>';
}

function _klantNotifs() {
  return '<div class="dash-panel hidden" id="kl-p-notificaties">' +
    '<div class="dashboard-panel-title">Notificaties</div>' +
    '<div id="kl-notif-list"><p>Laden...</p></div>' +
  '</div>';
}

function _klantAccount() {
  return '<div class="dash-panel hidden" id="kl-p-account">' +
    '<div class="dashboard-panel-title">Account instellingen</div>' +
    '<div class="form-group"><label>Nieuw e-mailadres</label><input type="email" id="kl-new-email" placeholder="' + esc(currentUser.email) + '"></div>' +
    '<div class="form-group"><label>Buurt</label><select id="kl-buurt">' + distOpts(currentUser.buurt) + '</select></div>' +
    '<div class="form-group"><label>Huidig wachtwoord</label><input type="password" id="kl-cur-pw"></div>' +
    '<div class="form-group"><label>Nieuw wachtwoord</label><input type="password" id="kl-new-pw"></div>' +
    '<button class="btn-primary" onclick="saveAccountKlant()">Opslaan</button>' +
    '<div class="form-error" id="kl-acc-msg"></div>' +
  '</div>';
}

// ─────────────────────────────────────────
// BOOKINGS
// ─────────────────────────────────────────

async function loadBookingsDV() {
  const el = document.getElementById('dv-bk-list');
  if (!el) return;
  try {
    const r = await fetch(API + '/bookings/' + currentUser.id);
    const bookings = await r.json();
    calBookings = bookings;

    if (!bookings.length) { el.innerHTML = '<p class="empty-plain">Geen boekingen.</p>'; return; }

    el.innerHTML = bookings.map(b =>
      '<div class="booking-item">' +
        '<div class="booking-info">' +
          '<strong>' + esc(b.klant_name) + '</strong>' +
          '<div>' + b.date + (b.time ? ' om ' + b.time : '') + (b.duration_minutes ? ' (' + fmtDur(b.duration_minutes) + ')' : '') + '</div>' +
          (b.message ? '<div class="booking-msg">"' + esc(b.message) + '"</div>' : '') +
        '</div>' +
        '<div class="booking-right">' +
          statusBadge(b.status) +
          (b.status === 'pending'
            ? '<div class="booking-actions">' +
                '<button class="btn-ok" onclick="respondBooking(' + b.id + ',\'accepted\',' + b.klant_id + ')">Accepteren</button>' +
                '<button class="btn-no" onclick="respondBooking(' + b.id + ',\'declined\',' + b.klant_id + ')">Weigeren</button>' +
              '</div>'
            : '') +
        '</div>' +
      '</div>'
    ).join('');
  } catch { el.innerHTML = '<p>Fout bij laden boekingen.</p>'; }
}

async function respondBooking(bookingId, status, klantId) {
  try {
    const r = await fetch(API + '/bookings/' + bookingId, {
      method: 'PUT', headers: ct(),
      body: JSON.stringify({ status, klant_id: klantId, dienstverlener_name: currentUser.name }),
    });
    if (!r.ok) throw new Error();
    showToast(status === 'accepted' ? 'Boeking geaccepteerd!' : 'Boeking geweigerd.', 'info');
    loadBookingsDV();
    pollNotifications();
  } catch { showToast('Fout bij bijwerken.', 'error'); }
}
window.respondBooking = respondBooking;

async function loadKlantBookings() {
  const el = document.getElementById('kl-bk-list');
  if (!el) return;
  try {
    const r = await fetch(API + '/my-bookings/' + currentUser.id);
    const bookings = await r.json();

    if (!bookings.length) { el.innerHTML = '<p class="empty-plain">Geen boekingen.</p>'; return; }

    el.innerHTML = bookings.map(b =>
      '<div class="booking-item">' +
        '<div class="booking-info">' +
          '<strong>' + esc(b.dienstverlener_name) + '</strong>' +
          '<div>' + b.date + (b.time ? ' om ' + b.time : '') + '</div>' +
          (b.message ? '<div class="booking-msg">"' + esc(b.message) + '"</div>' : '') +
        '</div>' +
        '<div class="booking-right">' + statusBadge(b.status) + '</div>' +
      '</div>'
    ).join('');
  } catch { el.innerHTML = '<p>Fout bij laden boekingen.</p>'; }
}

// ─────────────────────────────────────────
// NOTIFICATIONS (dashboard)
// ─────────────────────────────────────────

async function loadDVNotifications() {
  const el = document.getElementById('dv-notif-list');
  if (el) await _renderNotifList(el);
}

async function loadKlantNotifications() {
  const el = document.getElementById('kl-notif-list');
  if (el) await _renderNotifList(el);
}

async function _renderNotifList(el) {
  try {
    const r      = await fetch(API + '/notifications/' + currentUser.id);
    const notifs = await r.json();
    await fetch(API + '/notifications/' + currentUser.id + '/read', { method: 'PUT' });
    pollNotifications();

    if (!notifs.length) { el.innerHTML = '<p class="empty-plain">Geen notificaties.</p>'; return; }

    el.innerHTML = notifs.map(n =>
      '<div class="notif-item' + (n.is_read ? '' : ' notif-unread') + '">' +
        '<div>' + esc(n.message) + '</div>' +
        '<small>' + new Date(n.created_at).toLocaleDateString('nl-NL') + '</small>' +
      '</div>'
    ).join('');
  } catch { el.innerHTML = '<p>Fout bij laden notificaties.</p>'; }
}

// ─────────────────────────────────────────
// CALENDAR
// ─────────────────────────────────────────

function calPrev() { calMonth--; if (calMonth < 0)  { calMonth = 11; calYear--; } renderCalendar(); }
function calNext() { calMonth++; if (calMonth > 11) { calMonth = 0;  calYear++; } renderCalendar(); }
window.calPrev = calPrev;
window.calNext = calNext;

async function renderCalendar() {
  const grid  = document.getElementById('cal-grid');
  const label = document.getElementById('cal-label');
  if (!grid) return;

  if (label) label.textContent = new Date(calYear, calMonth, 1).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });

  if (!calBookings.length) {
    try {
      const r = await fetch(API + '/bookings/' + currentUser.id);
      calBookings = await r.json();
    } catch { /* silent */ }
  }

  const firstDay = new Date(calYear, calMonth, 1);
  const lastDay  = new Date(calYear, calMonth + 1, 0);
  const today    = new Date();
  let startDow   = (firstDay.getDay() + 6) % 7; // Mon=0

  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  grid.innerHTML = cells.map(d => {
    if (!d) return '<div class="cal-day cal-other"></div>';
    const dateStr   = calYear + '-' + String(calMonth + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    const isToday   = today.getFullYear() === calYear && today.getMonth() === calMonth && today.getDate() === d;
    const dayBk     = calBookings.filter(b => b.date && b.date.startsWith(dateStr));
    return '<div class="cal-day' + (isToday ? ' cal-today' : '') + '">' +
      '<div class="cal-day-num">' + d + '</div>' +
      dayBk.map(b => '<div class="cal-event">' + esc(b.klant_name || '') + '</div>').join('') +
    '</div>';
  }).join('');
}

// ─────────────────────────────────────────
// PROFILE / ACCOUNT SAVE
// ─────────────────────────────────────────

async function saveProfile() {
  const name          = document.getElementById('dv-name').value.trim();
  const category      = document.getElementById('dv-cat').value.trim();
  const experience    = document.getElementById('dv-exp').value.trim();
  const bio           = document.getElementById('dv-bio').value.trim();
  const hourly_rate   = document.getElementById('dv-rate').value;
  const buurt         = document.getElementById('dv-buurt').value;
  const phone         = document.getElementById('dv-phone').value.trim();
  const working_hours = document.getElementById('dv-hours').value.trim();
  const msgEl         = document.getElementById('dv-prof-msg');

  try {
    const r = await fetch(API + '/profile/' + currentUser.id, {
      method: 'PUT', headers: ct(),
      body: JSON.stringify({ name, category, experience, bio, hourly_rate: hourly_rate || null, buurt, phone: phone || null, working_hours: working_hours || null }),
    });
    const data = await r.json();
    if (!r.ok) { msgEl.textContent = data.error; return; }

    Object.assign(currentUser, { name, category, experience, bio, hourly_rate, buurt, phone, working_hours });
    localStorage.setItem('mkd_user', JSON.stringify(currentUser));
    msgEl.style.color = 'green';
    msgEl.textContent = 'Profiel opgeslagen!';
    if (document.getElementById('nav-username')) document.getElementById('nav-username').textContent = name;
    if (document.getElementById('nav-avatar'))   document.getElementById('nav-avatar').textContent   = ini(name);
  } catch { msgEl.textContent = 'Verbindingsfout.'; }
}
window.saveProfile = saveProfile;

function saveAccountDV() {
  _saveAccount(
    document.getElementById('dv-new-email').value.trim(),
    document.getElementById('dv-cur-pw').value,
    document.getElementById('dv-new-pw').value,
    null,
    'dv-acc-msg'
  );
}
window.saveAccountDV = saveAccountDV;

function saveAccountKlant() {
  _saveAccount(
    document.getElementById('kl-new-email').value.trim(),
    document.getElementById('kl-cur-pw').value,
    document.getElementById('kl-new-pw').value,
    document.getElementById('kl-buurt').value,
    'kl-acc-msg'
  );
}
window.saveAccountKlant = saveAccountKlant;

async function _saveAccount(newEmail, curPw, newPw, newBuurt, msgId) {
  const msgEl = document.getElementById(msgId);
  if (!curPw) { msgEl.textContent = 'Vul je huidig wachtwoord in.'; return; }

  const body = { current_password: curPw };
  if (newEmail)  body.email        = newEmail;
  if (newPw)     body.new_password = newPw;
  if (newBuurt)  body.buurt        = newBuurt;

  try {
    const r = await fetch(API + '/account/' + currentUser.id, { method: 'PUT', headers: ct(), body: JSON.stringify(body) });
    const data = await r.json();
    if (!r.ok) { msgEl.textContent = data.error; return; }
    if (newEmail)  currentUser.email = newEmail;
    if (newBuurt)  currentUser.buurt = newBuurt;
    localStorage.setItem('mkd_user', JSON.stringify(currentUser));
    msgEl.style.color = 'green';
    msgEl.textContent = 'Account bijgewerkt!';
  } catch { msgEl.textContent = 'Verbindingsfout.'; }
}

// ─────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────

let _toastTimer = null;

function showToast(msg, type) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className   = 'toast ' + (type || 'info');
  el.classList.remove('hidden');
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.classList.add('hidden'), 400);
  }, 3200);
}

// ─────────────────────────────────────────
// SCROLL REVEAL
// ─────────────────────────────────────────

let _revealObs = null;

function setupReveal() {
  const els = document.querySelectorAll('.reveal:not(.visible)');
  if (!els.length) return;
  if (!_revealObs) {
    _revealObs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); _revealObs.unobserve(e.target); } });
    }, { threshold: 0.1 });
  }
  els.forEach(el => _revealObs.observe(el));
}

// ─────────────────────────────────────────
// INJECT DASHBOARD CSS
// ─────────────────────────────────────────

function injectDashCSS() {
  const s = document.createElement('style');
  s.textContent = [
    '.dashboard-grid{display:grid;grid-template-columns:220px 1fr;gap:24px;padding:32px 24px;min-height:80vh}',
    '.dashboard-sidebar{display:flex;flex-direction:column;gap:16px}',
    '.dash-card{background:#fff;border-radius:12px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,.08)}',
    '.dash-avatar{width:56px;height:56px;border-radius:50%;background:var(--accent,#6c47ff);color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.3rem;font-weight:700;margin:0 auto 8px}',
    '.dash-name{text-align:center;font-weight:600;font-size:1rem}',
    '.dash-role-tag{text-align:center;font-size:.8rem;color:#888;margin-top:4px}',
    '.dash-menu-item{padding:10px 14px;border-radius:8px;cursor:pointer;font-size:.95rem;transition:background .2s}',
    '.dash-menu-item:hover{background:#f0ecff}',
    '.dash-menu-item.active{background:var(--accent,#6c47ff);color:#fff}',
    '.dashboard-panel{background:#fff;border-radius:12px;padding:28px;box-shadow:0 2px 12px rgba(0,0,0,.08)}',
    '.dashboard-panel-title{font-size:1.3rem;font-weight:700;margin-bottom:20px}',
    '.dash-panel.hidden{display:none}',
    '.dash-stat-row{display:flex;gap:16px;flex-wrap:wrap}',
    '.dash-stat-row .dash-card{flex:1;min-width:120px;text-align:center}',
    '.booking-item{display:flex;justify-content:space-between;align-items:flex-start;padding:14px 0;border-bottom:1px solid #f0f0f0;gap:12px}',
    '.booking-info{flex:1}',
    '.booking-msg{color:#888;font-size:.88rem;margin-top:4px;font-style:italic}',
    '.booking-right{display:flex;flex-direction:column;align-items:flex-end;gap:8px}',
    '.booking-actions{display:flex;gap:8px}',
    '.booking-badge{padding:4px 10px;border-radius:20px;font-size:.8rem;font-weight:600}',
    '.badge-pending{background:#fff3cd;color:#856404}',
    '.badge-accepted{background:#d1e7dd;color:#0f5132}',
    '.badge-declined{background:#f8d7da;color:#842029}',
    '.btn-ok{background:#198754;color:#fff;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:.85rem}',
    '.btn-no{background:#dc3545;color:#fff;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:.85rem}',
    '.cal-nav{display:flex;align-items:center;gap:16px;margin-bottom:12px}',
    '.cal-nav button{background:none;border:1px solid #ddd;border-radius:6px;padding:4px 12px;cursor:pointer;font-size:1.2rem}',
    '.cal-grid-header{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:4px}',
    '.cal-day-label{text-align:center;font-size:.78rem;font-weight:600;color:#888}',
    '.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}',
    '.cal-day{min-height:64px;border:1px solid #f0f0f0;border-radius:6px;padding:4px}',
    '.cal-other{background:#fafafa}',
    '.cal-today{border-color:var(--accent,#6c47ff);background:#f0ecff}',
    '.cal-day-num{font-size:.8rem;font-weight:600;margin-bottom:2px}',
    '.cal-event{background:var(--accent,#6c47ff);color:#fff;border-radius:4px;font-size:.7rem;padding:1px 4px;margin-bottom:2px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}',
    '.notif-item{padding:12px 0;border-bottom:1px solid #f0f0f0}',
    '.notif-unread{font-weight:600}',
    '.notif-item small{color:#aaa;font-size:.8rem}',
    '.empty-plain{color:#aaa;font-style:italic}',
    '@media(max-width:768px){.dashboard-grid{grid-template-columns:1fr}}',
    '.meta-score{background:#fff8e1;color:#b7791f;border-radius:20px;padding:2px 8px;font-size:.8rem;font-weight:600}',
    '.cat-icon{font-size:2rem;margin-bottom:8px}',
    '.btn-fav{font-size:1.1rem;background:none;border:none;cursor:pointer;padding:4px 8px;color:#e53e3e}',
  ].join('');
  document.head.appendChild(s);
}

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────

function ct()  { return { 'Content-Type': 'application/json' }; }

function ini(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0].substring(0, 2).toUpperCase();
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtDur(min) {
  if (!min) return '';
  if (min < 60) return min + ' min';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h + 'u' + (m ? m + 'min' : '');
}

function distOpts(selected) {
  const districts = ['Paramaribo','Wanica','Nickerie','Coronie','Saramacca','Commewijne','Marowijne','Para','Brokopondo','Sipaliwini'];
  return '<option value="">Kies district</option>' +
    districts.map(d => '<option value="' + d + '"' + (d === selected ? ' selected' : '') + '>' + d + '</option>').join('');
}

function statusBadge(status) {
  const map    = { pending: 'badge-pending', accepted: 'badge-accepted', declined: 'badge-declined' };
  const labels = { pending: 'In behandeling', accepted: 'Geaccepteerd', declined: 'Geweigerd' };
  return '<span class="booking-badge ' + (map[status] || 'badge-pending') + '">' + (labels[status] || status) + '</span>';
}
