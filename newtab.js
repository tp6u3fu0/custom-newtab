import { initClock }                    from './modules/clock.js';
import { initWeather, setWeatherMode }  from './modules/weather.js';
import { initLinks, getLinks }          from './modules/links.js';
import { initLeetCode }                 from './modules/leetcode.js';
import { initF1 }                       from './modules/f1.js';
import { initSearch }                   from './modules/search.js';

const MODULE_LABELS = {
  search: '搜尋', clock: '時鐘', weather: '天氣',
  links: '連結', leetcode: 'LeetCode', f1: 'F1',
};

// 目標欄數（從設定讀取，預設 9）；格子大小隨視窗動態計算
let GRID_COLS = 9;

function getSnapUnit() {
  return Math.floor(window.innerWidth / GRID_COLS);
}

// Valid snap sizes: CxR
const SIZE_MIGRATION = { sm: '1x1', md: '2x1', lg: '2x2', xl: '3x2' };
function migrateSize(s) { return SIZE_MIGRATION[s] ?? s; }

function getSizeCols(sizeKey) { return parseInt(sizeKey[0]); }
function getSizeRows(sizeKey) { return parseInt(sizeKey[2]); }

function snapSize(w, h) {
  const u = getSnapUnit();
  let cols = Math.max(1, Math.min(3, Math.round(w / u)));
  let rows = Math.max(1, Math.min(2, Math.round(h / u)));
  if (cols === 1) rows = 1; // 1x2 不合法
  return `${cols}x${rows}`;
}

// 預設位置（col/row 格座標，左上角）
const DEFAULT_POSITIONS = {
  search:   { col: 3, row: 0 },
  clock:    { col: 0, row: 0 },
  weather:  { col: 7, row: 0 },
  links:    { col: 3, row: 3 },
  leetcode: { col: 0, row: 2 },
  f1:       { col: 7, row: 2 },
};

const DEFAULT_SIZES = {
  search: '3x2', clock: '2x1', weather: '2x1',
  links: '2x1', leetcode: '2x1', f1: '2x1',
};

const DEFAULT_SETTINGS = {
  timeFormat: '24', showDate: true,
  weatherCity: '', leetcodeUser: '', f1Team: '',
  theme: 'system', style: 'minimal', animations: true,
  weatherMode: 'current',
  gridCols: 9,
};

// ── Grid helpers ──────────────────────────────────────────────
function getGridOffset() {
  const u = getSnapUnit();
  return {
    ox: (window.innerWidth  - GRID_COLS * u) / 2,
    oy: (window.innerHeight % u) / 2,
  };
}

function updateGridOffset() {
  const u = getSnapUnit();
  const { ox, oy } = getGridOffset();
  document.documentElement.style.setProperty('--snap-unit', u + 'px');
  document.documentElement.style.setProperty('--grid-ox',   ox + 'px');
  document.documentElement.style.setProperty('--grid-oy',   oy + 'px');
}

// 格座標 {col, row} → CSS 百分比位置（center anchor）
function gridToPercent(col, row, sizeKey) {
  const u = getSnapUnit();
  const { ox, oy } = getGridOffset();
  const vw = window.innerWidth, vh = window.innerHeight;
  const w = getSizeCols(sizeKey) * u;
  const h = getSizeRows(sizeKey) * u;
  return {
    left: (ox + col * u + w / 2) / vw * 100,
    top:  (oy + row * u + h / 2) / vh * 100,
  };
}

// 百分比位置 + size → {col, row}
function percentToGrid(leftPct, topPct, sizeKey) {
  const u = getSnapUnit();
  const { ox, oy } = getGridOffset();
  const vw = window.innerWidth, vh = window.innerHeight;
  const w = getSizeCols(sizeKey) * u;
  const h = getSizeRows(sizeKey) * u;
  const le = leftPct / 100 * vw - w / 2;
  const te = topPct  / 100 * vh - h / 2;
  return {
    col: Math.max(0, Math.round((le - ox) / u)),
    row: Math.max(0, Math.round((te - oy) / u)),
  };
}

// 舊格式 {left, top} 遷移到 {col, row}
function migratePosition(pos, sizeKey) {
  if (typeof pos?.col === 'number') return pos;
  if (typeof pos?.left === 'number') return percentToGrid(pos.left, pos.top, sizeKey);
  return DEFAULT_POSITIONS[sizeKey] ?? { col: 0, row: 0 };
}

// ── Storage ───────────────────────────────────────────────────
function storageGet(keys) {
  return new Promise(resolve => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.sync.get(keys, resolve);
    } else {
      const out = {};
      keys.forEach(k => { try { out[k] = JSON.parse(localStorage.getItem(k)); } catch { out[k] = null; } });
      resolve(out);
    }
  });
}

function storageSet(obj) {
  return new Promise(resolve => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.sync.set(obj, resolve);
    } else {
      Object.entries(obj).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
      resolve();
    }
  });
}

async function loadAll() {
  const raw = await storageGet(['settings', 'modulePositions', 'hiddenModules', 'moduleSizes', 'moduleZOrders']);
  const settings = { ...DEFAULT_SETTINGS, ...(raw.settings ?? {}) };
  const hidden   = raw.hiddenModules ?? [];

  // 遷移 size 格式
  const rawSizes = raw.moduleSizes ?? {};
  const sizes = {};
  Object.keys(DEFAULT_SIZES).forEach(id => {
    sizes[id] = migrateSize(rawSizes[id] ?? DEFAULT_SIZES[id]);
  });

  // 遷移 position 格式（需在 DOM/viewport ready 後執行）
  const rawPos = raw.modulePositions ?? {};
  const positions = {};
  Object.keys(DEFAULT_POSITIONS).forEach(id => {
    positions[id] = migratePosition(rawPos[id] ?? DEFAULT_POSITIONS[id], sizes[id]);
  });

  const zOrders = raw.moduleZOrders ?? {};

  return { settings, positions, hidden, sizes, zOrders };
}

// ── Theme / Style ─────────────────────────────────────────────
function applyStyle(style) {
  document.documentElement.setAttribute('data-style', style ?? 'minimal');
}
function applyTheme(theme, style) {
  if (style === 'neon') { document.documentElement.removeAttribute('data-theme'); return; }
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}

// ── Background ────────────────────────────────────────────────
function applyBackground(settings) {
  const layer = document.getElementById('bg-layer');
  const img   = document.getElementById('bg-img');
  if (!layer || !img) return;
  const type = settings.bgType ?? 'default';
  if (type === 'color' && settings.bgColor) {
    layer.style.background = settings.bgColor;
    img.classList.remove('has-image');
  } else if (type === 'gradient' && settings.bgGradient) {
    layer.style.background = settings.bgGradient;
    img.classList.remove('has-image');
  } else if (type === 'image') {
    layer.style.background = '';
    const data = localStorage.getItem('bg_image');
    if (data) {
      img.style.backgroundImage = `url(${data})`;
      img.style.filter = settings.bgBlur ? `blur(${settings.bgBlur}px)` : '';
      img.classList.add('has-image');
    } else {
      img.classList.remove('has-image');
    }
  } else {
    layer.style.background = '';
    img.classList.remove('has-image');
  }
}

// ── Snap preview ──────────────────────────────────────────────
const snapPreview = document.getElementById('snap-preview');

function showSnapPreview(col, row, sizeKey) {
  const u = getSnapUnit();
  const { left, top } = gridToPercent(col, row, sizeKey);
  snapPreview.style.width  = (getSizeCols(sizeKey) * u) + 'px';
  snapPreview.style.height = (getSizeRows(sizeKey) * u) + 'px';
  snapPreview.style.left   = left + '%';
  snapPreview.style.top    = top  + '%';
  snapPreview.classList.add('active');
}
function hideSnapPreview() { snapPreview.classList.remove('active'); }

// ── Build module DOM ──────────────────────────────────────────
function buildWrap(id, sizeKey) {
  const tpl = document.getElementById(`tpl-${id}`);
  if (!tpl) return null;

  const sz = sizeKey ?? '2x1';
  const section = document.createElement('section');
  section.className = 'module';
  section.id = `module-${id}`;
  section.appendChild(tpl.content.cloneNode(true));

  const handle = document.createElement('button');
  handle.className = 'mod-handle';
  handle.title = '拖曳移動';
  handle.setAttribute('aria-label', '拖曳移動');
  handle.textContent = '⠿';

  const hideBtn = document.createElement('button');
  hideBtn.className = 'mod-hide';
  hideBtn.title = '隱藏模組';
  hideBtn.setAttribute('aria-label', '隱藏');
  hideBtn.textContent = '×';

  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'mod-resize';

  const wrap = document.createElement('div');
  wrap.className = 'module-wrap';
  wrap.dataset.id   = id;
  wrap.dataset.size = sz;
  wrap.appendChild(handle);
  wrap.appendChild(section);
  wrap.appendChild(hideBtn);
  wrap.appendChild(resizeHandle);

  return { wrap, section, hideBtn, resizeHandle };
}

function placeWrap(wrap, pos, sizeKey, z) {
  const { left, top } = gridToPercent(pos.col, pos.row, sizeKey);
  wrap.style.left    = left + '%';
  wrap.style.top     = top  + '%';
  wrap.style.zIndex  = z ?? 10;
}

// 視窗縮放後重新定位所有模組
function repositionAllModules(positions, sizes, zOrders) {
  document.querySelectorAll('.module-wrap[data-id]').forEach(wrap => {
    const id   = wrap.dataset.id;
    const pos  = positions[id];
    const size = wrap.dataset.size ?? sizes[id] ?? '2x1';
    if (pos) placeWrap(wrap, pos, size, zOrders[id]);
  });
}

// ── Drag to move ──────────────────────────────────────────────
function makeDraggable(wrap, id, positions, sizes, zOrders, onLayout) {
  wrap.addEventListener('mousedown', e => {
    if (!document.body.classList.contains('edit-mode')) return;
    if (e.target.classList.contains('mod-hide'))   return;
    if (e.target.classList.contains('mod-resize')) return;
    if (e.target.closest('a, button:not(.mod-handle)')) return;
    e.preventDefault();
    bringToFront(id, wrap, zOrders, onLayout);

    const startX   = e.clientX, startY = e.clientY;
    const origLeft = parseFloat(wrap.style.left);
    const origTop  = parseFloat(wrap.style.top);
    const sizeKey  = wrap.dataset.size ?? sizes[id] ?? '2x1';
    wrap.classList.add('is-dragging');

    function onMove(e) {
      const dx = (e.clientX - startX) / window.innerWidth  * 100;
      const dy = (e.clientY - startY) / window.innerHeight * 100;
      const rawLeft = origLeft + dx, rawTop = origTop + dy;
      wrap.style.left = rawLeft + '%';
      wrap.style.top  = rawTop  + '%';
      const { col, row } = percentToGrid(rawLeft, rawTop, sizeKey);
      showSnapPreview(col, row, sizeKey);
    }

    function onUp(e) {
      wrap.classList.remove('is-dragging');
      hideSnapPreview();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);

      const dx = (e.clientX - startX) / window.innerWidth  * 100;
      const dy = (e.clientY - startY) / window.innerHeight * 100;
      const { col, row } = percentToGrid(origLeft + dx, origTop + dy, sizeKey);
      const { left, top } = gridToPercent(col, row, sizeKey);

      wrap.classList.add('is-snapping');
      wrap.style.left = left + '%';
      wrap.style.top  = top  + '%';
      const cleanup = () => { wrap.classList.remove('is-snapping'); wrap.removeEventListener('transitionend', cleanup); };
      wrap.addEventListener('transitionend', cleanup);

      positions[id] = { col, row };
      onLayout();
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  });
}

// ── Drag to resize ────────────────────────────────────────────
function makeResizable(wrap, id, sizes, positions, zOrders, onLayout, onSizeChange) {
  const handle = wrap.querySelector('.mod-resize');

  handle.addEventListener('mousedown', e => {
    if (!document.body.classList.contains('edit-mode')) return;
    e.stopPropagation();
    e.preventDefault();
    bringToFront(id, wrap, zOrders, onLayout);

    const u      = getSnapUnit();
    const startX = e.clientX, startY = e.clientY;
    const startW = wrap.offsetWidth, startH = wrap.offsetHeight;
    const { col, row } = positions[id] ?? DEFAULT_POSITIONS[id] ?? { col: 0, row: 0 };

    function onMove(e) {
      const newW = Math.max(u, Math.min(u * 3, startW + (e.clientX - startX)));
      const newH = Math.max(u, Math.min(u * 2, startH + (e.clientY - startY)));
      wrap.style.width  = newW + 'px';
      wrap.style.height = newH + 'px';
      // top-left 固定，只改右下
      const tmpKey = `${Math.max(1,Math.min(3,Math.round(newW/u)))}x${Math.max(1,Math.min(2,Math.round(newH/u)))}`;
      const { left, top } = gridToPercent(col, row, tmpKey);
      wrap.style.left = left + '%';
      wrap.style.top  = top  + '%';
    }

    function onUp(e) {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);

      const rawW = Math.max(u, Math.min(u * 3, startW + (e.clientX - startX)));
      const rawH = Math.max(u, Math.min(u * 2, startH + (e.clientY - startY)));
      const key  = snapSize(rawW, rawH);

      wrap.dataset.size = key;
      wrap.style.removeProperty('width');
      wrap.style.removeProperty('height');
      wrap.classList.add('is-snapping');

      const { left, top } = gridToPercent(col, row, key);
      wrap.style.left = left + '%';
      wrap.style.top  = top  + '%';
      const cleanup = () => { wrap.classList.remove('is-snapping'); wrap.removeEventListener('transitionend', cleanup); };
      wrap.addEventListener('transitionend', cleanup);

      sizes[id]     = key;
      positions[id] = { col, row };
      onLayout();
      onSizeChange?.(id, key);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  });
}

// ── Hidden bar ────────────────────────────────────────────────
function renderHiddenBar(hidden, onRestore) {
  const bar   = document.getElementById('hidden-bar');
  const chips = document.getElementById('hidden-chips');
  chips.innerHTML = '';
  if (hidden.length) {
    bar.classList.add('has-items');
    hidden.forEach(id => {
      const btn = document.createElement('button');
      btn.className = 'hidden-chip';
      btn.textContent = `+ ${MODULE_LABELS[id] ?? id}`;
      btn.addEventListener('click', () => onRestore(id));
      chips.appendChild(btn);
    });
  } else {
    bar.classList.remove('has-items');
  }
}

// ── Init module content ───────────────────────────────────────
async function initModuleContent(id, settings) {
  if (id === 'search')   initSearch();
  if (id === 'clock')    initClock(settings);
  if (id === 'weather')  initWeather(settings, settings.weatherMode ?? 'current');
  if (id === 'links')    { const links = await getLinks(); initLinks(links); }
  if (id === 'leetcode') initLeetCode(settings.leetcodeUser);
  if (id === 'f1')       initF1({ trackType: settings.f1TrackType ?? 'none', teamId: settings.f1Team ?? '', driverId: settings.f1DriverId ?? '' });
}

function saveLayout(positions, sizes, hidden, zOrders) {
  return storageSet({ modulePositions: positions, moduleSizes: sizes, hiddenModules: hidden, moduleZOrders: zOrders });
}

function bringToFront(id, wrap, zOrders, onLayout) {
  const maxZ = Object.values(zOrders).reduce((m, v) => Math.max(m, v), 10);
  if ((zOrders[id] ?? 0) >= maxZ) return; // 已經在最上層
  zOrders[id] = maxZ + 1;
  wrap.style.zIndex = zOrders[id];
  onLayout();
}
function saveSettings(settings) {
  return storageSet({ settings });
}

// ── Weather mode picker ───────────────────────────────────────
const WEATHER_MODES = [
  { key: 'current', label: '當前' },
  { key: 'hourly',  label: '時段' },
  { key: 'weekly',  label: '本週' },
];

function addWeatherModePicker(section, settings, onSave) {
  const picker = document.createElement('div');
  picker.className = 'mod-mode-picker';
  WEATHER_MODES.forEach(({ key, label }) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.dataset.mode = key;
    if ((settings.weatherMode ?? 'current') === key) btn.classList.add('active');
    btn.addEventListener('click', e => {
      e.stopPropagation();
      settings.weatherMode = key;
      picker.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.mode === key));
      setWeatherMode(key);
      onSave();
    });
    picker.appendChild(btn);
  });
  section.appendChild(picker);
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  const { settings, positions, hidden, sizes, zOrders } = await loadAll();

  GRID_COLS = settings.gridCols ?? 9;

  applyStyle(settings.style);
  applyTheme(settings.theme, settings.style);
  applyBackground(settings);
  if (settings.animations !== false) document.body.classList.add('animations');
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    applyTheme(settings.theme, settings.style);
  });

  updateGridOffset();

  const container = document.getElementById('modules-container');
  const allIds = Object.keys(DEFAULT_POSITIONS);

  async function addModule(id) {
    const built = buildWrap(id, sizes[id]);
    if (!built) return;
    const { wrap, hideBtn } = built;
    placeWrap(wrap, positions[id] ?? DEFAULT_POSITIONS[id], sizes[id], zOrders[id]);
    container.appendChild(wrap);
    await initModuleContent(id, settings);

    hideBtn.addEventListener('click', e => {
      e.stopPropagation();
      hidden.push(id);
      wrap.remove();
      renderHiddenBar(hidden, restoreModule);
      saveLayout(positions, sizes, hidden, zOrders);
    });

    const onLayout = () => saveLayout(positions, sizes, hidden, zOrders);
    makeDraggable(wrap, id, positions, sizes, zOrders, onLayout);
    makeResizable(wrap, id, sizes, positions, zOrders, onLayout, (changedId, newSize) => {
      if (changedId === 'weather') setWeatherMode(settings.weatherMode ?? 'current');
    });

    if (id === 'weather') {
      addWeatherModePicker(built.section, settings, () => saveSettings(settings));
    }
  }

  async function restoreModule(id) {
    const idx = hidden.indexOf(id);
    if (idx === -1) return;
    hidden.splice(idx, 1);
    await addModule(id);
    renderHiddenBar(hidden, restoreModule);
    saveLayout(positions, sizes, hidden);
  }

  for (const id of allIds) {
    if (!hidden.includes(id)) await addModule(id);
  }
  renderHiddenBar(hidden, restoreModule);

  // 視窗縮放 → 重新計算格子大小並重新定位
  window.addEventListener('resize', () => {
    updateGridOffset();
    repositionAllModules(positions, sizes, zOrders);
  });

  const editBtn = document.getElementById('edit-btn');
  const doneBtn = document.getElementById('done-btn');

  editBtn.addEventListener('click', () => {
    document.body.classList.add('edit-mode');
    editBtn.classList.add('hidden');
    doneBtn.classList.remove('hidden');
  });

  doneBtn.addEventListener('click', () => {
    document.body.classList.remove('edit-mode');
    doneBtn.classList.add('hidden');
    editBtn.classList.remove('hidden');
    container.querySelectorAll('.module-wrap').forEach(wrap => {
      const id = wrap.dataset.id;
      if (id) sizes[id] = wrap.dataset.size ?? '2x1';
    });
    saveLayout(positions, sizes, hidden, zOrders);
  });

  document.getElementById('settings-btn').addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
    } else {
      window.open('settings.html', '_blank');
    }
  });
}

main();
