import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { History, LockOpen, Megaphone, Sparkles } from 'lucide-react';
import type { KioskDeductionContext, LedgerEntry, Student } from '../types';
import { formatShortDate, formatWon } from '../utils/koreanSearch';

interface KioskOverlayProps {
  open: boolean;
  storeName: string;
  student: Student | null;
  ledger: LedgerEntry[];
  lowBalanceLimit: number;
  recentDeduction: KioskDeductionContext | null;
  onUnlock: () => void;
}

const HOLD_DURATION_MS = 2000;

function parseTimestampMs(ts: string): number {
  const ms = new Date(ts).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

export const KioskOverlay: React.FC<KioskOverlayProps> = ({
  open,
  storeName,
  student,
  ledger,
  lowBalanceLimit,
  recentDeduction,
  onUnlock,
}) => {
  const [holdProgress, setHoldProgress] = useState(0); // 0 to 100
  const [isHolding, setIsHolding] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const unlockedRef = useRef(false);
  const listScrollRef = useRef<HTMLDivElement | null>(null);

  const cancelHold = useCallback(() => {
    setIsHolding(false);
    setHoldProgress(0);
    startTimeRef.current = null;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!open) {
      cancelHold();
      unlockedRef.current = false;
    }
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [open, cancelHold]);

  const tick = useCallback(() => {
    if (startTimeRef.current === null || unlockedRef.current) return;
    const elapsed = performance.now() - startTimeRef.current;
    const pct = Math.min(100, (elapsed / HOLD_DURATION_MS) * 100);
    setHoldProgress(pct);

    if (elapsed >= HOLD_DURATION_MS) {
      unlockedRef.current = true;
      cancelHold();
      onUnlock();
      return;
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [cancelHold, onUnlock]);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (unlockedRef.current) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore if capture unsupported
    }
    setIsHolding(true);
    startTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
  };

  const handlePointerEnd = () => {
    if (!unlockedRef.current) {
      cancelHold();
    }
  };

  // Derive selected student's ACTIVE transactions sorted chronologically (oldest -> newest)
  const { activeTransactions, latestChargeIndex, usesSinceLatestCharge } = useMemo(() => {
    if (!student) {
      return {
        activeTransactions: [] as LedgerEntry[],
        latestChargeIndex: -1,
        usesSinceLatestCharge: 0,
      };
    }

    const list = ledger
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

    let chargeIdx = -1;
    for (let i = list.length - 1; i >= 0; i--) {
      if (String(list[i].type).toUpperCase() === 'CHARGE') {
        chargeIdx = i;
        break;
      }
    }

    const usesCount =
      chargeIdx >= 0
        ? list.slice(chargeIdx + 1).filter((tx) => String(tx.type).toUpperCase() === 'USE').length
        : 0;

    return {
      activeTransactions: list,
      latestChargeIndex: chargeIdx,
      usesSinceLatestCharge: usesCount,
    };
  }, [ledger, student]);

  // Auto-scroll to bottom (most recent transaction) whenever Kiosk mode opens or updates
  useEffect(() => {
    if (!open || !student) return;
    const frameId = requestAnimationFrame(() => {
      if (listScrollRef.current) {
        listScrollRef.current.scrollTop = listScrollRef.current.scrollHeight;
      }
    });
    return () => cancelAnimationFrame(frameId);
  }, [open, student?.student_id, activeTransactions.length]);

  if (!open || !student) return null;

  const isLowBalance = student.balance <= lowBalanceLimit;
  const isNegative = student.balance < 0;

  // Circle SVG stroke math for unlock gauge
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (holdProgress / 100) * circumference;

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col select-none overflow-hidden transition-colors ${
        isLowBalance
          ? 'bg-[#FFF5EE] ring-[10px] ring-inset ring-[#E65100] sm:ring-[14px]'
          : 'bg-[#FAF6F0] ring-[8px] ring-inset ring-[#E5DACB] sm:ring-[10px]'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="학생 확인용 잔액 및 이용 내역 화면"
    >
      {/* Main Full-Height Responsive Column */}
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-5 pt-6 pb-24 sm:px-8 sm:pt-8 sm:pb-24">
        {/* TOP SECTION: Store, Student Name/Grade, Just-Deducted, Giant Balance, Low-Balance Banner */}
        <div className="shrink-0 text-center">
          {/* Store Name — strictly no parent phone, memo, or other students */}
          <div className="text-sm font-bold tracking-tight text-[#745D4E] sm:text-base">
            {storeName}
          </div>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#2C1E16] sm:text-4xl">
            {student.name}
            {student.info ? (
              <span className="ml-2.5 text-xl font-semibold text-[#745D4E] sm:text-2xl">
                ({student.info})
              </span>
            ) : null}
          </h1>

          {recentDeduction && (
            <div className="mx-auto mt-3.5 w-full max-w-xl rounded-2xl border border-[#E5DACB] bg-white px-5 py-3 shadow-xs">
              <div className="text-xs font-semibold text-[#745D4E]">방금 맛있게 주문한 간식</div>
              <div className="mt-0.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-lg font-bold text-[#2C1E16] sm:text-xl">
                <span>{recentDeduction.itemsSummary}</span>
                <span className="font-num text-[#C0302B]">
                  -{Math.abs(recentDeduction.deductedAmount).toLocaleString('ko-KR')}원
                </span>
              </div>
            </div>
          )}

          <div className="mt-4 sm:mt-5">
            <div className="text-base font-semibold text-[#6E5849] sm:text-lg">
              현재 남은 적립금
            </div>
            <div
              className={`font-num mt-1 text-5xl font-bold tracking-tight sm:text-7xl ${
                isNegative
                  ? 'text-[#C0302B]'
                  : isLowBalance
                    ? 'text-[#D9531E]'
                    : 'text-[#2C1E16]'
              }`}
            >
              {formatWon(student.balance)}
            </div>
          </div>

          {isLowBalance ? (
            <div className="mx-auto mt-4 flex w-full max-w-2xl items-center gap-3.5 rounded-2xl border-2 border-[#E65100] bg-[#FFF0E5] px-5 py-3.5 text-left shadow-xs">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E65100] text-white">
                <Megaphone className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-bold text-[#9A3412] sm:text-lg">
                  잔액이 얼마 안 남았어요! 부모님께 말씀드려요 📢
                </p>
                {isNegative && (
                  <p className="mt-0.5 text-xs font-semibold text-[#C0302B] sm:text-sm">
                    부족한 금액({Math.abs(student.balance).toLocaleString('ko-KR')}원)이 다음 충전 시 정산됩니다.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[#745D4E] sm:text-base">
              <Sparkles className="h-4 w-4 text-[#B85D19]" />
              <span>오늘도 맛있게 먹고 건강한 하루 보내세요!</span>
            </div>
          )}
        </div>

        {/* BOTTOM SECTION: Read-Only Scrollable Transaction History Card */}
        <section
          aria-label="이용 및 적립 내역"
          className="mt-5 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#E5DACB] bg-white shadow-xs"
        >
          {/* Card Header */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#EFE6DA] bg-[#FDFBF7] px-5 py-3.5">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-[#B85D19]" />
              <h2 className="text-sm font-bold text-[#2C1E16] sm:text-base">
                그동안의 이용 및 적립 내역
              </h2>
            </div>

            <div className="flex items-center gap-2 text-xs font-medium text-[#745D4E]">
              <span className="font-num">총 {activeTransactions.length}건</span>
              {latestChargeIndex >= 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-[#1E7A4C]">
                    최근 적립 이후 {usesSinceLatestCharge}회 이용
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Scrollable List (oldest top -> newest bottom, auto-scrolled to bottom on open) */}
          <div ref={listScrollRef} className="flex-1 overflow-y-auto overscroll-contain">
            {activeTransactions.length === 0 ? (
              <div className="flex h-full min-h-[140px] flex-col items-center justify-center px-6 py-10 text-center">
                <p className="text-sm font-semibold text-[#745D4E]">
                  아직 기록된 이용·적립 내역이 없습니다.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[#F1E8DC] pb-4">
                {activeTransactions.map((tx, idx) => {
                  const isCharge = String(tx.type).toUpperCase() === 'CHARGE';
                  const isLatestCharge = idx === latestChargeIndex;

                  return (
                    <li key={tx.tx_id}>
                      {/* Subtle Cycle Boundary Divider above the most recent CHARGE row */}
                      {isLatestCharge && idx > 0 && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-dashed border-[#B7DFC9] bg-[#FAF6F0] px-5 py-1.5 text-xs font-semibold text-[#5E7C6B]">
                          <span>↑ 이전 정산 내역</span>
                          <span aria-hidden="true">·</span>
                          <span>↓ 최근 적립부터 현재까지</span>
                        </div>
                      )}

                      <div
                        className={`flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5 ${
                          isCharge ? 'bg-[#F3FAF6]' : 'bg-white'
                        }`}
                      >
                        {/* Left: Timestamp + Summary */}
                        <div className="flex min-w-0 flex-1 items-baseline gap-3 sm:gap-4">
                          <span className="font-num w-[82px] shrink-0 text-xs font-medium text-[#8D7665] sm:w-[92px] sm:text-sm">
                            {formatShortDate(tx.timestamp)}
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              {isCharge && (
                                <span className="rounded-md bg-[#E1F3E8] px-2 py-0.5 text-xs font-bold text-[#145C38] whitespace-nowrap">
                                  {isLatestCharge ? '최근 적립' : '적립'}
                                </span>
                              )}
                              <span
                                className={`text-sm font-bold sm:text-base ${
                                  isCharge ? 'text-[#1E7A4C]' : 'text-[#2C1E16]'
                                }`}
                              >
                                {tx.items_summary || (isCharge ? '적립금 충전' : '간식 이용')}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Right: Delta Amount + Balance After */}
                        <div className="shrink-0 text-right">
                          <div
                            className={`font-num text-base font-bold sm:text-lg ${
                              isCharge ? 'text-[#1E7A4C]' : 'text-[#C0302B]'
                            }`}
                          >
                            {isCharge
                              ? `+${Math.abs(tx.amount).toLocaleString('ko-KR')}원`
                              : `-${Math.abs(tx.amount).toLocaleString('ko-KR')}원`}
                          </div>
                          <div className="font-num mt-0.5 text-xs font-medium text-[#745D4E]">
                            잔액 {tx.balance_after.toLocaleString('ko-KR')}원
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* Bottom-Left Subtle Guard Label (visible on tablet/desktop) */}
      <p className="pointer-events-none fixed bottom-7 left-7 hidden text-xs font-medium text-[#9A8574] sm:block">
        화면 보호 모드 작동 중
      </p>

      {/* Fixed Bottom-Right 2.0-second Press-and-Hold Unlock Control */}
      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerEnd}
        onPointerLeave={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onContextMenu={(e) => e.preventDefault()}
        className={`fixed right-6 bottom-6 z-[110] touch-none select-none overflow-hidden rounded-2xl border-2 px-5 py-3 text-sm font-bold shadow-lg transition-transform ${
          isHolding
            ? 'scale-[0.98] border-[#B85D19] bg-[#FDF3E7] text-[#2C1E16]'
            : 'border-[#D9CBB8] bg-white text-[#5A4538] hover:border-[#B85D19]'
        }`}
      >
        {/* SVG Linear Fill Progress Overlay */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
          aria-hidden="true"
        >
          <rect
            x="0"
            y="0"
            width={holdProgress}
            height="100"
            fill="#B85D19"
            fillOpacity="0.14"
          />
        </svg>

        <div className="relative flex items-center gap-3">
          {/* Circular Progress Gauge */}
          <div className="relative flex h-9 w-9 items-center justify-center">
            <svg className="h-9 w-9 -rotate-90" viewBox="0 0 40 40">
              <circle
                cx="20"
                cy="20"
                r={radius}
                fill="none"
                stroke="#E5DACB"
                strokeWidth="3.5"
              />
              <circle
                cx="20"
                cy="20"
                r={radius}
                fill="none"
                stroke="#B85D19"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
              />
            </svg>
            <LockOpen className="absolute h-4 w-4 text-[#B85D19]" />
          </div>

          <div className="text-left">
            <div className="whitespace-nowrap text-sm font-bold text-[#2C1E16]">
              사장님 복귀 (2초 꾹)
            </div>
            <div className="font-num text-xs font-medium text-[#745D4E]">
              {isHolding
                ? `${Math.min(2.0, (holdProgress / 100) * 2).toFixed(1)}초 / 2.0초`
                : '떼지 말고 2초간 누르세요'}
            </div>
          </div>
        </div>
      </button>
    </div>
  );
};
