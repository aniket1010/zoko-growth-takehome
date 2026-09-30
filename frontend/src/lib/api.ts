const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type ConversationRow = {
  id: string;
  name: string | null;
  phone: string | null;
  last_seen_at: string;
  assignee_id: string | null;
  assignee_name: string | null;
  message_count: number;
  inbound_count: number;
};

export type MessageRow = {
  id: string;
  customerId: string;
  direction: "FROM_CUSTOMER" | "FROM_STORE";
  text: string | null;
  sentAt: string;
  deliveryStatus: string | null;
  agentId: string | null;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store", ...init, headers: { "content-type": "application/json", ...init?.headers } });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const getConversations = () => api<ConversationRow[]>("/api/conversations");
export const getMessages = (customerId: string) => api<MessageRow[]>(`/api/conversations/${customerId}/messages`);
export const sendMessage = (customerId: string, text: string) =>
  api<{ messageId?: string }>(`/api/conversations/${customerId}/messages`, { method: "POST", body: JSON.stringify({ text }) });
