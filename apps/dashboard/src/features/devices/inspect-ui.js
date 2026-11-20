const t = value => window.SnapkitI18n.t(value);
const dialog = document.getElementById('inspect-ui-dialog');
const status = document.getElementById('inspect-ui-status');
const errorText = document.getElementById('inspect-ui-error');
const openButton = document.getElementById('inspect-ui-open');
const widget = document.getElementById('inspect-ui-widget');
const project = document.getElementById('inspect-ui-project');
let active;

function showNode(element, node, label) {
  element.hidden = !node;
  element.querySelector('strong').textContent = node ? `${t(label)}: ${node.name}` : '';
  element.querySelector('code').textContent = node?.file ? `${node.file}:${node.line}:${node.column}${node.enclosing ? ` · ${node.enclosing}` : ''}` : '';
}

function show(result) {
  const messages = {
    starting: 'Connecting to Flutter Inspector…',
    waiting: 'Tap a widget in the app on this device.',
    selected: result.project ? 'Tap another widget to inspect it.' : 'No source location in this project. Tap another widget.',
    unavailable: 'Flutter Inspector is unavailable. Run the app in Flutter Debug and wait for it to load.',
    expired: 'Inspection timed out. Close and reopen Inspect UI to continue.',
  };
  status.textContent = t(messages[result.phase] || messages.starting);
  showNode(widget, result.widget, 'Selected widget');
  showNode(project, result.project, 'Project source');
  openButton.disabled = !result.project?.file;
}

export async function inspectUI(api, device, expectedWorkspace) {
  if (active || !dialog || !expectedWorkspace) return;
  const request = (command, sessionId) => api(`/api/devices/${encodeURIComponent(device.id)}/inspect-ui`, { expectedWorkspace, command, sessionId }, true);
  const current = { request, stop() { if (current.sessionId) void request('closeInspector', current.sessionId).catch(() => {}); } };
  active = current;
  document.getElementById('inspect-ui-device').textContent = device.name;
  errorText.textContent = '';
  show({ phase: 'starting' });
  dialog.showModal();
  const poll = async () => {
    if (active !== current) return;
    try {
      const result = await request('status', current.sessionId);
      if (active !== current) return;
      if (result.phase === 'idle' && Date.now() > current.deadline) result.phase = 'unavailable';
      show(result);
      if (!['unavailable', 'expired'].includes(result.phase)) current.timer = setTimeout(poll, 750);
    } catch (error) {
      if (active === current) { openButton.disabled = true; errorText.textContent = t(error.message); }
    }
  };
  try {
    const first = await request('inspectUI');
    current.sessionId = first.sessionId;
    current.deadline = Date.now() + 12000;
    if (active === current) void poll(); else current.stop();
  } catch (error) { if (active === current) { status.textContent = ''; errorText.textContent = t(error.message); } }
}

dialog?.addEventListener('close', () => {
  if (!active) return;
  clearTimeout(active.timer);
  active.stop();
  active = null;
});
openButton?.addEventListener('click', async () => {
  const current = active;
  if (!current?.sessionId) return;
  try { await current.request('openInspectedSource', current.sessionId); }
  catch (error) { if (active === current) errorText.textContent = t(error.message); }
});
