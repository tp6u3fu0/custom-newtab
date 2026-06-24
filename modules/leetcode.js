const CACHE_KEY = 'leetcode_cache';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

const QUERY = `
query lcData($username: String!) {
  matchedUser(username: $username) {
    submitStatsGlobal {
      acSubmissionNum { difficulty count }
    }
    userCalendar { streak }
  }
  allQuestionsCount { difficulty count }
  activeDailyCodingChallengeQuestion {
    question { title titleSlug difficulty }
  }
}`;

export async function initLeetCode(username) {
  const contentEl = document.getElementById('leetcode-content');
  const errorEl   = document.getElementById('leetcode-error');

  if (!username) {
    contentEl.classList.add('hidden');
    errorEl.classList.remove('hidden');
    errorEl.className = 'error-text';
    errorEl.textContent = '請在設定中輸入 LeetCode 帳號';
    return;
  }

  const cached = loadCache(username);
  if (cached) { render(cached); return; }

  try {
    const res = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Referer': 'https://leetcode.com' },
      body: JSON.stringify({ query: QUERY, variables: { username } }),
    });
    if (!res.ok) throw new Error('API error');
    const json = await res.json();

    const user  = json.data?.matchedUser;
    if (!user) throw new Error('User not found');

    const stats  = user.submitStatsGlobal?.acSubmissionNum ?? [];
    const totals = json.data?.allQuestionsCount ?? [];
    const daily  = json.data?.activeDailyCodingChallengeQuestion?.question ?? null;
    const streak = user.userCalendar?.streak ?? 0;

    const result = {
      ...parseStats(stats, totals),
      streak,
      daily: daily ? {
        title: daily.title,
        slug:  daily.titleSlug,
        diff:  daily.difficulty,
      } : null,
    };

    saveCache(username, result);
    render(result);
  } catch {
    contentEl.classList.add('hidden');
    errorEl.classList.remove('hidden');
    errorEl.className = 'error-text';
    errorEl.textContent = 'LeetCode 資料無法載入';
  }
}

function parseStats(stats, totals) {
  const s = {}, t = {};
  stats.forEach(x  => { s[x.difficulty] = x.count; });
  totals.forEach(x => { t[x.difficulty] = x.count; });
  return {
    total:       s['All']    ?? 0,
    easy:        s['Easy']   ?? 0,
    medium:      s['Medium'] ?? 0,
    hard:        s['Hard']   ?? 0,
    totalEasy:   t['Easy']   ?? 0,
    totalMedium: t['Medium'] ?? 0,
    totalHard:   t['Hard']   ?? 0,
  };
}

const DIFF_COLOR = { Easy: 'var(--accent-easy)', Medium: 'var(--accent-medium)', Hard: 'var(--accent-hard)' };

function render({ total, easy, medium, hard, totalEasy, totalMedium, totalHard, streak, daily }) {
  document.getElementById('leetcode-total').textContent = `${total} solved`;

  // Streak
  const streakEl = document.getElementById('lc-streak');
  if (streak > 0) {
    document.getElementById('lc-streak-count').textContent = `${streak}d`;
    streakEl.classList.remove('hidden');
  }

  // Progress bars
  setBar('easy',   easy,   totalEasy);
  setBar('medium', medium, totalMedium);
  setBar('hard',   hard,   totalHard);

  // Daily challenge
  const dailyEl = document.getElementById('lc-daily');
  if (daily) {
    dailyEl.href = `https://leetcode.com/problems/${daily.slug}/`;
    document.getElementById('lc-daily-title').textContent = daily.title;
    const diffEl = document.getElementById('lc-daily-diff');
    diffEl.textContent = daily.diff;
    diffEl.style.color = DIFF_COLOR[daily.diff] ?? 'var(--fg-muted)';
    dailyEl.classList.remove('hidden');
  }
}

function setBar(key, solved, total) {
  const pct = total > 0 ? Math.round(solved / total * 100) : 0;
  document.querySelector(`.lc-${key}-fill`).style.width = pct + '%';
  document.querySelector(`.lc-${key}-num`).textContent  =
    total > 0 ? `${solved}/${total}` : `${solved}`;
}

function loadCache(username) {
  try {
    const raw = localStorage.getItem(`${CACHE_KEY}_${username}`);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch { return null; }
}

function saveCache(username, data) {
  try {
    localStorage.setItem(`${CACHE_KEY}_${username}`, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}
