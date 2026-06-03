import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { ReaderPane } from "@/components/detail/reader-pane";
import { loadItemBundle } from "@/lib/detail/load-item";

export const dynamic = "force-dynamic";

interface DetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function DetailPage({ params }: DetailPageProps) {
  const { id } = await params;
  const user = await requireUser();
  const bundle = await loadItemBundle(id, user.id);
  if (!bundle) notFound();

  return (
    <div className="h-full">
      <ReaderPane bundle={bundle} backHref="/feed" />
    </div>
  );
}
