"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useState } from "react";
import { startViewTransition, itemViewTransitionName } from "@/lib/view-transitions";

interface FeedCardLinkProps {
  itemId: string;
  href: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Wraps a feed card in a Link that uses the browser View Transitions API
 * to morph the hero image + title into the detail header. Falls back to
 * a normal navigation if the API isn't available or prefers-reduced-motion is set.
 */
export function FeedCardLink({ itemId, href, className, children }: FeedCardLinkProps) {
  const router = useRouter();
  const [transitioning, setTransitioning] = useState(false);

  const handle = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      // Honor modifier-clicks (open in new tab, etc.) and middle clicks.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      setTransitioning(true);
      startViewTransition(() => {
        router.push(href);
      });
    },
    [router, href],
  );

  return (
    <Link
      href={href}
      onClick={handle}
      className={className}
      data-feed-card={itemId}
      data-vt-image={itemViewTransitionName(itemId, "image")}
      data-vt-title={itemViewTransitionName(itemId, "title")}
      data-transitioning={transitioning || undefined}
    >
      {children}
    </Link>
  );
}
