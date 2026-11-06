// Recognize Android logcat priority columns and textual iOS severity without
// treating an arbitrary standalone E in a message as an error.
export function logLevel(text) {
  const priority = text.match(/(?:^|\s)([VDIWEF])(?:\/[^\s:]+|\s+[^\s:]+\s*:)/)?.[1];
  if (priority) return priority === 'E' || priority === 'F' ? 'error' : priority === 'W' ? 'warning' : 'info';
  if (/\b(error|fatal|fault|exception)\b/i.test(text)) return 'error';
  if (/\bwarn(?:ing)?\b/i.test(text)) return 'warning';
  return 'info';
}
export function filterLogs(lines, {text = '', level = 'all', after = 0} = {}) {
  const query = text.toLocaleLowerCase();
  return lines.filter(line => line.id > after && (!query || line.text.toLocaleLowerCase().includes(query)) &&
    (level === 'all' || (level === 'warning' ? logLevel(line.text) !== 'info' : logLevel(line.text) === 'error')));
}
