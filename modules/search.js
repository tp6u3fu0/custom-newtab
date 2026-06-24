export function initSearch() {
  const input = document.getElementById('search-input');
  const btn   = document.getElementById('search-btn');
  if (!input) return;

  function doSearch() {
    const q = input.value.trim();
    if (q) window.location.href = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
  }

  input.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
  btn.addEventListener('click', doSearch);
}
