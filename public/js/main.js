// MaKandra — script.js  (API-connected)
'use strict';

const API = window.API_BASE || 'http://localhost:3000';

let currentUser    = null;
let allWorkers     = [];
let activeCat      = null;
let calYear        = new Date().getFullYear();
let calMonth       = new Date().getMonth();
let calBookings    = [];
let bookingModalEl = null;
let activeChatUid  = null;
let chatPollTimer  = null;

// ─────────────────────────────────────────
// INIT
// ─────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('mkd_user');
  if (saved) { currentUser = JSON.parse(saved); afterLogin(); }

  if (localStorage.getItem('mkd_dark') === '1') {
    document.body.classList.add('dark-mode');
    const icon  = document.getElementById('dark-mode-icon');
    const label = document.getElementById('dark-mode-label');
    if (icon)  icon.textContent  = '☀️';
    if (label) label.textContent = 'Lichte modus';
  }

  injectDashCSS();
  setupReveal();
  loadHomeData();
  buildDistrictFilters();

  document.getElementById('auth-overlay')?.addEventListener('click', closeAuthModal);
  document.getElementById('tab-btn-login')?.addEventListener('click', () => switchAuthTab('login'));
  document.getElementById('tab-btn-signup')?.addEventListener('click', () => switchAuthTab('signup'));
  document.getElementById('tab-btn-provider')?.addEventListener('click', () => switchAuthTab('provider'));

  // All auth form buttons already have inline onclick= in HTML — no extra listeners needed here.

  // Password strength indicators
  ['su-password', 'pv-password'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', function () {
      const prefix = id.split('-')[0];
      const el = document.getElementById(prefix + '-pw-strength');
      if (!el) return;
      const v = this.value;
      el.className = 'pw-strength';
      if (!v) return;
      const strong = v.length >= 10 && /[A-Z]/.test(v) && /\d/.test(v);
      const medium = v.length >= 6;
      el.classList.add(strong ? 'strong' : medium ? 'medium' : 'weak');
    });
  });

  document.getElementById('browse-search')?.addEventListener('input', applyFilters);
  document.getElementById('filter-district')?.addEventListener('change', applyFilters);
  document.getElementById('filter-sort')?.addEventListener('change', applyFilters);

  document.getElementById('review-overlay')?.addEventListener('click', closeReviewModal);
  document.querySelector('#review-modal .modal-x')?.addEventListener('click', () => {
    document.getElementById('review-overlay').classList.add('hidden');
  });
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

  // Show reset password modal if URL contains ?reset_token=
  const resetToken = new URLSearchParams(window.location.search).get('reset_token');
  if (resetToken) {
    document.getElementById('reset-pw-overlay')?.classList.remove('hidden');
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
  errEl.classList.remove('hidden');

  if (!email)    { errEl.textContent = 'Voer je e-mailadres in.'; return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { errEl.textContent = 'Voer een geldig e-mailadres in.'; return; }
  if (!password) { errEl.textContent = 'Voer je wachtwoord in.'; return; }

  try {
    const r    = await fetch(API + '/login', { method: 'POST', headers: ct(), body: JSON.stringify({ email, password }) });
    const data = await r.json();
    if (!r.ok) { errEl.textContent = data.error; return; }
    errEl.classList.add('hidden');
    currentUser = data.user;
    localStorage.setItem('mkd_user', JSON.stringify(currentUser));
    document.getElementById('auth-overlay').classList.add('hidden');
    afterLogin();
    showToast('Welkom terug, ' + currentUser.name + '!', 'success');
    pollNotifications();
    setInterval(pollNotifications, 30000);
  } catch { errEl.textContent = 'Verbindingsfout. Controleer of de server actief is.'; }
}

function toggleForgotPassword() {
  const form = document.getElementById('forgot-pw-form');
  form.classList.toggle('hidden');
  if (!form.classList.contains('hidden')) document.getElementById('forgot-email').focus();
}
window.toggleForgotPassword = toggleForgotPassword;

async function handleForgotPassword() {
  const email   = document.getElementById('forgot-email').value.trim();
  const errEl   = document.getElementById('forgot-error');
  const succEl  = document.getElementById('forgot-success');
  errEl.textContent = ''; errEl.classList.add('hidden');
  succEl.textContent = ''; succEl.classList.add('hidden');

  if (!email) { errEl.textContent = 'Voer je e-mailadres in.'; errEl.classList.remove('hidden'); return; }

  try {
    const r    = await fetch(API + '/forgot-password', { method: 'POST', headers: ct(), body: JSON.stringify({ email }) });
    const data = await r.json();
    if (!r.ok) { errEl.textContent = data.error; errEl.classList.remove('hidden'); return; }
    succEl.textContent = data.message;
    succEl.classList.remove('hidden');
    document.getElementById('forgot-email').value = '';
  } catch { errEl.textContent = 'Verbindingsfout.'; errEl.classList.remove('hidden'); }
}
window.handleForgotPassword = handleForgotPassword;

async function handleResetPassword() {
  const token    = new URLSearchParams(window.location.search).get('reset_token');
  const pw       = document.getElementById('reset-pw-input').value;
  const confirm  = document.getElementById('reset-pw-confirm').value;
  const errEl    = document.getElementById('reset-pw-error');
  const succEl   = document.getElementById('reset-pw-success');
  errEl.textContent = ''; errEl.classList.add('hidden');
  succEl.textContent = ''; succEl.classList.add('hidden');

  if (!pw)           { errEl.textContent = 'Voer een wachtwoord in.'; errEl.classList.remove('hidden'); return; }
  if (pw.length < 6) { errEl.textContent = 'Minimaal 6 tekens.'; errEl.classList.remove('hidden'); return; }
  if (pw !== confirm) { errEl.textContent = 'Wachtwoorden komen niet overeen.'; errEl.classList.remove('hidden'); return; }

  try {
    const r    = await fetch(API + '/reset-password', { method: 'POST', headers: ct(), body: JSON.stringify({ token, new_password: pw }) });
    const data = await r.json();
    if (!r.ok) { errEl.textContent = data.error; errEl.classList.remove('hidden'); return; }
    succEl.textContent = data.message;
    succEl.classList.remove('hidden');
    document.getElementById('reset-pw-input').value = '';
    document.getElementById('reset-pw-confirm').value = '';
    setTimeout(() => {
      document.getElementById('reset-pw-overlay').classList.add('hidden');
      history.replaceState(null, '', window.location.pathname);
      openAuthModal('login');
    }, 2500);
  } catch { errEl.textContent = 'Verbindingsfout.'; errEl.classList.remove('hidden'); }
}
window.handleResetPassword = handleResetPassword;

async function handleSignup() {
  const firstName = document.getElementById('su-firstname').value.trim();
  const lastName  = document.getElementById('su-lastname').value.trim();
  const email     = document.getElementById('su-email').value.trim();
  const password  = document.getElementById('su-password').value;
  const confirm   = document.getElementById('su-confirm-password').value;
  const buurt     = document.getElementById('su-district').value;
  const errEl     = document.getElementById('signup-error');
  errEl.textContent = '';
  errEl.classList.remove('hidden');

  if (!firstName)                  { errEl.textContent = 'Voornaam is verplicht.'; return; }
  if (!email)                      { errEl.textContent = 'E-mailadres is verplicht.'; return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { errEl.textContent = 'Voer een geldig e-mailadres in (bijv. naam@domein.com).'; return; }
  if (!password)                   { errEl.textContent = 'Wachtwoord is verplicht.'; return; }
  if (password.length < 6)         { errEl.textContent = 'Wachtwoord moet minimaal 6 tekens zijn.'; return; }
  if (password !== confirm)        { errEl.textContent = 'Wachtwoorden komen niet overeen.'; return; }
  if (!buurt)                      { errEl.textContent = 'Selecteer een district.'; return; }

  const name = lastName ? firstName + ' ' + lastName : firstName;
  try {
    const r    = await fetch(API + '/signup', { method: 'POST', headers: ct(), body: JSON.stringify({ first_name: firstName, last_name: lastName, name, email, password, role: 'klant', buurt }) });
    const data = await r.json();
    if (!r.ok) { errEl.textContent = data.error; return; }
    errEl.classList.add('hidden');
    currentUser = data.user;
    localStorage.setItem('mkd_user', JSON.stringify(currentUser));
    document.getElementById('auth-overlay').classList.add('hidden');
    afterLogin();
    showToast('Welkom bij MaKandra, ' + currentUser.name + '!', 'success');
    pollNotifications();
    setInterval(pollNotifications, 30000);
  } catch { errEl.textContent = 'Verbindingsfout. Controleer of de server actief is.'; }
}

async function handleProviderSignup() {
  const firstName    = document.getElementById('pv-firstname').value.trim();
  const lastName     = document.getElementById('pv-lastname').value.trim();
  const email        = document.getElementById('pv-email').value.trim();
  const password     = document.getElementById('pv-password').value;
  const confirm      = document.getElementById('pv-confirm-password').value;
  const buurt        = document.getElementById('pv-district').value;
  const category     = document.getElementById('pv-category').value;
  const bio          = document.getElementById('pv-tagline')?.value.trim() || '';
  const hourly_rate  = document.getElementById('pv-price')?.value || null;
  const phone        = document.getElementById('pv-phone')?.value.trim() || null;
  const working_hours = _schedPickerVal('pv') || null;
  const errEl        = document.getElementById('provider-error');
  errEl.textContent  = '';
  errEl.classList.remove('hidden');

  if (!firstName)                  { errEl.textContent = 'Voornaam is verplicht.'; return; }
  if (!email)                      { errEl.textContent = 'E-mailadres is verplicht.'; return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { errEl.textContent = 'Voer een geldig e-mailadres in (bijv. naam@domein.com).'; return; }
  if (!password)                   { errEl.textContent = 'Wachtwoord is verplicht.'; return; }
  if (password.length < 6)         { errEl.textContent = 'Wachtwoord moet minimaal 6 tekens zijn.'; return; }
  if (password !== confirm)        { errEl.textContent = 'Wachtwoorden komen niet overeen.'; return; }
  if (!buurt)                      { errEl.textContent = 'Selecteer een district.'; return; }
  if (!category)                   { errEl.textContent = 'Selecteer een categorie.'; return; }

  const name = lastName ? firstName + ' ' + lastName : firstName;
  try {
    const r    = await fetch(API + '/signup', { method: 'POST', headers: ct(), body: JSON.stringify({ first_name: firstName, last_name: lastName, name, email, password, role: 'dienstverlener', buurt, category, bio, hourly_rate, phone, working_hours }) });
    const data = await r.json();
    if (!r.ok) { errEl.textContent = data.error; return; }
    errEl.classList.add('hidden');
    currentUser = data.user;
    localStorage.setItem('mkd_user', JSON.stringify(currentUser));
    document.getElementById('auth-overlay').classList.add('hidden');
    afterLogin();
    showToast('Welkom bij MaKandra, ' + currentUser.name + '!', 'success');
    pollNotifications();
    setInterval(pollNotifications, 30000);
  } catch { errEl.textContent = 'Verbindingsfout. Controleer of de server actief is.'; }
}

// ─────────────────────────────────────────
// NAV / SESSION
// ─────────────────────────────────────────

function setNavAvatar() {
  const av = document.getElementById('nav-avatar');
  if (!av) return;
  if (currentUser.profile_picture) {
    av.outerHTML = '<img id="nav-avatar" src="' + API + currentUser.profile_picture + '" style="width:32px;height:32px;border-radius:50%;object-fit:cover">';
  } else {
    av.outerHTML = '<div class="user-avatar-sm" id="nav-avatar">' + ini(currentUser.name) + '</div>';
  }
}

function afterLogin() {
  document.getElementById('nav-auth')?.classList.add('hidden');
  document.getElementById('nav-user')?.classList.remove('hidden');
  setNavAvatar();
  const un = document.getElementById('nav-username');
  if (un) un.textContent = currentUser.name;

  const isDV = currentUser.role === 'dienstverlener';
  document.querySelectorAll('.klant-only').forEach(el => {
    el.style.display = isDV ? 'none' : '';
  });

  // Category clicks are blocked for dienstverleners via the browseByCategory() guard

  // Hide the hero search bar for dienstverleners
  const heroSearch = document.getElementById('hero-search-box');
  if (heroSearch) heroSearch.style.display = isDV ? 'none' : '';

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

  // Chat link in nav
  if (!document.getElementById('nav-chat-link')) {
    const navLinks = document.querySelector('.nav-links');
    if (navLinks) {
      const a = document.createElement('a');
      a.id = 'nav-chat-link';
      a.className = 'nav-link';
      a.style.position = 'relative';
      a.innerHTML = '💬 Berichten <span id="chat-nav-badge" style="display:none;background:#e53e3e;color:#fff;border-radius:50%;padding:1px 6px;font-size:.7rem;font-weight:700;margin-left:4px;vertical-align:middle"></span>';
      a.onclick = () => openChat(null, null, null);
      navLinks.appendChild(a);
    }
  }
  pollMsgCount();
  setInterval(pollMsgCount, 15000);
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
  if (!currentUser) { openAuthModal('login'); return; }
  if (currentUser.role === 'dienstverlener') { showToast('Favorieten zijn alleen beschikbaar voor klanten.', 'info'); return; }
  showView('favorites');
}
window.showFavorites = showFavorites;

function logout() {
  currentUser = null;
  localStorage.removeItem('mkd_user');
  document.getElementById('nav-auth')?.classList.remove('hidden');
  document.getElementById('nav-user')?.classList.add('hidden');
  document.getElementById('user-dropdown')?.classList.add('hidden');
  // Remove DV-only nav items
  document.querySelector('.dv-profile-link')?.remove();
  // Re-enable hero search for logged-out visitors
  const heroSearch = document.getElementById('hero-search-box');
  if (heroSearch) heroSearch.style.display = '';
  showView('home');
  showToast('Uitgelogd.', 'info');
}
window.logout = logout;

// ─────────────────────────────────────────
// VIEWS
// ─────────────────────────────────────────

let profileBackView  = 'home'; // tracks which view opened a profile, for the back button
const savedScrollPos = {};    // stores scroll position per view before leaving

function showView(name) {
  // Save scroll position of the current view before leaving
  const current = document.querySelector('.view.active');
  if (current) savedScrollPos[current.id.replace('view-', '')] = window.scrollY;

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById('view-' + name);
  if (target) target.classList.add('active');

  // Restore saved scroll position, or go to top for fresh views
  const restoreY = savedScrollPos[name] ?? 0;
  window.scrollTo({ top: restoreY, behavior: restoreY > 0 ? 'instant' : 'smooth' });

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
    const [workersRes, catsRes, statsRes] = await Promise.all([
      fetch(API + '/dienstverleners'),
      fetch(API + '/categories'),
      fetch(API + '/stats'),
    ]);

    const stats = await statsRes.json();
    const fmt = n => n >= 1000 ? (n / 1000).toFixed(1).replace('.', ',') + 'k+' : n + (n > 0 ? '+' : '');
    ['stat-dv', 'stat-dv2'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = fmt(stats.dv_count || 0); });
    ['stat-voltooid', 'stat-voltooid2'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = fmt(stats.voltooid_count || 0); });
    allWorkers = await workersRes.json();

    const grid = document.getElementById('top-providers-grid');
    if (grid) grid.innerHTML = allWorkers.slice(0, 10).map((w, i) => providerCard(w, i + 1)).join('');

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
    job_count:      apiMap[name]?.job_count       || 0,
  }));

  // Sort: categories with most bookings first
  allCats.sort((a, b) => b.booking_count - a.booking_count);

  grid.innerHTML = allCats.map(c => {
    const cls  = CAT_CSS[c.name] || '';
    const icon = CAT_ICONS[c.name] || '🔧';
    return '<div class="cat-card card-' + cls + ' reveal" onclick="browseByCategory(\'' + esc(c.name) + '\')" tabindex="0">' +
      '<div class="cat-icon">' + icon + '</div>' +
      '<div class="cat-name">' + esc(c.name) + '</div>' +
      '<div class="cat-count">' + c.provider_count + ' dienstverlener' + (c.provider_count !== 1 ? 's' : '') + '</div>' +
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
    const matchSearch   = !search   || w.name.toLowerCase().includes(search);
    const matchDistrict = !district || w.buurt === district;
    const matchCat      = !activeCat || w.category === activeCat;
    return matchSearch && matchDistrict && matchCat;
  });

  if (sort === 'price-asc')  filtered.sort((a, b) => (a.hourly_rate || 0) - (b.hourly_rate || 0));
  if (sort === 'price-desc') filtered.sort((a, b) => (b.hourly_rate || 0) - (a.hourly_rate || 0));
  if (sort === 'name')       filtered.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === 'score')      filtered.sort((a, b) => (b.vertrouwenscore || 0) - (a.vertrouwenscore || 0));
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
  if (currentUser && currentUser.role === 'dienstverlener') return;
  activeCat = cat;
  const bs = document.getElementById('browse-search');
  if (bs) bs.value = '';
  const dist = document.getElementById('filter-district');
  if (dist) dist.value = '';
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
  activeCat = null; // clear any active category so results show across all categories
  showView('browse');
  setTimeout(() => {
    const bs = document.getElementById('browse-search');
    const fd = document.getElementById('filter-district');
    if (bs) bs.value = q;
    if (fd) fd.value = dist;
    applyFilters();
  }, 80);
}
window.heroSearch = heroSearch;

// ─────────────────────────────────────────
// PROVIDER CARD
// ─────────────────────────────────────────

function providerCard(w, rank) {
  const favs      = getFavs();
  const isFav     = favs.includes(String(w.id));
  const price     = w.hourly_rate ? 'SRD ' + w.hourly_rate + '/u' : '';
  const rankBadge = rank && rank <= 3 ? '<span class="rank-badge">#' + rank + '</span>' : '';
  // vertrouwenscore is the composite trust score (clients + reviews formula)
  const vsNum     = (w.vertrouwenscore != null) ? w.vertrouwenscore : null;
  const rc        = w.review_count || 0;
  const availDot  = w.is_available === 0
    ? ' <span class="avail-dot busy" title="Bezet"></span>'
    : ' <span class="avail-dot" title="Beschikbaar"></span>';
  const favBtn    = (!currentUser || currentUser.role === 'klant')
    ? '<button class="btn-fav' + (isFav ? ' active' : '') + '" onclick="event.stopPropagation();toggleFav(' + w.id + ',this)" title="Favoriet">' + (isFav ? '&#10084;' : '&#9825;') + '</button>'
    : '';

  return '<div class="provider-card reveal" onclick="showProviderProfile(' + w.id + ')" tabindex="0">' +
    '<div class="provider-card-top">' +
      rankBadge +
      (favBtn ? '<div style="position:absolute;top:8px;right:8px;z-index:2">' + favBtn + '</div>' : '') +
    '</div>' +
    '<div class="pcard-avatar-section">' +
      '<div class="provider-avatar" style="background:' + avatarColor(w.name) + ';color:#fff">' +
        (w.profile_picture ? '<img src="' + API + w.profile_picture + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover">' : ini(w.name)) +
      '</div>' +
      (vsNum !== null ? '<div class="pcard-score-badge" title="Vertrouwensscore"><span class="pcard-score-num">' + vsNum + '</span><span class="pcard-review-cnt">%</span></div>' : '') +
    '</div>' +
    '<div class="provider-card-body">' +
      '<div class="provider-name">' + esc(w.name) + availDot + '</div>' +
      '<div class="provider-tagline">' + esc(w.bio || '') + '</div>' +
      '<div class="provider-meta">' +
        (w.buurt    ? '<span class="meta-chip pcard-chip-dist">📍 ' + esc(w.buurt)    + '</span>' : '') +
        (w.category ? '<span class="meta-chip pcard-chip-cat">🏷 ' + esc(w.category) + '</span>' : '') +
      '</div>' +
      (price ? '<div class="provider-price">' + price + '</div>' : '') +
      '<button class="btn-view-profile" onclick="event.stopPropagation();showProviderProfile(' + w.id + ')">Profiel bekijken →</button>' +
    '</div>' +
  '</div>';
}

// ─────────────────────────────────────────
// FAVORITES
// ─────────────────────────────────────────

function getFavs() {
  if (!currentUser) return [];
  return (JSON.parse(localStorage.getItem('mkd_fav_' + currentUser.id) || '[]') || []).map(String);
}

function toggleFav(id, btn) {
  const favId = String(id);
  let favs = getFavs();
  const isProfile = btn && btn.classList.contains('btn-fav-profile');
  if (favs.includes(favId)) {
    favs = favs.filter(f => f !== favId);
    if (btn) {
      btn.classList.remove('active');
      btn.innerHTML = isProfile ? '&#9825; Opslaan' : '&#9825;';
    }
    showToast('Verwijderd uit favorieten.', 'info');
  } else {
    favs.push(favId);
    if (btn) {
      btn.classList.add('active');
      btn.innerHTML = isProfile ? '&#10084; Favoriet' : '&#10084;';
    }
    showToast('Toegevoegd aan favorieten!', 'success');
  }
  if (currentUser) localStorage.setItem('mkd_fav_' + currentUser.id, JSON.stringify(favs));
}
window.toggleFav = toggleFav;

function renderFavoritesView() {
  const el = document.getElementById('favorites-content');
  if (!el) return;
  if (!currentUser || currentUser.role === 'dienstverlener') {
    el.innerHTML = '<div class="favorites-empty"><p>Favorieten zijn alleen beschikbaar voor klanten.</p></div>';
    return;
  }
  const favs  = getFavs();
  if (favs.length === 0) {
    el.innerHTML = '<div class="favorites-empty"><div class="favorites-empty-icon">&#9825;</div><p>Je hebt nog geen favorieten opgeslagen.</p></div>';
    return;
  }
  const faved = allWorkers.filter(w => favs.includes(String(w.id)));
  if (faved.length === 0) {
    fetch(API + '/dienstverleners')
      .then(r => r.json())
      .then(ws => {
        allWorkers = ws;
        const f2 = ws.filter(w => favs.includes(String(w.id)));
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
  // Remember which view we came from and save its scroll position
  const active = document.querySelector('.view.active');
  profileBackView = active ? (active.id.replace('view-', '') || 'home') : 'home';
  savedScrollPos[profileBackView] = window.scrollY;

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

  const favs        = getFavs();
  const isFav       = favs.includes(String(w.id));
  const canBook     = currentUser && currentUser.role === 'klant';
  // vsScore  — composite Vertrouwensscore used in the header ring and trust bar
  // avgScore — average review rating, shown separately as Beoordelingsscore
  const vsScore  = w.vertrouwenscore != null ? w.vertrouwenscore : 0;
  const avgScore = w.avg_score       ? Math.round(w.avg_score)   : 0;
  const availBadge = w.is_available === 0
    ? '<span class="prof-avail-badge busy">Bezet</span>'
    : '<span class="prof-avail-badge">Beschikbaar</span>';

  let skillsTags = '';
  if (w.category) skillsTags += '<span class="vaard-tag">' + esc(w.category) + '</span>';
  if (w.experience && w.experience !== w.category) skillsTags += '<span class="vaard-tag">' + esc(w.experience) + '</span>';

  el.innerHTML =
    // ── FULL-WIDTH GREEN HEADER ──
    '<div class="profile-header-bg">' +
      '<div class="profile-header-inner">' +
        '<div class="profile-back" onclick="showView(\'' + profileBackView + '\')">&#8592; Terug naar overzicht</div>' +
        '<div class="profile-top">' +
          '<div class="profile-avatar-lg" style="background:' + avatarColor(w.name) + '">' +
            (w.profile_picture
              ? '<img src="' + API + w.profile_picture + '" alt="">'
              : ini(w.name)) +
          '</div>' +
          '<div class="profile-header-info">' +
            '<h1>' + esc(w.name) + '</h1>' +
            (w.bio ? '<div class="profile-tagline">' + esc(w.bio.slice(0,100)) + (w.bio.length > 100 ? '…' : '') + '</div>' : '') +
            '<div class="profile-badges">' +
              (w.category    ? '<span class="profile-badge">🏷️ ' + esc(w.category) + '</span>' : '') +
              (w.buurt       ? '<span class="profile-badge">📍 ' + esc(w.buurt)    + '</span>' : '') +
              (w.review_count ? '<span class="profile-badge">⭐ ' + w.review_count + ' beoordelingen</span>' : '') +
              (w.working_hours ? '<span class="profile-badge">🕐 ' + esc(fmtSchedule(w.working_hours)) + '</span>' : '') +
              availBadge +
            '</div>' +
            '<div class="profile-action-btns">' +
              (canBook ? '<button class="btn-primary" onclick="openBookingModal(' + w.id + ',\'' + esc(w.name) + '\',\'' + esc(w.working_hours || '') + '\',' + (w.hourly_rate || 0) + ')">Boek nu</button>' : '') +
              ((!currentUser || currentUser.role === 'klant')
                ? '<button class="btn-fav-profile' + (isFav ? ' active' : '') + '" onclick="toggleFav(' + w.id + ',this)">' + (isFav ? '&#10084; Favoriet' : '&#9825; Opslaan') + '</button>'
                : '') +
            '</div>' +
          '</div>' +
          '<div class="profile-header-side">' +
            '<div class="profile-score-big">' +
              buildScoreLarge(vsScore) +
            '</div>' +
            (currentUser ? '<button class="btn-contact" onclick="openChat(' + w.id + ',\'' + esc(w.name) + '\',\'' + esc(w.profile_picture || '') + '\')">💬 Stuur bericht</button>' : '') +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +

    // ── BODY ──
    '<div class="profile-body">' +
      '<div class="profile-main-col">' +

        '<div class="profile-section">' +
          '<div class="profile-section-title">Over ' + esc(w.name.split(' ')[0]) + '</div>' +
          '<p style="color:#555;line-height:1.75">' + esc(w.bio || 'Geen beschrijving beschikbaar.') + '</p>' +
        '</div>' +

        '<div class="profile-section">' +
          '<div class="profile-section-title">🥇 Vertrouwensscore</div>' +
          '<div class="trust-stats">' +
            '<div class="trust-stat-box"><div class="ts-icon">👥</div><div class="ts-num" id="ts-clients">—</div><div class="ts-label">Totale klanten</div></div>' +
            '<div class="trust-stat-box"><div class="ts-icon">⭐</div><div class="ts-num">' + (w.review_count || '—') + '</div><div class="ts-label">Beoordelingen</div></div>' +
            '<div class="trust-stat-box"><div class="ts-icon">🔄</div><div class="ts-num" id="ts-returning">—</div><div class="ts-label">Terugkerende klanten</div></div>' +
          '</div>' +
          '<div class="trust-bars">' +
            /* Vertrouwensscore bar — computed from clients + reviews */
            '<div class="trust-bar-row"><span>Vertrouwensscore</span><div class="trust-bar"><div class="trust-bar-fill" id="tb-vs" style="width:' + vsScore + '%"></div></div><span id="tbl-vs">' + vsScore + '%</span></div>' +
            /* Beoordelingsscore bar — average of review scores (issue 7 rename) */
            '<div class="trust-bar-row"><span>Beoordelingsscore</span><div class="trust-bar"><div class="trust-bar-fill tb-orange" id="tb-rating" style="width:' + avgScore + '%"></div></div><span>' + (avgScore || '—') + (avgScore ? '%' : '') + '</span></div>' +
            '<div class="trust-bar-row"><span>Terugkerende klanten</span><div class="trust-bar"><div class="trust-bar-fill tb-blue" id="tb-returning" style="width:0%"></div></div><span id="tbl-returning">—</span></div>' +
          '</div>' +
        '</div>' +

        '<div class="profile-section">' +
          '<div class="profile-section-title">Vaardigheden</div>' +
          '<div class="vaardigheden-tags">' + (skillsTags || '<em style="color:#aaa">Geen vaardigheden opgegeven.</em>') + '</div>' +
        '</div>' +

        '<div class="profile-section" id="pv-portfolio-card">' +
          '<div class="profile-section-title">Portfolio</div>' +
          '<div id="pv-portfolio-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px"><p style="color:#aaa;font-size:.82rem">Laden...</p></div>' +
        '</div>' +

        '<div class="profile-section">' +
          '<div class="profile-section-title">Beoordelingen (' + (w.review_count || 0) + ')</div>' +
          '<div id="reviews-list"><p style="color:#aaa">Laden...</p></div>' +
          (currentUser && currentUser.role === 'klant'
            ? '<button class="btn-add-review" onclick="openReviewModal(' + w.id + ')">✏️ Beoordelingsscore geven</button>'
            : '') +
        '</div>' +

      '</div>' +

      '<div class="profile-side-col">' +
        '<div class="sidebar-info-card">' +
          '<h3>Dienst info</h3>' +
          '<div class="info-row"><span>District</span><span>' + esc(w.buurt || '—') + '</span></div>' +
          '<div class="info-row"><span>Categorie</span><span>' + esc(w.category || '—') + '</span></div>' +
          '<div class="info-row"><span>Klanten</span><span id="di-clients">—</span></div>' +
          '<div class="info-row"><span>Terugkerende</span><span id="di-returning">—</span></div>' +
          '<div class="info-row"><span>Beoordelingen</span><span>' + (w.review_count || '—') + '</span></div>' +
          (w.vertrouwenscore != null ? '<div class="info-row"><span>Vertrouwensscore</span><span style="color:var(--primary);font-weight:700">' + vsScore + '%</span></div>' : '') +
          (avgScore ? '<div class="info-row"><span>Beoordelingsscore</span><span style="color:#ea580c;font-weight:700">' + avgScore + '%</span></div>' : '') +
          (w.hourly_rate ? '<div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border)"><div style="font-size:1.4rem;font-weight:800;color:var(--primary)">SRD ' + w.hourly_rate + '/uur</div><div style="font-size:.75rem;color:#888">Indicatief tarief</div></div>' : '') +
        '</div>' +
        (w.email || w.phone
          ? '<div class="sidebar-info-card" style="margin-top:14px">' +
              '<h3>Contact</h3>' +
              (w.email ? '<div class="info-row"><span>E-mail</span><span style="word-break:break-all;font-size:.8rem">' + esc(w.email) + '</span></div>' : '') +
              (w.phone ? '<div class="info-row"><span>Telefoon</span><span>' + esc(w.phone) + '</span></div>' : '') +
              (currentUser ? '<button class="btn-stuur-bericht" onclick="openChat(' + w.id + ',\'' + esc(w.name) + '\',\'' + esc(w.profile_picture || '') + '\')">💬 Stuur bericht</button>' : '') +
            '</div>'
          : '') +
      '</div>' +
    '</div>';

  showView('profile');
  _loadReviews(w.id);
  _loadProviderStats(w.id);
  _loadProviderPortfolio(w.id);
}

async function _loadProviderPortfolio(providerId) {
  const grid = document.getElementById('pv-portfolio-grid');
  if (!grid) return;
  try {
    const r     = await fetch(API + '/portfolio/' + providerId);
    const items = await r.json();
    if (!items.length) {
      grid.className = 'portfolio-grid';
      grid.innerHTML = '<div class="portfolio-empty">Geen portfolio-items beschikbaar.</div>';
      return;
    }
    grid.className = 'portfolio-grid';
    grid.style = '';
    grid.innerHTML = items.map(item =>
      '<div class="portfolio-item" onclick="this.querySelector(\'video,img\')?.requestFullscreen?.()">' +
        (item.file_type === 'video'
          ? '<video src="' + API + item.file_path + '" muted playsinline loop></video>'
          : '<img src="' + API + item.file_path + '" loading="lazy" alt="Portfolio">') +
        '<div class="portfolio-overlay">' + (item.file_type === 'video' ? '▶' : '🔍') + '</div>' +
      '</div>'
    ).join('');
  } catch {
    grid.innerHTML = '<p style="color:#aaa;font-size:.85rem">Fout bij laden portfolio.</p>';
  }
}

async function _loadReviews(providerId) {
  const container = document.getElementById('reviews-list');
  if (!container) return;
  try {
    const r = await fetch(API + '/reviews/' + providerId);
    const reviews = await r.json();
    if (!reviews.length) {
      container.innerHTML = '<p style="color:#aaa">Nog geen beoordelingen.</p>';
      return;
    }
    container.innerHTML = reviews.map(rv =>
      '<div class="review-item">' +
        '<div class="review-header">' +
          '<strong>' + esc(rv.reviewer_name || 'Anoniem') + '</strong>' +
          '<span class="review-score">' + rv.score + '%</span>' +
        '</div>' +
        '<p style="color:#555;margin:4px 0 0">' + esc(rv.text) + '</p>' +
      '</div>'
    ).join('');
  } catch {
    container.innerHTML = '<p style="color:#aaa">Kon beoordelingen niet laden.</p>';
  }
}

async function _loadProviderStats(providerId) {
  try {
    const r = await fetch(API + '/provider-stats/' + providerId);
    if (!r.ok) return;
    const s = await r.json();
    const set    = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const setBar = (id, pct) => { const el = document.getElementById(id); if (el) el.style.width = pct + '%'; };

    set('ts-clients',   s.total_clients);
    set('ts-returning', s.returning_clients);
    set('di-clients',   s.total_clients);
    set('di-returning', s.returning_clients);

    // Update VS bar with authoritative backend-computed value
    const vs = s.vertrouwenscore != null ? s.vertrouwenscore : 0;
    setBar('tb-vs',    vs);
    set('tbl-vs',      vs + '%');

    // Returning-clients bar
    if (s.total_clients > 0) {
      const pct = Math.round(s.returning_clients / s.total_clients * 100);
      setBar('tb-returning', pct);
      set('tbl-returning',   pct + '%');
    }
  } catch { /* silent */ }
}

// ─────────────────────────────────────────
// BOOKING MODAL (created dynamically)
// ─────────────────────────────────────────

function openBookingModal(workerId, workerName, workingHoursRaw, hourlyRate) {
  if (!currentUser) { openAuthModal('login'); return; }
  if (!bookingModalEl) _createBookingModal();

  bookingModalEl.dataset.workerId     = workerId;
  bookingModalEl.dataset.workerName   = workerName;
  bookingModalEl.dataset.workingHours = workingHoursRaw || '';
  bookingModalEl.dataset.hourlyRate   = hourlyRate || 0;

  // Header
  document.getElementById('bk-worker-name').textContent = workerName;
  const avatarEl = document.getElementById('bk-avatar');
  if (avatarEl) { avatarEl.textContent = ini(workerName); avatarEl.style.background = avatarColor(workerName); }

  // Reset fields
  document.getElementById('bk-error').textContent = '';
  document.getElementById('bk-date').value = '';
  document.getElementById('bk-date').min   = new Date().toISOString().split('T')[0];
  document.getElementById('bk-slots').innerHTML = '<p class="bk-slots-placeholder">Kies eerst een datum</p>';
  document.getElementById('bk-msg').value  = '';
  document.getElementById('bk-price-est').style.display = 'none';
  // Reset duration to 60min
  document.querySelectorAll('.bk-dur-chip').forEach(c => c.classList.toggle('active', c.dataset.min === '60'));

  let sched = null;
  try { sched = JSON.parse(workingHoursRaw || ''); } catch (e) {}
  _bkApplySchedule(sched);

  document.getElementById('bk-overlay').classList.remove('hidden');
}
window.openBookingModal = openBookingModal;

function _createBookingModal() {
  const overlay = document.createElement('div');
  overlay.id        = 'bk-overlay';
  overlay.className = 'overlay hidden';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px';

  const DURS = [['30 min', 30], ['1 uur', 60], ['1,5 uur', 90], ['2 uur', 120], ['3 uur', 180], ['4 uur', 240]];

  overlay.innerHTML =
    '<div class="modal bk-modal-wrap" id="bk-modal">' +
      '<button class="modal-x" id="bk-close">&#10005;</button>' +

      // Provider header
      '<div class="bk-provider-header">' +
        '<div class="bk-avatar" id="bk-avatar">?</div>' +
        '<div>' +
          '<div style="font-size:.75rem;color:#999;margin-bottom:2px">Boeking bij</div>' +
          '<div style="font-weight:700;font-size:1.05rem" id="bk-worker-name"></div>' +
        '</div>' +
      '</div>' +

      // Schedule hint
      '<div id="bk-schedule-hint" style="display:none;background:#f0eeff;border:1px solid #d5c8ff;border-radius:10px;padding:10px 14px;margin-bottom:16px;font-size:.82rem;color:#5a3fc0;line-height:1.6"></div>' +

      // Date
      '<div class="form-group"><label>Datum</label><input type="date" id="bk-date"></div>' +
      '<div id="bk-day-error" style="display:none;color:#e53e3e;font-size:.8rem;margin-top:-8px;margin-bottom:10px"></div>' +

      // Duration chips
      '<div class="form-group">' +
        '<label>Duur</label>' +
        '<div class="bk-dur-chips">' +
          DURS.map(([label, min]) =>
            '<button type="button" class="bk-dur-chip' + (min === 60 ? ' active' : '') + '" data-min="' + min + '" onclick="bkPickDur(this)">' + label + '</button>'
          ).join('') +
        '</div>' +
      '</div>' +

      // Time slots
      '<div class="form-group">' +
        '<label>Tijdstip</label>' +
        '<div class="bk-slots" id="bk-slots"><p class="bk-slots-placeholder">Kies eerst een datum</p></div>' +
      '</div>' +

      // Price estimate
      '<div id="bk-price-est" class="bk-price-est" style="display:none"></div>' +

      // Message
      '<div class="form-group"><label>Bericht <span style="color:#aaa;font-weight:400">(optioneel)</span></label><textarea id="bk-msg" rows="3" placeholder="Beschrijf wat je nodig hebt..."></textarea></div>' +

      '<div class="form-error" id="bk-error"></div>' +
      '<button class="btn-primary btn-full" id="bk-submit">Verstuur aanvraag</button>' +
    '</div>';

  document.body.appendChild(overlay);
  bookingModalEl = document.getElementById('bk-modal');

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.add('hidden'); });
  document.getElementById('bk-close').addEventListener('click', () => overlay.classList.add('hidden'));
  document.getElementById('bk-submit').addEventListener('click', submitBooking);
  document.getElementById('bk-date').addEventListener('change', _bkOnDateChange);
}

function bkPickDur(btn) {
  document.querySelectorAll('.bk-dur-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  // Regenerate slots with new duration
  const date = document.getElementById('bk-date').value;
  if (date) _bkBuildSlots(date);
  _bkUpdatePrice();
}
window.bkPickDur = bkPickDur;

function _bkGetDur() {
  return parseInt(document.querySelector('.bk-dur-chip.active')?.dataset.min || '60');
}

function _bkBuildSlots(dateVal) {
  const slotsEl = document.getElementById('bk-slots');
  if (!slotsEl) return;
  let sched = null;
  try { sched = JSON.parse(bookingModalEl.dataset.workingHours || ''); } catch (e) {}

  const dur      = _bkGetDur();
  const start    = sched?.start || '08:00';
  const end      = sched?.end   || '20:00';
  const startMin = _timeToMin(start);
  const endMin   = _timeToMin(end);

  const slots = [];
  for (let m = startMin; m + dur <= endMin; m += 30) {
    slots.push(m);
  }

  if (!slots.length) { slotsEl.innerHTML = '<p class="bk-slots-placeholder">Geen beschikbare tijden.</p>'; return; }

  slotsEl.innerHTML = slots.map(m => {
    const t = mkdMinToTime(m);
    return '<button type="button" class="bk-slot" data-time="' + t + '" onclick="bkPickSlot(this)">' + t + '</button>';
  }).join('');
}

function bkPickSlot(btn) {
  document.querySelectorAll('.bk-slot').forEach(s => s.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('bk-error').textContent = '';
  _bkUpdatePrice();
}
window.bkPickSlot = bkPickSlot;

function _bkUpdatePrice() {
  const rate    = parseFloat(bookingModalEl?.dataset.hourlyRate || 0);
  const dur     = _bkGetDur();
  const priceEl = document.getElementById('bk-price-est');
  if (!priceEl) return;
  if (!rate) { priceEl.style.display = 'none'; return; }
  const est = (rate * dur / 60).toFixed(0);
  priceEl.style.display = '';
  priceEl.innerHTML = '💰 Geschatte kosten: <strong>SRD ' + est + '</strong> <span style="font-size:.78rem;opacity:.7">(bij SRD ' + rate + '/u)</span>';
}

async function submitBooking() {
  const workerId         = bookingModalEl.dataset.workerId;
  const date             = document.getElementById('bk-date').value;
  const activeSlot       = document.querySelector('.bk-slot.active');
  const time             = activeSlot?.dataset.time || '';
  const duration_minutes = _bkGetDur();
  const message          = document.getElementById('bk-msg').value.trim();
  const errEl            = document.getElementById('bk-error');

  if (!date) { errEl.textContent = 'Kies een datum.'; return; }
  const [y, m, d] = date.split('-').map(Number);
  if (new Date(y, m - 1, d) < new Date(new Date().toDateString())) { errEl.textContent = 'Kies een datum in de toekomst.'; return; }
  if (!time) { errEl.textContent = 'Kies een tijdstip.'; return; }

  let sched = null;
  try { sched = JSON.parse(bookingModalEl.dataset.workingHours || ''); } catch (e) {}

  if (sched && sched.days && sched.days.length) {
    const DAY_MAP = { zo:0, ma:1, di:2, wo:3, do:4, vr:5, za:6 };
    const DAY_NL  = { ma:'Maandag', di:'Dinsdag', wo:'Woensdag', do:'Donderdag', vr:'Vrijdag', za:'Zaterdag', zo:'Zondag' };
    const dow     = new Date(y, m - 1, d).getDay();
    const dayKey  = Object.keys(DAY_MAP).find(k => DAY_MAP[k] === dow);
    if (!sched.days.includes(dayKey)) {
      errEl.textContent = 'Niet beschikbaar op die dag. Werkdagen: ' + sched.days.map(k => DAY_NL[k] || k).join(', ') + '.';
      return;
    }
  }

  if (sched && sched.start && sched.end) {
    const bookStart = _timeToMin(time);
    const bookEnd   = bookStart + duration_minutes;
    const workStart = _timeToMin(sched.start);
    const workEnd   = _timeToMin(sched.end);
    if (bookStart < workStart) { errEl.textContent = 'Werktijd begint om ' + sched.start + '.'; return; }
    if (bookEnd > workEnd)     { errEl.textContent = 'Boeking eindigt na sluitingstijd (' + sched.end + '). Kies een eerder tijdstip of kortere duur.'; return; }
  }

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

function _bkApplySchedule(sched) {
  const hint   = document.getElementById('bk-schedule-hint');
  const timeEl = document.getElementById('bk-time');
  if (!sched || !sched.days || !sched.days.length) {
    if (hint) hint.style.display = 'none';
    if (timeEl) { timeEl.removeAttribute('min'); timeEl.removeAttribute('max'); }
    return;
  }
  const DAY_NL = { ma:'Ma', di:'Di', wo:'Wo', do:'Do', vr:'Vr', za:'Za', zo:'Zo' };
  const dayStr = sched.days.map(k => DAY_NL[k] || k).join(' · ');
  if (hint) {
    hint.style.display = '';
    hint.innerHTML = '<strong>📅 Werkdagen:</strong> ' + dayStr +
      (sched.start && sched.end ? '<br><strong>🕒 Werktijden:</strong> ' + sched.start + ' – ' + sched.end : '');
  }
  if (timeEl && sched.start) timeEl.min = sched.start;
  if (timeEl && sched.end)   timeEl.max = sched.end;
}

function _bkOnDateChange() {
  const dateVal  = this.value;
  const dayErrEl = document.getElementById('bk-day-error');
  const slotsEl  = document.getElementById('bk-slots');
  if (!dateVal || !bookingModalEl) {
    if (dayErrEl) dayErrEl.style.display = 'none';
    if (slotsEl)  slotsEl.innerHTML = '<p class="bk-slots-placeholder">Kies eerst een datum</p>';
    return;
  }
  let sched = null;
  try { sched = JSON.parse(bookingModalEl.dataset.workingHours || ''); } catch (e) {}

  const DAY_MAP = { zo:0, ma:1, di:2, wo:3, do:4, vr:5, za:6 };
  const DAY_NL  = { ma:'Maandag', di:'Dinsdag', wo:'Woensdag', do:'Donderdag', vr:'Vrijdag', za:'Zaterdag', zo:'Zondag' };
  const [y, m, d] = dateVal.split('-').map(Number);
  const dow    = new Date(y, m - 1, d).getDay();
  const dayKey = Object.keys(DAY_MAP).find(k => DAY_MAP[k] === dow);

  if (sched && sched.days && sched.days.length && !sched.days.includes(dayKey)) {
    dayErrEl.textContent = '⚠ Niet beschikbaar op ' + (DAY_NL[dayKey] || dayKey) + '. Werkdagen: ' + sched.days.map(k => DAY_NL[k] || k).join(', ') + '.';
    dayErrEl.style.display = '';
    if (slotsEl) slotsEl.innerHTML = '<p class="bk-slots-placeholder">Geen tijden op deze dag.</p>';
  } else {
    dayErrEl.style.display = 'none';
    _bkBuildSlots(dateVal);
  }
}

// ─────────────────────────────────────────
// REVIEW MODAL
// ─────────────────────────────────────────

function openReviewModal(providerId) {
  if (!currentUser) { openAuthModal('login'); return; }
  document.getElementById('review-target-id').value = providerId;
  document.getElementById('review-text').value      = '';
  const re = document.getElementById('review-error');
  re.textContent = '';
  re.classList.add('hidden');
  document.getElementById('review-overlay').classList.remove('hidden');
  setTimeout(() => updateSliderScore(75), 30);
}
window.openReviewModal = openReviewModal;

function updateSliderScore(val) {
  val = parseInt(val);
  const color = scoreColor(val);
  const pct   = val + '%';
  const slider  = document.getElementById('review-rating');
  const numEl   = document.getElementById('review-pct-label');
  const wrapEl  = document.getElementById('score-slider-wrap');
  if (slider) {
    slider.value = val;
    slider.style.setProperty('--fill', color);
    slider.style.setProperty('--pct',  pct);
    slider.style.background = 'linear-gradient(to right, ' + color + ' ' + pct + ', rgba(0,0,0,0.1) ' + pct + ')';
  }
  if (numEl)  { numEl.textContent = val + '%'; numEl.style.color = color; }
}
window.updateSliderScore = updateSliderScore;

function closeReviewModal(e) {
  if (!e || e.target === document.getElementById('review-overlay')) {
    document.getElementById('review-overlay').classList.add('hidden');
  }
}

async function submitReview() {
  if (submitReview._running) return;
  submitReview._running = true;
  setTimeout(() => { submitReview._running = false; }, 2000);

  const targetId = document.getElementById('review-target-id').value;
  const score    = document.getElementById('review-rating').value;
  const text     = document.getElementById('review-text').value.trim();
  const errEl    = document.getElementById('review-error');
  // Reset error state — make the div visible so any error message can be seen
  errEl.textContent = '';
  errEl.classList.remove('hidden');

  if (!text) {
    errEl.textContent = 'Schrijf een review.';
    submitReview._running = false;
    return;
  }

  try {
    const r = await fetch(API + '/reviews', {
      method: 'POST', headers: ct(),
      body: JSON.stringify({ reviewer_id: currentUser.id, provider_id: parseInt(targetId), score: parseInt(score), text }),
    });
    const data = await r.json();
    if (!r.ok) {
      errEl.textContent = data.error;
      submitReview._running = false;
      return;
    }
    errEl.classList.add('hidden');
    document.getElementById('review-overlay').classList.add('hidden');
    showToast('Review geplaatst!', 'success');
  } catch {
    errEl.textContent = 'Verbindingsfout. Controleer of de server actief is.';
  }
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
    const badge3 = document.getElementById('dash-notif-badge');
    if (badge)  { badge.textContent  = unread; badge.classList.toggle('hidden',  unread === 0); }
    if (badge2) { badge2.textContent = unread; badge2.classList.toggle('hidden', unread === 0); }
    if (badge3) { badge3.textContent = unread; badge3.classList.toggle('hidden', unread === 0); }
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
          (currentUser.profile_picture ? '<img src="' + API + currentUser.profile_picture + '" class="dash-avatar-img">' : '<div class="dash-avatar">' + ini(currentUser.name) + '</div>') +
          '<div class="dash-name">'   + esc(currentUser.name) + '</div>' +
          '<div class="dash-role-tag">Dienstverlener</div>' +
        '</div>' +
        '<nav>' +
          '<div class="dash-menu-item active" onclick="dvTab(\'overzicht\',this)">Overzicht</div>' +
          '<div class="dash-menu-item" onclick="dvTab(\'boekingen\',this)">Boekingen</div>' +
          '<div class="dash-menu-item" onclick="dvTab(\'agenda\',this)">Agenda</div>' +
          '<div class="dash-menu-item" onclick="dvTab(\'notificaties\',this)">Notificaties <span id="dash-notif-badge" class="hidden" style="background:#e53e3e;color:#fff;border-radius:50%;padding:1px 6px;font-size:11px;margin-left:4px;"></span></div>' +
          '<div class="dash-menu-item" onclick="dvTab(\'portfolio\',this)">Portfolio</div>' +
          '<div class="dash-menu-item" onclick="dvTab(\'profiel\',this)">Profiel bewerken</div>' +
          '<div class="dash-menu-item" onclick="dvTab(\'account\',this)">Settings</div>' +
          (currentUser.is_admin ? '<div class="dash-menu-item" onclick="dvTab(\'admin\',this)">Beheer</div>' : '') +
        '</nav>' +
      '</aside>' +
      '<div class="dashboard-panel">' +
        _dvOverzicht() + _dvBoekingen() + _dvAgenda() + _dvNotifs() + _dvPortfolioTab() + _dvProfiel() + _dvAccount() + (currentUser.is_admin ? _dvAdminPanel() : '') +
      '</div>' +
    '</div>';

  loadBookingsDV();
  renderCalendar();
  loadDVPortfolio();
  pollNotifications();
}

function dvTab(panel, el) {
  document.querySelectorAll('#dashboard-content .dash-menu-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('#dashboard-content .dash-panel').forEach(p => p.classList.add('hidden'));
  const target = document.getElementById('dv-p-' + panel);
  if (target) target.classList.remove('hidden');
  if (panel === 'boekingen')    { loadBookingsDV(); _resetDVBkSubTab(); }
  if (panel === 'agenda')       renderCalendar();
  if (panel === 'notificaties') loadDVNotifications();
  if (panel === 'portfolio')    loadDVPortfolioTab();
  if (panel === 'profiel')      loadDVPortfolio();
  if (panel === 'admin')        loadAdminPanel();
}
window.dvTab = dvTab;

function dvBkSubTab(sub, el) {
  document.querySelectorAll('#dv-bk-sub-tabs .bk-filter').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('dv-bk-sub-boekingen').style.display  = sub === 'boekingen'  ? '' : 'none';
  document.getElementById('dv-bk-sub-opdrachten').style.display = sub === 'opdrachten' ? '' : 'none';
  if (sub === 'opdrachten') loadDVOpdrachten();
}
window.dvBkSubTab = dvBkSubTab;

function _resetDVBkSubTab() {
  const boekEl = document.getElementById('dv-bk-sub-boekingen');
  const opdEl  = document.getElementById('dv-bk-sub-opdrachten');
  if (boekEl) boekEl.style.display = '';
  if (opdEl)  opdEl.style.display  = 'none';
  document.querySelectorAll('#dv-bk-sub-tabs .bk-filter').forEach((b, i) => b.classList.toggle('active', i === 0));
}

function _dvOverzicht() {
  const isAvail = currentUser.is_available !== 0;
  return '<div class="dash-panel" id="dv-p-overzicht">' +
    '<div class="dashboard-panel-title">Welkom, ' + esc(currentUser.name) + '</div>' +
    '<div class="avail-toggle-card">' +
      '<div class="avail-toggle-info">' +
        '<span class="avail-toggle-dot' + (isAvail ? '' : ' busy') + '"></span>' +
        '<div>' +
          '<strong>' + (isAvail ? 'Beschikbaar' : 'Bezet') + '</strong>' +
          '<div style="font-size:.8rem;color:#888">Klanten kunnen ' + (isAvail ? '' : 'geen ') + 'boeking aanvragen</div>' +
        '</div>' +
      '</div>' +
      '<label class="avail-switch">' +
        '<input type="checkbox" id="avail-check"' + (isAvail ? ' checked' : '') + ' onchange="toggleAvailability(this.checked)">' +
        '<span class="avail-slider"></span>' +
      '</label>' +
    '</div>' +
    '<div class="dnd-toggle-card">' +
      '<div class="avail-toggle-info">' +
        '<span style="font-size:1.2rem">⛔</span>' +
        '<div><strong>Niet Storen</strong><div style="font-size:.8rem;color:#888">Blokkeer inkomende berichten</div></div>' +
      '</div>' +
      '<label class="avail-switch">' +
        '<input type="checkbox" id="dnd-check"' + (currentUser.dnd_mode ? ' checked' : '') + ' onchange="toggleDND(this.checked)">' +
        '<span class="avail-slider dnd-slider"></span>' +
      '</label>' +
    '</div>' +
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
    '<div class="bk-filter-tabs" id="dv-bk-sub-tabs">' +
      '<button class="bk-filter active" onclick="dvBkSubTab(\'boekingen\',this)">Boekingen</button>' +
      '<button class="bk-filter" onclick="dvBkSubTab(\'opdrachten\',this)">Opdrachten</button>' +
    '</div>' +
    '<div id="dv-bk-sub-boekingen">' +
      '<div id="dv-bk-list"><p>Laden...</p></div>' +
    '</div>' +
    '<div id="dv-bk-sub-opdrachten" style="display:none">' +
      '<p style="font-size:.82rem;color:#888;margin:14px 0">Opdrachten in jouw categorie: <strong>' + esc(currentUser.category || '—') + '</strong></p>' +
      '<div id="dv-job-list"><p style="color:#aaa;font-size:.85rem">Laden...</p></div>' +
    '</div>' +
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

// ─────────────────────────────────────────
// PORTFOLIO TAB (dashboard)
// ─────────────────────────────────────────

const MAX_PORTFOLIO_SLOTS = 6;

function _dvPortfolioTab() {
  let slots = '';
  for (let i = 0; i < MAX_PORTFOLIO_SLOTS; i++) {
    slots += '<div class="portfolio-upload-item" id="dv-pslot-' + i + '" onclick="triggerPortfolioUpload(' + i + ')">' +
      '<div class="upload-icon">＋</div>' +
      '<div class="upload-text">Foto of video uploaden</div>' +
    '</div>';
  }
  return '<div class="dash-panel hidden" id="dv-p-portfolio">' +
    '<div class="dashboard-panel-title">Portfolio</div>' +
    '<p style="color:var(--text-muted);font-size:.875rem;margin-bottom:20px">Upload foto\'s en video\'s om uw werk te tonen aan potentiële klanten.</p>' +
    '<div class="portfolio-upload-grid" id="dv-portfolio-upload-grid">' + slots + '</div>' +
    '<p class="portfolio-hint">Ondersteunde formaten: JPG, PNG, GIF, MP4, MOV · Max. 50 MB per bestand</p>' +
    '<input type="file" id="dv-portfolio-slot-input" accept="image/*,video/*" style="display:none" onchange="uploadPortfolioSlot(this)">' +
  '</div>';
}

let _activeSlot = null;

function triggerPortfolioUpload(slotIndex) {
  _activeSlot = slotIndex;
  const input = document.getElementById('dv-portfolio-slot-input');
  if (input) input.click();
}
window.triggerPortfolioUpload = triggerPortfolioUpload;

async function uploadPortfolioSlot(input) {
  const file = input?.files?.[0];
  if (!file) return;
  const slot = document.getElementById('dv-pslot-' + _activeSlot);
  if (slot) {
    slot.innerHTML = '<div style="font-size:.8rem;color:#888">Uploaden...</div>';
    slot.onclick = null;
  }
  const fd = new FormData();
  fd.append('file', file);
  try {
    const r    = await fetch(API + '/portfolio/' + currentUser.id, { method: 'POST', body: fd });
    const data = await r.json().catch(() => ({}));
    if (r.ok) { loadDVPortfolioTab(); showToast('Geüpload!', 'success'); }
    else { showToast(data.error || 'Upload mislukt (' + r.status + ').', 'error'); loadDVPortfolioTab(); }
  } catch (e) { showToast('Verbindingsfout: ' + e.message, 'error'); loadDVPortfolioTab(); }
  input.value = '';
}
window.uploadPortfolioSlot = uploadPortfolioSlot;

async function loadDVPortfolioTab() {
  const grid = document.getElementById('dv-portfolio-upload-grid');
  if (!grid) return;
  try {
    const r = await fetch(API + '/portfolio/' + currentUser.id);
    const items = await r.json();
    let html = '';
    for (let i = 0; i < MAX_PORTFOLIO_SLOTS; i++) {
      const item = items[i];
      if (item) {
        html += '<div class="portfolio-upload-item filled" id="dv-pslot-' + i + '">' +
          (item.file_type === 'video'
            ? '<video src="' + API + item.file_path + '" muted playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></video>'
            : '<img src="' + API + item.file_path + '" alt="Portfolio">') +
          '<div class="portfolio-remove-btn" onclick="deleteDVPortfolioSlot(' + item.id + ')">✕</div>' +
        '</div>';
      } else {
        html += '<div class="portfolio-upload-item" id="dv-pslot-' + i + '" onclick="triggerPortfolioUpload(' + i + ')">' +
          '<div class="upload-icon">＋</div>' +
          '<div class="upload-text">Foto of video uploaden</div>' +
        '</div>';
      }
    }
    grid.innerHTML = html;
  } catch { /* silent */ }
}
window.loadDVPortfolioTab = loadDVPortfolioTab;

async function deleteDVPortfolioSlot(itemId) {
  try {
    await fetch(API + '/portfolio/item/' + itemId, { method: 'DELETE' });
    loadDVPortfolioTab();
    showToast('Verwijderd.', 'info');
  } catch { showToast('Fout bij verwijderen.', 'error'); }
}
window.deleteDVPortfolioSlot = deleteDVPortfolioSlot;

function _dvProfiel() {
  return '<div class="dash-panel hidden" id="dv-p-profiel">' +
    '<div class="dashboard-panel-title">Profiel bewerken</div>' +
    '<div class="form-group">' +
    '<label>Profielfoto</label>' +
    '<div class="pfp-upload-wrap" onclick="document.getElementById(\'dv-avatar\').click()" title="Klik om foto te wijzigen">' +
    (currentUser.profile_picture
      ? '<img src="' + API + currentUser.profile_picture + '" class="pfp-upload-img">'
      : '<div class="dash-avatar pfp-upload-img" style="font-size:1.8rem">' + ini(currentUser.name) + '</div>') +
    '<div class="pfp-overlay">📷</div>' +
    '</div>' +
    '<div style="font-size:.75rem;color:#aaa;margin-top:8px">Klik op de foto om te wijzigen</div>' +
    '<input type="file" id="dv-avatar" accept="image/*" style="display:none" onchange="uploadAvatarFor(\'dv\')">' +
    '<div class="form-error" id="dv-avatar-msg"></div>' +
    '</div>' +
    '<div class="form-row-2">' +
      '<div class="form-group"><label>Voornaam</label><input type="text" id="dv-firstname" value="' + esc(currentUser.first_name || currentUser.name.split(' ')[0] || '') + '"></div>' +
      '<div class="form-group"><label>Achternaam</label><input type="text" id="dv-lastname" value="' + esc(currentUser.last_name || (currentUser.name.includes(' ') ? currentUser.name.split(' ').slice(1).join(' ') : '')) + '"></div>' +
    '</div>' +
    '<div class="form-group"><label>Categorie</label><input type="text" id="dv-cat" value="' + esc(currentUser.category || '') + '"></div>' +
    '<div class="form-group"><label>Ervaring</label><input type="text" id="dv-exp" value="' + esc(currentUser.experience || '') + '"></div>' +
    '<div class="form-group"><label>Bio</label><textarea id="dv-bio" rows="4">' + esc(currentUser.bio || '') + '</textarea></div>' +
    '<div class="form-group"><label>Uurtarief (SRD)</label><input type="number" id="dv-rate" value="' + (currentUser.hourly_rate || '') + '"></div>' +
    '<div class="form-group"><label>Telefoon</label><input type="tel" id="dv-phone" value="' + esc(currentUser.phone || '') + '" placeholder="+597 ..."></div>' +
    '<div class="form-group"><label>Werktijden</label>' + _schedPickerHTML('dv', currentUser.working_hours) + '</div>' +
    '<div class="form-group"><label>Buurt</label><select id="dv-buurt">' + distOpts(currentUser.buurt) + '</select></div>' +
    '<button class="btn-primary" onclick="saveProfile()">Opslaan</button>' +
    '<div class="form-error" id="dv-prof-msg"></div>' +
  '</div>';
}

function _dvOpdrachten() {
  return '<div class="dash-panel hidden" id="dv-p-opdrachten">' +
    '<div class="dashboard-panel-title">Beschikbare opdrachten</div>' +
    '<p style="font-size:.82rem;color:#888;margin-bottom:14px">Opdrachten in jouw categorie: <strong>' + esc(currentUser.category || '—') + '</strong></p>' +
    '<div id="dv-job-list"><p style="color:#aaa;font-size:.85rem">Laden...</p></div>' +
  '</div>';
}

async function loadDVOpdrachten() {
  const el = document.getElementById('dv-job-list');
  if (!el) return;
  try {
    const url  = currentUser.category ? API + '/jobs?category=' + encodeURIComponent(currentUser.category) : API + '/jobs';
    const r    = await fetch(url);
    const jobs = await r.json();
    if (!jobs.length) { el.innerHTML = '<p class="empty-plain">Geen opdrachten gevonden in jouw categorie.</p>'; return; }
    el.innerHTML = jobs.map(j =>
      '<div class="job-card">' +
        '<div class="job-card-top">' +
          '<div>' +
            '<div class="job-title">' + esc(j.title) + '</div>' +
            '<div class="job-meta">' + esc(j.klant_name) + ' · ' + esc(j.category) + (j.buurt ? ' · ' + esc(j.buurt) : '') + (j.date_needed ? ' · ' + j.date_needed : '') + '</div>' +
          '</div>' +
          (j.budget ? '<span class="job-budget-tag">💰 ' + esc(j.budget) + '</span>' : '') +
        '</div>' +
        (j.description ? '<div class="job-desc-text">' + esc(j.description) + '</div>' : '') +
        '<div class="job-respond-wrap" id="jrw-' + j.id + '">' +
          '<textarea class="job-respond-input" id="jri-' + j.id + '" placeholder="Schrijf een korte reactie (optioneel)..." rows="2"></textarea>' +
          '<button class="btn-primary" style="margin-top:6px;font-size:.82rem;padding:8px 18px" onclick="respondToJob(' + j.id + ')">Reageren</button>' +
          '<div class="form-error" id="jre-' + j.id + '"></div>' +
        '</div>' +
      '</div>'
    ).join('');
  } catch { el.innerHTML = '<p>Fout bij laden opdrachten.</p>'; }
}

async function respondToJob(jobId) {
  const msg   = document.getElementById('jri-' + jobId)?.value.trim();
  const errEl = document.getElementById('jre-' + jobId);
  try {
    const r = await fetch(API + '/job-responses', {
      method: 'POST', headers: ct(),
      body: JSON.stringify({ job_id: jobId, dienstverlener_id: currentUser.id, message: msg || null }),
    });
    const data = await r.json();
    if (!r.ok) { if (errEl) errEl.textContent = data.error; return; }
    showToast('Reactie verstuurd!', 'success');
    const wrap = document.getElementById('jrw-' + jobId);
    if (wrap) wrap.innerHTML = '<p style="color:#6c47ff;font-size:.82rem;font-weight:600;padding:6px 0">✓ Gereageerd</p>';
  } catch { if (errEl) errEl.textContent = 'Verbindingsfout.'; }
}
window.respondToJob = respondToJob;

function _dvAccount() {
  return '<div class="dash-panel hidden" id="dv-p-account">' +
    '<div class="dashboard-panel-title">Settings</div>' +
    _darkModeCard() +
    '<div class="form-group"><label>Huidig e-mailadres</label><input type="text" disabled value="' + esc(currentUser.email) + '" style="background:#f5f5f5;color:#888"></div>' +
    '<div class="form-group"><label>Nieuw e-mailadres <span style="color:#aaa;font-size:.8rem">(laat leeg om ongewijzigd te laten)</span></label><input type="email" id="dv-new-email" placeholder="nieuw@email.com"></div>' +
    '<div class="form-group"><label>Huidig wachtwoord <span style="color:#e53e3e">*</span></label><input type="password" id="dv-cur-pw" placeholder="Verplicht voor wijzigingen"></div>' +
    '<div class="form-error" id="dv-acc-msg"></div>' +
    '<button class="btn-primary" onclick="saveAccountDV()">E-mail opslaan</button>' +
    '<hr style="margin:20px 0;border:none;border-top:1px solid #f0f0f0">' +
    '<div class="dashboard-panel-title" style="font-size:1rem">Wachtwoord wijzigen</div>' +
    '<p style="font-size:.83rem;color:#888;margin-bottom:14px">Na het opslaan ontvang je een bevestigingsmail. Klik op de link in de e-mail om het nieuwe wachtwoord te activeren.</p>' +
    '<div class="form-group"><label>Nieuw wachtwoord</label><input type="password" id="dv-new-pw" placeholder="Minimaal 6 tekens"></div>' +
    '<div class="form-group"><label>Nieuw wachtwoord bevestigen</label><input type="password" id="dv-new-pw-confirm" placeholder="Herhaal nieuw wachtwoord"></div>' +
    '<div class="form-error" id="dv-pw-msg"></div>' +
    '<button class="btn-primary" onclick="requestPasswordChange(\'dv\')">Wachtwoord wijzigen (bevestiging per e-mail)</button>' +
  '</div>';
}

// ── Klant ─────────────────────────────────

function renderKlantDash(el) {
  el.innerHTML =
    '<div class="dashboard-grid">' +
      '<aside class="dashboard-sidebar">' +
        '<div class="dash-card">' +
          (currentUser.profile_picture ? '<img src="' + API + currentUser.profile_picture + '" class="dash-avatar-img">' : '<div class="dash-avatar">' + ini(currentUser.name) + '</div>') +
          '<div class="dash-name">'   + esc(currentUser.name) + '</div>' +
          '<div class="dash-role-tag">Klant</div>' +
        '</div>' +
        '<nav>' +
          '<div class="dash-menu-item active" onclick="klantTab(\'overzicht\',this)">Overzicht</div>' +
          '<div class="dash-menu-item" onclick="klantTab(\'boekingen\',this)">Mijn boekingen</div>' +
          '<div class="dash-menu-item" onclick="klantTab(\'favorieten\',this)">Favorieten</div>' +
          '<div class="dash-menu-item" onclick="klantTab(\'reviews\',this)">Mijn reviews</div>' +
          '<div class="dash-menu-item" onclick="klantTab(\'notificaties\',this)">Notificaties <span id="dash-notif-badge" class="hidden" style="background:#e53e3e;color:#fff;border-radius:50%;padding:1px 6px;font-size:11px;margin-left:4px;"></span></div>' +
          '<div class="dash-menu-item" onclick="klantTab(\'profiel\',this)">Mijn profiel</div>' +
          '<div class="dash-menu-item" onclick="klantTab(\'account\',this)">Settings</div>' +
          (currentUser.is_admin ? '<div class="dash-menu-item" onclick="klantTab(\'admin\',this)">Beheer</div>' : '') +
        '</nav>' +
      '</aside>' +
      '<div class="dashboard-panel">' +
        _klantOverzicht() + _klantBoekingen() + _klantFavorieten() + _klantReviews() + _klantNotifs() + _klantProfiel() + _klantAccount() + (currentUser.is_admin ? _adminPanel() : '') +
      '</div>' +
    '</div>';

  loadKlantOverzicht();
  pollNotifications();
}

function klantTab(panel, el) {
  document.querySelectorAll('#dashboard-content .dash-menu-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('#dashboard-content .dash-panel').forEach(p => p.classList.add('hidden'));
  const target = document.getElementById('kl-p-' + panel);
  if (target) target.classList.remove('hidden');
  if (panel === 'boekingen')    { loadKlantBookings('all'); _resetKlantBkSubTab(); }
  if (panel === 'favorieten')   loadKlantFavorieten();
  if (panel === 'reviews')      loadKlantReviews();
  if (panel === 'notificaties') loadKlantNotifications();
  if (panel === 'admin')        loadAdminPanel();
}
window.klantTab = klantTab;

function klantBkSubTab(sub, el) {
  document.querySelectorAll('#kl-bk-sub-tabs .bk-filter').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('kl-bk-sub-boekingen').style.display  = sub === 'boekingen'  ? '' : 'none';
  document.getElementById('kl-bk-sub-opdrachten').style.display = sub === 'opdrachten' ? '' : 'none';
  if (sub === 'opdrachten') loadKlantOpdrachten();
}
window.klantBkSubTab = klantBkSubTab;

function _resetKlantBkSubTab() {
  const boekEl = document.getElementById('kl-bk-sub-boekingen');
  const opdEl  = document.getElementById('kl-bk-sub-opdrachten');
  if (boekEl) boekEl.style.display = '';
  if (opdEl)  opdEl.style.display  = 'none';
  document.querySelectorAll('#kl-bk-sub-tabs .bk-filter').forEach((b, i) => b.classList.toggle('active', i === 0));
}

function _klantOverzicht() {
  return '<div class="dash-panel" id="kl-p-overzicht">' +
    '<div class="dashboard-panel-title">Welkom, ' + esc(currentUser.name) + '</div>' +
    '<div class="dash-stat-row">' +
      '<div class="dash-card kl-stat-card">Boekingen<br><strong id="kl-stat-total">—</strong></div>' +
      '<div class="dash-card kl-stat-card">In afwachting<br><strong id="kl-stat-pending">—</strong></div>' +
      '<div class="dash-card kl-stat-card">Geaccepteerd<br><strong id="kl-stat-accepted">—</strong></div>' +
      '<div class="dash-card kl-stat-card">Favorieten<br><strong id="kl-stat-favs">—</strong></div>' +
    '</div>' +
    '<div class="dashboard-panel-title" style="margin-top:22px;font-size:1rem">Recente activiteit</div>' +
    '<div id="kl-recent"><p style="color:#aaa;font-size:.85rem">Laden...</p></div>' +
  '</div>';
}

async function loadKlantOverzicht() {
  try {
    const r = await fetch(API + '/my-bookings/' + currentUser.id);
    const bookings = await r.json();

    const total    = bookings.length;
    const pending  = bookings.filter(b => b.status === 'pending').length;
    const accepted = bookings.filter(b => b.status === 'accepted').length;
    const favKey   = 'mkd_fav_' + currentUser.id;
    const favCount = JSON.parse(localStorage.getItem(favKey) || '[]').length;

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('kl-stat-total',    total);
    set('kl-stat-pending',  pending);
    set('kl-stat-accepted', accepted);
    set('kl-stat-favs',     favCount);

    const recentEl = document.getElementById('kl-recent');
    if (!recentEl) return;
    if (!bookings.length) { recentEl.innerHTML = '<p style="color:#aaa;font-size:.85rem">Nog geen boekingen.</p>'; return; }
    recentEl.innerHTML = bookings.slice(0, 5).map(b =>
      '<div class="kl-recent-row">' +
        '<div>' +
          '<strong>' + esc(b.dienstverlener_name) + '</strong>' +
          '<div style="font-size:.8rem;color:#888">' + b.date + (b.time ? ' om ' + b.time : '') + '</div>' +
        '</div>' +
        statusBadge(b.status) +
      '</div>'
    ).join('');
  } catch {}
}

function _klantBoekingen() {
  return '<div class="dash-panel hidden" id="kl-p-boekingen">' +
    '<div class="dashboard-panel-title">Mijn boekingen</div>' +
    '<div class="bk-filter-tabs" id="kl-bk-sub-tabs">' +
      '<button class="bk-filter active" onclick="klantBkSubTab(\'boekingen\',this)">Boekingen</button>' +
      '<button class="bk-filter" onclick="klantBkSubTab(\'opdrachten\',this)">Opdrachten</button>' +
    '</div>' +
    '<div id="kl-bk-sub-boekingen">' +
      '<div class="bk-filter-tabs" style="margin-top:12px">' +
        '<button class="bk-filter active" onclick="klantBkFilter(\'all\',this)">Alle</button>' +
        '<button class="bk-filter" onclick="klantBkFilter(\'pending\',this)">In afwachting</button>' +
        '<button class="bk-filter" onclick="klantBkFilter(\'accepted\',this)">Geaccepteerd</button>' +
        '<button class="bk-filter" onclick="klantBkFilter(\'declined\',this)">Afgewezen</button>' +
      '</div>' +
      '<div id="kl-bk-list"><p>Laden...</p></div>' +
    '</div>' +
    '<div id="kl-bk-sub-opdrachten" style="display:none">' +
      '<div class="job-post-form" style="margin-top:14px">' +
        '<div class="form-group"><label>Titel <span style="color:#e53e3e">*</span></label><input type="text" id="job-title" placeholder="bijv. Elektricien nodig voor installatie"></div>' +
        '<div class="form-group"><label>Categorie <span style="color:#e53e3e">*</span></label><select id="job-cat">' + _catOpts() + '</select></div>' +
        '<div class="form-group"><label>Omschrijving</label><textarea id="job-desc" rows="3" placeholder="Beschrijf wat je nodig hebt..."></textarea></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
          '<div class="form-group"><label>Buurt</label><select id="job-buurt">' + distOpts('') + '</select></div>' +
          '<div class="form-group"><label>Budget (optioneel)</label><input type="text" id="job-budget" placeholder="bijv. SRD 500"></div>' +
        '</div>' +
        '<div class="form-group"><label>Datum nodig</label><input type="date" id="job-date"></div>' +
        '<div class="form-error" id="job-post-err"></div>' +
        '<button class="btn-primary" onclick="postJob()">Opdracht plaatsen</button>' +
      '</div>' +
      '<div class="dashboard-panel-title" style="margin-top:28px;font-size:1rem">Mijn opdrachten</div>' +
      '<div id="kl-job-list"><p style="color:#aaa;font-size:.85rem">Laden...</p></div>' +
    '</div>' +
  '</div>';
}

function _klantFavorieten() {
  return '<div class="dash-panel hidden" id="kl-p-favorieten">' +
    '<div class="dashboard-panel-title">Favorieten</div>' +
    '<div id="kl-fav-list"><p style="color:#aaa;font-size:.85rem">Laden...</p></div>' +
  '</div>';
}

async function loadKlantFavorieten() {
  const el = document.getElementById('kl-fav-list');
  if (!el) return;
  const favKey = 'mkd_fav_' + currentUser.id;
  const favIds = JSON.parse(localStorage.getItem(favKey) || '[]');
  if (!favIds.length) { el.innerHTML = '<p class="empty-plain">Nog geen favorieten opgeslagen.</p>'; return; }

  try {
    const r = await fetch(API + '/dienstverleners');
    const all = await r.json();
    const favs = all.filter(w => favIds.includes(String(w.id)) || favIds.includes(w.id));
    if (!favs.length) { el.innerHTML = '<p class="empty-plain">Favorieten niet gevonden.</p>'; return; }
    el.innerHTML = '<div style="display:flex;flex-direction:column;gap:12px">' +
      favs.map(w =>
        '<div class="booking-item" style="align-items:center">' +
          '<div class="booking-info" style="display:flex;align-items:center;gap:12px">' +
            '<div style="width:44px;height:44px;border-radius:50%;background:' + avatarColor(w.name) + ';display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.9rem;flex-shrink:0">' + ini(w.name) + '</div>' +
            '<div>' +
              '<strong>' + esc(w.name) + '</strong>' +
              '<div style="font-size:.8rem;color:#888">' + esc(w.category || '') + (w.buurt ? ' · ' + esc(w.buurt) : '') + '</div>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;gap:8px;flex-shrink:0">' +
            '<button class="bk-rebook-btn" onclick="showProviderProfile(' + w.id + ')">Bekijken</button>' +
            '<button class="bk-rebook-btn" onclick="openBookingModal(' + w.id + ',\'' + esc(w.name) + '\',\'' + esc(w.working_hours || '') + '\',' + (w.hourly_rate || 0) + ')">Boeken</button>' +
          '</div>' +
        '</div>'
      ).join('') +
    '</div>';
  } catch { el.innerHTML = '<p>Fout bij laden favorieten.</p>'; }
}

function _klantReviews() {
  return '<div class="dash-panel hidden" id="kl-p-reviews">' +
    '<div class="dashboard-panel-title">Mijn reviews</div>' +
    '<div id="kl-review-list"><p style="color:#aaa;font-size:.85rem">Laden...</p></div>' +
  '</div>';
}

async function loadKlantReviews() {
  const el = document.getElementById('kl-review-list');
  if (!el) return;
  try {
    const r       = await fetch(API + '/my-reviews/' + currentUser.id);
    const reviews = await r.json();
    if (!reviews.length) { el.innerHTML = '<p class="empty-plain">Nog geen reviews geschreven.</p>'; return; }
    el.innerHTML = reviews.map(rv =>
      '<div class="review-item">' +
        '<div class="review-header">' +
          '<strong>' + esc(rv.provider_name) + '</strong>' +
          '<span class="review-score">' + rv.score + '%</span>' +
        '</div>' +
        '<p style="color:#555;margin:4px 0 0">' + esc(rv.text) + '</p>' +
        '<small style="color:#aaa">' + new Date(rv.created_at).toLocaleDateString('nl-NL') + '</small>' +
      '</div>'
    ).join('');
  } catch { el.innerHTML = '<p>Fout bij laden reviews.</p>'; }
}

function _klantNotifs() {
  return '<div class="dash-panel hidden" id="kl-p-notificaties">' +
    '<div class="dashboard-panel-title">Notificaties</div>' +
    '<div id="kl-notif-list"><p>Laden...</p></div>' +
  '</div>';
}

function _klantProfiel() {
  return '<div class="dash-panel hidden" id="kl-p-profiel">' +
    '<div class="dashboard-panel-title">Mijn profiel</div>' +
    '<div class="form-group">' +
    '<label>Profielfoto</label>' +
    '<div class="pfp-upload-wrap" onclick="document.getElementById(\'kl-avatar\').click()" title="Klik om foto te wijzigen">' +
    (currentUser.profile_picture
      ? '<img src="' + API + currentUser.profile_picture + '" class="pfp-upload-img">'
      : '<div class="dash-avatar pfp-upload-img" style="font-size:1.8rem">' + ini(currentUser.name) + '</div>') +
    '<div class="pfp-overlay">📷</div>' +
    '</div>' +
    '<div style="font-size:.75rem;color:#aaa;margin-top:8px">Klik op de foto om te wijzigen</div>' +
    '<input type="file" id="kl-avatar" accept="image/*" style="display:none" onchange="uploadAvatarFor(\'kl\')">' +
    '<div class="form-error" id="kl-avatar-msg"></div>' +
    '</div>' +
    '<div class="form-row-2">' +
      '<div class="form-group"><label>Voornaam</label><input type="text" id="kl-firstname" value="' + esc(currentUser.first_name || currentUser.name.split(' ')[0] || '') + '"></div>' +
      '<div class="form-group"><label>Achternaam</label><input type="text" id="kl-lastname" value="' + esc(currentUser.last_name || (currentUser.name.includes(' ') ? currentUser.name.split(' ').slice(1).join(' ') : '')) + '"></div>' +
    '</div>' +
    '<div class="form-group">' +
      '<label>Over mij <span style="color:#aaa;font-size:.8rem;font-weight:400">(optioneel)</span></label>' +
      '<textarea id="kl-bio" rows="4" placeholder="Vertel iets over jezelf...">' + esc(currentUser.bio || '') + '</textarea>' +
    '</div>' +
    '<button class="btn-primary" onclick="saveKlantProfile()">Opslaan</button>' +
    '<div class="form-error" id="kl-prof-msg"></div>' +
  '</div>';
}

async function saveKlantProfile() {
  const first_name = document.getElementById('kl-firstname')?.value.trim() || '';
  const last_name  = document.getElementById('kl-lastname')?.value.trim()  || '';
  const name       = last_name ? first_name + ' ' + last_name : first_name;
  const bio        = document.getElementById('kl-bio')?.value.trim() || null;
  const msgEl      = document.getElementById('kl-prof-msg');

  if (!first_name) { msgEl.style.color = ''; msgEl.textContent = 'Voornaam is verplicht.'; return; }
  try {
    const r = await fetch(API + '/klant-profile/' + currentUser.id, {
      method: 'PUT', headers: ct(),
      body: JSON.stringify({ first_name, last_name: last_name || null, name, bio }),
    });
    const data = await r.json();
    if (!r.ok) { msgEl.style.color = ''; msgEl.textContent = data.error; return; }
    Object.assign(currentUser, { first_name, last_name: last_name || null, name, bio });
    localStorage.setItem('mkd_user', JSON.stringify(currentUser));
    msgEl.style.color = 'green';
    msgEl.textContent = 'Profiel opgeslagen!';
    if (document.getElementById('nav-username')) document.getElementById('nav-username').textContent = name;
    setNavAvatar();
  } catch { msgEl.textContent = 'Verbindingsfout.'; }
}
window.saveKlantProfile = saveKlantProfile;
// Keep old alias for backward compat
window.saveKlantName = saveKlantProfile;

function _catOpts() {
  return '<option value="">Kies categorie</option>' +
    Object.keys(CAT_CSS).map(c => '<option value="' + esc(c) + '">' + esc(c) + '</option>').join('');
}

function _klantOpdrachten() {
  return '<div class="dash-panel hidden" id="kl-p-opdrachten">' +
    '<div class="dashboard-panel-title">Opdracht plaatsen</div>' +
    '<div class="job-post-form">' +
      '<div class="form-group"><label>Titel <span style="color:#e53e3e">*</span></label><input type="text" id="job-title" placeholder="bijv. Elektricien nodig voor installatie"></div>' +
      '<div class="form-group"><label>Categorie <span style="color:#e53e3e">*</span></label><select id="job-cat">' + _catOpts() + '</select></div>' +
      '<div class="form-group"><label>Omschrijving</label><textarea id="job-desc" rows="3" placeholder="Beschrijf wat je nodig hebt..."></textarea></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
        '<div class="form-group"><label>Buurt</label><select id="job-buurt">' + distOpts('') + '</select></div>' +
        '<div class="form-group"><label>Budget (optioneel)</label><input type="text" id="job-budget" placeholder="bijv. SRD 500"></div>' +
      '</div>' +
      '<div class="form-group"><label>Datum nodig</label><input type="date" id="job-date"></div>' +
      '<div class="form-error" id="job-post-err"></div>' +
      '<button class="btn-primary" onclick="postJob()">Opdracht plaatsen</button>' +
    '</div>' +
    '<div class="dashboard-panel-title" style="margin-top:28px;font-size:1rem">Mijn opdrachten</div>' +
    '<div id="kl-job-list"><p style="color:#aaa;font-size:.85rem">Laden...</p></div>' +
  '</div>';
}

async function postJob() {
  const title    = document.getElementById('job-title')?.value.trim();
  const category = document.getElementById('job-cat')?.value;
  const desc     = document.getElementById('job-desc')?.value.trim();
  const buurt    = document.getElementById('job-buurt')?.value;
  const budget   = document.getElementById('job-budget')?.value.trim();
  const date     = document.getElementById('job-date')?.value;
  const errEl    = document.getElementById('job-post-err');
  errEl.textContent = '';

  if (!title)    { errEl.textContent = 'Titel is verplicht.'; return; }
  if (!category) { errEl.textContent = 'Kies een categorie.'; return; }

  try {
    const r = await fetch(API + '/jobs', {
      method: 'POST', headers: ct(),
      body: JSON.stringify({ klant_id: currentUser.id, title, description: desc, category, buurt: buurt || null, budget: budget || null, date_needed: date || null }),
    });
    const data = await r.json();
    if (!r.ok) { errEl.textContent = data.error; return; }
    showToast('Opdracht geplaatst!', 'success');
    document.getElementById('job-title').value = '';
    document.getElementById('job-desc').value  = '';
    document.getElementById('job-cat').value   = '';
    document.getElementById('job-budget').value = '';
    document.getElementById('job-date').value  = '';
    loadKlantOpdrachten();
  } catch { errEl.textContent = 'Verbindingsfout.'; }
}
window.postJob = postJob;

async function loadKlantOpdrachten() {
  const el = document.getElementById('kl-job-list');
  if (!el) return;
  try {
    const r    = await fetch(API + '/jobs/mine/' + currentUser.id);
    const jobs = await r.json();
    if (!jobs.length) { el.innerHTML = '<p class="empty-plain">Nog geen opdrachten geplaatst.</p>'; return; }
    el.innerHTML = jobs.map(j =>
      '<div class="job-card">' +
        '<div class="job-card-top">' +
          '<div>' +
            '<div class="job-title">' + esc(j.title) + '</div>' +
            '<div class="job-meta">' + esc(j.category) + (j.buurt ? ' · ' + esc(j.buurt) : '') + (j.date_needed ? ' · ' + j.date_needed : '') + '</div>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:8px">' +
            '<span class="job-status-badge ' + (j.status === 'open' ? 'job-open' : 'job-closed') + '">' + (j.status === 'open' ? 'Open' : 'Gesloten') + '</span>' +
            (j.status === 'open' ? '<button class="bk-rebook-btn" onclick="closeJob(' + j.id + ')">Sluiten</button>' : '') +
          '</div>' +
        '</div>' +
        (j.description ? '<div class="job-desc-text">' + esc(j.description) + '</div>' : '') +
        '<div class="job-card-footer">' +
          (j.budget ? '<span>💰 ' + esc(j.budget) + '</span>' : '') +
          '<span style="cursor:pointer;color:#6c47ff;font-weight:600" onclick="viewJobResponses(' + j.id + ',this)">💬 ' + j.response_count + ' reactie' + (j.response_count !== 1 ? 's' : '') + '</span>' +
        '</div>' +
        '<div class="job-responses-wrap" id="jr-' + j.id + '" style="display:none"></div>' +
      '</div>'
    ).join('');
  } catch { el.innerHTML = '<p>Fout bij laden opdrachten.</p>'; }
}

async function closeJob(jobId) {
  if (!confirm('Opdracht sluiten?')) return;
  try {
    await fetch(API + '/jobs/' + jobId + '/close', { method: 'PUT', headers: ct() });
    showToast('Opdracht gesloten.', 'info');
    loadKlantOpdrachten();
  } catch {}
}
window.closeJob = closeJob;

async function viewJobResponses(jobId, btn) {
  const wrap = document.getElementById('jr-' + jobId);
  if (!wrap) return;
  if (wrap.style.display !== 'none') { wrap.style.display = 'none'; return; }
  wrap.innerHTML = '<p style="color:#aaa;font-size:.82rem;padding:8px 0">Laden...</p>';
  wrap.style.display = '';
  try {
    const r    = await fetch(API + '/job-responses/' + jobId);
    const resp = await r.json();
    if (!resp.length) { wrap.innerHTML = '<p class="empty-plain" style="font-size:.82rem">Nog geen reacties.</p>'; return; }
    wrap.innerHTML = '<div style="margin-top:10px;display:flex;flex-direction:column;gap:8px">' +
      resp.map(rv =>
        '<div class="job-response-item">' +
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">' +
            '<div style="width:32px;height:32px;border-radius:50%;background:' + avatarColor(rv.dv_name) + ';display:flex;align-items:center;justify-content:center;color:#fff;font-size:.75rem;font-weight:700;flex-shrink:0">' + ini(rv.dv_name) + '</div>' +
            '<div><strong>' + esc(rv.dv_name) + '</strong>' + (rv.hourly_rate ? '<span style="color:#6c47ff;font-size:.78rem;margin-left:6px">SRD ' + rv.hourly_rate + '/u</span>' : '') + '</div>' +
          '</div>' +
          (rv.message ? '<div style="font-size:.82rem;color:#555">' + esc(rv.message) + '</div>' : '') +
          '<div style="margin-top:6px;display:flex;gap:6px">' +
            '<button class="bk-rebook-btn" onclick="showProviderProfile(' + rv.dienstverlener_id + ')">Profiel bekijken</button>' +
            '<button class="bk-rebook-btn" onclick="openBookingModal(' + rv.dienstverlener_id + ',\'' + esc(rv.dv_name) + '\')">Boeken</button>' +
          '</div>' +
        '</div>'
      ).join('') +
    '</div>';
  } catch { wrap.innerHTML = '<p>Fout bij laden reacties.</p>'; }
}
window.viewJobResponses = viewJobResponses;

function _klantAccount() {
  return '<div class="dash-panel hidden" id="kl-p-account">' +
    '<div class="dashboard-panel-title">Settings</div>' +
    _darkModeCard() +
    '<div class="form-group"><label>Huidig e-mailadres</label><input type="text" disabled value="' + esc(currentUser.email) + '" style="background:#f5f5f5;color:#888"></div>' +
    '<div class="form-group"><label>Nieuw e-mailadres <span style="color:#aaa;font-size:.8rem">(laat leeg om ongewijzigd te laten)</span></label><input type="email" id="kl-new-email" placeholder="nieuw@email.com"></div>' +
    '<div class="form-group"><label>District</label><select id="kl-buurt">' + distOpts(currentUser.buurt) + '</select></div>' +
    '<div class="form-group"><label>Huidig wachtwoord <span style="color:#e53e3e">*</span></label><input type="password" id="kl-cur-pw" placeholder="Verplicht voor wijzigingen"></div>' +
    '<div class="form-error" id="kl-acc-msg"></div>' +
    '<button class="btn-primary" onclick="saveAccountKlant()">E-mail / District opslaan</button>' +
    '<hr style="margin:20px 0;border:none;border-top:1px solid #f0f0f0">' +
    '<div class="dashboard-panel-title" style="font-size:1rem">Wachtwoord wijzigen</div>' +
    '<p style="font-size:.83rem;color:#888;margin-bottom:14px">Na het opslaan ontvang je een bevestigingsmail. Klik op de link in de e-mail om het nieuwe wachtwoord te activeren.</p>' +
    '<div class="form-group"><label>Nieuw wachtwoord</label><input type="password" id="kl-new-pw" placeholder="Minimaal 6 tekens"></div>' +
    '<div class="form-group"><label>Nieuw wachtwoord bevestigen</label><input type="password" id="kl-new-pw-confirm" placeholder="Herhaal nieuw wachtwoord"></div>' +
    '<div class="form-error" id="kl-pw-msg"></div>' +
    '<button class="btn-primary" onclick="requestPasswordChange(\'kl\')">Wachtwoord wijzigen (bevestiging per e-mail)</button>' +
  '</div>';
}

// ─────────────────────────────────────────
// ADMIN DASHBOARD
// ─────────────────────────────────────────

function _adminPanel() {
  return '<div class="dash-panel hidden" id="kl-p-admin">' +
    '<div class="dashboard-panel-title">Beheerdersdashboard</div>' +
    '<div class="admin-stat-grid" id="admin-stats-grid"><p style="color:#aaa">Laden...</p></div>' +
    '<div class="dashboard-panel-title" style="font-size:1rem;margin-top:20px">Gebruikers</div>' +
    '<div id="admin-user-list"><p style="color:#aaa;font-size:.85rem">Laden...</p></div>' +
  '</div>';
}

function _dvAdminPanel() {
  return '<div class="dash-panel hidden" id="dv-p-admin">' +
    '<div class="dashboard-panel-title">Beheerdersdashboard</div>' +
    '<div class="admin-stat-grid" id="admin-stats-grid"><p style="color:#aaa">Laden...</p></div>' +
    '<div class="dashboard-panel-title" style="font-size:1rem;margin-top:20px">Gebruikers</div>' +
    '<div id="admin-user-list"><p style="color:#aaa;font-size:.85rem">Laden...</p></div>' +
  '</div>';
}

async function loadAdminPanel() {
  if (!currentUser?.is_admin) return;
  const statsEl = document.getElementById('admin-stats-grid');
  const listEl  = document.getElementById('admin-user-list');
  if (!statsEl || !listEl) return;

  try {
    const [sRes, uRes] = await Promise.all([
      fetch(API + '/admin/stats', { headers: { 'x-user-id': currentUser.id } }),
      fetch(API + '/admin/users', { headers: { 'x-user-id': currentUser.id } }),
    ]);
    const stats = await sRes.json();
    const users = await uRes.json();

    if (!sRes.ok) { statsEl.innerHTML = '<p style="color:red">' + esc(stats.error) + '</p>'; return; }

    statsEl.innerHTML =
      statCard(stats.total_users,    'Gebruikers') +
      statCard(stats.total_klanten,  'Klanten') +
      statCard(stats.total_dv,       'Dienstverleners') +
      statCard(stats.total_bookings, 'Boekingen') +
      statCard(stats.total_jobs,     'Opdrachten') +
      statCard(stats.unverified,     'Niet-geverifieerd');

    if (!uRes.ok || !users.length) { listEl.innerHTML = '<p class="empty-plain">Geen gebruikers gevonden.</p>'; return; }
    listEl.innerHTML = users.map(u =>
      '<div class="admin-user-row">' +
        '<div class="au-name">' + esc(u.name) + '<div style="font-size:.75rem;color:#aaa">' + esc(u.email) + '</div></div>' +
        '<span class="au-role' + (u.role === 'dienstverlener' ? ' dv' : '') + '">' + esc(u.role) + '</span>' +
        (u.is_admin ? '<span class="au-role" style="background:#f0ecff;color:#6c47ff">admin</span>' : '') +
        (!u.email_verified ? '<span class="au-unverified">Niet geverif.</span>' : '') +
        (u.id !== currentUser.id ? '<button class="admin-del-btn" onclick="adminDeleteUser(' + u.id + ',\'' + esc(u.name) + '\')">Verwijderen</button>' : '') +
      '</div>'
    ).join('');
  } catch { statsEl.innerHTML = '<p style="color:red">Fout bij laden beheerdata.</p>'; }
}
window.loadAdminPanel = loadAdminPanel;

function statCard(n, label) {
  return '<div class="admin-stat-card"><strong>' + (n ?? '—') + '</strong><span>' + label + '</span></div>';
}

async function adminDeleteUser(userId, name) {
  if (!confirm('Gebruiker "' + name + '" definitief verwijderen?')) return;
  try {
    const r = await fetch(API + '/admin/users/' + userId, {
      method: 'DELETE', headers: { 'x-user-id': currentUser.id },
    });
    const data = await r.json();
    showToast(r.ok ? 'Gebruiker verwijderd.' : data.error, r.ok ? 'info' : 'error');
    if (r.ok) loadAdminPanel();
  } catch { showToast('Verbindingsfout.', 'error'); }
}
window.adminDeleteUser = adminDeleteUser;

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

let _klantBkCache = [];

function klantBkFilter(filter, btn) {
  document.querySelectorAll('.bk-filter').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  _renderKlantBkList(filter);
}
window.klantBkFilter = klantBkFilter;

function _renderKlantBkList(filter) {
  const el = document.getElementById('kl-bk-list');
  if (!el) return;
  const bookings = filter === 'all' ? _klantBkCache : _klantBkCache.filter(b => b.status === filter);
  if (!bookings.length) { el.innerHTML = '<p class="empty-plain">Geen boekingen gevonden.</p>'; return; }
  el.innerHTML = bookings.map(b =>
    '<div class="booking-item">' +
      '<div class="booking-info">' +
        '<strong>' + esc(b.dienstverlener_name) + '</strong>' +
        '<div>' + b.date + (b.time ? ' om ' + b.time : '') + (b.duration_minutes ? ' · ' + fmtDur(b.duration_minutes) : '') + '</div>' +
        (b.message ? '<div class="booking-msg">"' + esc(b.message) + '"</div>' : '') +
      '</div>' +
      '<div class="booking-right">' +
        statusBadge(b.status) +
        '<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">' +
          (b.status === 'pending'
            ? '<button class="btn-no" style="font-size:.75rem;padding:4px 10px" onclick="cancelKlantBooking(' + b.id + ',' + b.dienstverlener_id + ')">Annuleren</button>'
            : '') +
          '<button class="bk-rebook-btn" onclick="openBookingModal(' + b.dienstverlener_id + ',\'' + esc(b.dienstverlener_name) + '\')">Opnieuw boeken</button>' +
        '</div>' +
      '</div>' +
    '</div>'
  ).join('');
}

async function loadKlantBookings(filter) {
  const el = document.getElementById('kl-bk-list');
  if (!el) return;
  try {
    const r = await fetch(API + '/my-bookings/' + currentUser.id);
    _klantBkCache = await r.json();
    _renderKlantBkList(filter || 'all');
  } catch { el.innerHTML = '<p>Fout bij laden boekingen.</p>'; }
}

async function cancelKlantBooking(bookingId, dvId) {
  if (!confirm('Boeking annuleren?')) return;
  try {
    const r = await fetch(API + '/bookings/' + bookingId, {
      method: 'PUT', headers: ct(),
      body: JSON.stringify({ status: 'cancelled', dienstverlener_id: dvId, klant_name: currentUser.name }),
    });
    if (!r.ok) throw new Error();
    showToast('Boeking geannuleerd.', 'info');
    loadKlantBookings('all');
    loadKlantOverzicht();
  } catch { showToast('Fout bij annuleren.', 'error'); }
}
window.cancelKlantBooking = cancelKlantBooking;

// ─────────────────────────────────────────
// PORTFOLIO
// ─────────────────────────────────────────

async function loadDVPortfolio() {
  const grid = document.getElementById('dv-portfolio-grid');
  if (!grid) return;
  try {
    const r     = await fetch(API + '/portfolio/' + currentUser.id);
    const items = await r.json();
    if (!items.length) { grid.innerHTML = '<p style="font-size:.8rem;color:#aaa;grid-column:1/-1">Nog geen portfolio items.</p>'; return; }
    grid.innerHTML = items.map(item =>
      '<div class="portfolio-thumb" style="position:relative;aspect-ratio:1;border-radius:8px;overflow:hidden;background:#111">' +
        (item.file_type === 'video'
          ? '<video src="' + API + item.file_path + '" style="width:100%;height:100%;object-fit:cover" muted playsinline></video>'
          : '<img src="' + API + item.file_path + '" style="width:100%;height:100%;object-fit:cover" loading="lazy">') +
        '<button onclick="deletePortfolioItem(' + item.id + ',this)" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,.7);border:none;color:#fff;border-radius:50%;width:22px;height:22px;cursor:pointer;font-size:.75rem;line-height:22px;text-align:center">✕</button>' +
      '</div>'
    ).join('');
  } catch { grid.innerHTML = '<p style="font-size:.8rem;color:#aaa">Fout bij laden portfolio.</p>'; }
}

async function uploadPortfolioItem() {
  const input  = document.getElementById('dv-portfolio-input');
  const msgEl  = document.getElementById('dv-portfolio-msg');
  const file   = input?.files?.[0];
  if (!file) return;
  msgEl.textContent = 'Uploaden...';
  const fd = new FormData();
  fd.append('file', file);
  try {
    const r = await fetch(API + '/portfolio/' + currentUser.id, { method: 'POST', body: fd });
    const d = await r.json();
    if (!r.ok) { msgEl.textContent = d.error; return; }
    msgEl.textContent = '';
    input.value = '';
    loadDVPortfolio();
    showToast('Item toegevoegd!', 'success');
  } catch { msgEl.textContent = 'Uploadfout.'; }
}
window.uploadPortfolioItem = uploadPortfolioItem;

async function deletePortfolioItem(id, btn) {
  btn.textContent = '…';
  try {
    await fetch(API + '/portfolio/item/' + id, { method: 'DELETE' });
    loadDVPortfolio();
  } catch { btn.textContent = '✕'; }
}
window.deletePortfolioItem = deletePortfolioItem;

// ─────────────────────────────────────────
// NOTIFICATIONS (dashboard)
// ─────────────────────────────────────────

function _notifSource(msg) {
  if (msg.startsWith('📅'))  return { label: '📋 Boekingen',     tab: 'boekingen',  color: '#4a90d9' };
  if (msg.startsWith('✅'))  return { label: '📋 Boekingen',     tab: 'boekingen',  color: '#38a169' };
  if (msg.startsWith('❌'))  return { label: '📋 Boekingen',     tab: 'boekingen',  color: '#e53e3e' };
  if (msg.startsWith('💼'))  return { label: '💼 Opdrachten',    tab: 'opdrachten', color: '#805ad5' };
  if (msg.startsWith('⭐') || msg.startsWith('🌟'))
                              return { label: '⭐ Beoordelingen', tab: 'profiel',    color: '#d97706' };
  return null;
}

function _goToDashTab(panel) {
  const items = document.querySelectorAll('#dashboard-content .dash-menu-item');
  for (const item of items) {
    const oc = item.getAttribute('onclick') || '';
    if (oc.includes("'" + panel + "'")) { item.click(); return; }
  }
}
window._goToDashTab = _goToDashTab;

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

    el.innerHTML = notifs.map(n => {
      const src  = _notifSource(n.message);
      const date = new Date(n.created_at);
      const dateStr = date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
      const timeStr = date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
      const srcBadge = src
        ? '<span class="notif-src-badge" style="background:' + src.color + '22;color:' + src.color + ';border:1px solid ' + src.color + '44">' + src.label + '</span>'
        : '';
      const clickAttr = src ? ' onclick="_goToDashTab(\'' + src.tab + '\')" style="cursor:pointer"' : '';
      return '<div class="notif-item' + (n.is_read ? '' : ' notif-unread') + '"' + clickAttr + '>' +
        srcBadge +
        '<div class="notif-msg">' + esc(n.message) + '</div>' +
        '<small>' + dateStr + ' · ' + timeStr + '</small>' +
      '</div>';
    }).join('');
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
  const first_name    = document.getElementById('dv-firstname')?.value.trim() || '';
  const last_name     = document.getElementById('dv-lastname')?.value.trim()  || '';
  const name          = last_name ? first_name + ' ' + last_name : first_name;
  const category      = document.getElementById('dv-cat').value.trim();
  const experience    = document.getElementById('dv-exp').value.trim();
  const bio           = document.getElementById('dv-bio').value.trim();
  const hourly_rate   = document.getElementById('dv-rate').value;
  const buurt         = document.getElementById('dv-buurt').value;
  const phone         = document.getElementById('dv-phone').value.trim();
  const working_hours = _schedPickerVal('dv');
  const msgEl         = document.getElementById('dv-prof-msg');

  if (!first_name) { msgEl.style.color = ''; msgEl.textContent = 'Voornaam is verplicht.'; return; }

  try {
    const r = await fetch(API + '/profile/' + currentUser.id, {
      method: 'PUT', headers: ct(),
      body: JSON.stringify({ first_name, last_name: last_name || null, name, category, experience, bio, hourly_rate: hourly_rate || null, buurt, phone: phone || null, working_hours: working_hours || null }),
    });
    const data = await r.json();
    if (!r.ok) { msgEl.textContent = data.error; return; }

    Object.assign(currentUser, { first_name, last_name: last_name || null, name, category, experience, bio, hourly_rate, buurt, phone, working_hours });
    localStorage.setItem('mkd_user', JSON.stringify(currentUser));
    msgEl.style.color = 'green';
    msgEl.textContent = 'Profiel opgeslagen!';
    if (document.getElementById('nav-username')) document.getElementById('nav-username').textContent = name;
    setNavAvatar();
  } catch { msgEl.textContent = 'Verbindingsfout.'; }
}
window.saveProfile = saveProfile;

async function uploadAvatarFor(prefix) {
  const file  = document.getElementById(prefix + '-avatar')?.files[0];
  const msgEl = document.getElementById(prefix + '-avatar-msg');
  if (!file) { if (msgEl) msgEl.textContent = 'Kies eerst een afbeelding.'; return; }
  const form = new FormData();
  form.append('avatar', file);
  try {
    const r = await fetch(API + '/upload/avatar/' + currentUser.id, { method: 'POST', body: form });
    const data = await r.json();
    if (!r.ok) { if (msgEl) msgEl.textContent = data.error; return; }
    currentUser.profile_picture = data.url;
    localStorage.setItem('mkd_user', JSON.stringify(currentUser));
    if (msgEl) { msgEl.style.color = 'green'; msgEl.textContent = 'Foto opgeslagen!'; }
    setNavAvatar();
    renderDashboard();
  } catch { if (msgEl) msgEl.textContent = 'Verbindingsfout.'; }
}
window.uploadAvatarFor = uploadAvatarFor;

async function uploadAvatar() { await uploadAvatarFor('dv'); }
window.uploadAvatar = uploadAvatar;

function _darkModeCard() {
  const isDark = document.body.classList.contains('dark-mode');
  return '<div class="dark-mode-card">' +
    '<div class="avail-toggle-info">' +
      '<span style="font-size:1.3rem">' + (isDark ? '☀️' : '🌙') + '</span>' +
      '<div><strong>Nachtmodus</strong><div style="font-size:.8rem;color:#888">Donker kleurenschema</div></div>' +
    '</div>' +
    '<label class="avail-switch">' +
      '<input type="checkbox"' + (isDark ? ' checked' : '') + ' onchange="toggleDarkMode()">' +
      '<span class="avail-slider"></span>' +
    '</label>' +
  '</div>';
}

function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('mkd_dark', isDark ? '1' : '0');
  const icon  = document.getElementById('dark-mode-icon');
  const label = document.getElementById('dark-mode-label');
  if (icon)  icon.textContent  = isDark ? '☀️' : '🌙';
  if (label) label.textContent = isDark ? 'Lichte modus' : 'Nachtmodus';
}
window.toggleDarkMode = toggleDarkMode;

async function toggleAvailability(isAvail) {
  if (!currentUser) return;
  try {
    await fetch(API + '/availability/' + currentUser.id, {
      method: 'PUT', headers: ct(),
      body: JSON.stringify({ is_available: isAvail }),
    });
    currentUser.is_available = isAvail ? 1 : 0;
    localStorage.setItem('mkd_user', JSON.stringify(currentUser));
    const dot = document.querySelector('.avail-toggle-dot');
    const lbl = document.querySelector('.avail-toggle-info strong');
    const sub = document.querySelector('.avail-toggle-info div > div');
    if (dot) dot.classList.toggle('busy', !isAvail);
    if (lbl) lbl.textContent = isAvail ? 'Beschikbaar' : 'Bezet';
    if (sub) sub.textContent = 'Klanten kunnen ' + (isAvail ? '' : 'geen ') + 'boeking aanvragen';
    showToast(isAvail ? 'Je bent nu beschikbaar.' : 'Je staat op bezet.', 'info');
  } catch {
    showToast('Fout bij bijwerken.', 'error');
  }
}
window.toggleAvailability = toggleAvailability;

function saveAccountDV() {
  const newEmail = document.getElementById('dv-new-email').value.trim();
  const curPw    = document.getElementById('dv-cur-pw').value;
  const msgEl    = document.getElementById('dv-acc-msg');
  _saveAccountEmail(newEmail, curPw, null, msgEl);
}
window.saveAccountDV = saveAccountDV;

function saveAccountKlant() {
  const newEmail = document.getElementById('kl-new-email').value.trim();
  const curPw    = document.getElementById('kl-cur-pw').value;
  const newBuurt = document.getElementById('kl-buurt').value;
  const msgEl    = document.getElementById('kl-acc-msg');
  _saveAccountEmail(newEmail, curPw, newBuurt, msgEl);
}
window.saveAccountKlant = saveAccountKlant;

async function _saveAccountEmail(newEmail, curPw, newBuurt, msgEl) {
  msgEl.style.color = '';
  if (!newEmail && !newBuurt) { msgEl.textContent = 'Geen wijzigingen om op te slaan.'; return; }
  if (newEmail) {
    if (!curPw) { msgEl.textContent = 'Vul je huidig wachtwoord in om je e-mailadres te wijzigen.'; return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(newEmail)) {
      msgEl.textContent = 'Voer een geldig e-mailadres in.'; return;
    }
  }

  const body = {};
  if (newEmail)  body.current_password = curPw;
  if (newEmail)  body.email = newEmail;
  if (newBuurt)  body.buurt = newBuurt;

  try {
    const r = await fetch(API + '/account/' + currentUser.id, { method: 'PUT', headers: ct(), body: JSON.stringify(body) });
    const data = await r.json();
    if (!r.ok) { msgEl.textContent = data.error; return; }
    if (newEmail) currentUser.email = newEmail;
    if (newBuurt) currentUser.buurt = newBuurt;
    localStorage.setItem('mkd_user', JSON.stringify(currentUser));
    msgEl.style.color = 'green';
    msgEl.textContent = 'Gegevens bijgewerkt!';
  } catch { msgEl.textContent = 'Verbindingsfout.'; }
}

async function requestPasswordChange(prefix) {
  const curPw   = document.getElementById(prefix === 'dv' ? 'dv-cur-pw' : 'kl-cur-pw')?.value;
  const newPw   = document.getElementById(prefix + '-new-pw')?.value;
  const confirm = document.getElementById(prefix + '-new-pw-confirm')?.value;
  const msgEl   = document.getElementById(prefix + '-pw-msg');
  msgEl.style.color = '';
  msgEl.textContent = '';

  if (!curPw)              { msgEl.textContent = 'Vul je huidig wachtwoord in.'; return; }
  if (!newPw)              { msgEl.textContent = 'Vul een nieuw wachtwoord in.'; return; }
  if (newPw.length < 6)   { msgEl.textContent = 'Nieuw wachtwoord moet minimaal 6 tekens zijn.'; return; }
  if (newPw !== confirm)   { msgEl.textContent = 'Wachtwoorden komen niet overeen.'; return; }

  try {
    const r = await fetch(API + '/change-password/request', {
      method: 'POST', headers: ct(),
      body: JSON.stringify({ user_id: currentUser.id, current_password: curPw, new_password: newPw }),
    });
    const data = await r.json();
    if (!r.ok) { msgEl.textContent = data.error; return; }
    msgEl.style.color = 'green';
    msgEl.textContent = data.message;
    document.getElementById(prefix + '-new-pw').value         = '';
    document.getElementById(prefix + '-new-pw-confirm').value = '';
  } catch { msgEl.textContent = 'Verbindingsfout.'; }
}
window.requestPasswordChange = requestPasswordChange;

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
// CHAT
// ─────────────────────────────────────────

function openChat(userId, name, avatar) {
  if (!currentUser) { openAuthModal('login'); return; }
  _renderChatView();
  showView('chat');
  if (userId) selectConversation(userId, name, avatar);
}
window.openChat = openChat;

function closeChat() {
  if (chatPollTimer) { clearInterval(chatPollTimer); chatPollTimer = null; }
  activeChatUid = null;
}

function _renderChatView() {
  const el = document.getElementById('view-chat');
  if (!el) return;
  el.innerHTML =
    '<div class="cv-layout">' +
      '<div class="cv-sidebar">' +
        '<div class="cv-sidebar-header">' +
          '<button class="cv-back-btn" onclick="showView(\'home\')">&#8592; Terug</button>' +
          '<div style="font-size:1.15rem;font-weight:700;margin-top:10px">💬 Berichten</div>' +
        '</div>' +
        '<div id="cv-convos"><div class="chat-empty" style="padding:24px;font-size:.85rem">Laden...</div></div>' +
      '</div>' +
      '<div class="cv-main" id="cv-main">' +
        '<div class="chat-empty" style="flex-direction:column;gap:8px">' +
          '<span style="font-size:2.5rem">💬</span>' +
          '<span>Kies een gesprek om te starten</span>' +
        '</div>' +
      '</div>' +
    '</div>';
  loadConversations();
}

async function loadConversations() {
  if (!currentUser) return;
  const el = document.getElementById('cv-convos');
  if (!el) return;
  try {
    const r = await fetch(API + '/conversations/' + currentUser.id);
    const convos = await r.json();
    if (!convos.length) {
      el.innerHTML = '<div class="chat-empty" style="padding:24px;font-size:.85rem;flex-direction:column;gap:4px"><span style="font-size:1.8rem">📭</span><span>Nog geen gesprekken</span></div>';
      return;
    }
    el.innerHTML = convos.map(c =>
      '<div class="chat-convo-item' + (activeChatUid == c.id ? ' active' : '') + '" data-uid="' + c.id + '" onclick="selectConversation(' + c.id + ',\'' + esc(c.name) + '\',\'' + esc(c.profile_picture || '') + '\')">' +
        '<div class="chat-convo-avatar" style="background:' + avatarColor(c.name) + '">' +
          (c.profile_picture ? '<img src="' + API + c.profile_picture + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover">' : ini(c.name)) +
        '</div>' +
        '<div class="chat-convo-info">' +
          '<div class="chat-convo-name">' + esc(c.name) + '</div>' +
          '<div class="chat-convo-last">' + esc(c.last_message || '') + '</div>' +
        '</div>' +
        (c.unread_count > 0 ? '<div class="chat-convo-badge">' + c.unread_count + '</div>' : '') +
      '</div>'
    ).join('');
  } catch { el.innerHTML = '<div class="chat-empty">Kon gesprekken niet laden.</div>'; }
}

async function selectConversation(userId, name, avatar) {
  activeChatUid = userId;
  const mainEl = document.getElementById('cv-main');
  if (!mainEl) return;

  document.querySelectorAll('.chat-convo-item').forEach(el => {
    el.classList.toggle('active', el.dataset.uid == userId);
  });

  mainEl.innerHTML =
    '<div class="cv-active-header">' +
      '<div class="chat-convo-avatar" style="background:' + avatarColor(name) + ';width:38px;height:38px;font-size:.88rem;flex-shrink:0">' +
        (avatar ? '<img src="' + API + avatar + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover">' : ini(name)) +
      '</div>' +
      '<div><div style="font-weight:700">' + esc(name) + '</div></div>' +
    '</div>' +
    '<div class="cv-messages" id="chat-messages"></div>' +
    '<div class="cv-input-row">' +
      '<input type="text" class="cv-input" id="chat-input" placeholder="Schrijf een bericht..." onkeydown="if(event.key===\'Enter\')sendChatMessage()">' +
      '<button class="cv-send-btn" onclick="sendChatMessage()">Stuur →</button>' +
    '</div>';

  await loadChatMessages(userId);
  fetch(API + '/messages/read', { method: 'PUT', headers: ct(), body: JSON.stringify({ reader_id: currentUser.id, sender_id: userId }) });
  loadConversations();

  if (chatPollTimer) clearInterval(chatPollTimer);
  chatPollTimer = setInterval(() => loadChatMessages(userId, true), 4000);
}
window.selectConversation = selectConversation;

async function loadChatMessages(withUserId, silent = false) {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  try {
    const r = await fetch(API + '/messages/' + currentUser.id + '/' + withUserId);
    const msgs = await r.json();
    const atBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 60;
    container.innerHTML = msgs.length
      ? msgs.map(m => {
          const mine = m.sender_id == currentUser.id;
          const time = new Date(m.created_at).toLocaleTimeString('nl', { hour: '2-digit', minute: '2-digit' });
          return '<div class="chat-msg ' + (mine ? 'mine' : 'theirs') + '">' +
            esc(m.message) +
            '<div class="chat-msg-time">' + time + '</div>' +
          '</div>';
        }).join('')
      : '<div class="chat-empty" style="font-size:.83rem">Stuur het eerste bericht!</div>';
    if (!silent || atBottom) container.scrollTop = container.scrollHeight;
  } catch { /* silent */ }
}

async function sendChatMessage() {
  if (!currentUser || !activeChatUid) return;
  const input = document.getElementById('chat-input');
  const msg = input?.value.trim();
  if (!msg) return;
  input.value = '';
  try {
    const r = await fetch(API + '/messages', {
      method: 'POST', headers: ct(),
      body: JSON.stringify({ sender_id: currentUser.id, receiver_id: activeChatUid, message: msg }),
    });
    const data = await r.json();
    if (data.dnd) {
      showToast('Deze gebruiker heeft Niet Storen ingeschakeld.', 'info');
      input.value = msg;
      return;
    }
    await loadChatMessages(activeChatUid);
    loadConversations();
  } catch { showToast('Fout bij verzenden.', 'error'); }
}
window.sendChatMessage = sendChatMessage;

async function toggleDND(isOn) {
  if (!currentUser) return;
  try {
    await fetch(API + '/dnd/' + currentUser.id, {
      method: 'PUT', headers: ct(),
      body: JSON.stringify({ dnd_mode: isOn }),
    });
    currentUser.dnd_mode = isOn ? 1 : 0;
    localStorage.setItem('mkd_user', JSON.stringify(currentUser));
    const dot = document.querySelector('#dv-p-overzicht .avail-toggle-card:last-of-type .avail-toggle-dot');
    const lbl = document.querySelector('#dnd-check')?.closest('.avail-toggle-card')?.querySelector('strong');
    const slider = document.querySelector('#dnd-check ~ .avail-slider');
    if (dot) dot.classList.toggle('busy', isOn);
    if (lbl) lbl.textContent = 'Niet Storen ' + (isOn ? '(aan)' : '(uit)');
    if (slider) slider.style.background = isOn ? '#ef4444' : '#ccc';
    showToast(isOn ? 'Niet Storen ingeschakeld.' : 'Niet Storen uitgeschakeld.', 'info');
  } catch { showToast('Fout bij bijwerken.', 'error'); }
}
window.toggleDND = toggleDND;

async function pollMsgCount() {
  if (!currentUser) return;
  try {
    const r = await fetch(API + '/messages/unread/' + currentUser.id);
    const { count } = await r.json();
    const navBadge  = document.getElementById('chat-nav-badge');
    const dashBadge = document.getElementById('dash-chat-badge');
    [navBadge, dashBadge].forEach(b => {
      if (!b) return;
      b.textContent = count;
      b.style.display = count === 0 ? 'none' : 'inline';
    });
  } catch { /* silent */ }
}

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
    '.notif-item{padding:12px 0;border-bottom:1px solid #f0f0f0;transition:background .15s}',
    '.notif-item[onclick]:hover{background:#f7f7fc;border-radius:8px;padding:12px 8px;margin:0 -8px}',
    '.notif-unread .notif-msg{font-weight:600}',
    '.notif-item small{color:#aaa;font-size:.8rem}',
    '.notif-msg{margin:4px 0 2px}',
    '.notif-src-badge{display:inline-block;font-size:.72rem;font-weight:600;border-radius:20px;padding:1px 8px;margin-bottom:4px;letter-spacing:.01em}',
    '.empty-plain{color:#aaa;font-style:italic}',
    '@media(max-width:768px){.dashboard-grid{grid-template-columns:1fr}}',
    '.meta-score{background:#fff8e1;color:#b7791f;border-radius:20px;padding:2px 8px;font-size:.8rem;font-weight:600}',
    '.cat-icon{font-size:2rem;margin-bottom:8px}',
    '.btn-fav{font-size:1.1rem;background:rgba(0,0,0,.25);border:none;cursor:pointer;padding:4px 8px;color:#fff;border-radius:50%;line-height:1;opacity:1!important}',
    '.dash-avatar-img{width:56px;height:56px;border-radius:50%;object-fit:cover;margin:0 auto 8px;display:block}',
    // Card redesign
    '.pcard-avatar-section{display:flex;flex-direction:column;align-items:center;padding:4px 0 6px}',
    '.pcard-score-badge{display:flex;align-items:center;gap:4px;margin-top:5px}',
    '.pcard-score-num{background:rgba(34,197,94,.12);color:#15803d;border:1.5px solid #22c55e;border-radius:20px;padding:1px 9px;font-size:.8rem;font-weight:700}',
    '.pcard-review-cnt{font-size:.75rem;color:var(--text-muted)}',
    '.top10-section .pcard-review-cnt{color:rgba(255,255,255,.5)}',
    '.pcard-chip-dist{background:rgba(236,72,153,.1);color:#be185d}',
    '.pcard-chip-cat{background:rgba(245,158,11,.1);color:#b45309}',
    '.top10-section .pcard-chip-dist{background:rgba(236,72,153,.2);color:#f9a8d4}',
    '.top10-section .pcard-chip-cat{background:rgba(245,158,11,.2);color:#fde68a}',
    '.avail-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#22c55e;vertical-align:middle}',
    '.avail-dot.busy{background:#ef4444}',
    // Profile page 2-column layout
    // Profile – v7.1 style
    '.profile-header-bg{background:var(--primary);padding:48px 0 40px;position:relative;overflow:hidden}',
    '.profile-header-bg::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at 80% 50%,rgba(255,255,255,.08) 0,transparent 60%),repeating-linear-gradient(45deg,rgba(255,255,255,.02) 0,rgba(255,255,255,.02) 1px,transparent 1px,transparent 50px);pointer-events:none}',
    '.profile-header-inner{max-width:1240px;margin:0 auto;padding:0 24px;position:relative}',
    '.profile-back{display:inline-flex;align-items:center;gap:6px;color:rgba(255,255,255,.65);font-size:.85rem;cursor:pointer;margin-bottom:24px;transition:color .2s}',
    '.profile-back:hover{color:#fff}',
    '.profile-top{display:flex;align-items:flex-end;gap:28px;flex-wrap:wrap}',
    '.profile-avatar-lg{width:110px;height:110px;border-radius:50%;border:4px solid rgba(255,255,255,.3);display:flex;align-items:center;justify-content:center;font-size:2.4rem;font-weight:700;color:#fff;overflow:hidden;flex-shrink:0;box-shadow:0 4px 20px rgba(0,0,0,.2)}',
    '.profile-avatar-lg img{width:100%;height:100%;object-fit:cover}',
    '.profile-header-info{flex:1;min-width:200px}',
    '.profile-header-info h1{font-family:var(--font-display);font-size:2.2rem;font-weight:700;color:#fff;margin:0 0 6px;text-shadow:0 1px 6px rgba(0,0,0,.2)}',
    '.profile-tagline{font-size:.95rem;color:rgba(255,255,255,.72);margin-bottom:14px}',
    '.profile-badges{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}',
    '.profile-badge{display:inline-flex;align-items:center;gap:5px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);padding:4px 12px;border-radius:20px;font-size:.78rem;color:rgba(255,255,255,.9);backdrop-filter:blur(4px)}',
    '.prof-avail-badge{display:inline-flex;align-items:center;gap:5px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);padding:4px 12px;border-radius:20px;font-size:.78rem;color:rgba(255,255,255,.9)}',
    '.prof-avail-badge.busy{background:rgba(239,68,68,.25);border-color:rgba(239,68,68,.4)}',
    '.profile-action-btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}',
    '.profile-header-side{text-align:right;flex-shrink:0;min-width:140px}',
    '.profile-score-big{margin-bottom:14px}',
    '.phs-num{font-size:2.8rem;font-weight:800;color:#fff;line-height:1}',
    '.phs-label{font-size:.75rem;color:rgba(255,255,255,.6);margin-top:4px}',
    '.profile-body{max-width:1240px;margin:0 auto;padding:40px 24px 80px;display:grid;grid-template-columns:1fr 320px;gap:24px;align-items:start}',
    '@media(max-width:900px){.profile-body{grid-template-columns:1fr}.profile-side-col{order:-1}.profile-top{align-items:flex-start}}',
    '.profile-main-col{}',
    '.profile-side-col{}',
    '.profile-section{background:#fff;border-radius:14px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,.06);margin-bottom:18px}',
    '.profile-section-title{font-size:1rem;font-weight:700;margin-bottom:14px;color:var(--dark)}',
    '.sidebar-info-card{background:#fff;border-radius:14px;padding:22px;box-shadow:0 2px 12px rgba(0,0,0,.06)}',
    '.sidebar-info-card h3{font-size:1rem;font-weight:700;margin:0 0 16px;color:var(--dark)}',
    '.info-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border-light);font-size:.87rem}',
    '.info-row:last-child{border-bottom:none}',
    '.info-row>span:first-child{color:var(--text-muted)}',
    '.info-row>span:last-child{font-weight:600;text-align:right}',
    '.btn-add-review{margin-top:14px;background:var(--primary);color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:.9rem;font-weight:600;cursor:pointer}',
    '.btn-add-review:hover{background:var(--primary-h)}',
    '.prof-section-title{font-size:1rem;font-weight:700;margin-bottom:12px}',
    '.trust-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px}',
    '.trust-stat-box{background:#f8f7ff;border-radius:10px;padding:12px;text-align:center}',
    '.ts-icon{font-size:1.3rem;margin-bottom:3px}',
    '.ts-num{font-size:1.35rem;font-weight:700;color:#1a1a2e}',
    '.ts-label{font-size:.7rem;color:#888;margin-top:2px}',
    '.trust-bars{display:flex;flex-direction:column;gap:9px;margin-bottom:12px}',
    '.trust-bar-row{display:flex;align-items:center;gap:8px;font-size:.82rem}',
    '.trust-bar-row>span:first-child{min-width:155px;color:#555}',
    '.trust-bar{flex:1;height:8px;background:#e5e7eb;border-radius:4px;overflow:hidden}',
    '.trust-bar-fill{height:100%;background:#22c55e;border-radius:4px;transition:width .5s}',
    '.trust-bar-fill.tb-blue{background:#3b82f6}',
    '.trust-bar-fill.tb-orange{background:#ea580c}',
    '.trust-bar-row>span:last-child{min-width:34px;text-align:right;font-weight:600;font-size:.8rem}',
    '.trust-hours{display:inline-flex;align-items:center;gap:6px;background:#f0fdf4;color:#166534;border-radius:20px;padding:5px 13px;font-size:.82rem}',
    '.vaardigheden-tags{display:flex;flex-wrap:wrap;gap:8px}',
    '.vaard-tag{padding:6px 14px;background:var(--green-light);color:var(--primary);border-radius:20px;font-size:.82rem;font-weight:600;border:1px solid rgba(27,67,50,.12)}',
    // Portfolio grid (v7.1 style)
    '.portfolio-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}',
    '@media(max-width:600px){.portfolio-grid{grid-template-columns:repeat(2,1fr)}}',
    '.portfolio-item{aspect-ratio:4/3;border-radius:8px;overflow:hidden;background:#e5e7eb;position:relative;cursor:pointer}',
    '.portfolio-item img,.portfolio-item video{width:100%;height:100%;object-fit:cover;transition:transform .3s}',
    '.portfolio-item:hover img,.portfolio-item:hover video{transform:scale(1.07)}',
    '.portfolio-overlay{position:absolute;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .2s;font-size:24px}',
    '.portfolio-item:hover .portfolio-overlay{opacity:1}',
    '.portfolio-empty{grid-column:1/-1;text-align:center;padding:40px;color:#aaa;font-size:.9rem}',
    // Portfolio upload grid (dashboard)
    '.portfolio-upload-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px}',
    '@media(max-width:600px){.portfolio-upload-grid{grid-template-columns:repeat(2,1fr)}}',
    '.portfolio-upload-item{aspect-ratio:4/3;border-radius:10px;border:2px dashed var(--border);background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;cursor:pointer;position:relative;overflow:hidden;transition:border-color .2s,background .2s}',
    '.portfolio-upload-item:hover{border-color:var(--primary);background:var(--green-light)}',
    '.portfolio-upload-item.filled{border-style:solid;border-color:var(--border);cursor:default}',
    '.portfolio-upload-item.filled img,.portfolio-upload-item.filled video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}',
    '.portfolio-remove-btn{position:absolute;top:6px;right:6px;background:rgba(0,0,0,.6);color:#fff;border:none;border-radius:50%;width:26px;height:26px;cursor:pointer;font-size:.8rem;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .2s;z-index:2}',
    '.portfolio-upload-item.filled:hover .portfolio-remove-btn{opacity:1}',
    '.upload-icon{font-size:1.6rem;color:var(--text-muted)}',
    '.upload-text{font-size:.75rem;color:var(--text-muted);text-align:center;padding:0 8px}',
    '.portfolio-hint{font-size:.75rem;color:var(--text-muted);margin-top:4px}',
    // Score ring
    '.score-ring{display:block;flex-shrink:0}',
    '.score-ring-arc{transition:stroke-dasharray 1s cubic-bezier(.4,0,.2,1)}',
    '.score-large-wrap{display:flex;align-items:center;gap:14px}',
    '.score-large-info{display:flex;flex-direction:column}',
    '.score-large-pct{font-size:2rem;font-weight:800;line-height:1;color:#fff}',
    '.score-large-label{font-size:.75rem;color:rgba(255,255,255,.6);margin-top:4px}',
    '.dienst-info-table{width:100%;border-collapse:collapse}',
    '.dienst-info-table td{padding:7px 0;border-bottom:1px solid #f3f3f3;font-size:.87rem;vertical-align:middle}',
    '.dienst-info-table td:first-child{color:#888}',
    '.di-val{font-weight:600;text-align:right}',
    '.di-green{color:#16a34a}',
    '.dienst-price-box{background:#fef3c7;border-radius:10px;padding:14px;text-align:center;margin-top:12px}',
    '.dienst-price{font-size:1.3rem;font-weight:700;color:#d97706}',
    '.dienst-price-label{font-size:.77rem;color:#92400e;margin-top:2px}',
    '.btn-stuur-bericht{display:block;width:100%;background:#c07f1a;color:#fff;border:none;border-radius:8px;padding:11px;font-size:.9rem;font-weight:600;cursor:pointer;text-align:center;text-decoration:none;margin-top:10px;box-sizing:border-box}',
    '.btn-stuur-bericht:hover{background:#a0691a}',
    '.review-item{padding:13px 0;border-bottom:1px solid #f3f3f3}',
    '.review-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}',
    '.review-score{color:#f59e0b;font-size:1rem;letter-spacing:1px}',
    // Score slider (v7.1 style)
    '.score-slider{-webkit-appearance:none;appearance:none;width:100%;height:6px;border-radius:3px;cursor:pointer;outline:none;transition:height .15s;background:linear-gradient(to right,var(--primary) 75%,rgba(0,0,0,0.1) 75%)}',
    '.score-slider:hover{height:8px}',
    '.score-slider::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:var(--fill,var(--primary));border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.2);cursor:grab;transition:transform .15s,box-shadow .15s}',
    '.score-slider::-webkit-slider-thumb:active{cursor:grabbing;transform:scale(1.15);box-shadow:0 4px 16px rgba(0,0,0,.3)}',
    '.score-slider::-moz-range-thumb{width:20px;height:20px;border-radius:50%;background:var(--fill,var(--primary));border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.2);cursor:grab}',
    '.score-slider-display{display:flex;align-items:center;gap:3px;height:56px;margin-top:4px}',
    '.score-slider-num{font-family:var(--font-display);font-size:42px;font-weight:900;line-height:1;letter-spacing:-1.5px;transition:color .2s}',
    '.score-slider-pct{font-size:18px;font-weight:700;opacity:.7}',
    // Star rating picker
    '.star-rating{display:flex;gap:6px;margin:6px 0 2px;cursor:pointer}',
    '.star{font-size:2rem;color:#d5d0c8;transition:color .1s;user-select:none;line-height:1}',
    '.star.active{color:#f59e0b}',
    '.star.hover{color:#fbbf24}',
    // Profile photo upload
    '.pfp-upload-wrap{position:relative;display:inline-block;cursor:pointer;border-radius:50%;overflow:hidden;width:88px;height:88px}',
    '.pfp-upload-img{width:88px;height:88px;border-radius:50%;object-fit:cover;display:flex;align-items:center;justify-content:center;font-size:1.8rem}',
    '.pfp-overlay{position:absolute;inset:0;background:rgba(0,0,0,0);display:flex;align-items:center;justify-content:center;font-size:1.5rem;opacity:0;transition:background .2s,opacity .2s}',
    '.pfp-upload-wrap:hover .pfp-overlay{background:rgba(0,0,0,.45);opacity:1}',
    // Availability toggle in dashboard
    '.avail-toggle-card{display:flex;align-items:center;justify-content:space-between;background:#f0fdf4;border-radius:10px;padding:14px 16px;margin-bottom:16px;gap:12px}',
    '.avail-toggle-info{display:flex;align-items:center;gap:12px}',
    '.avail-toggle-dot{width:11px;height:11px;border-radius:50%;background:#22c55e;flex-shrink:0}',
    '.avail-toggle-dot.busy{background:#ef4444}',
    '.avail-switch{position:relative;width:44px;height:24px;display:inline-block;flex-shrink:0}',
    '.avail-switch input{opacity:0;width:0;height:0;position:absolute}',
    '.avail-slider{position:absolute;inset:0;background:#ccc;border-radius:24px;cursor:pointer;transition:.25s}',
    '.avail-slider::before{content:"";position:absolute;width:18px;height:18px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:.25s}',
    '.avail-switch input:checked~.avail-slider{background:#22c55e}',
    '.avail-switch input:checked~.avail-slider::before{transform:translateX(20px)}',
    '#dnd-check:checked~.avail-slider{background:#ef4444}',
    // Dark mode card
    '.dark-mode-card{display:flex;align-items:center;justify-content:space-between;background:#f0f0ff;border-radius:10px;padding:14px 16px;margin-bottom:20px;gap:12px}',
    'body.dark-mode .dark-mode-card{background:#1e1e32}',
    // ── DARK MODE ──────────────────────────────────────────
    'body.dark-mode{--bg:#0f0f1a;--surface:#1a1a2e;--primary:#0d0d1f;--text:#dddde8;--text-muted:#8888a0;background:#0f0f1a;color:#dddde8}',
    'body.dark-mode #navbar{background:#0d0d1f!important;border-bottom:1px solid #1e1e32}',
    'body.dark-mode .nav-link{color:#c0c0d8!important}',
    'body.dark-mode .nav-logo-img{filter:brightness(.9)}',
    'body.dark-mode .user-pill{background:#1a1a2e!important;color:#dddde8!important}',
    'body.dark-mode .user-dropdown{background:#1a1a2e!important;border:1px solid #2a2a40!important}',
    'body.dark-mode .user-dropdown a{color:#dddde8!important}',
    'body.dark-mode .user-dropdown a:hover{background:#252540!important}',
    'body.dark-mode .hero{background:#0d0d1f!important}',
    'body.dark-mode .hero-title,body.dark-mode .hero-subtitle{color:#dddde8!important}',
    'body.dark-mode .provider-card{background:rgba(255,255,255,.08)!important;border-color:rgba(255,255,255,.15)!important;backdrop-filter:blur(12px)!important;-webkit-backdrop-filter:blur(12px)!important}',
    'body.dark-mode .provider-name,body.dark-mode .provider-price{color:#dddde8!important}',
    'body.dark-mode .provider-tagline{color:#8888a0!important}',
    'body.dark-mode .dash-card{background:#1a1a2e!important;color:#dddde8!important}',
    'body.dark-mode .dashboard-panel{background:#1a1a2e!important;color:#dddde8!important}',
    'body.dark-mode .dashboard-grid{background:#0f0f1a!important}',
    'body.dark-mode .prof-card{background:#1a1a2e!important;color:#dddde8!important}',
    'body.dark-mode .prof-section-title{color:#dddde8!important}',
    'body.dark-mode .trust-stat-box{background:#111128!important}',
    'body.dark-mode .ts-num{color:#dddde8!important}',
    'body.dark-mode .dienst-info-table td{border-color:#2a2a40!important;color:#dddde8!important}',
    'body.dark-mode .dienst-info-table td:first-child{color:#8888a0!important}',
    'body.dark-mode .profile-back{color:#a0a0c0!important}',
    'body.dark-mode input,body.dark-mode textarea,body.dark-mode select{background:#1e1e32!important;color:#dddde8!important;border-color:#3a3a55!important}',
    'body.dark-mode input:focus,body.dark-mode textarea:focus,body.dark-mode select:focus{background:#1e1e32!important;border-color:#6c47ff!important;box-shadow:0 0 0 3px rgba(108,71,255,.2)!important}',
    'body.dark-mode input::placeholder,body.dark-mode textarea::placeholder{color:#6060a0!important}',
    'body.dark-mode input:-webkit-autofill,body.dark-mode input:-webkit-autofill:hover,body.dark-mode input:-webkit-autofill:focus{-webkit-box-shadow:0 0 0 1000px #1e1e32 inset!important;-webkit-text-fill-color:#dddde8!important;caret-color:#dddde8!important}',
    'body.dark-mode .modal{background:#1a1a2e!important;color:#dddde8!important}',
    'body.dark-mode .form-group label{color:#c0c0d8!important}',
    'body.dark-mode .booking-item{border-color:#2a2a40!important}',
    'body.dark-mode .notif-item{border-color:#2a2a40!important}',
    'body.dark-mode .notif-item[onclick]:hover{background:#1e1e35!important}',
    'body.dark-mode .avail-toggle-card{background:#0d2818!important}',
    'body.dark-mode .dnd-toggle-card{background:#2a1010!important;border-color:#4a2020!important}',
    'body.dark-mode .cv-sidebar{background:#111126!important}',
    'body.dark-mode .cv-sidebar-header{background:#0d0d1f!important;border-color:#2a2a3e!important}',
    'body.dark-mode .cv-main,body.dark-mode #view-chat.active{background:#0f0f1a!important}',
    'body.dark-mode .cv-active-header,body.dark-mode .cv-input-row{background:#111126!important;border-color:#2a2a3e!important}',
    'body.dark-mode .chat-convo-item{border-color:#2a2a3e!important;color:#dddde8!important}',
    'body.dark-mode .chat-convo-item:hover{background:#1a1a2e!important}',
    'body.dark-mode .chat-convo-item.active{background:#22224a!important}',
    'body.dark-mode .chat-convo-last{color:#7070a0!important}',
    'body.dark-mode .chat-msg.theirs{background:#1e1e32!important;color:#dddde8!important}',
    'body.dark-mode .cv-input{background:#1e1e32!important;border-color:#3a3a55!important;color:#dddde8!important}',
    'body.dark-mode .vaard-tag{background:#1e1e3a!important;color:#a0a0ff!important}',
    'body.dark-mode .prof-avail-badge{background:#0d2818!important;color:#4ade80!important}',
    'body.dark-mode .hero-search-box,body.dark-mode .search-input-wrap{background:#1a1a2e!important}',
    'body.dark-mode .browse-section,body.dark-mode .browse-header{background:#0f0f1a!important}',
    'body.dark-mode .category-card{background:#1a1a2e!important;color:#dddde8!important}',
    'body.dark-mode .footer{background:#0d0d1f!important}',
    // Hardcoded-background elements that CSS variables can't reach
    'body.dark-mode .hero-card{background:rgba(20,20,38,.92)!important;box-shadow:0 4px 24px rgba(0,0,0,.5)!important}',
    'body.dark-mode .hc-info strong{color:#dddde8!important}',
    'body.dark-mode .hc-info small{color:#8888a0!important}',
    'body.dark-mode .hero-search-box{background:#1a1a2e!important;border-color:#2a2a40!important}',
    'body.dark-mode .search-input-wrap input{background:#1a1a2e!important;color:#dddde8!important}',
    'body.dark-mode .search-input-wrap input::placeholder{color:#6060a0!important}',
    'body.dark-mode #hero-district{background:#1a1a2e!important;color:#dddde8!important;border-color:#2a2a40!important}',
    'body.dark-mode .modal{background:#1a1a2e!important;color:#dddde8!important}',
    'body.dark-mode .modal h3,body.dark-mode .modal label,body.dark-mode .modal p{color:#dddde8!important}',
    'body.dark-mode .auth-tabs{background:#111128!important}',
    'body.dark-mode .tab-btn{color:#8888a0!important}',
    'body.dark-mode .tab-btn.active{color:#dddde8!important;border-color:#6c47ff!important}',
    'body.dark-mode .category-card{background:#1a1a2e!important;color:#dddde8!important}',
    'body.dark-mode .section-title{color:#dddde8!important}',
    'body.dark-mode .section-sub{color:#8888a0!important}',
    'body.dark-mode .cta-section,body.dark-mode .cta-box{background:#0d0d1f!important}',
    'body.dark-mode .cta-num-item strong{color:#dddde8!important}',
    'body.dark-mode .cta-num-item span{color:#8888a0!important}',
    'body.dark-mode .filter-bar,body.dark-mode .browse-filters{background:#111126!important}',
    'body.dark-mode .filter-bar select,body.dark-mode .browse-filters input{background:#1a1a2e!important;color:#dddde8!important;border-color:#2a2a40!important}',
    'body.dark-mode .review-overlay,body.dark-mode #review-overlay{background:rgba(0,0,0,.7)!important}',
    'body.dark-mode #review-modal{background:#1a1a2e!important;color:#dddde8!important}',
    'body.dark-mode .dash-menu-item{color:#c0c0d8!important}',
    'body.dark-mode .dash-menu-item:hover{background:#1e1e32!important}',
    'body.dark-mode .dash-menu-item.active{background:#6c47ff!important;color:#fff!important}',
    'body.dark-mode .booking-badge{border:1px solid #2a2a40!important}',
    'body.dark-mode .btn-ok{background:#166534!important}',
    'body.dark-mode .btn-no{background:#7f1d1d!important}',
    // Full-page chat view — must use .active so ID selector doesn't override .view{display:none}
    '#view-chat.active{display:flex;flex-direction:column;background:#e8e5e0;height:100vh;padding-top:var(--nav-h);box-sizing:border-box}',
    '.cv-layout{display:grid;grid-template-columns:300px 1fr;flex:1;overflow:hidden}',
    '.cv-back-btn{background:none;border:none;cursor:pointer;color:#444;font-size:.88rem;padding:0;display:flex;align-items:center;gap:4px;font-weight:500}',
    '.cv-back-btn:hover{color:#6c47ff}',
    'body.dark-mode .cv-back-btn{color:#a0a0c0}',
    'body.dark-mode .cv-back-btn:hover{color:#a090ff}',
    '@media(max-width:640px){.cv-layout{grid-template-columns:1fr}}',
    '.cv-sidebar{border-right:1px solid #ddd;overflow-y:auto;background:#f5f3ef;display:flex;flex-direction:column}',
    '.cv-sidebar-header{padding:20px 18px 16px;border-bottom:1px solid #e0ddd8;flex-shrink:0;background:#ece9e3}',
    '.cv-main{display:flex;flex-direction:column;background:#e8e5e0;overflow:hidden}',
    '.cv-active-header{padding:14px 20px;border-bottom:1px solid #ddd;background:#f5f3ef;display:flex;align-items:center;gap:12px;flex-shrink:0}',
    '.cv-messages{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:8px}',
    '.cv-input-row{display:flex;gap:10px;padding:14px 20px;border-top:1px solid #ddd;background:#f5f3ef;flex-shrink:0}',
    '.cv-input{flex:1;border:1.5px solid #d5d0c8;border-radius:24px;padding:10px 18px;font-size:.92rem;outline:none;font-family:inherit;background:#fff}',
    '.cv-input:focus{border-color:#6c47ff}',
    '.cv-send-btn{background:#6c47ff;color:#fff;border:none;border-radius:24px;padding:10px 22px;cursor:pointer;font-size:.9rem;font-weight:600;white-space:nowrap}',
    '.cv-send-btn:hover{background:#5a38e0}',
    // Shared convo/message classes
    '.chat-convo-item{display:flex;align-items:center;gap:10px;padding:12px 16px;cursor:pointer;border-bottom:1px solid #e8e4de;transition:background .15s}',
    '.chat-convo-item:hover{background:#ede9e2}',
    '.chat-convo-item.active{background:#e0dbd2;border-right:3px solid #6c47ff}',
    '.chat-convo-avatar{width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:.88rem;font-weight:700;flex-shrink:0}',
    '.chat-convo-info{flex:1;min-width:0}',
    '.chat-convo-name{font-size:.9rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.chat-convo-last{font-size:.77rem;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}',
    '.chat-convo-badge{background:#6c47ff;color:#fff;border-radius:50%;min-width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;flex-shrink:0}',
    '.chat-msg{max-width:70%;padding:10px 14px;border-radius:14px;font-size:.9rem;line-height:1.5;word-break:break-word}',
    '.chat-msg.mine{background:#6c47ff;color:#fff;align-self:flex-end;border-radius:14px 14px 2px 14px}',
    '.chat-msg.theirs{background:#f5f3ef;color:#1a1a2e;align-self:flex-start;border-radius:14px 14px 14px 2px;box-shadow:0 1px 3px rgba(0,0,0,.06)}',
    '.chat-msg-time{font-size:.68rem;margin-top:4px;opacity:.6;text-align:right}',
    '.chat-msg.theirs .chat-msg-time{text-align:left}',
    '.chat-empty{display:flex;align-items:center;justify-content:center;flex:1;color:#aaa;font-size:.9rem;text-align:center}',
    // DND card
    '.dnd-toggle-card{display:flex;align-items:center;justify-content:space-between;background:#fff5f5;border:1px solid #fee2e2;border-radius:10px;padding:14px 16px;margin-bottom:16px;gap:12px}',
    '.dnd-slider{background:#ccc}',
    '#dnd-check:checked~.dnd-slider{background:#ef4444!important}',
    // Klant dashboard
    '.kl-stat-card{text-align:center;flex:1;min-width:80px}',
    '.kl-recent-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f0f0f0;gap:8px}',
    '.bk-filter-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}',
    '.bk-filter{background:#f0ede8;border:1.5px solid #d5d0c8;color:#555;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;cursor:pointer;transition:all .15s}',
    '.bk-filter.active{background:#6c47ff;border-color:#6c47ff;color:#fff}',
    '.bk-filter:hover:not(.active){background:#e6e0ff;border-color:#6c47ff;color:#6c47ff}',
    '.bk-rebook-btn{background:#f0ede8;border:1.5px solid #d5d0c8;color:#555;border-radius:20px;padding:4px 12px;font-size:.75rem;font-weight:600;cursor:pointer;transition:all .15s;white-space:nowrap}',
    '.bk-rebook-btn:hover{background:#6c47ff;border-color:#6c47ff;color:#fff}',
    'body.dark-mode .kl-recent-row{border-color:#2a2a3e}',
    'body.dark-mode .bk-filter{background:#1e1e38;border-color:#3a3a55;color:#b0b0cc}',
    'body.dark-mode .bk-filter.active{background:#6c47ff;color:#fff}',
    'body.dark-mode .bk-rebook-btn{background:#1e1e38;border-color:#3a3a55;color:#b0b0cc}',
    'body.dark-mode .bk-rebook-btn:hover{background:#6c47ff;color:#fff}',
    // Jobs
    '.job-post-form{background:#f8f7f4;border:1.5px solid #e8e4dc;border-radius:12px;padding:20px;margin-bottom:8px}',
    '.job-card{background:#fff;border:1.5px solid #e8e4dc;border-radius:12px;padding:16px 18px;margin-bottom:12px}',
    '.job-card-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:6px}',
    '.job-title{font-weight:700;font-size:.95rem;color:#1a1a2e}',
    '.job-meta{font-size:.78rem;color:#888;margin-top:2px}',
    '.job-desc-text{font-size:.83rem;color:#555;margin:8px 0;line-height:1.5}',
    '.job-card-footer{display:flex;gap:14px;align-items:center;margin-top:10px;font-size:.8rem;color:#888;flex-wrap:wrap}',
    '.job-status-badge{border-radius:20px;padding:3px 10px;font-size:.75rem;font-weight:700}',
    '.job-open{background:#dcfce7;color:#166534}',
    '.job-closed{background:#f3f4f6;color:#6b7280}',
    '.job-budget-tag{background:#fef3c7;color:#b7791f;border-radius:20px;padding:3px 10px;font-size:.75rem;font-weight:600;white-space:nowrap}',
    '.job-respond-wrap{margin-top:12px;padding-top:12px;border-top:1px solid #f0ede8}',
    '.job-respond-input{width:100%;border:1.5px solid #d5d0c8;border-radius:8px;padding:8px 12px;font-size:.82rem;font-family:inherit;resize:vertical;background:#fff}',
    '.job-respond-input:focus{border-color:#6c47ff;outline:none}',
    '.job-response-item{background:#f8f7f4;border-radius:10px;padding:12px 14px}',
    '.cat-jobs-badge{font-size:.72rem;color:#6c47ff;font-weight:600;margin-top:4px;background:#f0eeff;border-radius:20px;padding:2px 8px;display:inline-block}',
    'body.dark-mode .job-post-form{background:#13132a;border-color:#2a2a3e}',
    'body.dark-mode .job-card{background:#1a1a2e;border-color:#2a2a3e}',
    'body.dark-mode .job-title{color:#dddde8}',
    'body.dark-mode .job-desc-text{color:#a0a0c0}',
    'body.dark-mode .job-respond-wrap{border-color:#2a2a3e}',
    'body.dark-mode .job-respond-input{background:#13132a;border-color:#3a3a55;color:#dddde8}',
    'body.dark-mode .job-response-item{background:#13132a}',
    'body.dark-mode .cat-jobs-badge{background:#1e1e38;color:#a090ff}',
    // Booking modal polish
    '.bk-modal-wrap{width:100%;max-width:500px;max-height:90vh;overflow-y:auto;padding:28px;border-radius:20px;background:#fff;position:relative}',
    '.bk-provider-header{display:flex;align-items:center;gap:14px;margin-bottom:20px;padding-bottom:18px;border-bottom:1px solid #f0ede8}',
    '.bk-avatar{width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:1rem;flex-shrink:0}',
    '.bk-dur-chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}',
    '.bk-dur-chip{background:#f0ede8;border:1.5px solid #d5d0c8;color:#555;border-radius:20px;padding:6px 14px;font-size:.82rem;font-weight:600;cursor:pointer;transition:all .15s}',
    '.bk-dur-chip.active{background:#6c47ff;border-color:#6c47ff;color:#fff}',
    '.bk-dur-chip:hover:not(.active){background:#e6e0ff;border-color:#6c47ff;color:#6c47ff}',
    '.bk-slots{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px;min-height:40px;align-items:flex-start}',
    '.bk-slots-placeholder{color:#aaa;font-size:.82rem;padding:8px 0;width:100%}',
    '.bk-slot{background:#f0ede8;border:1.5px solid #d5d0c8;color:#444;border-radius:10px;padding:7px 14px;font-size:.82rem;font-weight:600;cursor:pointer;transition:all .15s}',
    '.bk-slot.active{background:#6c47ff;border-color:#6c47ff;color:#fff}',
    '.bk-slot:hover:not(.active){background:#e6e0ff;border-color:#6c47ff;color:#6c47ff}',
    '.bk-price-est{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:.85rem;color:#166534}',
    'body.dark-mode .bk-modal-wrap{background:#1a1a2e!important;color:#dddde8!important}',
    'body.dark-mode .bk-provider-header{border-color:#2a2a3e!important}',
    'body.dark-mode .bk-dur-chip{background:#1e1e38;border-color:#3a3a55;color:#b0b0cc}',
    'body.dark-mode .bk-dur-chip.active{background:#6c47ff;color:#fff}',
    'body.dark-mode .bk-slot{background:#1e1e38;border-color:#3a3a55;color:#b0b0cc}',
    'body.dark-mode .bk-slot.active{background:#6c47ff;color:#fff}',
    'body.dark-mode .bk-price-est{background:#0d2018;border-color:#166534;color:#4ade80}',
    // Schedule picker
    '.sched-picker{margin-top:4px}',
    '.sched-days{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}',
    '.sched-day{background:#f0ede8;border:1.5px solid #d5d0c8;color:#555;border-radius:20px;padding:5px 13px;font-size:.8rem;font-weight:600;cursor:pointer;transition:background .15s,color .15s,border-color .15s;line-height:1.4}',
    '.sched-day.active{background:#6c47ff;border-color:#6c47ff;color:#fff}',
    '.sched-day:hover:not(.active){background:#e6e0ff;border-color:#6c47ff;color:#6c47ff}',
    '.sched-time-row{display:flex;flex-direction:column;gap:10px}',
    '.sched-time-block{display:flex;align-items:center;gap:10px}',
    '.sched-time-label{font-size:.8rem;color:#888;min-width:28px}',
    '.sched-time-lbl{min-width:42px;font-size:.88rem;font-weight:700;color:#6c47ff;text-align:center}',
    '.sched-range{flex:1;accent-color:#6c47ff;cursor:pointer;height:4px}',
    'body.dark-mode .sched-day{background:#1e1e38;border-color:#3a3a55;color:#b0b0cc}',
    'body.dark-mode .sched-day.active{background:#6c47ff;border-color:#6c47ff;color:#fff}',
    'body.dark-mode .sched-day:hover:not(.active){background:#2a2050;border-color:#6c47ff;color:#a090ff}',
    'body.dark-mode .sched-time-label{color:#666}',
    'body.dark-mode .sched-time-lbl{color:#a090ff}',
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

function avatarColor(name) {
  const colors = ['#e91e8c','#9c27b0','#3f51b5','#0097a7','#00897b','#43a047','#f57c00','#e53935'];
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return colors[Math.abs(h) % colors.length];
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ─── Score ring helpers (v7.1 style) ──────────────────────────────────────────
function scoreColor(score) {
  if (score >= 90) return '#16a34a';
  if (score >= 75) return '#65a30d';
  if (score >= 60) return '#ea580c';
  return '#dc2626';
}

function buildScoreRing(score, size = 56, stroke = 5) {
  const r = (size / 2) - stroke;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = scoreColor(score);
  return '<svg class="score-ring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
    '<circle cx="' + (size/2) + '" cy="' + (size/2) + '" r="' + r + '" fill="none" stroke="rgba(0,0,0,0.08)" stroke-width="' + stroke + '"/>' +
    '<circle class="score-ring-arc" cx="' + (size/2) + '" cy="' + (size/2) + '" r="' + r + '" fill="none"' +
    ' stroke="' + color + '" stroke-width="' + stroke + '" stroke-linecap="round"' +
    ' stroke-dasharray="' + dash + ' ' + circ + '" stroke-dashoffset="0"' +
    ' transform="rotate(-90 ' + (size/2) + ' ' + (size/2) + ')"' +
    ' data-full="' + circ + '" data-dash="' + dash + '"/>' +
    '</svg>';
}

function buildScoreLarge(score) {
  if (!score) return '<div class="score-large-wrap"><div class="score-large-info"><span class="score-large-pct" style="color:#aaa">—</span><span class="score-large-label">Geen score</span></div></div>';
  const color = scoreColor(score);
  const label = score >= 95 ? 'Uitzonderlijk' : score >= 85 ? 'Uitstekend' : score >= 75 ? 'Zeer goed' : score >= 65 ? 'Goed' : 'Gemiddeld';
  return '<div class="score-large-wrap">' +
    buildScoreRing(score, 88, 7) +
    '<div class="score-large-info">' +
    '<span class="score-large-pct" style="color:' + color + '">' + score + '%</span>' +
    '<span class="score-large-label">' + label + '</span>' +
    '</div></div>';
}

// ─── Schedule picker helpers ───────────────────────────────────────────────
function mkdMinToTime(m) {
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}
window.mkdMinToTime = mkdMinToTime;

function _timeToMin(t) {
  const [h, m] = (t || '').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function fmtSchedule(val) {
  if (!val) return '';
  try {
    const p = JSON.parse(val);
    if (!p.days || !p.days.length) return val;
    const LABEL = { ma:'Ma', di:'Di', wo:'Wo', do:'Do', vr:'Vr', za:'Za', zo:'Zo' };
    return p.days.map(d => LABEL[d] || d).join(' ') + '  ' + (p.start || '') + '–' + (p.end || '');
  } catch (e) { return val; }
}

function _schedPickerHTML(prefix, val) {
  const DAYS = [['ma','Ma'],['di','Di'],['wo','Wo'],['do','Do'],['vr','Vr'],['za','Za'],['zo','Zo']];
  let selDays = [], startMin = 480, endMin = 1020;
  try {
    const p = JSON.parse(val || '{}');
    selDays   = p.days  || [];
    startMin  = _timeToMin(p.start || '08:00');
    endMin    = _timeToMin(p.end   || '17:00');
  } catch (e) {}

  const chips = DAYS.map(([k, label]) =>
    '<button type="button" class="sched-day' + (selDays.includes(k) ? ' active' : '') +
    '" data-day="' + k + '" onclick="this.classList.toggle(\'active\')">' + label + '</button>'
  ).join('');

  return '<div class="sched-picker" id="' + prefix + '-sched">' +
    '<div class="sched-days">' + chips + '</div>' +
    '<div class="sched-time-row">' +
      '<div class="sched-time-block">' +
        '<span class="sched-time-label">Van</span>' +
        '<span class="sched-time-lbl" id="' + prefix + '-start-lbl">' + mkdMinToTime(startMin) + '</span>' +
        '<input type="range" class="sched-range" id="' + prefix + '-start" min="0" max="1380" step="30" value="' + startMin + '"' +
        ' oninput="document.getElementById(\'' + prefix + '-start-lbl\').textContent=mkdMinToTime(+this.value)">' +
      '</div>' +
      '<div class="sched-time-block">' +
        '<span class="sched-time-label">Tot</span>' +
        '<span class="sched-time-lbl" id="' + prefix + '-end-lbl">' + mkdMinToTime(endMin) + '</span>' +
        '<input type="range" class="sched-range" id="' + prefix + '-end" min="0" max="1380" step="30" value="' + endMin + '"' +
        ' oninput="document.getElementById(\'' + prefix + '-end-lbl\').textContent=mkdMinToTime(+this.value)">' +
      '</div>' +
    '</div>' +
  '</div>';
}

function _schedPickerVal(prefix) {
  const el = document.getElementById(prefix + '-sched');
  if (!el) return '';
  const days  = Array.from(el.querySelectorAll('.sched-day.active')).map(b => b.dataset.day);
  const start = mkdMinToTime(+(document.getElementById(prefix + '-start')?.value || 480));
  const end   = mkdMinToTime(+(document.getElementById(prefix + '-end')?.value   || 1020));
  if (!days.length) return '';
  return JSON.stringify({ days, start, end });
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
