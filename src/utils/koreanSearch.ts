import type { Student } from '../types';

const CHOSUNG_LIST = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ',
  'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

const CHOSUNG_SET = new Set(CHOSUNG_LIST);

/**
 * Extracts Hangul initial consonants (초성) from a Korean string.
 * Example: '김민수' -> 'ㄱㅁㅅ'
 */
export function extractChosung(str: string): string {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 0xac00 && code <= 0xd7a3) {
      const chosungIndex = Math.floor((code - 0xac00) / 588);
      result += CHOSUNG_LIST[chosungIndex];
    } else {
      result += str[i];
    }
  }
  return result;
}

/**
 * Checks whether the entire query consists of Hangul chosung consonants (ignoring whitespace).
 */
export function isChosungOnly(query: string): boolean {
  const cleaned = query.replace(/\s+/g, '');
  if (!cleaned) return false;
  for (let i = 0; i < cleaned.length; i++) {
    if (!CHOSUNG_SET.has(cleaned[i])) {
      return false;
    }
  }
  return true;
}

/**
 * Extracts digits only from a phone number string.
 */
export function extractDigits(str: string): string {
  return (str || '').replace(/\D/g, '');
}

/**
 * Returns the last 4 digits of a phone number for safe display.
 */
export function getPhoneLast4(phone: string): string {
  const digits = extractDigits(phone);
  if (digits.length >= 4) {
    return digits.slice(-4);
  }
  return digits || '-';
}

/**
 * Real-time student matcher supporting:
 * 1. Full name substring match
 * 2. Hangul chosung search (e.g. 'ㄱㅁㅅ' -> '김민수')
 * 3. Parent phone last 4 digits (or any numeric sequence in phone)
 */
export function matchesStudentQuery(student: Student, rawQuery: string): boolean {
  const query = rawQuery.trim();
  if (!query) return true;

  const compactQuery = query.replace(/\s+/g, '').toLowerCase();
  const nameCompact = (student.name || '').replace(/\s+/g, '').toLowerCase();

  // 1. Direct full-name match
  if (nameCompact.includes(compactQuery)) {
    return true;
  }

  // 2. Korean chosung match (supports pure chosung like 'ㄱㅁㅅ' or partial syllable + chosung)
  const nameChosung = extractChosung(student.name || '').replace(/\s+/g, '');
  if (isChosungOnly(compactQuery) && nameChosung.includes(compactQuery)) {
    return true;
  }

  // Mixed query support (e.g. '김ㅁㅅ' matches '김민수')
  if (compactQuery.length <= nameCompact.length) {
    for (let start = 0; start <= nameCompact.length - compactQuery.length; start++) {
      let matched = true;
      for (let j = 0; j < compactQuery.length; j++) {
        const qChar = compactQuery[j];
        const nChar = nameCompact[start + j];
        if (CHOSUNG_SET.has(qChar)) {
          if (extractChosung(nChar) !== qChar) {
            matched = false;
            break;
          }
        } else if (nChar !== qChar) {
          matched = false;
          break;
        }
      }
      if (matched) return true;
    }
  }

  // 3. Parent phone number match (especially last 4 digits)
  const queryDigits = extractDigits(query);
  if (queryDigits.length > 0) {
    const phoneDigits = extractDigits(student.parent_phone || '');
    if (phoneDigits.endsWith(queryDigits) || phoneDigits.includes(queryDigits)) {
      return true;
    }
  }

  return false;
}

export function formatWon(amount: number, showSign = false): string {
  const num = Number(amount) || 0;
  const formatted = Math.abs(num).toLocaleString('ko-KR');
  if (num < 0) return `-${formatted}원`;
  if (showSign && num > 0) return `+${formatted}원`;
  return `${formatted}원`;
}

export function formatDateTime(ts: string): string {
  if (!ts) return '-';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) {
    return ts;
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd} ${hh}:${min}`;
}

export function formatShortDate(ts: string): string {
  if (!ts) return '-';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) {
    return ts.slice(0, 10);
  }
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${min}`;
}

export function getTodayYYYYMMDD(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

export function downloadStudentsCsv(students: Student[], storeName: string): void {
  const headers = ['학생ID', '이름', '학년/학교', '보호자 연락처', '현재 잔액(원)', '메모'];
  const escapeCell = (val: string | number) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = students.map((s) => [
    escapeCell(s.student_id),
    escapeCell(s.name),
    escapeCell(s.info),
    escapeCell(s.parent_phone),
    escapeCell(s.balance),
    escapeCell(s.memo),
  ]);

  const csvBody = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  // UTF-8 BOM (\uFEFF) so Microsoft Excel opens Korean cleanly without mojibake
  const blob = new Blob(['\uFEFF' + csvBody], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeStore = (storeName || '꽈배기매장').replace(/[\\/:*?"<>|]/g, '_');
  link.href = url;
  link.download = `${safeStore}_학생잔액표_${getTodayYYYYMMDD()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
