"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, Send } from "lucide-react";
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
  const inFlight = useRef(false);
  const router = useRouter();

  async function onSend() {
    if (!text.trim() || inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    try {
      const result = await sendMessage(customerId, text.trim());
      if (result.ok) {
        setText("");
        toast.success("Sent. It will appear here when Zoko confirms it.");
        setTimeout(() => router.refresh(), 3000);
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Could not send your reply. Check your connection and try again.");
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }

  return (
    <div className="space-y-3">
        <label htmlFor="reply" className="block text-[13px] font-medium">
          Reply
        </label>
        <Textarea
          id="reply"
          value={text}
          disabled={sending}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a reply…"
          rows={3}
          className="max-h-48 min-h-24 resize-y bg-background/50 p-3 text-sm md:text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void onSend();
            }
          }}
        />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Ctrl / ⌘ + Enter to send</p>
        <Button onClick={onSend} disabled={sending || !text.trim()} className="h-11 gap-2 px-4">
          <Send aria-hidden />
          {sending ? "Sending…" : "Send reply"}
        </Button>
      </div>
      <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
        <LockKeyhole className="mt-px size-3 shrink-0" aria-hidden />
        <span>
          Replies are enabled for test numbers only, within 24 hours of their last message.
        </span>
      </p>
    </div>
  );
}
