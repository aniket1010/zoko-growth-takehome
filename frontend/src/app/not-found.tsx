import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { Page } from "@/components/panel";
import { EmptyState } from "@/components/states";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <Page>
      <EmptyState icon={<MessagesSquare className="size-5" />} title="We could not find that conversation" className="bg-card py-12">
        It may belong to a customer who has not messaged since the webhook went live, or the backend is waking up.
      </EmptyState>
      <div className="flex justify-center">
        <Link href="/conversations" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Back to conversations
        </Link>
      </div>
    </Page>
  );
}
