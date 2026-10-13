import { Fragment, type ReactNode } from "react";
import Image from "next/image";
import { isSafeUrl, type RichTextMark, type RichTextNode } from "@/lib/rich-text";
import { richTextClasses } from "@/lib/rich-text-styles";
import { cn } from "@/lib/utils";

// Turns a stored editor document into React elements. Built from known node
// types only: unknown nodes are skipped, nothing is injected as raw HTML, and
// link and image URLs are checked again here.

function applyMark(mark: RichTextMark, children: ReactNode, key: string): ReactNode {
  switch (mark.type) {
    case "bold":
      return <strong key={key}>{children}</strong>;
    case "italic":
      return <em key={key}>{children}</em>;
    case "underline":
      return <u key={key}>{children}</u>;
    case "strike":
      return <s key={key}>{children}</s>;
    case "code":
      return <code key={key}>{children}</code>;
    case "link": {
      const href = mark.attrs?.href;
      if (!isSafeUrl(href)) return children;
      const external = /^https?:/i.test(href);
      return (
        <a key={key} href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
          {children}
        </a>
      );
    }
    default:
      return children;
  }
}

function Children({ nodes }: { nodes?: RichTextNode[] }) {
  return <>{(nodes ?? []).map((node, i) => renderNode(node, String(i)))}</>;
}

function renderImage(node: RichTextNode, key: string) {
  const { src, alt, width, height } = (node.attrs ?? {}) as {
    src?: unknown;
    alt?: unknown;
    width?: unknown;
    height?: unknown;
  };
  if (!isSafeUrl(src) || /^(mailto|tel):/i.test(src)) return null;
  const altText = typeof alt === "string" ? alt : "";
  if (typeof width === "number" && typeof height === "number") {
    let optimised = src.startsWith("/");
    if (!optimised) {
      try {
        const host = new URL(src).hostname;
        optimised = host === "images.unsplash.com";
      } catch {
        optimised = false;
      }
    }
    // Other hosts (the media library among them, already behind a CDN) are passed through as they are.
    return <Image key={key} src={src} alt={altText} width={width} height={height} sizes="(min-width: 1024px) 800px, 100vw" unoptimized={!optimised} />;
  }
  // eslint-disable-next-line @next/next/no-img-element -- size unknown, so next/image cannot be used
  return <img key={key} src={src} alt={altText} loading="lazy" />;
}

function renderNode(node: RichTextNode, key: string): ReactNode {
  switch (node.type) {
    case "text": {
      let out: ReactNode = node.text ?? "";
      (node.marks ?? []).forEach((mark, i) => {
        out = applyMark(mark, out, `${key}-m${i}`);
      });
      return <Fragment key={key}>{out}</Fragment>;
    }
    case "paragraph":
      return <p key={key}><Children nodes={node.content} /></p>;
    case "heading": {
      const level = Number(node.attrs?.level);
      const Tag = level === 3 ? "h3" : level === 4 ? "h4" : "h2";
      return <Tag key={key}><Children nodes={node.content} /></Tag>;
    }
    case "bulletList":
      return <ul key={key}><Children nodes={node.content} /></ul>;
    case "orderedList": {
      const start = Number(node.attrs?.start);
      return <ol key={key} start={Number.isInteger(start) && start > 1 ? start : undefined}><Children nodes={node.content} /></ol>;
    }
    case "listItem":
      return <li key={key}><Children nodes={node.content} /></li>;
    case "blockquote":
      return <blockquote key={key}><Children nodes={node.content} /></blockquote>;
    case "codeBlock":
      return <pre key={key}><code><Children nodes={node.content} /></code></pre>;
    case "horizontalRule":
      return <hr key={key} />;
    case "hardBreak":
      return <br key={key} />;
    case "image":
      return renderImage(node, key);
    default:
      return null;
  }
}

export function RichText({ doc, className }: { doc: unknown; className?: string }) {
  if (!doc || typeof doc !== "object" || (doc as RichTextNode).type !== "doc") return null;
  return (
    <div className={cn(richTextClasses, className)}>
      <Children nodes={(doc as RichTextNode).content} />
    </div>
  );
}
