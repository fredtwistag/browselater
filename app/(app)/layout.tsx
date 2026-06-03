import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { AppShell } from "@/components/shell/app-shell";
import { KeyboardShortcuts } from "@/components/shell/keyboard-shortcuts";
import { loadSidebarData } from "@/lib/shell/sidebar-data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");
  const { counts, tags } = await loadSidebarData(user.id);

  return (
    <AppShell
      user={{
        email: user.email ?? "",
        avatarUrl: user.user_metadata?.avatar_url ?? null,
      }}
      counts={counts}
      tags={tags}
    >
      <KeyboardShortcuts />
      {children}
    </AppShell>
  );
}
