"use client";

import { useChat } from "ai/react";
import { Send } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Markdown } from "@/components/detail/markdown";

interface SourceMeta {
  index: number;
  id: string;
  title: string;
  url: string;
}

export function ChatRoom() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, data } = useChat({
    api: "/api/chat",
  });

  // The server sends one { sources } data part per request, before streaming the answer.
  const latestSources: SourceMeta[] =
    (data as Array<{ sources?: SourceMeta[] }> | undefined)
      ?.flatMap((d) => d.sources ?? [])
      .slice(-6) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-4">
        {messages.length === 0 && (
          <div className="rounded-lg border border-dashed bg-card/30 p-8 text-center text-sm text-muted-foreground">
            Try: <em>“What did I save about onboarding flows?”</em>
          </div>
        )}
        {messages.map((m, i) => {
          const isLastAssistant = m.role === "assistant" && i === messages.length - 1;
          return (
            <Card key={m.id} className={m.role === "user" ? "bg-secondary" : ""}>
              <CardContent className="space-y-3 p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {m.role === "user" ? "You" : "BrowseLater"}
                </div>
                <div className="text-sm">
                  <Markdown>{m.content}</Markdown>
                </div>
                {isLastAssistant && latestSources.length > 0 && (
                  <div className="space-y-1 border-t pt-3">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Sources
                    </div>
                    <ul className="space-y-1">
                      {latestSources.map((s) => (
                        <li key={s.id} className="text-sm">
                          <span className="mr-2 text-muted-foreground">[{s.index}]</span>
                          <Link href={`/item/${s.id}`} className="text-primary hover:underline">
                            {s.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <form
        onSubmit={handleSubmit}
        className="sticky bottom-4 flex gap-2 bg-background/80 py-2 backdrop-blur"
      >
        <Input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask your library…"
          disabled={isLoading}
          className="flex-1"
        />
        <Button type="submit" disabled={isLoading || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
