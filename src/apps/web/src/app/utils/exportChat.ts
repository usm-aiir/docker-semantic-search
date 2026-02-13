import type { ChatResponse } from "../api";

export interface ChatExportData {
  collection: string;
  query: string;
  exportedAt: string;
  messages: Array<{
    role: "user" | "assistant";
    content: string;
    sources?: Array<{ title: string; doc_id: string }>;
    timestamp?: string;
  }>;
}

export function exportChatAsJSON(
  collection: string,
  query: string,
  history: Array<{ question: string; response: ChatResponse }>
): void {
  const data: ChatExportData = {
    collection,
    query,
    exportedAt: new Date().toISOString(),
    messages: history.flatMap((item) => [
      {
        role: "user" as const,
        content: item.question,
      },
      {
        role: "assistant" as const,
        content: item.response.answer,
        sources: item.response.sources.map((s) => ({
          title: s.title,
          doc_id: s.doc_id,
        })),
      },
    ]),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  downloadBlob(blob, `chat-${sanitizeFilename(collection)}-${Date.now()}.json`);
}

export function exportChatAsMarkdown(
  collection: string,
  query: string,
  history: Array<{ question: string; response: ChatResponse }>
): void {
  const lines: string[] = [
    `# Chat Export: ${collection}`,
    "",
    `**Initial Query:** ${query}`,
    `**Exported:** ${new Date().toLocaleString()}`,
    "",
    "---",
    "",
  ];

  history.forEach((item, i) => {
    lines.push(`## Question ${i + 1}`);
    lines.push("");
    lines.push(`> ${item.question}`);
    lines.push("");
    lines.push("### Answer");
    lines.push("");
    lines.push(item.response.answer);
    lines.push("");

    if (item.response.sources.length > 0) {
      lines.push("### Sources");
      lines.push("");
      item.response.sources.forEach((src) => {
        lines.push(`- **${src.title || src.doc_id}**`);
        if (src.snippet) {
          lines.push(`  > ${src.snippet.slice(0, 150)}...`);
        }
      });
      lines.push("");
    }

    lines.push("---");
    lines.push("");
  });

  const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
  downloadBlob(blob, `chat-${sanitizeFilename(collection)}-${Date.now()}.md`);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9-_]/gi, "_").slice(0, 50);
}
