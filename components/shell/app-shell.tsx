import { AppSidebar } from "./app-sidebar";
import { MobileTopBar } from "./mobile-top-bar";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { SidebarCounts, SidebarTag } from "@/lib/shell/sidebar-data";

interface AppShellProps {
  user: { email: string; avatarUrl: string | null };
  counts: SidebarCounts;
  tags: SidebarTag[];
  children: React.ReactNode;
}

export function AppShell({ user, counts, tags, children }: AppShellProps) {
  return (
    <TooltipProvider delayDuration={250}>
      <div className="flex h-screen min-h-0 w-full overflow-hidden bg-background">
        <aside className="hidden h-full w-[260px] flex-shrink-0 border-r md:flex">
          <AppSidebar user={user} counts={counts} tags={tags} />
        </aside>
        <main className="flex h-full min-w-0 flex-1 flex-col">
          <MobileTopBar user={user} counts={counts} tags={tags} />
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </main>
      </div>
    </TooltipProvider>
  );
}
