"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { updateProfileAction } from "./actions";

export function ProfileEditor({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const dirty = value !== initial;

  function save() {
    startTransition(async () => {
      try {
        const result = await updateProfileAction(value);
        toast({
          title: "Profile saved",
          description: `Version ${result.version} — all future saves will use this.`,
        });
      } catch (err) {
        toast({
          title: "Save failed",
          description: err instanceof Error ? err.message : "Try again.",
          variant: "destructive",
        });
      }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div>
          <h2 className="text-lg font-medium">Personalization profile</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Markdown. Five sections: Personal · Family · Wealth · Health · Twistag. Edit freely —
            old versions are kept so past insights remain reproducible.
          </p>
        </div>
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="min-h-[480px] font-mono text-xs leading-relaxed"
          spellCheck={false}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" disabled={!dirty || pending} onClick={() => setValue(initial)}>
            Reset
          </Button>
          <Button onClick={save} disabled={!dirty || pending}>
            {pending ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
