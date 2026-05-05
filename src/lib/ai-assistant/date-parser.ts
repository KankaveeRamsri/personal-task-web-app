export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseAssistantDueDate(input: string | null | undefined): string | null {
  if (!input) return null;

  const text = input.trim().toLowerCase();

  if (text === "วันนี้" || text === "today") {
    const d = new Date();
    return formatLocalDate(d);
  }

  if (text === "พรุ่งนี้" || text === "tomorrow") {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return formatLocalDate(d);
  }

  if (text === "มะรืน" || text === "มะรืนนี้" || text === "day after tomorrow") {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return formatLocalDate(d);
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  return null;
}
