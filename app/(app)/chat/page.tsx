import { requireUser } from "@/lib/supabase/server";
import { ChatRoom } from "./chat-room";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  await requireUser();
  return (
    <div className="container max-w-3xl py-6">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Chat with your library</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ask anything. Answers cite the saves they pull from.
        </p>
      </div>
      <ChatRoom />
    </div>
  );
}
