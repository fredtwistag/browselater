import { createServiceClient } from "@/lib/supabase/service";

export const DEFAULT_PROFILE_MD = `# About me
(replace with one paragraph — role, age, what you're optimizing for in life right now)

# Family snapshot
(replace — partner, kids' ages, household rhythms, anything that helps insights land)

# Wealth context
(replace — risk appetite, current focus, life-stage financial goals)

# Health context
(replace — current routine, what you're working on, constraints)

# Twistag context
- **Ops**: (replace)
- **Sales**: (replace)
- **DevEx**: (replace)
- **Innovation**: (replace)
- **Marketing**: (replace)
`;

export async function getLatestProfile(userId: string): Promise<string> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("user_profile")
    .select("profile_md, version")
    .eq("user_id", userId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.profile_md ?? DEFAULT_PROFILE_MD;
}

export async function saveProfile(userId: string, profileMd: string): Promise<number> {
  const supabase = createServiceClient();
  const { data: latest } = await supabase
    .from("user_profile")
    .select("version")
    .eq("user_id", userId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = (latest?.version ?? 0) + 1;
  await supabase.from("user_profile").insert({
    user_id: userId,
    version: nextVersion,
    profile_md: profileMd,
  });
  return nextVersion;
}
