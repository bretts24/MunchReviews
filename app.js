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
  if (rating <= 3)      return { label: 'Poo',     cls: 'poo',     emoji: '💩' };
  if (rating <= 6)      return { label: 'Mids',    cls: 'mids',    emoji: '😐' };
  return                       { label: 'Chronic', cls: 'chronic', emoji: '🔥' };
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
}

// ---- Upload photos to Supabase Storage ----------------------------------------
async function uploadPhotos(files) {
  const urls = [];
  for (const file of files) {
    const ext  = file.name.split('.').pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await db.storage
      .from('review-photos')
      .upload(path, file, { cacheControl: '3600', upsert: false });
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

  card.innerHTML = `
    ${galleryHTML}
    <div class="card-body">
      <div class="card-restaurant">${escHtml(review.restaurant)}</div>
      <div class="card-meta">
        ${review.food_type ? `<span class="card-food-type">${escHtml(review.food_type)}</span>` : '<span></span>'}
        <span class="card-date">${formatDate(review.created_at)}</span>
      </div>
      <div class="rating-badge ${meta.cls}">${meta.emoji} ${review.rating}/10 — ${meta.label}</div>
      <p class="card-review">${escHtml(review.review_text || '')}</p>
    </div>
  `;

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

// ---- XSS guard ----------------------------------------
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---- Fetch all reviews (optionally filtered) ----------------------------------------
async function fetchReviews({ search = '', sortBy = 'created_at' } = {}) {
  let query = db.from('reviews').select('*').order(sortBy, { ascending: false });

  if (search.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(`restaurant.ilike.${term},food_type.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}
