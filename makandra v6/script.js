/* ═══════════════════════════════════════
   MAKANDRA – SCRIPT.JS
   Premium Surinamese Services Platform
═══════════════════════════════════════ */

'use strict';

/* ── Categories (updated per requirements) ─── */
const CATEGORIES = [
  { name: 'Schilders',              icon: '🖌️', color: '#FFF7ED', count: 143 },
  { name: 'Elektriciens',           icon: '⚡', color: '#EFF6FF', count: 189 },
  { name: 'Hoveniers',              icon: '🌿', color: '#F0FDF4', count: 112 },
  { name: 'Bank- & Mattenreiniging', icon: '🛋️', color: '#FDF4FF', count: 87  },
  { name: 'Fotografie',             icon: '📷', color: '#FFF7ED', count: 198 },
  { name: 'Video & Animatie',       icon: '🎬', color: '#FEF2F2', count: 112 },
  { name: 'Muziek & Audio',         icon: '🎵', color: '#F5F3FF', count: 89  },
  { name: 'Coaching & Training',    icon: '🎯', color: '#FEFCE8', count: 97  },
  { name: 'Schoonheid & Wellness',  icon: '💆', color: '#FDF4FF', count: 145 },
  { name: 'Evenementen',            icon: '🎉', color: '#FFF7ED', count: 163 },
  { name: 'Grafisch Ontwerp',       icon: '🎨', color: '#FDF4FF', count: 243 },
  { name: 'Bouw & Constructie',     icon: '🏗️', color: '#F0FDF4', count: 156 },
  { name: 'Overig',                 icon: '🔧', color: '#F5F5F5', count: 321 },
];

/* ── Provider data (Top 10 with different services each) ── */
const PROVIDERS = [
  {
    id: 1, firstname: 'Anjali', lastname: 'Ramdjitan',
    category: 'Grafisch Ontwerp', district: 'Paramaribo',
    tagline: 'Professionele logo\'s & huisstijl voor uw merk',
    score: 98, reviews: 124, price: 'SRD 200/uur',
    color: '#7C3AED', email: 'anjali@example.com',
    workingHours: 'Ma–Vr 09:00–17:00',
    clients: 87, repeatClients: 62, onTime: 96,
    description: 'Met meer dan 8 jaar ervaring in grafisch ontwerp help ik bedrijven in Suriname een krachtige visuele identiteit op te bouwen. Specialisatie in logo-ontwerp, huisstijl en drukwerk.',
    skills: ['Adobe Illustrator', 'Photoshop', 'Branding', 'Logo Design', 'Drukwerk', 'UI Design'],
    portfolio: [],
    reviewsList: [
      { author: 'Mark J.', score: 95, text: 'Geweldige ontwerper! Mijn logo is precies wat ik wilde.', date: '2025-03-15' },
      { author: 'Sara P.', score: 100, text: 'Zeer professioneel en snel. Aanbevolen!', date: '2025-02-28' },
    ]
  },
  {
    id: 2, firstname: 'Jerome', lastname: 'Fonkel',
    category: 'Elektriciens', district: 'Commewijne',
    tagline: 'Elektrische installaties & reparaties thuis en bedrijf',
    score: 96, reviews: 112, price: 'SRD 180/uur',
    color: '#B45309', email: 'jerome@example.com',
    workingHours: 'Ma–Za 07:00–18:00',
    clients: 104, repeatClients: 78, onTime: 98,
    description: 'Gediplomeerd elektricien met 15 jaar ervaring in woningen en bedrijfspanden. Snel, betrouwbaar en schoon werk gegarandeerd.',
    skills: ['Elektrische installaties', 'Reparaties', 'Beveiliging', 'Zonnepanelen'],
    portfolio: [],
    reviewsList: [
      { author: 'Hank R.', score: 90, text: 'Snel en vakkundig werk. Zeker aanbevolen!', date: '2025-03-05' },
      { author: 'Diana B.', score: 100, text: 'Uitstekend! Alles netjes en op tijd.', date: '2025-04-02' },
    ]
  },
  {
    id: 3, firstname: 'Maria', lastname: 'Brunings',
    category: 'Fotografie', district: 'Paramaribo',
    tagline: 'Professionele fotografie voor elk moment',
    score: 100, reviews: 201, price: 'SRD 500/dag',
    color: '#DB2777', email: 'maria@example.com',
    workingHours: 'Ma–Zo 08:00–20:00',
    clients: 189, repeatClients: 143, onTime: 99,
    description: 'Gespecialiseerd in bruilofts-, portret- en commerciële fotografie. Ik vang de mooiste momenten van jouw leven vast met een creatief oog voor detail.',
    skills: ['Portretfotografie', 'Bruiloftsfotografie', 'Adobe Lightroom', 'Studio Lighting', 'Drone'],
    portfolio: [],
    reviewsList: [
      { author: 'Jan K.', score: 100, text: 'De beste fotograaf van Suriname! Mijn bruiloft was perfect vastgelegd.', date: '2025-03-22' },
      { author: 'Lisa A.', score: 98, text: 'Prachtige foto\'s, erg professioneel en vriendelijk.', date: '2025-02-14' },
    ]
  },
  {
    id: 4, firstname: 'Fatima', lastname: 'Abdoelkarim',
    category: 'Coaching & Training', district: 'Paramaribo',
    tagline: 'Business coaching voor ondernemers in Suriname',
    score: 97, reviews: 67, price: 'SRD 250/sessie',
    color: '#D97706', email: 'fatima@example.com',
    workingHours: 'Ma–Vr 08:00–17:00',
    clients: 58, repeatClients: 44, onTime: 97,
    description: 'Gecertificeerd business coach met 10 jaar ervaring. Ik help ondernemers en teams hun doelen te bereiken door strategische planning en persoonlijke ontwikkeling.',
    skills: ['Business Coaching', 'Teambuilding', 'Strategie', 'Leiderschap', 'NLP'],
    portfolio: [],
    reviewsList: [
      { author: 'Roy S.', score: 95, text: 'Fantastische coach die echt luistert en helpt.', date: '2025-04-10' },
    ]
  },
  {
    id: 5, firstname: 'Devraj', lastname: 'Kalpoe',
    category: 'Schilders', district: 'Wanica',
    tagline: 'Professioneel schilderwerk binnen & buiten',
    score: 95, reviews: 88, price: 'SRD 160/dag',
    color: '#1B4332', email: 'devraj@example.com',
    workingHours: 'Ma–Za 07:00–17:00',
    clients: 76, repeatClients: 55, onTime: 94,
    description: 'Meer dan 12 jaar schilderervaring. Ik werk zorgvuldig, met kwaliteitsverf en nette afwerking. Zowel binnen als buiten voor woningen en bedrijven.',
    skills: ['Binnen schilderwerk', 'Buiten schilderwerk', 'Muurpreparatie', 'Behangen', 'Decoratief schilderwerk'],
    portfolio: [],
    reviewsList: [
      { author: 'Sandra M.', score: 95, text: 'Prachtig schilderwerk, erg nette werker!', date: '2025-03-10' },
    ]
  },
  {
    id: 6, firstname: 'Claudia', lastname: 'Waterberg',
    category: 'Schoonheid & Wellness', district: 'Paramaribo',
    tagline: 'Hairstyling & beautydiensten aan huis',
    score: 95, reviews: 88, price: 'SRD 120/behandeling',
    color: '#9D174D', email: 'claudia@example.com',
    workingHours: 'Di–Za 09:00–18:00',
    clients: 82, repeatClients: 68, onTime: 96,
    description: 'Professionele kapper en beautytherapist aan huis. Specialisatie in Afrikaans, Surinaams en Europees haar. Luxe behandelingen in het comfort van jouw thuis.',
    skills: ['Haarstyling', 'Bruidsmake-up', 'Manicure', 'Pedicure', 'Gezichtsbehandeling'],
    portfolio: [],
    reviewsList: []
  },
  {
    id: 7, firstname: 'Ramesh', lastname: 'Soekhoe',
    category: 'Hoveniers', district: 'Para',
    tagline: 'Tuinonderhoud, snoeien en landschapsinrichting',
    score: 93, reviews: 71, price: 'SRD 130/dag',
    color: '#15803D', email: 'ramesh@example.com',
    workingHours: 'Ma–Za 06:00–15:00',
    clients: 63, repeatClients: 48, onTime: 92,
    description: 'Ervaren hovenier met passie voor groene ruimtes. Tuinaanleg, onderhoud, snoeien en het ontwerp van mooie buitenruimtes in heel Suriname.',
    skills: ['Tuinaanleg', 'Maaien', 'Snoeien', 'Bestrating', 'Landschapsontwerp', 'Irrigatie'],
    portfolio: [],
    reviewsList: [
      { author: 'Anita V.', score: 93, text: 'Mijn tuin ziet er geweldig uit. Heel tevreden!', date: '2025-04-08' },
    ]
  },
  {
    id: 8, firstname: 'Kevin', lastname: 'Telting',
    category: 'Video & Animatie', district: 'Wanica',
    tagline: 'Videoproductie & animatie voor bedrijven',
    score: 91, reviews: 34, price: 'SRD 800/video',
    color: '#7C3AED', email: 'kevin@example.com',
    workingHours: 'Ma–Vr 09:00–18:00, Za op aanvraag',
    clients: 31, repeatClients: 21, onTime: 90,
    description: 'Videograaf en animator met passie voor het vertellen van verhalen. Van bedrijfsvideo\'s tot social media content, ik lever professionele videoproductie op maat.',
    skills: ['Videografie', 'After Effects', 'Premiere Pro', '2D Animatie', 'Drone Video'],
    portfolio: [],
    reviewsList: []
  },
  {
    id: 9, firstname: 'Priya', lastname: 'Sewdajal',
    category: 'Bank- & Mattenreiniging', district: 'Nickerie',
    tagline: 'Professionele reiniging van banken, matten & meubels',
    score: 89, reviews: 56, price: 'SRD 250/behandeling',
    color: '#0891B2', email: 'priya@example.com',
    workingHours: 'Ma–Vr 08:00–17:00',
    clients: 49, repeatClients: 36, onTime: 91,
    description: 'Gespecialiseerde reinigingsdienst voor banken, matten, stoelen en andere meubels. Met professionele apparatuur en milieuvriendelijke middelen.',
    skills: ['Stofreiniging', 'Vlekreiniging', 'Stoomreiniging', 'Tapijt wassen', 'Leerbehandeling'],
    portfolio: [],
    reviewsList: []
  },
  {
    id: 10, firstname: 'Nisha', lastname: 'Balgobind',
    category: 'Evenementen', district: 'Para',
    tagline: 'Eventcoördinatie & decoratie voor elke gelegenheid',
    score: 87, reviews: 29, price: 'SRD 600/evenement',
    color: '#DC2626', email: 'nisha@example.com',
    workingHours: 'Ma–Zo 08:00–21:00',
    clients: 27, repeatClients: 19, onTime: 88,
    description: 'Eventplanner met oog voor detail en creativiteit. Van intieme verjaardagen tot grote bedrijfsevenementen, ik zorg dat uw feest onvergetelijk wordt.',
    skills: ['Eventplanning', 'Decoratie', 'Catering Coördinatie', 'Logistiek', 'Budgetbeheer'],
    portfolio: [],
    reviewsList: []
  },
  {
    id: 11, firstname: 'Sandro', lastname: 'Kowlesar',
    category: 'Bouw & Constructie', district: 'Wanica',
    tagline: 'Verbouw, reparaties en bouwprojecten',
    score: 84, reviews: 45, price: 'SRD 300/dag',
    color: '#2563EB', email: 'sandro@example.com',
    workingHours: 'Ma–Za 07:00–17:00',
    clients: 39, repeatClients: 24, onTime: 86,
    description: 'Ervaren aannemer voor kleine en grote bouwprojecten. Verbouw, uitbouw, reparaties, gips- en tegelwerk. Kwaliteitswerk met een nette oplevering.',
    skills: ['Metselwerk', 'Tegelwerk', 'Gipswerk', 'Dakrparatie', 'Verbouw', 'Sloopwerk'],
    portfolio: [],
    reviewsList: [
      { author: 'Peter N.', score: 85, text: 'Goed werk geleverd, netjes en op tijd.', date: '2025-03-18' },
    ]
  },
];

/* ── App State ──────────────────────────── */
const state = {
  currentUser: null,
  filteredProviders: [...PROVIDERS],
  activeCategory: '',
  dashTab: 'overzicht',
  reviewRating: 0,
  favorites: [],       // provider ids marked as favorite
  useLater: [],        // provider ids saved for later
  favTab: 'favorites', // 'favorites' | 'later'
};

/* ══════════════════════════════════════════
   SCORE UTILITIES
══════════════════════════════════════════ */

function scoreColor(score) {
  if (score >= 90) return '#16a34a';
  if (score >= 75) return '#ca8a04';
  if (score >= 60) return '#ea580c';
  return '#dc2626';
}

function buildScoreRing(score, size = 56, stroke = 5) {
  const r = (size / 2) - stroke;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = scoreColor(score);
  return `
    <svg class="score-ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="rgba(0,0,0,0.08)" stroke-width="${stroke}"/>
      <circle class="score-ring-arc" cx="${size/2}" cy="${size/2}" r="${r}" fill="none"
        stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"
        stroke-dasharray="${dash} ${circ}" stroke-dashoffset="0"
        transform="rotate(-90 ${size/2} ${size/2})"
        data-full="${circ}" data-dash="${dash}"/>
      <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
        font-size="${size * 0.22}px" font-weight="700" fill="${color}" font-family="inherit">
        ${score}
      </text>
    </svg>`;
}

function buildScoreBadge(score) {
  const color = scoreColor(score);
  return `<span class="score-badge" style="--sc:${color}">${score}<span class="score-badge-pct">%</span></span>`;
}

function buildScoreLarge(score) {
  const color = scoreColor(score);
  const label = score >= 95 ? 'Uitzonderlijk' : score >= 85 ? 'Uitstekend' : score >= 75 ? 'Zeer goed' : score >= 65 ? 'Goed' : 'Gemiddeld';
  return `
    <div class="score-large-wrap">
      ${buildScoreRing(score, 88, 7)}
      <div class="score-large-info">
        <span class="score-large-pct" style="color:${color}">${score}%</span>
        <span class="score-large-label">${label}</span>
      </div>
    </div>`;
}

function buildScoreBar(score) {
  const color = scoreColor(score);
  return `
    <div class="score-bar-wrap">
      <div class="score-bar-track">
        <div class="score-bar-fill" style="width:${score}%; background:${color}" data-score="${score}"></div>
      </div>
      <span class="score-bar-val" style="color:${color}">${score}%</span>
    </div>`;
}

/* ══════════════════════════════════════════
   TRUST SCORE WIDGET
══════════════════════════════════════════ */

function buildTrustScore(p) {
  const avgScore = p.reviewsList.length
    ? Math.round(p.reviewsList.reduce((s, r) => s + r.score, 0) / p.reviewsList.length)
    : p.score;

  const repeatPct = p.clients > 0 ? Math.round((p.repeatClients / p.clients) * 100) : 0;
  const onTimePct = p.onTime || 0;

  const bars = [
    { label: 'Beoordelingen score', val: avgScore, color: scoreColor(avgScore) },
    { label: 'Terugkerende klanten', val: repeatPct, color: '#2563eb' },
    { label: 'Op tijd aangekomen', val: onTimePct, color: '#16a34a' },
  ];

  return `
    <div class="trust-score-section reveal">
      <div class="trust-score-title">🏅 Vertrouwensscore</div>
      <div class="trust-score-grid">
        <div class="trust-metric">
          <div class="trust-metric-icon">👥</div>
          <div class="trust-metric-val">${p.clients}</div>
          <div class="trust-metric-label">Totale klanten</div>
        </div>
        <div class="trust-metric">
          <div class="trust-metric-icon">🔁</div>
          <div class="trust-metric-val">${p.repeatClients}</div>
          <div class="trust-metric-label">Terugkerende klanten</div>
        </div>
        <div class="trust-metric">
          <div class="trust-metric-icon">⭐</div>
          <div class="trust-metric-val">${p.reviews}</div>
          <div class="trust-metric-label">Beoordelingen</div>
        </div>
      </div>
      <div class="trust-score-bar-section">
        ${bars.map(b => `
          <div class="trust-score-bar-row">
            <div class="trust-score-bar-label">${b.label}</div>
            <div class="trust-score-bar-track">
              <div class="trust-score-bar-fill" style="width:${b.val}%; background:${b.color}" data-score="${b.val}"></div>
            </div>
            <div class="trust-score-bar-val">${b.val}%</div>
          </div>`).join('')}
      </div>
      ${p.workingHours ? `<div class="trust-hours-chip">🕐 Werktijden: ${p.workingHours}</div>` : ''}
    </div>`;
}

/* ══════════════════════════════════════════
   RENDER HELPERS
══════════════════════════════════════════ */

function initials(p) {
  return (p.firstname[0] + (p.lastname ? p.lastname[0] : '')).toUpperCase();
}

function isFavorite(id)  { return state.favorites.includes(id); }
function isUseLater(id)  { return state.useLater.includes(id); }

function toggleFavorite(id, e) {
  if (e) { e.stopPropagation(); }
  if (isFavorite(id)) {
    state.favorites = state.favorites.filter(x => x !== id);
    showToast('Verwijderd uit favorieten', 'success');
  } else {
    state.favorites.push(id);
    showToast('Toegevoegd aan favorieten ❤️', 'success');
  }
  // Animate heart
  const btns = document.querySelectorAll(`[data-fav-id="${id}"]`);
  btns.forEach(b => {
    b.classList.add('heart-beat');
    setTimeout(() => b.classList.remove('heart-beat'), 400);
    b.textContent = isFavorite(id) ? '❤️' : '🤍';
  });
  // If on favorites view, re-render
  if (document.getElementById('view-favorites')?.classList.contains('active')) {
    renderFavoritesView();
  }
}

function toggleUseLater(id, e) {
  if (e) { e.stopPropagation(); }
  if (isUseLater(id)) {
    state.useLater = state.useLater.filter(x => x !== id);
    showToast('Verwijderd uit "Gebruik later"', 'success');
  } else {
    state.useLater.push(id);
    showToast('Opgeslagen voor later 🔖', 'success');
  }
  const btns = document.querySelectorAll(`[data-later-id="${id}"]`);
  btns.forEach(b => {
    b.textContent = isUseLater(id) ? '🔖' : '📌';
  });
  if (document.getElementById('view-favorites')?.classList.contains('active')) {
    renderFavoritesView();
  }
}

function renderProviderCard(p, rank = null) {
  const scoreRing = buildScoreRing(p.score, 48, 4);
  const favIcon  = isFavorite(p.id) ? '❤️' : '🤍';
  const laterIcon = isUseLater(p.id) ? '🔖' : '📌';
  return `
    <div class="provider-card reveal" onclick="showProfile(${p.id})" tabindex="0"
         onkeydown="if(event.key==='Enter')showProfile(${p.id})">
      <div class="provider-card-top">
        ${rank ? `<div class="rank-badge">#${rank}</div>` : ''}
        <div class="provider-card-actions">
          <button class="btn-fav ${isFavorite(p.id) ? 'active' : ''}" data-fav-id="${p.id}"
            title="Toevoegen aan favorieten"
            onclick="toggleFavorite(${p.id}, event)">${favIcon}</button>
          <button class="btn-later ${isUseLater(p.id) ? 'active' : ''}" data-later-id="${p.id}"
            title="Opslaan voor later"
            onclick="toggleUseLater(${p.id}, event)">${laterIcon}</button>
        </div>
        <div class="provider-avatar" style="background:${p.color}">
          ${initials(p)}
        </div>
        <div class="provider-score">
          ${scoreRing}
          <span class="score-count">(${p.reviews})</span>
        </div>
      </div>
      <div class="provider-card-body">
        <div class="provider-name">${p.firstname} ${p.lastname}</div>
        <div class="provider-tagline">${p.tagline}</div>
        <div class="provider-meta">
          <span class="meta-chip">📍 ${p.district}</span>
          <span class="meta-chip">🏷️ ${p.category}</span>
        </div>
        <div class="provider-price">${p.price}</div>
        <button class="btn-view-profile">Profiel bekijken →</button>
      </div>
    </div>`;
}

function renderCategoryCards() {
  const grid = document.getElementById('categories-grid');
  if (!grid) return;
  grid.innerHTML = CATEGORIES.map(c => `
    <div class="cat-card reveal" onclick="browseByCategory('${c.name}')" tabindex="0"
         onkeydown="if(event.key==='Enter')browseByCategory('${c.name}')">
      <div class="cat-icon" style="background:${c.color}">${c.icon}</div>
      <div class="cat-name">${c.name}</div>
      <div class="cat-count">${c.count} dienstverleners</div>
    </div>`).join('');
  observeReveal();
}

function renderTopProviders() {
  const grid = document.getElementById('top-providers-grid');
  if (!grid) return;
  const top = [...PROVIDERS].sort((a,b) => b.score - a.score).slice(0, 10);
  grid.innerHTML = top.map((p, i) => renderProviderCard(p, i + 1)).join('');
  observeReveal();
}

function renderSidebarCats() {
  const el = document.getElementById('sidebar-cats');
  if (!el) return;
  el.innerHTML = `<div class="sidebar-cat-item ${!state.activeCategory ? 'active' : ''}" onclick="browseByCategory('')">
      <span>🔍</span><span>Alle categorieën</span></div>` +
    CATEGORIES.map(c => `
      <div class="sidebar-cat-item ${state.activeCategory === c.name ? 'active' : ''}"
           onclick="browseByCategory('${c.name}')">
        <span>${c.icon}</span><span>${c.name}</span>
      </div>`).join('');
}

function applyFilters() {
  const q      = (document.getElementById('browse-search')?.value || '').toLowerCase();
  const dist   = document.getElementById('filter-district')?.value || '';
  const sort   = document.getElementById('filter-sort')?.value || 'score';

  let list = PROVIDERS.filter(p => {
    const nameMatch = (p.firstname + ' ' + p.lastname).toLowerCase().includes(q) ||
                      p.tagline.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
    const catMatch  = !state.activeCategory || p.category === state.activeCategory;
    const distMatch = !dist || p.district === dist;
    return nameMatch && catMatch && distMatch;
  });

  if (sort === 'score')   list.sort((a,b) => b.score - a.score);
  if (sort === 'reviews') list.sort((a,b) => b.reviews - a.reviews);
  if (sort === 'name')    list.sort((a,b) => (a.firstname+a.lastname).localeCompare(b.firstname+b.lastname));

  state.filteredProviders = list;
  const grid  = document.getElementById('browse-grid');
  const empty = document.getElementById('browse-empty');
  const count = document.getElementById('results-count');

  if (!grid) return;

  if (list.length === 0) {
    grid.innerHTML = '';
    empty?.classList.remove('hidden');
    if (count) count.textContent = 'Geen resultaten gevonden';
  } else {
    grid.innerHTML = list.map(p => renderProviderCard(p)).join('');
    empty?.classList.add('hidden');
    if (count) count.textContent = `${list.length} dienstverlener${list.length !== 1 ? 's' : ''} gevonden`;
    observeReveal();
  }
}

function resetFilters() {
  const bs = document.getElementById('browse-search');
  const fd = document.getElementById('filter-district');
  const fs = document.getElementById('filter-sort');
  if (bs) bs.value = '';
  if (fd) fd.value = '';
  if (fs) fs.value = 'score';
  state.activeCategory = '';
  renderSidebarCats();
  applyFilters();
}

/* ══════════════════════════════════════════
   FAVORITES VIEW
══════════════════════════════════════════ */

function showFavorites() {
  showView('favorites');
  renderFavoritesView();
}

function renderFavoritesView() {
  const content = document.getElementById('favorites-content');
  if (!content) return;

  const favProviders   = PROVIDERS.filter(p => isFavorite(p.id));
  const laterProviders = PROVIDERS.filter(p => isUseLater(p.id));

  content.innerHTML = `
    <div class="favorites-tabs">
      <button class="fav-tab ${state.favTab === 'favorites' ? 'active' : ''}"
        onclick="switchFavTab('favorites')">❤️ Favorieten (${favProviders.length})</button>
      <button class="fav-tab ${state.favTab === 'later' ? 'active' : ''}"
        onclick="switchFavTab('later')">🔖 Gebruik later (${laterProviders.length})</button>
    </div>
    <div id="fav-list-content">
      ${buildFavList(state.favTab === 'favorites' ? favProviders : laterProviders, state.favTab)}
    </div>`;
}

function switchFavTab(tab) {
  state.favTab = tab;
  renderFavoritesView();
}

function buildFavList(providers, tab) {
  if (providers.length === 0) {
    const msg = tab === 'favorites'
      ? 'U heeft nog geen favorieten toegevoegd. Klik op het ❤️-icoon op een kaart om een dienstverlener op te slaan.'
      : 'U heeft nog geen dienstverleners opgeslagen voor later. Klik op het 📌-icoon om iemand te bewaren.';
    return `
      <div class="favorites-empty">
        <div class="favorites-empty-icon">${tab === 'favorites' ? '❤️' : '🔖'}</div>
        <h3>Geen items</h3>
        <p>${msg}</p>
        <button class="btn-primary" onclick="showView('browse')">Dienstverleners bekijken</button>
      </div>`;
  }
  return `<div class="providers-grid">${providers.map(p => renderProviderCard(p)).join('')}</div>`;
}

/* ══════════════════════════════════════════
   VIEW NAVIGATION
══════════════════════════════════════════ */

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const v = document.getElementById('view-' + name);
  if (v) {
    v.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  if (name === 'home') {
    renderCategoryCards();
    renderTopProviders();
  }
  if (name === 'browse') {
    renderSidebarCats();
    applyFilters();
  }
  if (name === 'dashboard' && state.currentUser) {
    renderDashboard();
  }
  if (name === 'favorites') {
    renderFavoritesView();
  }
  setTimeout(() => observeReveal(), 50);
}

function browseByCategory(cat) {
  state.activeCategory = cat;
  showView('browse');
}

function browseByDistrict(dist) {
  showView('browse');
  const fd = document.getElementById('filter-district');
  if (fd) { fd.value = dist; applyFilters(); }
}

function heroSearch() {
  const q    = document.getElementById('hero-search')?.value || '';
  const dist = document.getElementById('hero-district')?.value || '';
  showView('browse');
  setTimeout(() => {
    const bs = document.getElementById('browse-search');
    const fd = document.getElementById('filter-district');
    if (bs) bs.value = q;
    if (fd) fd.value = dist;
    applyFilters();
  }, 50);
}

/* ══════════════════════════════════════════
   PROFILE VIEW
══════════════════════════════════════════ */

function showProfile(id) {
  const p = PROVIDERS.find(x => x.id === id);
  if (!p) return;
  showView('profile');
  document.getElementById('profile-content').innerHTML = buildProfileHTML(p);
  requestAnimationFrame(() => { animateScoreRings(); observeReveal(); });
}

function buildProfileHTML(p) {
  const avgScore = p.reviewsList.length
    ? Math.round(p.reviewsList.reduce((s, r) => s + r.score, 0) / p.reviewsList.length)
    : p.score;

  const reviewsHTML = p.reviewsList.length
    ? p.reviewsList.map(r => `
        <div class="review-card reveal">
          <div class="review-header">
            <div class="review-avatar">${r.author[0]}</div>
            <div class="review-meta">
              <div class="review-author">${r.author}</div>
              <div class="review-date">${formatDate(r.date)}</div>
            </div>
            <div class="review-score-chip">${buildScoreBadge(r.score)}</div>
          </div>
          <div class="review-text">${r.text}</div>
        </div>`).join('')
    : `<p class="no-reviews">Nog geen beoordelingen. Wees de eerste!</p>`;

  const portfolioHTML = p.portfolio.length
    ? p.portfolio.map(item => {
        const isVideo = item.type === 'video';
        return `
          <div class="portfolio-item">
            ${isVideo
              ? `<video src="${item.src}" muted loop playsinline></video>`
              : `<img src="${item.src}" alt="Portfolio">`}
            <div class="portfolio-overlay">${isVideo ? '▶' : '🔍'}</div>
          </div>`;
      }).join('')
    : `<div class="portfolio-empty">Geen portfolio-items beschikbaar.</div>`;

  const favIcon  = isFavorite(p.id) ? '❤️ Opgeslagen' : '🤍 Opslaan als favoriet';
  const laterIcon = isUseLater(p.id) ? '🔖 Opgeslagen voor later' : '📌 Gebruik later';

  return `
    <div class="profile-header-bg">
      <div class="profile-header-inner">
        <div class="profile-back" onclick="history.back()">← Terug naar overzicht</div>
        <div class="profile-top">
          <div class="profile-avatar-lg" style="background:${p.color}">${initials(p)}</div>
          <div class="profile-header-info">
            <h1>${p.firstname} ${p.lastname}</h1>
            <div class="profile-tagline">${p.tagline}</div>
            <div class="profile-badges">
              <span class="profile-badge">📍 ${p.district}</span>
              <span class="profile-badge">🏷️ ${p.category}</span>
              <span class="profile-badge">⭐ ${p.reviews} beoordelingen</span>
              ${p.workingHours ? `<span class="profile-badge">🕐 ${p.workingHours}</span>` : ''}
            </div>
            <div class="profile-action-btns" style="margin-top:14px">
              <button class="btn-fav-profile" data-fav-id="${p.id}"
                onclick="toggleFavorite(${p.id}, event)">${favIcon}</button>
              <button class="btn-later-profile" data-later-id="${p.id}"
                onclick="toggleUseLater(${p.id}, event)">${laterIcon}</button>
            </div>
          </div>
          <div class="profile-header-side">
            <div class="profile-score-big">
              ${buildScoreLarge(avgScore)}
            </div>
            <button class="btn-contact" onclick="contactProvider(${p.id})">
              📩 Contact opnemen
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="profile-body">
      <div class="profile-main-col">

        <div class="profile-section reveal">
          <div class="profile-section-title">Over ${p.firstname}</div>
          <div class="profile-description">${p.description}</div>
        </div>

        ${buildTrustScore(p)}

        <div class="profile-section reveal">
          <div class="profile-section-title">Vaardigheden</div>
          <div class="skills-list">
            ${p.skills.map(s => `<span class="skill-chip">${s}</span>`).join('')}
          </div>
        </div>

        <div class="profile-section reveal">
          <div class="profile-section-title">Portfolio</div>
          <div class="portfolio-grid">${portfolioHTML}</div>
        </div>

        <div class="profile-section reveal">
          <div class="profile-section-title">Beoordelingen (${p.reviewsList.length})</div>
          ${reviewsHTML}
          ${state.currentUser
            ? `<button class="btn-add-review" onclick="openReviewModal(${p.id})">✏️ Beoordeling schrijven</button>`
            : `<p class="no-reviews"><a onclick="openAuthModal('login')" style="color:var(--primary);font-weight:600">Log in</a> om een beoordeling te schrijven.</p>`
          }
        </div>
      </div>

      <div class="profile-side-col">
        <div class="sidebar-info-card reveal">
          <h3>Dienst info</h3>
          <div class="info-row">
            <span>District</span><span>${p.district}</span>
          </div>
          <div class="info-row">
            <span>Categorie</span><span>${p.category}</span>
          </div>
          <div class="info-row">
            <span>Klanten</span><span>${p.clients}</span>
          </div>
          <div class="info-row">
            <span>Terugkerende klanten</span><span>${p.repeatClients}</span>
          </div>
          <div class="info-row">
            <span>Op tijd</span><span style="color:${scoreColor(p.onTime)}">${p.onTime}%</span>
          </div>
          <div class="info-row">
            <span>Beoordelingen</span><span>${p.reviews}</span>
          </div>
          <div class="info-row">
            <span>Score</span><span style="color:${scoreColor(avgScore)};font-weight:700">${avgScore}%</span>
          </div>
          ${p.workingHours ? `<div class="info-row"><span>Werktijden</span><span style="font-size:12px">${p.workingHours}</span></div>` : ''}
          <div class="price-highlight">
            <span class="price-val">${p.price}</span>
            <small>Indicatief tarief</small>
          </div>
        </div>
        <div class="sidebar-info-card reveal">
          <h3>Contact</h3>
          <div class="info-row">
            <span>E-mail</span><span>${p.email}</span>
          </div>
          <button class="btn-contact" style="width:100%;margin-top:16px;justify-content:center"
                  onclick="contactProvider(${p.id})">
            📩 Stuur bericht
          </button>
        </div>
      </div>
    </div>`;
}

function contactProvider(id) {
  if (!state.currentUser) {
    openAuthModal('login');
    showToast('Log in om contact op te nemen', 'error');
    return;
  }
  const p = PROVIDERS.find(x => x.id === id);
  showToast(`Bericht gestuurd naar ${p?.firstname}!`, 'success');
}

/* ══════════════════════════════════════════
   SCORE RING ANIMATION
══════════════════════════════════════════ */

function animateScoreRings() {
  document.querySelectorAll('.score-ring-arc').forEach(arc => {
    const full = parseFloat(arc.dataset.full);
    const dash = parseFloat(arc.dataset.dash);
    arc.style.strokeDasharray = `0 ${full}`;
    arc.style.transition = 'none';
    requestAnimationFrame(() => {
      setTimeout(() => {
        arc.style.transition = 'stroke-dasharray 1s cubic-bezier(0.4,0,0.2,1)';
        arc.style.strokeDasharray = `${dash} ${full}`;
      }, 100);
    });
  });

  document.querySelectorAll('.score-bar-fill, .trust-score-bar-fill').forEach(bar => {
    const target = bar.dataset.score + '%';
    bar.style.width = '0%';
    bar.style.transition = 'none';
    requestAnimationFrame(() => {
      setTimeout(() => {
        bar.style.transition = 'width 1s cubic-bezier(0.4,0,0.2,1)';
        bar.style.width = target;
      }, 150);
    });
  });
}

/* ══════════════════════════════════════════
   REVIEW MODAL
══════════════════════════════════════════ */

function openReviewModal(providerId) {
  if (!state.currentUser) { openAuthModal('login'); return; }
  state.reviewRating = 0;
  document.getElementById('review-target-id').value = providerId;
  document.getElementById('review-text').value = '';
  document.getElementById('review-rating').value = 0;
  document.getElementById('review-error').classList.add('hidden');
  document.getElementById('review-overlay').classList.remove('hidden');
  setTimeout(() => renderScoreSlider(50), 30);
}

function closeReviewModal(e) {
  if (!e || e.target === e.currentTarget || e.currentTarget === document.querySelector('.modal-x')) {
    document.getElementById('review-overlay').classList.add('hidden');
  }
}

function renderScoreSlider(val) {
  const container = document.getElementById('star-selector');
  if (!container) return;
  val = val || 50;
  const color = scoreColor(val);
  state.reviewRating = val;
  document.getElementById('review-rating').value = val;
  container.innerHTML = `
    <div class="score-slider-wrap">
      <input type="range" id="score-slider" min="1" max="100" value="${val}"
             class="score-slider" oninput="updateSliderScore(this.value)"
             style="--fill:${color}" />
      <div class="score-slider-display" id="slider-display">
        <span class="score-slider-num" style="color:${color}">${val}</span><span class="score-slider-pct">%</span>
      </div>
    </div>`;
}

function updateSliderScore(val) {
  val = parseInt(val);
  state.reviewRating = val;
  document.getElementById('review-rating').value = val;
  const color = scoreColor(val);
  const display = document.getElementById('slider-display');
  if (display) {
    display.innerHTML = `<span class="score-slider-num" style="color:${color}">${val}</span><span class="score-slider-pct">%</span>`;
  }
  const slider = document.getElementById('score-slider');
  if (slider) slider.style.setProperty('--fill', color);
}

function submitReview() {
  const rating = parseInt(document.getElementById('review-rating').value || 0);
  const text   = document.getElementById('review-text').value.trim();
  const pid    = parseInt(document.getElementById('review-target-id').value);
  const errEl  = document.getElementById('review-error');

  if (!rating || rating < 1) {
    showError(errEl, 'Geef een score op (1-100).');
    return;
  }
  if (!text) {
    showError(errEl, 'Schrijf een beoordeling.');
    return;
  }

  const p = PROVIDERS.find(x => x.id === pid);
  if (p) {
    const newReview = {
      author: state.currentUser.firstname + ' ' + (state.currentUser.lastname?.[0] || '') + '.',
      score: rating,
      text,
      date: new Date().toISOString().split('T')[0],
    };
    p.reviewsList.unshift(newReview);
    const avg = Math.round(p.reviewsList.reduce((s,r) => s+r.score, 0) / p.reviewsList.length);
    p.score = avg;
    p.reviews += 1;
  }

  document.getElementById('review-overlay').classList.add('hidden');
  showToast('Beoordeling geplaatst! Bedankt.', 'success');
  if (p) showProfile(p.id);
}

/* ══════════════════════════════════════════
   AUTH MODAL
══════════════════════════════════════════ */

function openAuthModal(tab = 'login') {
  document.getElementById('auth-overlay').classList.remove('hidden');
  switchAuthTab(tab);
}

function closeAuthModal(e) {
  if (!e || e.target === e.currentTarget) {
    document.getElementById('auth-overlay').classList.add('hidden');
  }
}

function switchAuthTab(tab) {
  ['login','signup','provider'].forEach(t => {
    document.getElementById('tab-' + t)?.classList.add('hidden');
    document.getElementById('tab-btn-' + t)?.classList.remove('active');
  });
  document.getElementById('tab-' + tab)?.classList.remove('hidden');
  document.getElementById('tab-btn-' + tab)?.classList.add('active');
}

function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');

  if (!email || !pass) { showError(errEl, 'Vul alle velden in.'); return; }
  if (!email.includes('@')) { showError(errEl, 'Ongeldig e-mailadres.'); return; }

  const prov = PROVIDERS.find(p => p.email === email);
  if (prov) {
    loginUser({ firstname: prov.firstname, lastname: prov.lastname, email, isProvider: true, providerId: prov.id });
    document.getElementById('auth-overlay').classList.add('hidden');
    showToast('Welkom terug!', 'success');
    showView('dashboard');
  } else {
    loginUser({ firstname: email.split('@')[0], lastname: '', email, isProvider: false });
    document.getElementById('auth-overlay').classList.add('hidden');
    showToast('Welkom terug!', 'success');
  }
}

function handleSignup() {
  const fn   = document.getElementById('su-firstname').value.trim();
  const ln   = document.getElementById('su-lastname').value.trim();
  const em   = document.getElementById('su-email').value.trim();
  const pw   = document.getElementById('su-password').value;
  const dist = document.getElementById('su-district').value;
  const errEl = document.getElementById('signup-error');

  if (!fn || !ln || !em || !pw || !dist) { showError(errEl, 'Vul alle verplichte velden in.'); return; }
  if (!em.includes('@')) { showError(errEl, 'Ongeldig e-mailadres.'); return; }
  if (pw.length < 6) { showError(errEl, 'Wachtwoord moet minimaal 6 tekens zijn.'); return; }

  loginUser({ firstname: fn, lastname: ln, email: em, isProvider: false, district: dist });
  document.getElementById('auth-overlay').classList.add('hidden');
  showToast(`Welkom bij MaKandra, ${fn}!`, 'success');
}

function handleProviderSignup() {
  const fn    = document.getElementById('pv-firstname').value.trim();
  const ln    = document.getElementById('pv-lastname').value.trim();
  const em    = document.getElementById('pv-email').value.trim();
  const pw    = document.getElementById('pv-password').value;
  const cat   = document.getElementById('pv-category').value;
  const dist  = document.getElementById('pv-district').value;
  const tag   = document.getElementById('pv-tagline').value.trim();
  const price = document.getElementById('pv-price').value.trim();
  const hours = document.getElementById('pv-hours').value.trim();
  const errEl = document.getElementById('provider-error');

  if (!fn || !ln || !em || !pw || !cat || !dist) { showError(errEl, 'Vul alle verplichte velden in.'); return; }
  if (!em.includes('@')) { showError(errEl, 'Ongeldig e-mailadres.'); return; }
  if (pw.length < 6) { showError(errEl, 'Wachtwoord moet minimaal 6 tekens zijn.'); return; }

  const newProv = {
    id: PROVIDERS.length + 1,
    firstname: fn, lastname: ln,
    category: cat, district: dist,
    tagline: tag || `${cat} diensten in ${dist}`,
    score: 0, reviews: 0,
    price: price || 'Op aanvraag',
    color: '#1B4332',
    email: em,
    workingHours: hours || '',
    clients: 0, repeatClients: 0, onTime: 100,
    description: 'Dit profiel is zojuist aangemaakt.',
    skills: [],
    portfolio: [],
    reviewsList: [],
  };
  PROVIDERS.push(newProv);

  loginUser({ firstname: fn, lastname: ln, email: em, isProvider: true, providerId: newProv.id });
  document.getElementById('auth-overlay').classList.add('hidden');
  showToast(`Profiel aangemaakt! Welkom, ${fn}!`, 'success');
  showView('dashboard');
}

function loginUser(user) {
  state.currentUser = user;
  document.getElementById('nav-auth').classList.add('hidden');
  document.getElementById('nav-user').classList.remove('hidden');
  document.getElementById('nav-avatar').textContent = user.firstname[0].toUpperCase();
  document.getElementById('nav-username').textContent = user.firstname;
}

function logout() {
  state.currentUser = null;
  document.getElementById('nav-auth').classList.remove('hidden');
  document.getElementById('nav-user').classList.add('hidden');
  document.getElementById('user-dropdown').classList.add('hidden');
  showView('home');
  showToast('Je bent uitgelogd.', 'success');
}

function toggleUserMenu() {
  document.getElementById('user-dropdown').classList.toggle('hidden');
}

function toggleMobileMenu() {
  document.getElementById('mobile-menu').classList.toggle('hidden');
}

/* ══════════════════════════════════════════
   DASHBOARD (Provider dashboard)
══════════════════════════════════════════ */

function renderDashboard() {
  const u = state.currentUser;
  if (!u) return;
  const p = u.isProvider ? PROVIDERS.find(x => x.id === u.providerId) : null;

  const providerMenu = u.isProvider ? `
    <div class="dash-menu-item ${state.dashTab==='overzicht'?'active':''}" onclick="switchDashTab('overzicht')">
      <span>📊</span> Overzicht
    </div>
    <div class="dash-menu-item ${state.dashTab==='profile'?'active':''}" onclick="switchDashTab('profile')">
      <span>👤</span> Profiel
    </div>
    <div class="dash-menu-item ${state.dashTab==='portfolio'?'active':''}" onclick="switchDashTab('portfolio')">
      <span>🖼️</span> Portfolio
    </div>
    <div class="dash-menu-item ${state.dashTab==='reviews'?'active':''}" onclick="switchDashTab('reviews')">
      <span>⭐</span> Beoordelingen
    </div>
    <div class="dash-menu-item ${state.dashTab==='vertrouwen'?'active':''}" onclick="switchDashTab('vertrouwen')">
      <span>🏅</span> Vertrouwensscore
    </div>` : `
    <div class="dash-menu-item ${state.dashTab==='profile'?'active':''}" onclick="switchDashTab('profile')">
      <span>👤</span> Profiel
    </div>`;

  document.getElementById('dashboard-content').innerHTML = `
    <div class="dashboard-header">
      <div>
        <h1>Welkom, ${u.firstname}! 👋</h1>
        <p>${u.isProvider ? 'Beheer uw dienstverlener-dashboard' : 'Uw klantaccount'}</p>
      </div>
      ${u.isProvider && p ? `<button class="btn-accent" onclick="showProfile(${p.id})">Mijn profiel bekijken →</button>` : ''}
    </div>
    <div class="dashboard-grid">
      <div class="dashboard-sidebar">
        ${providerMenu}
        <div class="dash-menu-item" onclick="logout()">
          <span>🚪</span> Uitloggen
        </div>
      </div>
      <div class="dashboard-panel" id="dash-panel">
        ${buildDashPanel(u, p)}
      </div>
    </div>`;
}

function switchDashTab(tab) {
  state.dashTab = tab;
  const u = state.currentUser;
  const p = u?.isProvider ? PROVIDERS.find(x => x.id === u.providerId) : null;
  const panel = document.getElementById('dash-panel');
  if (panel) panel.innerHTML = buildDashPanel(u, p);
  document.querySelectorAll('.dash-menu-item').forEach(el => el.classList.remove('active'));
  event?.currentTarget?.classList.add('active');
  setTimeout(() => { animateScoreRings(); observeReveal(); }, 100);
}

function buildDashPanel(u, p) {
  // OVERZICHT (provider stats)
  if (state.dashTab === 'overzicht' && p) {
    const avgScore = p.reviewsList.length
      ? Math.round(p.reviewsList.reduce((s,r) => s+r.score, 0) / p.reviewsList.length)
      : p.score;
    return `
      <div class="dashboard-panel-title">📊 Overzicht</div>
      <div class="provider-stats-row">
        <div class="provider-stat-card">
          <div class="stat-icon">👥</div>
          <div class="stat-val">${p.clients}</div>
          <div class="stat-lbl">Totale klanten</div>
        </div>
        <div class="provider-stat-card">
          <div class="stat-icon">🔁</div>
          <div class="stat-val">${p.repeatClients}</div>
          <div class="stat-lbl">Terugkerende klanten</div>
        </div>
        <div class="provider-stat-card">
          <div class="stat-icon">⭐</div>
          <div class="stat-val">${p.reviews}</div>
          <div class="stat-lbl">Beoordelingen</div>
        </div>
      </div>
      <div class="dash-score-overview">
        ${buildScoreLarge(avgScore)}
        <div class="dash-score-stats">
          <div><strong>${p.reviews}</strong> beoordelingen</div>
          <div>Score: <strong style="color:${scoreColor(avgScore)}">${avgScore}%</strong></div>
          <div>Op tijd: <strong style="color:${scoreColor(p.onTime)}">${p.onTime}%</strong></div>
        </div>
      </div>
      <div class="dash-section">
        <div class="dash-section-title">Uw categorie &amp; tarief</div>
        <div class="info-row"><span>Categorie</span><span>${p.category}</span></div>
        <div class="info-row"><span>District</span><span>${p.district}</span></div>
        <div class="info-row"><span>Tarief</span><span>${p.price}</span></div>
        <div class="info-row"><span>Werktijden</span><span>${p.workingHours || 'Niet ingesteld'}</span></div>
      </div>`;
  }

  // VERTROUWENSSCORE
  if (state.dashTab === 'vertrouwen' && p) {
    const avgScore = p.reviewsList.length
      ? Math.round(p.reviewsList.reduce((s,r) => s+r.score, 0) / p.reviewsList.length)
      : p.score;
    const repeatPct = p.clients > 0 ? Math.round((p.repeatClients / p.clients) * 100) : 0;
    return `
      <div class="dashboard-panel-title">🏅 Vertrouwensscore</div>
      <p style="color:var(--text-muted);margin-bottom:24px;font-size:14px">Uw vertrouwensscore wordt berekend op basis van meerdere factoren en is zichtbaar voor klanten op uw profiel.</p>
      <div class="dash-score-overview">
        ${buildScoreLarge(avgScore)}
        <div class="dash-score-stats">
          <div><strong>Beoordelingsscore:</strong> ${avgScore}%</div>
          <div><strong>Terugkerende klanten:</strong> ${repeatPct}%</div>
          <div><strong>Op tijd aangekomen:</strong> ${p.onTime}%</div>
          <div><strong>Totale klanten:</strong> ${p.clients}</div>
        </div>
      </div>
      <div class="trust-score-bar-section">
        <div class="trust-score-bar-row">
          <div class="trust-score-bar-label">Beoordelingen score</div>
          <div class="trust-score-bar-track"><div class="trust-score-bar-fill" style="width:${avgScore}%;background:${scoreColor(avgScore)}" data-score="${avgScore}"></div></div>
          <div class="trust-score-bar-val">${avgScore}%</div>
        </div>
        <div class="trust-score-bar-row">
          <div class="trust-score-bar-label">Terugkerende klanten</div>
          <div class="trust-score-bar-track"><div class="trust-score-bar-fill" style="width:${repeatPct}%;background:#2563eb" data-score="${repeatPct}"></div></div>
          <div class="trust-score-bar-val">${repeatPct}%</div>
        </div>
        <div class="trust-score-bar-row">
          <div class="trust-score-bar-label">Op tijd aangekomen</div>
          <div class="trust-score-bar-track"><div class="trust-score-bar-fill" style="width:${p.onTime}%;background:#16a34a" data-score="${p.onTime}"></div></div>
          <div class="trust-score-bar-val">${p.onTime}%</div>
        </div>
      </div>`;
  }

  // PORTFOLIO (upload)
  if (state.dashTab === 'portfolio' && p) {
    const slots = Math.max(6, p.portfolio.length + 1);
    const items = [];
    for (let i = 0; i < slots; i++) {
      const item = p.portfolio[i];
      if (item) {
        const isVid = item.type === 'video';
        items.push(`
          <div class="portfolio-upload-item filled">
            ${isVid
              ? `<video src="${item.src}" muted playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></video>`
              : `<img src="${item.src}" alt="Portfolio">`}
            <div class="portfolio-remove-btn" onclick="removePortfolioItem(${p.id},${i})">✕</div>
          </div>`);
      } else {
        items.push(`
          <div class="portfolio-upload-item" onclick="triggerPortfolioUpload(${p.id})">
            <div class="upload-icon">➕</div>
            <div class="upload-text">Foto of video uploaden</div>
          </div>`);
      }
    }
    return `
      <div class="dashboard-panel-title">🖼️ Portfolio</div>
      <p style="color:var(--text-muted);margin-bottom:20px;font-size:14px">Upload foto's en video's om uw werk te tonen aan potentiële klanten.</p>
      <div class="portfolio-upload-grid">${items.join('')}</div>
      <p class="portfolio-hint">Ondersteunde formaten: JPG, PNG, GIF, MP4, MOV · Max. 50MB per bestand</p>
      <input type="file" id="portfolio-file-input" accept="image/*,video/*" style="display:none" onchange="handlePortfolioUpload(${p.id}, this)" multiple />`;
  }

  // REVIEWS
  if (state.dashTab === 'reviews' && p) {
    const reviews = p.reviewsList;
    const avgScore = reviews.length
      ? Math.round(reviews.reduce((s,r) => s+r.score, 0) / reviews.length)
      : p.score;
    return `
      <div class="dashboard-panel-title">⭐ Beoordelingen & Score</div>
      <div class="dash-score-overview">
        ${buildScoreLarge(avgScore)}
        <div class="dash-score-stats">
          <div><strong>${reviews.length}</strong> beoordelingen</div>
          <div>Score: <strong style="color:${scoreColor(avgScore)}">${avgScore}%</strong></div>
        </div>
      </div>
      ${reviews.length
        ? reviews.map(r => `
            <div class="review-card">
              <div class="review-header">
                <div class="review-avatar">${r.author[0]}</div>
                <div class="review-meta">
                  <div class="review-author">${r.author}</div>
                  <div class="review-date">${formatDate(r.date)}</div>
                </div>
                ${buildScoreBadge(r.score)}
              </div>
              <div class="review-text">${r.text}</div>
            </div>`).join('')
        : '<p class="no-reviews">Nog geen beoordelingen ontvangen.</p>'
      }`;
  }

  // PROFILE tab
  return `
    <div class="dashboard-panel-title">👤 Mijn Profiel</div>
    <div class="dash-section">
      <div class="dash-section-title">Persoonlijke gegevens</div>
      <div class="avatar-upload-area">
        <div class="avatar-preview">${u.firstname[0].toUpperCase()}</div>
        <button class="btn-avatar-upload" onclick="showToast('Foto uploaden beschikbaar in de app.', 'success')">
          📷 Foto uploaden
        </button>
      </div>
      <div class="form-grid-2">
        <div class="form-group">
          <label>Voornaam</label>
          <input type="text" value="${u.firstname}" id="d-fn" />
        </div>
        <div class="form-group">
          <label>Achternaam</label>
          <input type="text" value="${u.lastname || ''}" id="d-ln" />
        </div>
      </div>
      <div class="form-group">
        <label>E-mailadres</label>
        <input type="email" value="${u.email}" id="d-em" />
      </div>
    </div>
    ${u.isProvider && p ? `
    <div class="dash-section">
      <div class="dash-section-title">Uw dienst</div>
      <div class="form-group">
        <label>Omschrijving</label>
        <input type="text" value="${p.tagline}" id="d-tag" />
      </div>
      <div class="form-group">
        <label>Tarief</label>
        <input type="text" value="${p.price}" id="d-price" />
      </div>
      <div class="form-group">
        <label>Werktijden</label>
        <input type="text" value="${p.workingHours || ''}" id="d-hours" placeholder="bijv. Ma–Vr 08:00–17:00" />
      </div>
    </div>` : ''}
    <button class="dash-save-btn" onclick="saveDashProfile()">💾 Opslaan</button>`;
}

function saveDashProfile() {
  const fn = document.getElementById('d-fn')?.value.trim();
  const ln = document.getElementById('d-ln')?.value.trim();
  if (fn) {
    state.currentUser.firstname = fn;
    state.currentUser.lastname  = ln || '';
    document.getElementById('nav-avatar').textContent = fn[0].toUpperCase();
    document.getElementById('nav-username').textContent = fn;
  }
  const tag   = document.getElementById('d-tag')?.value.trim();
  const price = document.getElementById('d-price')?.value.trim();
  const hours = document.getElementById('d-hours')?.value.trim();
  if (state.currentUser.isProvider) {
    const p = PROVIDERS.find(x => x.id === state.currentUser.providerId);
    if (p) {
      if (tag) p.tagline = tag;
      if (price) p.price = price;
      if (hours !== undefined) p.workingHours = hours;
    }
  }
  showToast('Profiel bijgewerkt!', 'success');
}

/* Portfolio upload handlers */
function triggerPortfolioUpload(providerId) {
  const input = document.getElementById('portfolio-file-input');
  if (input) input.click();
}

function handlePortfolioUpload(providerId, input) {
  const p = PROVIDERS.find(x => x.id === providerId);
  if (!p || !input.files.length) return;

  Array.from(input.files).forEach(file => {
    const isVideo = file.type.startsWith('video/');
    const reader = new FileReader();
    reader.onload = (e) => {
      p.portfolio.push({ src: e.target.result, type: isVideo ? 'video' : 'image' });
      showToast(`${isVideo ? 'Video' : 'Foto'} succesvol geüpload!`, 'success');
      renderDashboard();
      // Stay on portfolio tab
      state.dashTab = 'portfolio';
      renderDashboard();
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
}

function removePortfolioItem(providerId, index) {
  const p = PROVIDERS.find(x => x.id === providerId);
  if (!p) return;
  p.portfolio.splice(index, 1);
  showToast('Item verwijderd.', 'success');
  state.dashTab = 'portfolio';
  renderDashboard();
}

/* ══════════════════════════════════════════
   SCROLL REVEAL
══════════════════════════════════════════ */

let revealObserver = null;

function observeReveal() {
  if (revealObserver) {
    document.querySelectorAll('.reveal:not(.visible)').forEach(el => revealObserver.observe(el));
    return;
  }
  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
        const rings = entry.target.querySelectorAll('.score-ring-arc');
        if (rings.length) animateScoreRings();
      }
    });
  }, { threshold: 0.10 });
  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
}

/* ══════════════════════════════════════════
   TOAST
══════════════════════════════════════════ */

let toastTimer = null;

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

/* ══════════════════════════════════════════
   UTILS
══════════════════════════════════════════ */

function showError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  el.style.animation = 'none';
  requestAnimationFrame(() => { el.style.animation = ''; });
}

function formatDate(dateStr) {
  try {
    return new Date(dateStr).toLocaleDateString('nl-NL', { year:'numeric', month:'long', day:'numeric' });
  } catch { return dateStr; }
}

/* ══════════════════════════════════════════
   NAVBAR SCROLL EFFECT
══════════════════════════════════════════ */

window.addEventListener('scroll', () => {
  document.getElementById('navbar')?.classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });

/* ══════════════════════════════════════════
   CLOSE DROPDOWN ON OUTSIDE CLICK
══════════════════════════════════════════ */

document.addEventListener('click', (e) => {
  const pill = document.querySelector('.user-pill');
  const dropdown = document.getElementById('user-dropdown');
  if (dropdown && !dropdown.classList.contains('hidden')) {
    if (!pill?.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  }
});

/* ══════════════════════════════════════════
   HERO SEARCH — ENTER KEY
══════════════════════════════════════════ */

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && document.getElementById('hero-search') === document.activeElement) {
    heroSearch();
  }
});

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  renderCategoryCards();
  renderTopProviders();
  observeReveal();

  // Hero cards score display
  document.querySelectorAll('.hc-score').forEach(el => {
    const text = el.textContent.trim();
    const match = text.match(/[\d.]+/);
    if (match) {
      const raw = parseFloat(match[0]);
      const pct = Math.round((raw / 5) * 100);
      el.innerHTML = buildScoreBadge(pct);
    }
  });

  setTimeout(() => animateScoreRings(), 400);
});
