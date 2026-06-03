"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  ChevronLeft,
  Eye,
  EyeOff,
  ExternalLink,
  MoreHorizontal,
  RefreshCw,
  Star,
  Trash2,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  archiveItem,
  unarchiveItem,
  deleteItem,
  rerunAi,
  markRead,
  markUnread,
  starItem,
  unstarItem,
} from "@/app/(app)/item/[id]/actions";

interface ReaderToolbarProps {
  itemId: string;
  isArchived: boolean;
  isStarred: boolean;
  isRead: boolean;
  canonicalUrl: string;
  backHref?: string;
  /** When true, hide the back button on lg+ (list pane is already visible). */
  backMobileOnly?: boolean;
}

export function ReaderToolbar({
  itemId,
  isArchived,
  isStarred,
  isRead,
  canonicalUrl,
  backHref,
  backMobileOnly = false,
}: ReaderToolbarProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<unknown>, after?: () => void) {
    startTransition(async () => {
      await fn();
      router.refresh();
      after?.();
    });
  }

  return (
    <div className="sticky top-0 z-20 flex items-center gap-1 border-b bg-background/85 px-3 py-2 backdrop-blur">
      {backHref && (
        <a
          href={backHref}
          className={cn(
            "-ml-1 mr-1 inline-flex items-center justify-center rounded p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
            backMobileOnly && "lg:hidden",
          )}
          aria-label="Back to list"
        >
          <ChevronLeft className="h-4 w-4" />
        </a>
      )}

      <IconButton
        label={isStarred ? "Unstar" : "Star"}
        onClick={() =>
          run(
            () => (isStarred ? unstarItem(itemId) : starItem(itemId)),
            () => toast({ title: isStarred ? "Unstarred" : "Saved" }),
          )
        }
        disabled={pending}
      >
        <Star className={cn("h-4 w-4", isStarred && "fill-amber-400 text-amber-500")} />
      </IconButton>

      <IconButton
        label={isRead ? "Mark unread" : "Mark read"}
        onClick={() => run(() => (isRead ? markUnread(itemId) : markRead(itemId)))}
        disabled={pending}
      >
        {isRead ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </IconButton>

      <IconButton
        label={isArchived ? "Unarchive" : "Archive"}
        onClick={() =>
          run(
            () => (isArchived ? unarchiveItem(itemId) : archiveItem(itemId)),
            () => toast({ title: isArchived ? "Unarchived" : "Archived" }),
          )
        }
        disabled={pending}
      >
        {isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
      </IconButton>

      <span className="mx-1 h-4 w-px bg-border" aria-hidden />

      <IconButton label="Open source" asLink href={canonicalUrl}>
        <ExternalLink className="h-4 w-4" />
      </IconButton>

      <IconButton
        label="Re-run AI"
        onClick={() =>
          run(
            () => rerunAi(itemId),
            () => toast({ title: "Re-running AI…" }),
          )
        }
        disabled={pending}
      >
        <RefreshCw className={cn("h-4 w-4", pending && "animate-spin")} />
      </IconButton>

      <div className="ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="More actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => {
                if (!confirm("Delete this item? It will go to trash for 30 days.")) return;
                startTransition(async () => {
                  await deleteItem(itemId);
                  router.push("/feed");
                });
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function IconButton({
  label,
  children,
  onClick,
  disabled,
  asLink,
  href,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  asLink?: boolean;
  href?: string;
}) {
  const cls =
    "inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50";

  if (asLink && href) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={cls}
            aria-label={label}
          >
            {children}
          </a>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={cls}
          aria-label={label}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
