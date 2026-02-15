export type ParsedImport = {
  projectHeading: string | null;
  pairs: Array<{ key: string; value: string }>;
  skipped: number;
};

export function parseTxtImport(input: string): ParsedImport {
  const lines = input.split(/\r?\n/);
  let projectHeading: string | null = null;
  const pairs: Array<{ key: string; value: string }> = [];
  let skipped = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    if (line.startsWith("[") && line.endsWith("]")) {
      projectHeading = line.slice(1, -1).trim();
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      skipped += 1;
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (!key || !value) {
      skipped += 1;
      continue;
    }

    pairs.push({ key, value });
  }

  return { projectHeading, pairs, skipped };
}
