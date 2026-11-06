export const DAY = 86400000;
export const REVIEW_KEY = 'snapkit-review-v1';
/** @typedef {{version: number, firstUsedAt: number, days: string[], successes: number, lastSuccessAt: number, prompts: number, nextPromptAt: number, optedOut: boolean, submitted: boolean}} ReviewHistory */
/** @returns {ReviewHistory} */
export function newHistory(now) { return {version: 1, firstUsedAt: now, days: [], successes: 0, lastSuccessAt: 0, prompts: 0, nextPromptAt: 0, optedOut: false, submitted: false}; }
export function readHistory(raw, now) {
  try {
    const h = JSON.parse(raw);
    if (h?.version === 1 && ['firstUsedAt','successes','lastSuccessAt','prompts','nextPromptAt'].every(k => Number.isFinite(h[k]) && h[k] >= 0) && Array.isArray(h.days) && h.days.length <= 90 && h.days.every(d => typeof d === 'string' && /^\d{4}-\d\d-\d\d$/.test(d)) && typeof h.optedOut === 'boolean' && typeof h.submitted === 'boolean') return /** @type {ReviewHistory} */ (h);
  } catch {}
  return newHistory(now);
}
/** @param {ReviewHistory} history */
export function recordDay(history, now) {
  const date = new Date(now), day = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  return {...history, days: [...new Set([...history.days, day])].slice(-90)};
}
/** @param {ReviewHistory} history */
export function recordSuccess(history, now) { return {...history, successes: Math.min(100, history.successes + 1), lastSuccessAt: now}; }
/** @param {ReviewHistory} history */
export function eligible(history, {now, sessionStartedAt, quiet, busy}) {
  return !history.optedOut && !history.submitted && history.prompts < 3 && now >= history.nextPromptAt &&
    now - history.firstUsedAt >= 7 * DAY && history.days.length >= 3 && history.successes >= 5 &&
    now - sessionStartedAt >= 8 * 60000 && now - history.lastSuccessAt >= 30000 && quiet && !busy;
}
/** @param {ReviewHistory} history */
export function invited(history, now) { return {...history, prompts: history.prompts + 1, nextPromptAt: now + 30 * DAY}; }
