"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Archive,
  Compass,
  FileText,
  Inbox,
  Keyboard,
  Link as LinkIcon,
  MessageSquare,
  Moon,
  Plus,
  Search,
  Settings,
  Star,
  Sun,
} from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { SIDEBAR_CONTEXTS } from "@/lib/shell/contexts";
import { getRecentItems, type PaletteItem } from "@/lib/shell/palette-actions";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShowShortcuts: () => void;
}

export function CommandPalette({ open, onOpenChange, onShowShortcuts }: CommandPaletteProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [recents, setRecents] = useState<PaletteItem[]>([]);
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    getRecentItems()
      .then(setRecents)
      .catch(() => setRecents([]));
  }, [open]);

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  function saveUrl(url: string) {
    const trimmed = url.trim();
    if (!trimmed) return;
    startTransition(async () => {
      try {
        const res = await fetch("/api/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: trimmed }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as { id: string; duplicate?: boolean };
        toast({
          title: data.duplicate ? "Already saved" : "Saved",
          description: data.duplicate ? "Surfacing the existing item." : "Extracting…",
        });
        onOpenChange(false);
        setSearch("");
        router.refresh();
      } catch (err) {
        toast({
          title: "Save failed",
          description: err instanceof Error ? err.message : "Try again.",
          variant: "destructive",
        });
      }
    });
  }

  const looksLikeUrl = /^https?:\/\//i.test(search.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-xl">
        <Command shouldFilter>
          <CommandInput
            placeholder="Search, jump to, or paste a URL…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No matches. Press ? for keyboard shortcuts.</CommandEmpty>

            {looksLikeUrl && (
              <CommandGroup heading="Save">
                <CommandItem
                  value={`save-url-${search}`}
                  onSelect={() => saveUrl(search)}
                  disabled={pending}
                >
                  <Plus className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">Save {search}</span>
                </CommandItem>
              </CommandGroup>
            )}

            <CommandGroup heading="Search">
              <CommandItem
                value="search-content"
                onSelect={() => go(`/search${search ? `?q=${encodeURIComponent(search)}` : ""}`)}
              >
                <Search className="h-4 w-4 text-muted-foreground" />
                <span>{search ? `Search “${search}”` : "Search library"}</span>
                <CommandShortcut>/</CommandShortcut>
              </CommandItem>
            </CommandGroup>

            <CommandGroup heading="Switch view">
              <CommandItem value="view-inbox" onSelect={() => go("/feed")}>
                <Inbox className="h-4 w-4 text-muted-foreground" />
                <span>Inbox</span>
                <CommandShortcut>g i</CommandShortcut>
              </CommandItem>
              <CommandItem value="view-saved" onSelect={() => go("/feed?view=saved")}>
                <Star className="h-4 w-4 text-muted-foreground" />
                <span>Saved</span>
                <CommandShortcut>g s</CommandShortcut>
              </CommandItem>
              <CommandItem value="view-archived" onSelect={() => go("/feed?view=archived")}>
                <Archive className="h-4 w-4 text-muted-foreground" />
                <span>Archived</span>
                <CommandShortcut>g a</CommandShortcut>
              </CommandItem>
              {SIDEBAR_CONTEXTS.map((ctx) => (
                <CommandItem
                  key={ctx.key}
                  value={`context-${ctx.key}`}
                  onSelect={() => go(`/feed?context=${ctx.key}`)}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: `hsl(${ctx.tint})` }}
                    aria-hidden
                  />
                  <span>{ctx.label}</span>
                  <CommandShortcut>g {ctx.key.charAt(0)}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>

            {recents.length > 0 && (
              <CommandGroup heading="Jump to recent">
                {recents.map((it) => (
                  <CommandItem
                    key={it.id}
                    value={`recent-${it.title ?? it.canonical_url} ${it.id}`}
                    onSelect={() => go(`/feed?selected=${it.id}`)}
                  >
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{it.title ?? it.canonical_url}</span>
                    <span className="ml-2 truncate text-xs text-muted-foreground">
                      {it.source_domain ?? ""}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            <CommandSeparator />

            <CommandGroup heading="App">
              <CommandItem value="open-chat" onSelect={() => go("/chat")}>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span>Open chat</span>
                <CommandShortcut>g c</CommandShortcut>
              </CommandItem>
              <CommandItem value="open-settings" onSelect={() => go("/settings/profile")}>
                <Settings className="h-4 w-4 text-muted-foreground" />
                <span>Open settings</span>
              </CommandItem>
              <CommandItem
                value="toggle-theme"
                onSelect={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Moon className="h-4 w-4 text-muted-foreground" />
                )}
                <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
              </CommandItem>
              <CommandItem
                value="show-shortcuts"
                onSelect={() => {
                  onOpenChange(false);
                  onShowShortcuts();
                }}
              >
                <Keyboard className="h-4 w-4 text-muted-foreground" />
                <span>Keyboard shortcuts</span>
                <CommandShortcut>?</CommandShortcut>
              </CommandItem>
              <CommandItem
                value="copy-url"
                onSelect={() => {
                  navigator.clipboard.writeText(window.location.href).then(() => {
                    toast({ title: "URL copied" });
                    onOpenChange(false);
                  });
                }}
              >
                <LinkIcon className="h-4 w-4 text-muted-foreground" />
                <span>Copy current URL</span>
              </CommandItem>
              <CommandItem value="root" onSelect={() => go("/")}>
                <Compass className="h-4 w-4 text-muted-foreground" />
                <span>Home</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
