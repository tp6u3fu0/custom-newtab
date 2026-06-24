import { getLinks, saveLinks } from './modules/links.js';
import { F1_TEAMS, F1_DRIVERS } from './modules/f1.js';

const DEFAULT_SETTINGS = {
  timeFormat:  '24',
  showDate:    true,
  weatherCity: '',
  leetcodeUser:'',
  f1Team:      '', f1TrackType: 'none', f1DriverId: '',
  theme:       'system',
  style:       'minimal',
  animations:  true,
  bgType:      'default',
  bgColor:     '#1a1a2e',
  bgGradient:  '',
  bgBlur:      0,
  gridCols:    9,
};

const GRADIENT_PRESETS = [
  { label: '午夜藍', value: 'linear-gradient(135deg,#0f0c29,#302b63,#24243e)' },
  { label: '玫瑰金', value: 'linear-gradient(135deg,#f7971e,#ffd200)' },
  { label: '翡翠', value: 'linear-gradient(135deg,#11998e,#38ef7d)' },
  { label: '極光', value: 'linear-gradient(135deg,#00c3ff,#ffff1c)' },
  { label: '深海', value: 'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)' },
  { label: '黃昏', value: 'linear-gradient(135deg,#fc466b,#3f5efb)' },
  { label: '沙漠', value: 'linear-gradient(135deg,#f7971e,#c94b4b)' },
  { label: '夜空', value: 'linear-gradient(135deg,#0d0d0d,#1a1a2e,#2d1b69)' },
];

async function loadSettings() {
  return new Promise(resolve => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.sync.get(['settings'], r => {
        resolve({ ...DEFAULT_SETTINGS, ...(r.settings ?? {}) });
      });
    } else {
      try {
        resolve({ ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('settings') ?? '{}') });
      } catch { resolve({ ...DEFAULT_SETTINGS }); }
    }
  });
}

async function saveSettings(s) {
  return new Promise(resolve => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.sync.set({ settings: s }, resolve);
    } else {
      localStorage.setItem('settings', JSON.stringify(s));
      resolve();
    }
  });
}

function applyStyle(style) {
  document.documentElement.setAttribute('data-style', style ?? 'minimal');
  document.querySelectorAll('.style-option').forEach(el => {
    el.classList.toggle('active', el.dataset.style === style);
  });
}

function applyTheme(theme, style) {
  if (style === 'neon') { document.documentElement.removeAttribute('data-theme'); return; }
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = theme === 'dark' || (theme === 'system' && prefersDark);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}

// ── Links editor ─────────────────────────────────────────────
async function renderLinksEditor() {
  const editor = document.getElementById('links-editor');
  const links  = await getLinks();
  editor.innerHTML = '';

  links.forEach((link, i) => {
    const domain = (() => { try { return new URL(link.url).hostname; } catch { return ''; } })();
    const row = document.createElement('div');
    row.className = 'link-editor-row';
    row.innerHTML = `
      <img src="https://www.google.com/s2/favicons?domain=${domain}&sz=32" alt=""
           onerror="this.style.display='none'" />
      <span class="le-name">${escHtml(link.name)}</span>
      <span class="le-url">${escHtml(link.url)}</span>
      <button class="le-del" data-idx="${i}" title="刪除">×</button>
    `;
    editor.appendChild(row);
  });

  editor.querySelectorAll('.le-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      const current = await getLinks();
      await saveLinks(current.filter((_, i) => i !== +btn.dataset.idx));
      renderLinksEditor();
    });
  });
}

function openAddModal(onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h3>新增連結</h3>
      <input id="modal-name" type="text" placeholder="名稱（例：Google）" />
      <input id="modal-url"  type="text" placeholder="網址（例：https://google.com）" />
      <div class="modal-actions">
        <button class="btn-cancel">取消</button>
        <button class="btn-confirm">新增</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const nameInput = overlay.querySelector('#modal-name');
  nameInput.focus();
  overlay.querySelector('.btn-cancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('.btn-confirm').addEventListener('click', () => {
    let name = nameInput.value.trim();
    let url  = overlay.querySelector('#modal-url').value.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    if (!name) { try { name = new URL(url).hostname; } catch { name = url; } }
    overlay.remove();
    onConfirm({ name, url });
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast() {
  const t = document.getElementById('save-toast');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  const settings = await loadSettings();
  applyStyle(settings.style);
  applyTheme(settings.theme, settings.style);

  // Style picker
  const styleRadio = document.querySelector(`input[name="style"][value="${settings.style}"]`);
  if (styleRadio) styleRadio.checked = true;
  document.querySelectorAll('input[name="style"]').forEach(r => {
    r.addEventListener('change', () => {
      applyStyle(r.value);
      applyTheme(document.getElementById('s-theme').value, r.value);
    });
  });

  document.getElementById('s-theme').value        = settings.theme;
  document.getElementById('s-animations').checked = settings.animations !== false;
  document.getElementById('s-time-format').value  = settings.timeFormat;
  document.getElementById('s-show-date').checked  = settings.showDate;
  document.getElementById('s-weather-city').value = settings.weatherCity;
  document.getElementById('s-lc-user').value      = settings.leetcodeUser;

  // F1 追蹤設定
  const f1TeamSel   = document.getElementById('s-f1-team');
  const f1DriverSel = document.getElementById('s-f1-driver');
  F1_TEAMS.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id; opt.textContent = t.name;
    f1TeamSel.appendChild(opt);
  });
  F1_DRIVERS.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id; opt.textContent = `${d.code} · ${d.name}`;
    f1DriverSel.appendChild(opt);
  });
  f1TeamSel.value   = settings.f1Team     ?? '';
  f1DriverSel.value = settings.f1DriverId ?? '';

  let currentF1TrackType = settings.f1TrackType ?? 'none';
  const f1TypeCtrl = document.getElementById('s-f1-track-type');
  const f1TeamRow   = document.getElementById('f1-team-row');
  const f1DriverRow = document.getElementById('f1-driver-row');
  function setF1TrackType(val) {
    currentF1TrackType = val;
    f1TypeCtrl.querySelectorAll('.seg-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.value === val));
    f1TeamRow.style.display   = val === 'team'   ? '' : 'none';
    f1DriverRow.style.display = val === 'driver' ? '' : 'none';
  }
  setF1TrackType(currentF1TrackType);
  f1TypeCtrl.addEventListener('click', e => {
    const btn = e.target.closest('.seg-btn');
    if (btn) setF1TrackType(btn.dataset.value);
  });

  document.getElementById('s-theme').addEventListener('change', e => {
    const style = document.querySelector('input[name="style"]:checked')?.value ?? 'minimal';
    applyTheme(e.target.value, style);
  });

  // Grid cols segmented control
  let currentGridCols = settings.gridCols ?? 9;
  const segCtrl = document.getElementById('s-grid-cols');
  function setGridCols(val) {
    currentGridCols = val;
    segCtrl.querySelectorAll('.seg-btn').forEach(b => {
      b.classList.toggle('active', +b.dataset.value === val);
    });
  }
  segCtrl.querySelectorAll('.seg-btn').forEach(b => {
    b.addEventListener('click', () => setGridCols(+b.dataset.value));
  });
  setGridCols(currentGridCols);

  // ── Background UI ──────────────────────────────────────────
  let currentBgType     = settings.bgType     ?? 'default';
  let currentBgGradient = settings.bgGradient ?? '';

  // Tabs
  const bgTabs = document.querySelectorAll('.bg-tab');
  function setActiveBgTab(type) {
    currentBgType = type;
    bgTabs.forEach(t => t.classList.toggle('active', t.dataset.bgType === type));
    document.querySelectorAll('.bg-panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById(`bg-panel-${type}`);
    if (panel) panel.classList.add('active');
  }
  bgTabs.forEach(t => t.addEventListener('click', () => setActiveBgTab(t.dataset.bgType)));
  setActiveBgTab(currentBgType);

  // Color inputs — keep in sync
  const colorPicker = document.getElementById('s-bg-color');
  const colorHex    = document.getElementById('s-bg-color-hex');
  colorPicker.value = settings.bgColor ?? '#1a1a2e';
  colorHex.value    = settings.bgColor ?? '#1a1a2e';
  colorPicker.addEventListener('input', () => { colorHex.value = colorPicker.value; });
  colorHex.addEventListener('input', () => {
    if (/^#[0-9a-f]{6}$/i.test(colorHex.value)) colorPicker.value = colorHex.value;
  });

  // Gradient presets
  const presetsEl = document.getElementById('gradient-presets');
  GRADIENT_PRESETS.forEach(g => {
    const sw = document.createElement('div');
    sw.className = 'gradient-swatch';
    sw.style.background = g.value;
    sw.title = g.label;
    if (g.value === settings.bgGradient) { sw.classList.add('active'); currentBgGradient = g.value; }
    sw.addEventListener('click', () => {
      presetsEl.querySelectorAll('.gradient-swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      currentBgGradient = g.value;
    });
    presetsEl.appendChild(sw);
  });

  // Image upload
  const uploadArea  = document.getElementById('bg-upload-area');
  const fileInput   = document.getElementById('s-bg-file');
  const previewImg  = document.getElementById('bg-preview-img');
  const blurSlider  = document.getElementById('s-bg-blur');
  const blurVal     = document.getElementById('s-bg-blur-val');

  blurSlider.value = settings.bgBlur ?? 0;
  blurVal.textContent = blurSlider.value;
  blurSlider.addEventListener('input', () => { blurVal.textContent = blurSlider.value; });

  // Show existing image if any
  const existingImg = localStorage.getItem('bg_image');
  if (existingImg) {
    previewImg.src = existingImg;
    previewImg.classList.add('visible');
    uploadArea.classList.add('has-image');
  }

  function loadImageFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = e => {
      const data = e.target.result;
      localStorage.setItem('bg_image', data);
      previewImg.src = data;
      previewImg.classList.add('visible');
      uploadArea.classList.add('has-image');
    };
    reader.readAsDataURL(file);
  }

  fileInput.addEventListener('change', () => loadImageFile(fileInput.files[0]));

  uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
  uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
  uploadArea.addEventListener('drop', e => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    loadImageFile(e.dataTransfer.files[0]);
  });

  // Links
  renderLinksEditor();
  document.getElementById('add-link-btn').addEventListener('click', () => {
    openAddModal(async link => {
      const current = await getLinks();
      await saveLinks([...current, link]);
      renderLinksEditor();
    });
  });

  // Save
  document.getElementById('save-btn').addEventListener('click', async () => {
    const newStyle = document.querySelector('input[name="style"]:checked')?.value ?? 'minimal';
    const updated  = {
      style:       newStyle,
      theme:       document.getElementById('s-theme').value,
      animations:  document.getElementById('s-animations').checked,
      timeFormat:  document.getElementById('s-time-format').value,
      showDate:    document.getElementById('s-show-date').checked,
      weatherCity: document.getElementById('s-weather-city').value.trim(),
      leetcodeUser:document.getElementById('s-lc-user').value.trim(),
      f1TrackType: currentF1TrackType,
      f1Team:      document.getElementById('s-f1-team').value,
      f1DriverId:  document.getElementById('s-f1-driver').value,
      bgType:      currentBgType,
      bgColor:     colorHex.value || colorPicker.value,
      bgGradient:  currentBgGradient,
      bgBlur:      Number(blurSlider.value),
      gridCols:    currentGridCols,
    };

    if (updated.weatherCity !== settings.weatherCity) localStorage.removeItem('weather_cache');
    if (updated.f1Team !== settings.f1Team)
      localStorage.removeItem(`f1_standings_cache_team_${settings.f1Team}`);
    if (updated.f1DriverId !== settings.f1DriverId)
      localStorage.removeItem(`f1_standings_cache_driver_${settings.f1DriverId}`);

    await saveSettings(updated);
    showToast();
  });
}

main();
