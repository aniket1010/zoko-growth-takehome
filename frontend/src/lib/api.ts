export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type Overview = {
  total_messages: number;
  customer_messages: number;
  agent_messages: number;
  bot_messages: number;
  customers_with_messages: number;
  conversations: number;
  closed: number;
  awaiting_first_reply: number;
  closed_without_reply: number;
  reassigned: number;
  avg_frt_seconds: number | null;
  median_frt_seconds: number | null;
  avg_resolution_seconds: number | null;
  median_resolution_seconds: number | null;
  csat_asked: number;
  csat_received: number;
  csat_avg: number | null;
  messages_per_customer: { id: string; name: string | null; phone: string | null; messages: number; from_customer: number }[];
};

export type AgentRow = {
  id: string;
  name: string;
  email: string | null;
  messages_sent: number;
  replied_conversations: number;
  avg_frt_seconds: number | null;
  median_frt_seconds: number | null;
  closed_conversations: number;
  avg_resolution_seconds: number | null;
  median_resolution_seconds: number | null;
  reassigned_chats: number;
  csat_received: number;
  csat_avg: number | null;
};

export type AttentionRow = {
  customer_id: string;
  customer_name: string | null;
  phone: string | null;
  started_at: string;
  waiting_seconds: number;
  message_count: number;
  assignee_name: string | null;
};

export type ConversationRow = {
  id: string;
  name: string | null;
  phone: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  message_count: number;
  inbound_count: number;
  last_message_at: string;
  last_message: string | null;
  is_closed: boolean;
};

export type CustomerDetail = { id: string; name: string | null; phone: string | null; assignee_name: string | null };

export type MessageRow = {
  id: string;
  customerId: string;
  direction: "FROM_CUSTOMER" | "FROM_STORE";
  type: string | null;
  text: string | null;
  sentAt: string;
  deliveryStatus: string | null;
  agentId: string | null;
  senderType: "customer" | "agent" | "bot" | null;
  agentEmail: string | null;
  templateName: string | null;
  replyToTemplate: string | null;
  postback: string | null;
};

export type ChatEventRow = { kind: "assigned" | "closed"; event_at: string; closed_by_type: string | null; agent_name: string | null };

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const api = {
  overview: () => get<Overview>("/api/metrics/overview"),
  agents: () => get<AgentRow[]>("/api/metrics/agents"),
  attention: () => get<AttentionRow[]>("/api/metrics/attention"),
  conversations: () => get<ConversationRow[]>("/api/conversations"),
  customer: (id: string) => get<CustomerDetail>(`/api/conversations/${id}`),
  messages: (id: string) => get<MessageRow[]>(`/api/conversations/${id}/messages`),
  events: (id: string) => get<ChatEventRow[]>(`/api/conversations/${id}/events`),
};

/** Called from the browser. The backend enforces the send allowlist and answers 403 otherwise. */
export async function sendMessage(customerId: string, text: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(`${API_BASE}/api/conversations/${customerId}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (res.ok) return { ok: true };
  const body = await res.json().catch(() => ({}));
  return { ok: false, error: body.error ?? `Request failed (${res.status})` };
}
