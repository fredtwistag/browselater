import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeShiki from "@shikijs/rehype";
import { cn } from "@/lib/utils";

interface MarkdownProps {
  children: string;
  className?: string;
}

// Allow Shiki's color/background-color inline styles to survive sanitization.
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    "*": [...(defaultSchema.attributes?.["*"] ?? []), "className", "style"],
    code: [...(defaultSchema.attributes?.code ?? []), "className", "style"],
    pre: [...(defaultSchema.attributes?.pre ?? []), "className", "style", "tabIndex"],
    span: [...(defaultSchema.attributes?.span ?? []), "className", "style"],
  },
};

export function Markdown({ children, className }: MarkdownProps) {
  return (
    <div className={cn("prose-markdown", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          [
            rehypeShiki,
            {
              themes: { light: "github-light", dark: "github-dark" },
              defaultColor: false,
            },
          ],
          [rehypeSanitize, sanitizeSchema],
        ]}
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
          // Shiki injects highlighted span trees inside <pre><code>; we preserve its
          // className/style and only style inline (no className) code spans ourselves.
          code: ({ children, className, ...rest }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.95em]" {...rest}>
                  {children}
                </code>
              );
            }
            return (
              <code className={className} {...rest}>
                {children}
              </code>
            );
          },
          pre: ({ children, className, style, ...rest }) => (
            <pre
              className={cn(
                "my-6 overflow-x-auto rounded-lg border p-4 text-sm",
                // When Shiki sets its own className (.shiki), keep its background.
                className,
                !className?.includes("shiki") && "bg-muted/30",
              )}
              style={style}
              tabIndex={0}
              {...rest}
            >
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
