import { env } from "../config/env.js";

/** Thin wrapper over the Zoko REST API. Every call sends the `apikey` header. */
async function zoko<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!env.ZOKO_API_KEY) throw new Error("ZOKO_API_KEY is not set");
  const res = await fetch(`${env.ZOKO_API_BASE}${path}`, {
    ...init,
    headers: { accept: "application/json", "content-type": "application/json", apikey: env.ZOKO_API_KEY, ...init.headers },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Zoko ${init.method ?? "GET"} ${path} -> ${res.status}: ${body}`);
  return (body ? JSON.parse(body) : {}) as T;
}

// Response types are deliberately loose until we have seen real payloads.
export type ZokoCustomer = {
  id: string;
  name?: string;
  channel?: string;
  channelId?: string; // phone for WhatsApp
  lastIncomingMessageAt?: string;
  assignment?: { id?: string; type?: string; [k: string]: unknown } | null;
  [k: string]: unknown;
};
export type ZokoCustomerPage = { currentPage: number; totalPages: number; totalCustomers: number; customers: ZokoCustomer[] };
export type ZokoAgent = { id: string; firstName?: string; lastName?: string; email?: string; role?: string; active?: boolean };

export const zokoApi = {
  // `channel` is required. Zoko rate-limits this endpoint to 1 request per 300 seconds.
  listCustomers: (page = 1, pageSize = 100) =>
    zoko<ZokoCustomerPage>(`/customer?channel=whatsapp&page=${page}&pageSize=${pageSize}&includeAssign=true`),
  listAgents: () => zoko<ZokoAgent[] | { agents: ZokoAgent[] }>(`/agent/agents`),
  listTemplates: () => zoko<unknown>(`/account/templates`),
  getMessage: (id: string) => zoko<unknown>(`/message/${id}`),
  sendText: (recipient: string, message: string) =>
    zoko<{ messageId?: string; status?: string }>(`/message`, {
      method: "POST",
      body: JSON.stringify({ channel: "whatsapp", recipient, type: "text", message }),
    }),
  // WhatsApp only allows free text within 24h of the customer's last message.
  sendTemplate: (recipient: string, templateId: string, templateArgs: string[] = []) =>
    zoko<{ messageId?: string; status?: string }>(`/message`, {
      method: "POST",
      body: JSON.stringify({ channel: "whatsapp", recipient, type: "template", templateId, templateArgs }),
    }),
};
