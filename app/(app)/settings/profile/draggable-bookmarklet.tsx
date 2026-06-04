"use client";

/**
 * The bookmarklet link is meant to be dragged to the bookmarks bar.
 * We preventDefault on click so users don't accidentally fire the JS
 * against /settings/profile itself. The href stays a real `javascript:`
 * URL so drag-to-bookmark works.
 */
export function DraggableBookmarklet({ href }: { href: string }) {
  return (
    <a
      href={href}
      onClick={(e) => e.preventDefault()}
      draggable
      className="font-medium text-primary"
    >
      Save to BrowseLater
    </a>
  );
}
