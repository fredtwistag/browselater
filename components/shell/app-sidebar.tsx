import Link from "next/link";
import { Archive, Inbox, MessageSquare, Search, Star } from "lucide-react";
import { SidebarSection } from "./sidebar-section";
import { SidebarRow } from "./sidebar-row";
import { SidebarTags } from "./sidebar-tags";
import { SidebarUser } from "./sidebar-user";
import { SaveInputCompact } from "./save-input-compact";
import { SIDEBAR_CONTEXTS } from "@/lib/shell/contexts";
import type { SidebarCounts, SidebarTag } from "@/lib/shell/sidebar-data";

interface AppSidebarProps {
  user: { email: string; avatarUrl: string | null };
  counts: SidebarCounts;
  tags: SidebarTag[];
}

export function AppSidebar({ user, counts, tags }: AppSidebarProps) {
  return (
    <div className="flex h-full w-full flex-col gap-3 overflow-y-auto p-3">
      <Link href="/feed" className="px-2 py-1 text-sm font-semibold tracking-tight">
        BrowseLater
      </Link>

      <SaveInputCompact />

      <nav className="flex-1 space-y-3" aria-label="Library">
        <SidebarSection>
          <SidebarRow
            href="/feed"
            label="Inbox"
            icon={<Inbox className="h-3.5 w-3.5" />}
            count={counts.inboxUnread}
          />
          <SidebarRow
            href="/feed?view=saved"
            label="Saved"
            icon={<Star className="h-3.5 w-3.5" />}
            count={counts.saved}
            match={{ pathname: "/feed", search: { view: "saved" } }}
          />
          <SidebarRow
            href="/feed?view=archived"
            label="Archived"
            icon={<Archive className="h-3.5 w-3.5" />}
            count={counts.archived}
            match={{ pathname: "/feed", search: { view: "archived" } }}
          />
        </SidebarSection>

        <SidebarSection label="Contexts">
          {SIDEBAR_CONTEXTS.map((ctx) => (
            <SidebarRow
              key={ctx.key}
              href={`/feed?context=${ctx.key}`}
              label={ctx.label}
              dot={`var(--context-${ctx.key})`}
              match={{ pathname: "/feed", search: { context: ctx.key } }}
            />
          ))}
        </SidebarSection>

        <SidebarTags tags={tags} />

        <SidebarSection>
          <SidebarRow href="/search" label="Search" icon={<Search className="h-3.5 w-3.5" />} />
          <SidebarRow href="/chat" label="Chat" icon={<MessageSquare className="h-3.5 w-3.5" />} />
        </SidebarSection>
      </nav>

      <div className="border-t pt-2">
        <SidebarUser user={user} />
      </div>
    </div>
  );
}
