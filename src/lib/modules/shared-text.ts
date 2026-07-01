export async function readUploadedText(file: File) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const candidates = ["utf-8", "windows-1252", "iso-8859-1"];

  for (const encoding of candidates) {
    try {
      const decoder = new TextDecoder(encoding, { fatal: encoding === "utf-8" });
      const text = decoder.decode(bytes);
      if (text.trim()) return { text, encoding };
    } catch {
      // Try next encoding.
    }
  }

  return { text: new TextDecoder().decode(bytes), encoding: "utf-8" };
}

export function detectDelimiter(line: string) {
  const candidates = [
    { value: "\t", label: "TAB" },
    { value: ";", label: "ponto_virgula" },
    { value: ",", label: "virgula" },
  ];
  const best = candidates
    .map((candidate) => ({
      ...candidate,
      count: line.split(candidate.value).length - 1,
    }))
    .sort((a, b) => b.count - a.count)[0];
  return best && best.count > 0 ? best : { value: " ", label: "espaco" };
}

export function splitColumns(line: string, delimiter: string) {
  if (delimiter === " ") return line.trim().split(/\s+/);
  return line.split(delimiter).map((column) => column.trim());
}

export function parseNumber(value: unknown) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

export function sanitizeDownloadName(name: string, fallback: string) {
  const safe = name
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return safe || fallback;
}
