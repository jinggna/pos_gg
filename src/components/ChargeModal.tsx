import React, { useEffect, useMemo, useState } from 'react';
import { Coins, X } from 'lucide-react';
import type { Student } from '../types';
import { formatWon } from '../utils/koreanSearch';
import { appendTxMemo, extractOrdererQuickOptions } from '../utils/txMemoUtils';

interface ChargeModalProps {
  open: boolean;
  student: Student | null;
  initialMemo?: string;
  busy: boolean;
  onClose: () => void;
  onCharge: (amount: number, memoLabel: string) => Promise<boolean>;
}

const PRESET_AMOUNTS = [5000, 10000, 20000, 30000];

export const ChargeModal: React.FC<ChargeModalProps> = ({
  open,
  student,
  initialMemo = '',
  busy,
  onClose,
  onCharge,
}) => {
  const [selectedAmount, setSelectedAmount] = useState<number>(10000);
  const [customInput, setCustomInput] = useState<string>('');
  const [note, setNote] = useState<string>('적립금 충전');
  const [ordererMemo, setOrdererMemo] = useState<string>('');

  useEffect(() => {
    if (open) {
      setSelectedAmount(10000);
      setCustomInput('');
      setNote('적립금 충전');
      setOrdererMemo(initialMemo);
    }
  }, [open, initialMemo]);

  const ordererQuickOptions = useMemo(
    () => (student ? extractOrdererQuickOptions(student.name) : []),
    [student]
  );

  if (!open || !student) return null;

  const activeAmount =
    customInput.trim() !== ''
      ? Math.max(0, Math.round(Number(customInput.replace(/[,\s]/g, '')) || 0))
      : selectedAmount;

  const afterBalance = student.balance + activeAmount;
  const previewSummary = appendTxMemo(note.trim() || '적립금 충전', ordererMemo);

  const handleToggleQuickOrderer = (label: string) => {
    setOrdererMemo((prev) => (prev.trim() === label ? '' : label));
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeAmount <= 0) return;
    const ok = await onCharge(activeAmount, previewSummary);
    if (ok) {
      setOrdererMemo('');
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C1E16]/55 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="charge-modal-title"
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#E5DACB] bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-[#EFE6DA] pb-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#ECF7F1] text-[#1E7A4C]">
              <Coins className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 id="charge-modal-title" className="text-lg font-bold text-[#2C1E16]">
                적립금 충전 — {student.name}
                {student.info ? ` (${student.info})` : ''}
              </h3>
              <p className="text-xs text-[#745D4E]">충전할 금액을 선택하거나 직접 입력하세요.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#745D4E] hover:bg-[#F3ECE1] disabled:opacity-50"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleConfirm} className="mt-5 space-y-5">
          {/* Preset Quick Buttons */}
          <div className="grid grid-cols-2 gap-3">
            {PRESET_AMOUNTS.map((amt) => {
              const isSelected = customInput.trim() === '' && selectedAmount === amt;
              return (
                <button
                  key={amt}
                  type="button"
                  onClick={() => {
                    setSelectedAmount(amt);
                    setCustomInput('');
                  }}
                  className={`font-num min-h-[60px] rounded-xl border px-2 text-lg font-bold transition-all active:scale-[0.98] ${
                    isSelected
                      ? 'border-[#1E7A4C] bg-[#ECF7F1] text-[#1E7A4C] ring-2 ring-[#1E7A4C]/25'
                      : 'border-[#E5DACB] bg-[#FAF6F0] text-[#2C1E16] hover:border-[#C9B7A0] hover:bg-[#F3ECE1]'
                  }`}
                >
                  +{amt.toLocaleString('ko-KR')}원
                </button>
              );
            })}
          </div>

          {/* Direct Custom Amount & Charge Base Label */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[#3F2E23]">
                직접 입력 (원)
              </label>
              <input
                type="number"
                min="100"
                step="100"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="금액 직접 입력"
                className="font-num min-h-[48px] w-full rounded-xl border border-[#DECDB8] bg-[#FAF6F0] px-3.5 text-base font-bold text-[#2C1E16] placeholder:font-sans placeholder:font-normal placeholder:text-[#A49080] focus:border-[#1E7A4C] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[#3F2E23]">
                충전 항목명
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="예: 적립금 충전, 계좌이체 충전"
                className="min-h-[48px] w-full rounded-xl border border-[#DECDB8] bg-[#FAF6F0] px-3.5 text-sm font-medium text-[#2C1E16] placeholder:text-[#A49080] focus:border-[#1E7A4C] focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* Balance Preview */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#D8E9DF] bg-[#F5FBF7] px-5 py-4">
            <div>
              <div className="text-xs font-medium text-[#5A4538]">현재 잔액</div>
              <div className="font-num mt-0.5 text-lg font-bold text-[#4A372B]">
                {formatWon(student.balance)}
              </div>
            </div>
            <div className="font-num text-sm font-bold text-[#1E7A4C]">
              +{activeAmount.toLocaleString('ko-KR')}원 →
            </div>
            <div className="text-right">
              <div className="text-xs font-medium text-[#1E7A4C]">충전 후 잔액</div>
              <div className="font-num mt-0.5 text-2xl font-bold text-[#1E7A4C]">
                {formatWon(afterBalance)}
              </div>
            </div>
          </div>

          {/* Optional Orderer Memo & Quick Select Chips */}
          <div className="rounded-xl border border-[#E5DACB] bg-[#FAF6F0] p-4">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
              <label
                htmlFor="charge-orderer-memo"
                className="text-xs font-bold text-[#5A4538]"
              >
                거래 메모 (선택 · 예: 주문자 이름)
              </label>
              {ordererMemo.trim() && (
                <span className="text-xs font-medium text-[#1E7A4C]">
                  저장: {previewSummary}
                </span>
              )}
            </div>

            {ordererQuickOptions.length > 0 && (
              <div className="mb-2.5 flex flex-wrap items-center gap-2">
                {ordererQuickOptions.map((option) => {
                  const isActive = ordererMemo.trim() === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => handleToggleQuickOrderer(option)}
                      disabled={busy}
                      className={`min-h-[38px] rounded-xl border px-3.5 py-1.5 text-sm font-bold transition-colors active:scale-[0.98] disabled:opacity-50 ${
                        isActive
                          ? 'border-[#1E7A4C] bg-[#1E7A4C] text-white'
                          : 'border-[#DECDB8] bg-white text-[#4A372B] hover:border-[#1E7A4C] hover:bg-[#ECF7F1]'
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="relative">
              <input
                id="charge-orderer-memo"
                type="text"
                value={ordererMemo}
                onChange={(e) => setOrdererMemo(e.target.value)}
                placeholder="예: 보호자, 계좌이체, 현금 등"
                disabled={busy}
                className="min-h-[44px] w-full rounded-xl border border-[#DECDB8] bg-white pr-10 pl-3.5 text-sm font-medium text-[#2C1E16] placeholder:text-[#9D8978] focus:border-[#1E7A4C] focus:outline-none disabled:opacity-50"
              />
              {ordererMemo && (
                <button
                  type="button"
                  onClick={() => setOrdererMemo('')}
                  className="absolute top-1/2 right-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#745D4E] hover:bg-[#F3ECE1]"
                  aria-label="메모 지우기"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="min-h-[54px] rounded-xl border border-[#DECDB8] bg-[#FAF6F0] px-3 text-base font-semibold text-[#4A372B] hover:bg-[#F3ECE1] disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={busy || activeAmount <= 0}
              className="min-h-[54px] rounded-xl bg-[#1E7A4C] px-3 text-base font-bold text-white transition-colors hover:bg-[#16603B] active:scale-[0.99] whitespace-normal break-keep disabled:opacity-50"
            >
              {busy ? '충전 처리 중...' : `${activeAmount.toLocaleString('ko-KR')}원 충전 확정`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
