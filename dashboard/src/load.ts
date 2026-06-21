import { isResultRecord, type ResultRecord } from "./contract";

export interface Loaded {
  records: ResultRecord[];
  skipped: number;
}

// Parse JSONL, validating each line at the seam. Malformed / shape-drifted lines
// are skipped and counted rather than crashing the view.
export function parseRecords(text: string): Loaded {
  const records: ResultRecord[] = [];
  let skipped = 0;
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (isResultRecord(parsed)) records.push(parsed);
      else skipped++;
    } catch {
      skipped++;
    }
  }
  return { records, skipped };
}

export async function fetchRecords(url = "/records.jsonl"): Promise<Loaded> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No run store at ${url} (HTTP ${res.status}).`);
  return parseRecords(await res.text());
}
