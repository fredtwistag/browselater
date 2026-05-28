import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/privacy", label: "Privacy" },
  { href: "/settings/errors", label: "Errors" },
];

export function SettingsNav({ active }: { active: "profile" | "privacy" | "errors" }) {
  return (
    <nav className="mb-6 flex flex-wrap gap-2 text-sm" aria-label="Settings">
      {TABS.map((t) => {
        const isActive = t.href.endsWith(active);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "rounded-md px-3 py-1.5 transition-colors",
              isActive
                ? "bg-secondary font-medium text-secondary-foreground"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
