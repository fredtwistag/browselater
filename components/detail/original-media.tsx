"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { youtubeVideoId } from "@/lib/extract/url";
import type { ContentType } from "@/lib/db/types";

interface Item {
  type: ContentType;
  canonical_url: string;
  hero_image_url: string | null;
  title: string | null;
}
interface Content {
  raw_text: string | null;
  transcript_json: unknown | null;
}

export function OriginalMedia({ item, content }: { item: Item; content: Content | null }) {
  return (
    <section className="space-y-4">
      {item.type === "youtube" && (
        <YouTubeBlock item={item} transcript={content?.transcript_json} />
      )}
      {item.type === "image" && item.hero_image_url && (
        <a
          href={item.canonical_url}
          target="_blank"
          rel="noopener noreferrer"
          className="block overflow-hidden rounded-lg border"
        >
          <div className="relative aspect-auto w-full">
            <Image
              src={item.hero_image_url}
              alt={item.title ?? ""}
              width={1200}
              height={800}
              className="h-auto w-full object-contain"
            />
          </div>
        </a>
      )}
      <FullContent rawText={content?.raw_text ?? null} />
    </section>
  );
}

function YouTubeBlock({ item, transcript }: { item: Item; transcript: unknown }) {
  const id = youtubeVideoId(item.canonical_url);
  if (!id) return null;
  return (
    <div className="space-y-3">
      <div className="aspect-video w-full overflow-hidden rounded-lg border bg-black">
        <iframe
          src={`https://www.youtube.com/embed/${id}`}
          title={item.title ?? "YouTube video"}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
      {Array.isArray(transcript) && transcript.length > 0 && (
        <TranscriptList lines={transcript as { start: number; text: string }[]} videoId={id} />
      )}
    </div>
  );
}

function TranscriptList({
  lines,
  videoId,
}: {
  lines: { start: number; text: string }[];
  videoId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer rounded-md border bg-card px-4 py-2 text-sm font-medium hover:bg-accent">
        Transcript ({lines.length} lines)
      </summary>
      <ul className="mt-2 max-h-[480px] space-y-1 overflow-y-auto rounded-md border bg-card p-3 text-sm">
        {lines.map((line, i) => (
          <li key={i} className="flex gap-3 leading-relaxed">
            <a
              href={`https://www.youtube.com/watch?v=${videoId}&t=${Math.round(line.start)}s`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 font-mono text-xs text-muted-foreground hover:text-primary"
            >
              {formatTs(line.start)}
            </a>
            <span>{line.text}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function formatTs(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function FullContent({ rawText }: { rawText: string | null }) {
  const [expanded, setExpanded] = useState(false);
  if (!rawText) return null;
  return (
    <div className="space-y-3">
      <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
        <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
        {expanded ? "Hide" : "Show"} full extracted content
      </Button>
      {expanded && (
        <pre className="max-h-[640px] overflow-y-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-4 font-sans text-sm leading-relaxed">
          {rawText}
        </pre>
      )}
    </div>
  );
}
