export interface AgentConnection { base: string; token: string }
export interface RequestContext { connection: AgentConnection | null; token?: string; unauthorized?: () => void }
export class AgentError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = 'AgentError'; }
}
// No session data is persisted or logged. Pairing validation stays in the controller.
export async function agentRequest<T = unknown>(url: string, data: unknown, context: RequestContext): Promise<T> {
  const headers: Record<string, string> = context.connection ? { Authorization: `Bearer ${context.connection.token}` } : {};
  if (data !== undefined) { headers['Content-Type'] = 'application/json'; if (!context.connection && context.token) headers['X-Snapkit-Token'] = context.token; }
  const timeout = url === '/api/folders/pick' ? 310000 : url.includes('/api/provision/catalog') ? 135000 : url === '/api/scan' || url.includes('/boot') || url.includes('/shutdown') ? 120000 : 30000;
  const response = await fetch(context.connection ? context.connection.base + url : url, { method: data === undefined ? 'GET' : 'POST', headers, credentials: 'omit', signal: AbortSignal.timeout(timeout), ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
  const payload = await response.json();
  if (context.connection && response.status === 401) context.unauthorized?.();
  if (!response.ok) throw new AgentError(payload.error || window.SnapkitI18n.t('Request failed ({0})', [response.status]), response.status);
  return payload as T;
}
