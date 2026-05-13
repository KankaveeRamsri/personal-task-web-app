"use client";

function renderInline(text: string): React.ReactNode[] {
  const pattern = /\*\*([^*\n]+?)\*\*|`([^`\n]+?)`/g;
  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyCounter = 0;
  pattern.lastIndex = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }
    if (match[1] !== undefined) {
      result.push(
        <strong key={keyCounter++} className="font-semibold text-zinc-900 dark:text-zinc-100">
          {match[1]}
        </strong>,
      );
    } else if (match[2] !== undefined) {
      result.push(
        <code
          key={keyCounter++}
          className="rounded bg-zinc-100 dark:bg-zinc-700/60 px-1 py-0.5 text-[0.82em] font-mono text-zinc-700 dark:text-zinc-200"
        >
          {match[2]}
        </code>,
      );
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }
  return result.length > 0 ? result : [text];
}

type MdBlock =
  | { t: "h1" | "h2" | "h3"; text: string }
  | { t: "p"; lines: string[] }
  | { t: "ul"; items: string[] }
  | { t: "code"; lang: string; lines: string[] }
  | { t: "table"; headers: string[]; rows: string[][] };

function parseMarkdown(raw: string): MdBlock[] {
  const lines = raw.split("\n");
  const blocks: MdBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      blocks.push({ t: "code", lang, lines: codeLines });
      continue;
    }

    if (line.startsWith("### ")) { blocks.push({ t: "h3", text: line.slice(4) }); i++; continue; }
    if (line.startsWith("## ")) { blocks.push({ t: "h2", text: line.slice(3) }); i++; continue; }
    if (line.startsWith("# ")) { blocks.push({ t: "h1", text: line.slice(2) }); i++; continue; }

    if (/^[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push({ t: "ul", items });
      continue;
    }

    if (line.trim().startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      const headers = tableLines[0].split("|").map((s) => s.trim()).filter(Boolean);
      const dataStart =
        tableLines.length > 1 && /^[\s|:-]+$/.test(tableLines[1]) ? 2 : 1;
      const rows = tableLines.slice(dataStart).map((l) =>
        l.split("|").map((s) => s.trim()).filter(Boolean),
      );
      if (headers.length > 0) blocks.push({ t: "table", headers, rows });
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith("#") &&
      !/^[-*]\s/.test(lines[i]) &&
      !lines[i].startsWith("```") &&
      !lines[i].trim().startsWith("|")
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) blocks.push({ t: "p", lines: paraLines });
  }

  return blocks;
}

export function MarkdownRenderer({ content }: { content: string }) {
  if (!content) return null;
  const blocks = parseMarkdown(content);

  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {blocks.map((block, idx) => {
        if (block.t === "h1") {
          return (
            <h1 key={idx} className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-2 first:mt-0">
              {renderInline(block.text)}
            </h1>
          );
        }
        if (block.t === "h2") {
          return (
            <h2 key={idx} className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mt-1.5 first:mt-0">
              {renderInline(block.text)}
            </h2>
          );
        }
        if (block.t === "h3") {
          return (
            <h3 key={idx} className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mt-1 first:mt-0">
              {renderInline(block.text)}
            </h3>
          );
        }
        if (block.t === "code") {
          return (
            <pre
              key={idx}
              className="overflow-x-auto rounded-lg bg-zinc-100 dark:bg-zinc-800 px-3 py-2 text-[11px] font-mono text-zinc-700 dark:text-zinc-300"
            >
              <code>{block.lines.join("\n")}</code>
            </pre>
          );
        }
        if (block.t === "ul") {
          return (
            <ul key={idx} className="space-y-0.5">
              {block.items.map((item, j) => (
                <li key={j} className="flex items-baseline gap-1.5">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-zinc-400 dark:bg-zinc-500" />
                  <span className="flex-1">{renderInline(item)}</span>
                </li>
              ))}
            </ul>
          );
        }
        if (block.t === "table") {
          return (
            <div key={idx} className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700/40">
              <table className="w-full border-collapse text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-800/60">
                  <tr>
                    {block.headers.map((h, j) => (
                      <th
                        key={j}
                        className="border-b border-zinc-200 dark:border-zinc-700/40 px-3 py-1.5 text-left font-medium text-zinc-600 dark:text-zinc-400"
                      >
                        {renderInline(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, j) => (
                    <tr key={j} className="border-b border-zinc-100 dark:border-zinc-800/40 last:border-0">
                      {row.map((cell, k) => (
                        <td key={k} className="px-3 py-1.5 text-zinc-700 dark:text-zinc-300">
                          {renderInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (block.t === "p") {
          return (
            <p key={idx} className="text-zinc-700 dark:text-zinc-300">
              {block.lines.map((l, j) => (
                <span key={j}>
                  {renderInline(l)}
                  {j < block.lines.length - 1 && <br />}
                </span>
              ))}
            </p>
          );
        }
        return null;
      })}
    </div>
  );
}
