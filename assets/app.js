const els = {
  cats: document.getElementById('cats'),
  grid: document.getElementById('grid'),
  q: document.getElementById('q'),
  sidebar: document.getElementById('sidebar'),
  menuBtn: document.getElementById('menuBtn'),
  backdrop: document.getElementById('backdrop'),
  openAll: document.getElementById('openAll'),
  closeAll: document.getElementById('closeAll'),
  previewWrap: document.getElementById('previewWrap'),
  preview: document.getElementById('preview'),
  previewTitle: document.getElementById('previewTitle'),
  openInNew: document.getElementById('openInNew'),
  closePreview: document.getElementById('closePreview')
};

const state = { data: null, expanded: new Set(), filter: '' };

// --- Sidebar menu toggle (mobile)
els.menuBtn?.addEventListener('click', () => toggleSidebar(true));
els.backdrop?.addEventListener('click', () => toggleSidebar(false));
function toggleSidebar(open){
  if(!window.matchMedia('(max-width:1024px)').matches) return;
  els.sidebar.classList.toggle('open', open);
  els.backdrop.classList.toggle('show', open);
}

// --- Load JSON
init();
async function init(){
  try{
    const res = await fetch('./data/site.json?v=' + Date.now());
    if(!res.ok) throw new Error('Не удалось загрузить data/site.json');
    state.data = await res.json();
    const firstId = state.data.categories?.[0]?.id;
    if(firstId) state.expanded.add(firstId);
    render();
    wireSearch();
    wirePreview();
  }catch(err){
    console.error(err);
    els.cats.innerHTML = `<div class="muted" style="padding:12px">Ошибка загрузки JSON: ${escapeHtml(String(err.message||err))}</div>`;
  }
}

// --- Render categories & pages
function render(){
  const q = state.filter.trim().toLowerCase();
  const cats = (state.data?.categories||[]).map(cat => {
    const isOpen = state.expanded.has(cat.id);
    const pages = (cat.pages||[]).filter(p => !q || match(p.title, q) || match(p.desc, q)).map(p => pageItem(cat, p)).join('');
    const hasVisible = pages.length > 0 || !q;
    if(!hasVisible) return '';
    return `
      <section class="cat" data-id="${escapeAttr(cat.id)}">
        <div class="cat-header" data-action="toggle">
          <div class="cat-title"><span style="font-size:18px">${escapeHtml(cat.emoji||'📁')}</span><span>${escapeHtml(cat.title)}</span></div>
          <div class="muted">${isOpen ? '▾' : '▸'}</div>
        </div>
        ${cat.desc ? `<div class="cat-desc">${escapeHtml(cat.desc)}</div>`: ''}
        ${isOpen ? `<div class="pages">${pages || emptyHint()}</div>` : ''}
      </section>`;
  }).join('');
  els.cats.innerHTML = cats || `<div class="muted" style="padding:12px">Нет категорий</div>`;

  // header actions
  els.cats.querySelectorAll('.cat-header').forEach(h => h.addEventListener('click', () => {
    const id = h.parentElement.getAttribute('data-id');
    if(state.expanded.has(id)) state.expanded.delete(id); else state.expanded.add(id);
    render();
  }));

  // page link clicks
  els.cats.querySelectorAll('a.page-link').forEach(a => a.addEventListener('click', onOpenPage));
}

function pageItem(cat, p){
  const url = p.path || '#';
  return `
    <a class="page-link" href="${escapeAttr(url)}" data-url="${escapeAttr(url)}" data-title="${escapeAttr(p.title)}">
      <div class="page-emoji">${escapeHtml(p.emoji||'🔗')}</div>
      <div class="page-meta">
        <div class="page-title">${highlight(p.title)}</div>
        ${p.desc ? `<div class="page-desc">${highlight(p.desc)}</div>` : ''}
      </div>
      <div class="open-chip">${deviceHasWide() ? 'Открыть справа' : 'Открыть'}</div>
    </a>`;
}

function emptyHint(){
  return `<div class="hint" style="padding:10px">Пока пусто. Добавьте страницы в JSON.</div>`
}

// --- Search
function wireSearch(){
  els.q.addEventListener('input', e => { state.filter = e.target.value; render(); });
}
function match(text, q){ return String(text||'').toLowerCase().includes(q); }
function highlight(text){ if(!state.filter) return escapeHtml(text); const re = new RegExp(`(${escapeReg(state.filter)})`, 'ig'); return escapeHtml(text).replace(re, '<mark>$1</mark>'); }

// --- Preview
function wirePreview(){
  els.closePreview.addEventListener('click', () => {
    els.preview.src = 'about:blank';
    els.previewWrap.classList.remove('active');
  });
  window.addEventListener('hashchange', tryOpenFromHash);
  tryOpenFromHash();
}

function onOpenPage(e){
  // On mobile open the page directly, on desktop open preview iframe
  const url = this.getAttribute('data-url');
  const title = this.getAttribute('data-title');
  if(!deviceHasWide()) return; // allow default navigation on mobile
  e.preventDefault();
  openPreview(url, title);
  toggleSidebar(false);
  location.hash = '#'+encodeURIComponent(url);
}

function deviceHasWide(){ return window.matchMedia('(min-width: 1025px)').matches; }

function openPreview(url, title){
  els.previewTitle.innerHTML = `🔗 ${escapeHtml(title)}`;
  els.preview.src = url;
  els.openInNew.href = url;
  els.previewWrap.classList.add('active');
}

function tryOpenFromHash(){
  const h = decodeURIComponent(location.hash.replace(/^#/, ''));
  if(h && /^[^#?].+$/i.test(h)){
    openPreview(h, 'Предпросмотр');
  }
}

// --- Utilities
function escapeHtml(s){ return String(s).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;','\\'':'&#39;'}[c])); }
function escapeAttr(s){ return escapeHtml(s).replace(/\"/g, '&quot;'); }
function escapeReg(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
