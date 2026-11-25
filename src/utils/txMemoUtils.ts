/**
 * Splits a shared/sibling ledger student name (e.g. "박서진, 서영" or "김민수/민지")
 * into quick-select orderer options plus "보호자".
 * Returns an empty array when the student name does not contain comma or slash separators.
 */
export function extractOrdererQuickOptions(studentName: string): string[] {
  const trimmed = String(studentName || '').trim();
  if (!trimmed || !/[,/]/.test(trimmed)) {
    return [];
  }

  const rawParts = trimmed
    .split(/[,/]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  const uniqueParts: string[] = [];
  for (const part of rawParts) {
    if (!uniqueParts.includes(part)) {
      uniqueParts.push(part);
    }
  }

  if (uniqueParts.length < 2) {
    return [];
  }

  if (!uniqueParts.includes('보호자')) {
    uniqueParts.push('보호자');
  }

  return uniqueParts;
}

/**
 * Appends an optional transaction memo to items_summary in "내용 (메모)" format.
 * Example: appendTxMemo("찹쌀꽈배기 2개", "서영") -> "찹쌀꽈배기 2개 (서영)"
 */
export function appendTxMemo(baseSummary: string, memo: string): string {
  const cleanBase = String(baseSummary || '').trim();
  const cleanMemo = String(memo || '').trim();
  if (!cleanMemo) return cleanBase;
  if (!cleanBase) return cleanMemo;

  const suffix = `(${cleanMemo})`;
  if (cleanBase.endsWith(suffix)) {
    return cleanBase;
  }
  return `${cleanBase} ${suffix}`;
}
