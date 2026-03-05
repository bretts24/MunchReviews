// ============================================================
// MunchReviews — Shared App Logic
// ============================================================

const SUPABASE_URL = 'https://jrhsrqknjtewsowswmqc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dYC3DQ8iFnhivh5IBJPB-Q_8hd5x4a8';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---- Nav three-dot menu ----------------------------------------
function initNav() {
  const btn      = document.getElementById('menuBtn');
  const dropdown = document.getElementById('menuDropdown');
  if (!btn || !dropdown) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
  });

  document.addEventListener('click', () => {
    dropdown.classList.remove('open');
  });
}

// ---- Toast notifications ----------------------------------------
function showToast(msg, type = 'success') {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  // force reflow
  void toast.offsetWidth;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ---- Rating helpers ----------------------------------------
function getRatingMeta(rating) {
  if (rating <= 2)  return { label: 'Poo',       cls: 'poo',      emoji: '💩' };
  if (rating <= 4)  return { label: 'Shwag',     cls: 'shwag',    emoji: '😒' };
  if (rating <= 6)  return { label: 'Mids',      cls: 'mids',     emoji: '😐' };
  if (rating <= 7)  return { label: 'Chronic',   cls: 'chronic',  emoji: '🌿' };
  if (rating <= 9)  return { label: 'Gas',       cls: 'gas',      emoji: '🔥' };
  return                   { label: 'Holy Shit', cls: 'holyshit', emoji: '🤯' };
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
}

// ---- Compress image before upload ----------------------------------------
function compressImage(file, maxWidth = 1200, quality = 0.8) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
    };
    img.src = url;
  });
}

// ---- Upload photos to Supabase Storage ----------------------------------------
async function uploadPhotos(files) {
  const urls = [];
  for (const file of files) {
    const compressed = await compressImage(file);
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const { error } = await db.storage
      .from('review-photos')
      .upload(path, compressed, { contentType: 'image/jpeg', cacheControl: '3600', upsert: false });
    if (error) throw error;
    const { data } = db.storage.from('review-photos').getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}

// ---- Build a review card element ----------------------------------------
function buildCard(review) {
  const meta = getRatingMeta(review.rating);

  const card = document.createElement('div');
  card.className = 'card';

  // Photo gallery
  const photos = review.photo_urls || [];
  let galleryHTML = '';
  if (photos.length > 0) {
    const imgs = photos.map((url, i) =>
      `<img src="${url}" class="${i === 0 ? 'active' : ''}" alt="food photo" loading="lazy">`
    ).join('');
    const dots = photos.length > 1
      ? `<div class="gallery-dots">${photos.map((_, i) =>
          `<span class="gallery-dot ${i === 0 ? 'active' : ''}" data-idx="${i}"></span>`
        ).join('')}</div>`
      : '';
    const arrows = photos.length > 1
      ? `<button class="gallery-arrow prev">&#8249;</button>
         <button class="gallery-arrow next">&#8250;</button>`
      : '';
    galleryHTML = `<div class="card-gallery">${imgs}${dots}${arrows}</div>`;
  } else {
    galleryHTML = `<div class="card-photo-placeholder">🍽️</div>`;
  }

  const location = [review.city, review.state].filter(Boolean).map(escHtml).join(', ');

  card.innerHTML = `
    ${galleryHTML}
    <div class="card-body">
      <div class="card-restaurant">${escHtml(review.restaurant)}</div>
      ${location ? `<div class="card-location">📍 ${location}</div>` : ''}
      <div class="card-meta">
        ${review.food_type ? `<span class="card-food-type">${escHtml(review.food_type)}</span>` : '<span></span>'}
        <span class="card-date">${review.reviewer_name ? `${escHtml(review.reviewer_name)} · ` : ''}${formatDate(review.created_at)}</span>
      </div>
      <div class="rating-badge ${meta.cls}">${meta.emoji} ${review.rating}/10 — ${meta.label}</div>
      <p class="card-review">${escHtml(review.review_text || '')}</p>
    </div>
  `;

  // Click card to open full review
  card.style.cursor = 'pointer';
  card.addEventListener('click', (e) => {
    if (e.target.closest('.gallery-arrow') || e.target.closest('.gallery-dot')) return;
    openReviewModal(review);
  });

  // Gallery navigation
  if (photos.length > 1) {
    let current = 0;
    const imgEls  = card.querySelectorAll('.card-gallery img');
    const dotEls  = card.querySelectorAll('.gallery-dot');

    function goTo(idx) {
      imgEls[current].classList.remove('active');
      dotEls[current].classList.remove('active');
      current = (idx + photos.length) % photos.length;
      imgEls[current].classList.add('active');
      dotEls[current].classList.add('active');
    }

    card.querySelector('.gallery-arrow.prev').addEventListener('click', () => goTo(current - 1));
    card.querySelector('.gallery-arrow.next').addEventListener('click', () => goTo(current + 1));
    dotEls.forEach(d => d.addEventListener('click', () => goTo(+d.dataset.idx)));
  }

  return card;
}

// ---- Review modal ----------------------------------------
function openReviewModal(review) {
  let modal = document.getElementById('reviewModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'reviewModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal-box" id="modalBox"></div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeReviewModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeReviewModal();
    });
  }

  const meta   = getRatingMeta(review.rating);
  const photos = review.photo_urls || [];

  let galleryHTML = '';
  if (photos.length > 0) {
    const imgs = photos.map((url, i) =>
      `<img src="${url}" class="modal-photo ${i === 0 ? 'active' : ''}" alt="food photo" loading="lazy">`
    ).join('');
    const dots = photos.length > 1
      ? `<div class="gallery-dots">${photos.map((_, i) =>
          `<span class="gallery-dot ${i === 0 ? 'active' : ''}" data-idx="${i}"></span>`
        ).join('')}</div>`
      : '';
    const arrows = photos.length > 1
      ? `<button class="gallery-arrow prev" id="modalPrev">&#8249;</button>
         <button class="gallery-arrow next" id="modalNext">&#8250;</button>`
      : '';
    galleryHTML = `<div class="modal-gallery">${imgs}${dots}${arrows}</div>`;
  }

  const modalLocation = [review.city, review.state].filter(Boolean).map(escHtml).join(', ');

  document.getElementById('modalBox').innerHTML = `
    <button class="modal-close" id="modalClose">✕</button>
    ${galleryHTML}
    <div class="modal-body">
      <div class="card-restaurant" style="font-size:1.3rem;margin-bottom:4px;">${escHtml(review.restaurant)}</div>
      ${modalLocation ? `<div class="card-location" style="margin-bottom:8px;">📍 ${modalLocation}</div>` : ''}
      <div class="card-meta" style="margin-bottom:12px;">
        ${review.food_type ? `<span class="card-food-type">${escHtml(review.food_type)}</span>` : '<span></span>'}
        <span class="card-date">${review.reviewer_name ? `${escHtml(review.reviewer_name)} · ` : ''}${formatDate(review.created_at)}</span>
      </div>
      <div class="rating-badge ${meta.cls}" style="margin-bottom:16px;">${meta.emoji} ${review.rating}/10 — ${meta.label}</div>
      <p style="font-size:0.95rem;line-height:1.7;color:var(--text);">${escHtml(review.review_text || '')}</p>
    </div>
  `;

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';

  document.getElementById('modalClose').addEventListener('click', closeReviewModal);

  // Gallery nav inside modal
  if (photos.length > 1) {
    let current = 0;
    const imgEls = modal.querySelectorAll('.modal-photo');
    const dotEls = modal.querySelectorAll('.gallery-dot');
    function goTo(idx) {
      imgEls[current].classList.remove('active');
      dotEls[current].classList.remove('active');
      current = (idx + photos.length) % photos.length;
      imgEls[current].classList.add('active');
      dotEls[current].classList.add('active');
    }
    document.getElementById('modalPrev').addEventListener('click', () => goTo(current - 1));
    document.getElementById('modalNext').addEventListener('click', () => goTo(current + 1));
    dotEls.forEach(d => d.addEventListener('click', () => goTo(+d.dataset.idx)));
  }
}

function closeReviewModal() {
  const modal = document.getElementById('reviewModal');
  if (modal) modal.classList.remove('open');
  document.body.style.overflow = '';
}


function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---- Upload recipe photos to Supabase Storage ----------------------------------------
async function uploadRecipePhotos(files) {
  const urls = [];
  for (const file of files) {
    const compressed = await compressImage(file);
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const { error } = await db.storage
      .from('recipe-photos')
      .upload(path, compressed, { contentType: 'image/jpeg', cacheControl: '3600', upsert: false });
    if (error) throw error;
    const { data } = db.storage.from('recipe-photos').getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}

// ---- Fetch recipes (optionally filtered) ----------------------------------------
async function fetchRecipes({ search = '', sortBy = 'created_at' } = {}) {
  let query = db.from('recipes').select('*').order(sortBy, { ascending: false });

  if (search.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(`meal_name.ilike.${term},author_name.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// ---- Build a recipe card element ----------------------------------------
function buildRecipeCard(recipe) {
  const meta  = getRatingMeta(recipe.rating);
  const card  = document.createElement('div');
  card.className = 'card recipe-card';

  const photos = recipe.photo_urls || [];
  let galleryHTML = '';
  if (photos.length > 0) {
    const imgs = photos.map((url, i) =>
      `<img src="${url}" class="${i === 0 ? 'active' : ''}" alt="recipe photo" loading="lazy">`
    ).join('');
    const dots = photos.length > 1
      ? `<div class="gallery-dots">${photos.map((_, i) =>
          `<span class="gallery-dot ${i === 0 ? 'active' : ''}" data-idx="${i}"></span>`
        ).join('')}</div>`
      : '';
    const arrows = photos.length > 1
      ? `<button class="gallery-arrow prev">&#8249;</button>
         <button class="gallery-arrow next">&#8250;</button>`
      : '';
    galleryHTML = `<div class="card-gallery">${imgs}${dots}${arrows}</div>`;
  } else {
    galleryHTML = `<div class="card-photo-placeholder">🍳</div>`;
  }

  const ingredients = recipe.ingredients || [];
  const equipment   = recipe.equipment   || [];

  card.innerHTML = `
    ${galleryHTML}
    <div class="card-body recipe-card-body">
      <div class="recipe-meal-name">${escHtml(recipe.meal_name)}</div>
      <div class="recipe-card-meta">
        ${recipe.prep_time ? `<span class="recipe-meta-chip">⏱ ${escHtml(recipe.prep_time)}</span>` : ''}
        <span class="recipe-meta-chip">🥗 ${ingredients.length} ingredient${ingredients.length !== 1 ? 's' : ''}</span>
        ${equipment.length > 0 ? `<span class="recipe-meta-chip">🔧 ${equipment.length} item${equipment.length !== 1 ? 's' : ''}</span>` : ''}
      </div>
      <div class="recipe-card-footer">
        <span class="recipe-author">${recipe.author_name ? escHtml(recipe.author_name) : 'Anonymous'} · ${formatDate(recipe.created_at)}</span>
        <span class="recipe-rating-compact ${meta.cls}">${meta.emoji} ${recipe.rating}/10</span>
      </div>
    </div>
  `;

  card.style.cursor = 'pointer';
  card.addEventListener('click', (e) => {
    if (e.target.closest('.gallery-arrow') || e.target.closest('.gallery-dot')) return;
    openRecipeModal(recipe);
  });

  if (photos.length > 1) {
    let current = 0;
    const imgEls = card.querySelectorAll('.card-gallery img');
    const dotEls = card.querySelectorAll('.gallery-dot');
    function goTo(idx) {
      imgEls[current].classList.remove('active');
      dotEls[current].classList.remove('active');
      current = (idx + photos.length) % photos.length;
      imgEls[current].classList.add('active');
      dotEls[current].classList.add('active');
    }
    card.querySelector('.gallery-arrow.prev').addEventListener('click', () => goTo(current - 1));
    card.querySelector('.gallery-arrow.next').addEventListener('click', () => goTo(current + 1));
    dotEls.forEach(d => d.addEventListener('click', () => goTo(+d.dataset.idx)));
  }

  return card;
}

// ---- Recipe modal ----------------------------------------
function openRecipeModal(recipe) {
  let modal = document.getElementById('recipeModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'recipeModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal-box recipe-modal-box" id="recipeModalBox"></div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeRecipeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeRecipeModal();
    });
  }

  const meta        = getRatingMeta(recipe.rating);
  const photos      = recipe.photo_urls || [];
  const ingredients = recipe.ingredients || [];
  const equipment   = recipe.equipment   || [];

  let galleryHTML = '';
  if (photos.length > 0) {
    const imgs = photos.map((url, i) =>
      `<img src="${url}" class="modal-photo ${i === 0 ? 'active' : ''}" alt="recipe photo" loading="lazy">`
    ).join('');
    const dots = photos.length > 1
      ? `<div class="gallery-dots">${photos.map((_, i) =>
          `<span class="gallery-dot ${i === 0 ? 'active' : ''}" data-idx="${i}"></span>`
        ).join('')}</div>`
      : '';
    const arrows = photos.length > 1
      ? `<button class="gallery-arrow prev" id="recipeModalPrev">&#8249;</button>
         <button class="gallery-arrow next" id="recipeModalNext">&#8250;</button>`
      : '';
    galleryHTML = `<div class="modal-gallery">${imgs}${dots}${arrows}</div>`;
  }

  const ingredientsHTML = ingredients.length > 0
    ? `<ul class="recipe-ingredient-list">
        ${ingredients.map(ing => `
          <li>
            ${ing.amount ? `<span class="ing-amount">${escHtml(ing.amount)}</span>` : ''}
            <span class="ing-item">${escHtml(ing.item)}</span>
          </li>`).join('')}
       </ul>`
    : '<p style="color:var(--text-muted);font-size:0.88rem;">No ingredients listed.</p>';

  const equipmentHTML = equipment.length > 0
    ? `<div class="recipe-equipment-tags">
        ${equipment.map(e => `<span class="equipment-tag">${escHtml(e)}</span>`).join('')}
       </div>`
    : '';

  document.getElementById('recipeModalBox').innerHTML = `
    <button class="modal-close" id="recipeModalClose">✕</button>
    ${galleryHTML}
    <div class="modal-body">
      <div class="recipe-modal-header">
        <div class="recipe-meal-name" style="font-size:1.4rem;">${escHtml(recipe.meal_name)}</div>
        <div class="recipe-modal-sub">
          ${recipe.prep_time ? `<span class="recipe-meta-chip">⏱ ${escHtml(recipe.prep_time)}</span>` : ''}
          <span class="recipe-rating-compact ${meta.cls}">${meta.emoji} ${recipe.rating}/10 — ${meta.label}</span>
        </div>
        <div style="font-size:0.8rem;color:var(--text-muted);margin-top:6px;">
          ${recipe.author_name ? `By ${escHtml(recipe.author_name)} · ` : ''}${formatDate(recipe.created_at)}
        </div>
      </div>

      <div class="recipe-section">
        <div class="recipe-section-title">Ingredients</div>
        ${ingredientsHTML}
      </div>

      ${equipment.length > 0 ? `
      <div class="recipe-section">
        <div class="recipe-section-title">Equipment</div>
        ${equipmentHTML}
      </div>` : ''}
    </div>
  `;

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';

  document.getElementById('recipeModalClose').addEventListener('click', closeRecipeModal);

  if (photos.length > 1) {
    let current = 0;
    const imgEls = modal.querySelectorAll('.modal-photo');
    const dotEls = modal.querySelectorAll('.gallery-dot');
    function goTo(idx) {
      imgEls[current].classList.remove('active');
      dotEls[current].classList.remove('active');
      current = (idx + photos.length) % photos.length;
      imgEls[current].classList.add('active');
      dotEls[current].classList.add('active');
    }
    document.getElementById('recipeModalPrev').addEventListener('click', () => goTo(current - 1));
    document.getElementById('recipeModalNext').addEventListener('click', () => goTo(current + 1));
    dotEls.forEach(d => d.addEventListener('click', () => goTo(+d.dataset.idx)));
  }
}

function closeRecipeModal() {
  const modal = document.getElementById('recipeModal');
  if (modal) modal.classList.remove('open');
  document.body.style.overflow = '';
}

// ---- Fetch all reviews (optionally filtered) ----------------------------------------
async function fetchReviews({ search = '', sortBy = 'created_at' } = {}) {
  let query = db.from('reviews').select('*').order(sortBy, { ascending: false });

  if (search.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(`restaurant.ilike.${term},food_type.ilike.${term},city.ilike.${term},state.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}
