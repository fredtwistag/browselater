import { requireUser } from "@/lib/supabase/server";
import { getLatestProfile } from "@/lib/ai/profile";
import { SettingsNav } from "@/components/settings/settings-nav";
import { ProfileEditor } from "./profile-editor";
import { BookmarkletPanel } from "./bookmarklet-panel";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser();
  const profileMd = await getLatestProfile(user.id);

  return (
    <div className="container max-w-3xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your personalization profile is sent to Claude with every save. It powers the personalized
          insight cards on each detail page.
        </p>
      </div>

      <SettingsNav active="profile" />

      <section className="space-y-6">
        <ProfileEditor initial={profileMd} />
        <BookmarkletPanel userId={user.id} />
      </section>
    </div>
  );
}
