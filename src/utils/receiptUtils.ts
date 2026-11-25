import type { LedgerEntry, Student } from '../types';
import { formatDateTime } from './koreanSearch';

export interface SettlementCycle {
  entries: LedgerEntry[];
  carryOverBalance: number;
  totalCharged: number;
  totalUsed: number;
  calculatedCurrentBalance: number;
  studentCurrentBalance: number;
  periodStartLabel: string;
  periodEndLabel: string;
  hasChargeAnchor: boolean;
}

function parseTimestampMs(ts: string): number {
  const ms = new Date(ts).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Computes the student's current settlement cycle using 100% pure JavaScript arithmetic:
 * 1. Filter student's ACTIVE ledger entries and sort chronologically (oldest -> newest).
 * 2. Find the index of the LAST (most recent) CHARGE transaction (or 0 if none exists).
 * 3. Slice from that index to the latest entry.
 * 4. Carry-over balance = cycle[0].balance_before.
 * 5. Sum CHARGE amounts and USE amounts (as positive spend), compute final balance.
 */
export function buildSettlementCycle(student: Student, ledger: LedgerEntry[]): SettlementCycle {
  const activeEntries = ledger
    .filter(
      (entry) =>
        entry.student_id === student.student_id &&
        String(entry.status || 'ACTIVE').toUpperCase() === 'ACTIVE'
    )
    .sort((a, b) => {
      const diff = parseTimestampMs(a.timestamp) - parseTimestampMs(b.timestamp);
      if (diff !== 0) return diff;
      return String(a.tx_id).localeCompare(String(b.tx_id));
    });

  if (activeEntries.length === 0) {
    return {
      entries: [],
      carryOverBalance: student.balance,
      totalCharged: 0,
      totalUsed: 0,
      calculatedCurrentBalance: student.balance,
      studentCurrentBalance: student.balance,
      periodStartLabel: '거래 내역 없음',
      periodEndLabel: formatDateTime(new Date().toISOString()),
      hasChargeAnchor: false,
    };
  }

  let lastChargeIndex = -1;
  for (let i = activeEntries.length - 1; i >= 0; i--) {
    if (String(activeEntries[i].type).toUpperCase() === 'CHARGE') {
      lastChargeIndex = i;
      break;
    }
  }

  const startIndex = lastChargeIndex >= 0 ? lastChargeIndex : 0;
  const cycleEntries = activeEntries.slice(startIndex);
  const carryOverBalance = Number(cycleEntries[0].balance_before ?? 0);

  let totalCharged = 0;
  let totalUsed = 0;

  for (const tx of cycleEntries) {
    const typeUpper = String(tx.type).toUpperCase();
    const amt = Number(tx.amount) || 0;
    if (typeUpper === 'CHARGE') {
      totalCharged += Math.abs(amt);
    } else if (typeUpper === 'USE') {
      totalUsed += Math.abs(amt);
    } else if (amt > 0) {
      totalCharged += amt;
    } else if (amt < 0) {
      totalUsed += Math.abs(amt);
    }
  }

  const calculatedCurrentBalance = carryOverBalance + totalCharged - totalUsed;

  return {
    entries: cycleEntries,
    carryOverBalance,
    totalCharged,
    totalUsed,
    calculatedCurrentBalance,
    studentCurrentBalance: student.balance,
    periodStartLabel: formatDateTime(cycleEntries[0].timestamp),
    periodEndLabel: formatDateTime(cycleEntries[cycleEntries.length - 1].timestamp),
    hasChargeAnchor: lastChargeIndex >= 0,
  };
}
