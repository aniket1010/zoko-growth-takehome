"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sendMessage } from "@/lib/api";

/**
 * Sends through our backend, never straight to Zoko. The backend refuses any
 * number not in SEND_ALLOWLIST (403), so this box cannot message real customers.
 * The sent message appears in the thread once Zoko's webhook reports it.
 */
export function SendBox({ customerId }: { customerId: string }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const router = useRouter();

  async function onSend() {
    if (!text.trim()) return;
    setSending(true);
    const result = await sendMessage(customerId, text.trim());
    setSending(false);
    if (result.ok) {
      setText("");
      toast.success("Sent. It will appear here when Zoko confirms it.");
      setTimeout(() => router.refresh(), 3000);
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a reply…"
        rows={3}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void onSend();
        }}
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Only allowlisted test numbers can be messaged. Free text works within 24h of the customer&apos;s last message.</p>
        <Button onClick={onSend} disabled={sending || !text.trim()}>
          {sending ? "Sending…" : "Send"}
        </Button>
      </div>
    </div>
  );
}
