import React from "react";

/**
 * @param {{content: string}} props
 */
export default function EditorFooterStats({ content }) {
  const withoutTags = String(content || "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
  const text = withoutTags.replace(/\s+/g, " ").trim();
  const words = text ? text.split(" ").length : 0;
  const chars = text.length;

  return (
    <div className="fixed bottom-3 left-1/2 z-50 -translate-x-1/2 pointer-events-none">
      <div className="pointer-events-auto">
        <div className="glass-soft rounded-full px-3 py-1.5 text-xs inline-flex items-center gap-3">
          <span className="text-muted-foreground">{words} words</span>
          <span className="text-muted-foreground">{chars} characters</span>
        </div>
      </div>
    </div>
  );
}
