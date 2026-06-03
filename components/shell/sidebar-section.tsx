interface SidebarSectionProps {
  label?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}

export function SidebarSection({ label, children, action }: SidebarSectionProps) {
  return (
    <div className="space-y-0.5">
      {label && (
        <div className="flex items-center justify-between px-2 pb-1 pt-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">
            {label}
          </span>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
