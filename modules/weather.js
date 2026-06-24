const CACHE_KEY = 'weather_cache';
const CACHE_TTL = 10 * 60 * 1000;

const WEATHER_CODES = {
  0: ['☀️', '晴天'],
  1: ['🌤️', '大致晴朗'], 2: ['⛅', '部分多雲'], 3: ['☁️', '多雲'],
  45: ['🌫️', '霧'], 48: ['🌫️', '霜霧'],
  51: ['🌦️', '毛毛雨'], 53: ['🌦️', '毛毛雨'], 55: ['🌧️', '毛毛雨'],
  61: ['🌧️', '小雨'], 63: ['🌧️', '中雨'], 65: ['🌧️', '大雨'],
  71: ['🌨️', '小雪'], 73: ['🌨️', '中雪'], 75: ['❄️', '大雪'],
  80: ['🌦️', '陣雨'], 81: ['🌧️', '陣雨'], 82: ['⛈️', '暴雨'],
  95: ['⛈️', '雷雨'], 96: ['⛈️', '雷陣雨'], 99: ['⛈️', '強雷雨'],
};

const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

let _weatherData = null; // { current, hourly, daily, locationName }

export async function initWeather(settings, mode = 'current') {
  const errorEl = document.getElementById('weather-error');

  const cached = loadCache();
  if (cached) {
    _weatherData = cached;
    applyMode(mode);
    return;
  }

  try {
    let lat, lon, locationName;

    if (settings.weatherCity) {
      const geo = await geocodeCity(settings.weatherCity);
      lat = geo.lat; lon = geo.lon; locationName = geo.name;
    } else {
      const pos = await getPosition();
      lat = pos.coords.latitude;
      lon = pos.coords.longitude;
      locationName = await reverseGeocode(lat, lon);
    }

    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,weather_code` +
      `&hourly=temperature_2m,weather_code&forecast_days=2` +
      `&daily=temperature_2m_max,temperature_2m_min,weather_code&forecast_days=7` +
      `&timezone=auto`
    );
    const data = await res.json();

    const current = {
      icon: (WEATHER_CODES[data.current.weather_code] ?? ['🌡️', '未知'])[0],
      desc: (WEATHER_CODES[data.current.weather_code] ?? ['🌡️', '未知'])[1],
      temp: Math.round(data.current.temperature_2m),
      locationName,
    };

    // 本日時段：取當前時間起最多 8 個整點（顯示數量由模組寬度決定）
    const nowHour = new Date().getHours();
    const hourly = [];
    for (let i = 0; i < data.hourly.time.length && hourly.length < 8; i++) {
      const t = new Date(data.hourly.time[i]);
      if (t < new Date()) continue;
      const [icon] = WEATHER_CODES[data.hourly.weather_code[i]] ?? ['🌡️'];
      hourly.push({ hour: t.getHours(), icon, temp: Math.round(data.hourly.temperature_2m[i]) });
    }

    // 本週預測：7 天
    const daily = data.daily.time.map((t, i) => {
      const d = new Date(t);
      const [icon] = WEATHER_CODES[data.daily.weather_code[i]] ?? ['🌡️'];
      return {
        label: i === 0 ? '今天' : `週${DAY_NAMES[d.getDay()]}`,
        icon,
        max: Math.round(data.daily.temperature_2m_max[i]),
        min: Math.round(data.daily.temperature_2m_min[i]),
      };
    });

    _weatherData = { current, hourly, daily };
    saveCache(_weatherData);
    applyMode(mode);
  } catch {
    document.getElementById('weather-current')?.classList.add('hidden');
    if (errorEl) {
      errorEl.classList.remove('hidden');
      errorEl.className = 'error-text';
      errorEl.textContent = '無法取得天氣資料';
    }
  }
}

export function setWeatherMode(mode) {
  applyMode(mode);
}

function applyMode(mode) {
  const cur    = document.getElementById('weather-current');
  const hourly = document.getElementById('weather-hourly');
  const weekly = document.getElementById('weather-weekly');
  if (!cur) return;

  cur.classList.toggle('hidden',    mode !== 'current');
  hourly?.classList.toggle('hidden', mode !== 'hourly');
  weekly?.classList.toggle('hidden', mode !== 'weekly');

  if (!_weatherData) return;

  if (mode === 'current') {
    renderCurrent(_weatherData.current);
  } else if (mode === 'hourly') {
    renderHourly(_weatherData.hourly);
  } else if (mode === 'weekly') {
    renderWeekly(_weatherData.daily);
  }
}

function renderCurrent({ icon, desc, temp, locationName }) {
  document.getElementById('weather-icon').textContent = icon;
  document.getElementById('weather-temp').textContent = `${temp}°C`;
  document.getElementById('weather-desc').textContent = desc;
  document.getElementById('weather-location').textContent = locationName ? `· ${locationName}` : '';
}

function getHourlyCount() {
  const size = document.querySelector('.module-wrap[data-id="weather"]')?.dataset.size ?? '2x1';
  if (size.startsWith('1')) return 1;
  if (size.startsWith('2')) return 5;
  return 8;
}

function renderHourly(hours) {
  // 頂部當前摘要（A / B 風格）
  if (_weatherData?.current) {
    const { icon, temp, desc, locationName } = _weatherData.current;
    const el = id => document.getElementById(id);
    if (el('wh-icon'))  el('wh-icon').textContent  = icon;
    if (el('wh-temp'))  el('wh-temp').textContent  = `${temp}°C`;
    if (el('wh-desc'))  el('wh-desc').textContent  = desc;
    if (el('wh-loc'))   el('wh-loc').textContent   = locationName ? `· ${locationName}` : '';
  }

  const list = document.getElementById('weather-hourly-list');
  if (!list) return;
  list.innerHTML = '';
  const count = getHourlyCount();
  const visible = hours.slice(0, count);
  visible.forEach(({ hour, icon, temp }, i) => {
    const item = document.createElement('div');
    item.className = 'wh-item' + (i < visible.length - 1 ? ' wh-sep' : '');
    item.innerHTML = `
      <span class="wh-hour">${String(hour).padStart(2, '0')}:00</span>
      <span class="wh-icon">${icon}</span>
      <span class="wh-temp">${temp}°</span>
    `;
    list.appendChild(item);
  });
}

function renderWeekly(days) {
  const list = document.getElementById('weather-weekly-list');
  if (!list) return;
  list.innerHTML = '';
  days.forEach(({ label, icon, max, min }) => {
    const item = document.createElement('div');
    item.className = 'wd-item';
    item.innerHTML = `
      <span class="wd-label">${label}</span>
      <span class="wd-icon">${icon}</span>
      <span class="wd-range">
        <span class="wd-max">${max}°</span>
        <span class="wd-sep">/</span>
        <span class="wd-min">${min}°</span>
      </span>
    `;
    list.appendChild(item);
  });
}

function getPosition() {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 })
  );
}

async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=zh&count=1`
    );
    const d = await res.json();
    return d.results?.[0]?.name ?? '';
  } catch { return ''; }
}

async function geocodeCity(city) {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=zh`
  );
  const d = await res.json();
  const r = d.results?.[0];
  if (!r) throw new Error('city not found');
  return { lat: r.latitude, lon: r.longitude, name: r.name };
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch { return null; }
}

function saveCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}
