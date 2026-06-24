export function initClock(settings) {
  const timeEl = document.getElementById('clock-time');
  const greetingEl = document.getElementById('clock-greeting');
  const dateEl = document.getElementById('clock-date');

  function tick() {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();

    if (settings.timeFormat === '12') {
      const period = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      timeEl.textContent = `${h12}:${String(m).padStart(2, '0')} ${period}`;
    } else {
      timeEl.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    if (h >= 5 && h < 12) greetingEl.textContent = '早安';
    else if (h >= 12 && h < 18) greetingEl.textContent = '午安';
    else greetingEl.textContent = '晚安';

    if (settings.showDate) {
      const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
      const y = now.getFullYear();
      const mo = now.getMonth() + 1;
      const d = now.getDate();
      const w = weekdays[now.getDay()];
      dateEl.textContent = `${y} 年 ${mo} 月 ${d} 日　週${w}`;
    } else {
      dateEl.textContent = '';
    }
  }

  tick();
  setInterval(tick, 1000);
}
