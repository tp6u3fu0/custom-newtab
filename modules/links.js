const DEFAULT_LINKS = [
  { name: 'Google', url: 'https://www.google.com' },
  { name: 'YouTube', url: 'https://www.youtube.com' },
  { name: 'GitHub', url: 'https://www.github.com' },
];

export function initLinks(links) {
  const grid = document.getElementById('links-grid');
  grid.innerHTML = '';

  const items = links.length ? links : DEFAULT_LINKS;

  items.forEach((link, idx) => {
    const a = document.createElement('a');
    a.className = 'link-item';
    a.href = link.url;
    a.title = link.name;
    a.target = '_self';

    // 編輯模式阻止跳頁
    a.addEventListener('click', e => {
      if (document.body.classList.contains('edit-mode')) e.preventDefault();
    });

    const iconDiv = document.createElement('div');
    iconDiv.className = 'link-icon';

    const img = document.createElement('img');
    const domain = (() => { try { return new URL(link.url).hostname; } catch { return ''; } })();
    img.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    img.alt = link.name;
    img.onerror = () => {
      img.remove();
      const fb = document.createElement('span');
      fb.className = 'link-fallback';
      fb.textContent = link.name[0];
      iconDiv.appendChild(fb);
    };

    iconDiv.appendChild(img);

    // 刪除按鈕（編輯模式才顯示）
    const delBtn = document.createElement('button');
    delBtn.className = 'link-del';
    delBtn.setAttribute('aria-label', '刪除');
    delBtn.textContent = '×';
    delBtn.addEventListener('click', async e => {
      e.preventDefault();
      e.stopPropagation();
      const current = await getLinks();
      const base = current.length ? current : DEFAULT_LINKS;
      const updated = base.filter((_, i) => i !== idx);
      await saveLinks(updated);
      initLinks(updated);
    });
    iconDiv.appendChild(delBtn);

    const nameEl = document.createElement('span');
    nameEl.className = 'link-name';
    nameEl.textContent = link.name;

    a.appendChild(iconDiv);
    a.appendChild(nameEl);
    grid.appendChild(a);
  });

  // Add button
  const addBtn = document.createElement('div');
  addBtn.className = 'link-item link-add';
  addBtn.title = '新增連結';
  addBtn.setAttribute('role', 'button');
  addBtn.setAttribute('tabindex', '0');
  addBtn.innerHTML = `
    <div class="link-icon"><span>+</span></div>
    <span class="link-name">新增</span>
  `;
  addBtn.addEventListener('click', () => openAddLinkModal());
  addBtn.addEventListener('keydown', e => { if (e.key === 'Enter') openAddLinkModal(); });
  grid.appendChild(addBtn);
}

function openAddLinkModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h3>新增連結</h3>
      <input id="modal-name" type="text" placeholder="名稱（例：Google）" />
      <input id="modal-url" type="text" placeholder="網址（例：https://google.com）" />
      <div class="modal-actions">
        <button class="btn-cancel">取消</button>
        <button class="btn-confirm">新增</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const nameInput = overlay.querySelector('#modal-name');
  const urlInput = overlay.querySelector('#modal-url');
  nameInput.focus();

  overlay.querySelector('.btn-cancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('.btn-confirm').addEventListener('click', async () => {
    let name = nameInput.value.trim();
    let url = urlInput.value.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    if (!name) name = new URL(url).hostname;

    const storage = await getLinks();
    storage.push({ name, url });
    await saveLinks(storage);
    overlay.remove();
    initLinks(storage);
  });

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

export async function getLinks() {
  return new Promise(resolve => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.sync.get(['links'], r => resolve(r.links ?? []));
    } else {
      try {
        resolve(JSON.parse(localStorage.getItem('links') ?? '[]'));
      } catch { resolve([]); }
    }
  });
}

export async function saveLinks(links) {
  return new Promise(resolve => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.sync.set({ links }, resolve);
    } else {
      localStorage.setItem('links', JSON.stringify(links));
      resolve();
    }
  });
}
