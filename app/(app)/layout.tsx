import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { TopNav } from "@/components/shell/top-nav";
import { KeyboardShortcuts } from "@/components/shell/keyboard-shortcuts";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <TopNav
        user={{ email: user.email ?? "", avatarUrl: user.user_metadata?.avatar_url ?? null }}
      />
      <KeyboardShortcuts />
      <main className="flex-1">{children}</main>
    </div>
  );
}
