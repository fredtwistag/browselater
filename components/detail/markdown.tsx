import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { cn } from "@/lib/utils";

interface MarkdownProps {
  children: string;
  className?: string;
}

export function Markdown({ children, className }: MarkdownProps) {
  return (
    <div className={cn("prose-markdown", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          h2: ({ children }) => (
            <h2 className="mt-8 font-serif text-2xl font-semibold tracking-tight">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-6 font-serif text-xl font-semibold tracking-tight">{children}</h3>
          ),
          p: ({ children }) => <p className="my-4 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="my-4 list-disc pl-6">{children}</ul>,
          ol: ({ children }) => <ol className="my-4 list-decimal pl-6">{children}</ol>,
          li: ({ children }) => <li className="my-1.5 leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-6 border-l-4 border-primary/40 bg-muted/30 py-1 pl-5 font-serif italic text-muted-foreground">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-6 overflow-x-auto rounded-md border">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
          th: ({ children }) => (
            <th className="border-b px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="border-b px-4 py-2 align-top">{children}</td>,
          tr: ({ children }) => <tr className="even:bg-muted/20">{children}</tr>,
          code: ({ children, className }) =>
            className ? (
              <code className={cn("rounded bg-muted px-1.5 py-0.5 font-mono text-sm", className)}>
                {children}
              </code>
            ) : (
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.95em]">
                {children}
              </code>
            ),
          pre: ({ children }) => (
            <pre className="my-6 overflow-x-auto rounded-lg border bg-muted/30 p-4 text-sm">
              {children}
            </pre>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline-offset-4 hover:underline"
            >
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
