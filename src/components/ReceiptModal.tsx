import React, { useEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import {
  Check,
  Copy,
  Download,
  Loader2,
  ReceiptText,
  RotateCcw,
  X,
} from 'lucide-react';
import type { LedgerEntry, StoreSettings, Student } from '../types';
import { formatDateTime, formatShortDate, formatWon, getTodayYYYYMMDD } from '../utils/koreanSearch';
import { buildSettlementCycle } from '../utils/receiptUtils';

function buildKakaoTemplateMessage(params: {
  storeName: string;
  studentName: string;
  studentInfo: string;
  carryOverBalance: number;
  totalCharged: number;
  totalUsed: number;
  currentBalance: number;
  isLowBalance: boolean;
  lowBalanceLimit: number;
  periodLabel: string;
  txCount: number;
}): string {
  const store = params.storeName || '우리동네 꽈배기';
  const studentLabel = params.studentInfo
    ? `${params.studentName}(${params.studentInfo})`
    : params.studentName;

  const lines: string[] = [
    `안녕하세요, ${store}입니다 :)`,
    `${studentLabel} 학생 선불 적립금 정산 내역을 안내드립니다.`,
    '',
    `■ 정산 기간: ${params.periodLabel} (${params.txCount}건)`,
    `■ 이월 잔액: ${formatWon(params.carryOverBalance)}`,
    `■ 기간 충전: +${params.totalCharged.toLocaleString('ko-KR')}원`,
    `■ 기간 이용: -${params.totalUsed.toLocaleString('ko-KR')}원`,
    `■ 현재 잔액: ${formatWon(params.currentBalance)}`,
  ];

  if (params.currentBalance < 0) {
    lines.push(
      '',
      `현재 잔액이 ${Math.abs(params.currentBalance).toLocaleString('ko-KR')}원 부족(미수금) 상태입니다. 편하실 때 적립금 충전을 부탁드립니다.`
    );
  } else if (params.isLowBalance) {
    lines.push(
      '',
      `현재 남은 적립금이 ${params.lowBalanceLimit.toLocaleString('ko-KR')}원 이하입니다. 편하실 때 추가 충전을 부탁드립니다.`
    );
  }

  lines.push('', '자세한 이용 내역은 함께 보내드린 영수증 이미지를 확인해 주세요. 항상 감사합니다!');
  return lines.join('\n');
}

interface ReceiptModalProps {
  open: boolean;
  student: Student | null;
  ledger: LedgerEntry[];
  settings: StoreSettings;
  onClose: () => void;
  onNotify: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  open,
  student,
  ledger,
  settings,
  onClose,
  onNotify,
}) => {
  const receiptRef = useRef<HTMLDivElement | null>(null);
  const [exportingPng, setExportingPng] = useState(false);
  const [kakaoMessage, setKakaoMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const cycle = useMemo(() => {
    if (!student) return null;
    return buildSettlementCycle(student, ledger);
  }, [student, ledger]);

  const defaultTemplateMessage = useMemo(() => {
    if (!student || !cycle) return '';
    const periodLabel =
      cycle.entries.length > 0
        ? `${cycle.periodStartLabel} ~ ${cycle.periodEndLabel}`
        : '최근 정산 내역';
    const lowBalance = cycle.calculatedCurrentBalance <= settings.low_balance_limit;

    return buildKakaoTemplateMessage({
      storeName: settings.store_name,
      studentName: student.name,
      studentInfo: student.info,
      carryOverBalance: cycle.carryOverBalance,
      totalCharged: cycle.totalCharged,
      totalUsed: cycle.totalUsed,
      currentBalance: cycle.calculatedCurrentBalance,
      isLowBalance: lowBalance,
      lowBalanceLimit: settings.low_balance_limit,
      periodLabel,
      txCount: cycle.entries.length,
    });
  }, [student, cycle, settings.store_name, settings.low_balance_limit]);

  useEffect(() => {
    if (open) {
      setKakaoMessage(defaultTemplateMessage);
      setCopied(false);
    }
  }, [open, student?.student_id, defaultTemplateMessage]);

  if (!open || !student || !cycle) return null;

  const issuedAt = formatDateTime(new Date().toISOString());
  const isLowBalance = cycle.calculatedCurrentBalance <= settings.low_balance_limit;
  const hasDiscrepancy = cycle.calculatedCurrentBalance !== cycle.studentCurrentBalance;

  const handleDownloadPng = async () => {
    if (!receiptRef.current) return;
    setExportingPng(true);
    try {
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        backgroundColor: '#FFFDF9',
        useCORS: true,
        logging: false,
      });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      const safeName = student.name.replace(/[\\/:*?"<>|]/g, '_');
      link.download = `${safeName}_이용내역_${getTodayYYYYMMDD()}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      onNotify('success', `${safeName}_이용내역_${getTodayYYYYMMDD()}.png 저장 완료`);
    } catch (err) {
      onNotify(
        'error',
        `영수증 이미지 저장 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`
      );
    } finally {
      setExportingPng(false);
    }
  };

  const handleResetKakaoMessage = () => {
    setKakaoMessage(defaultTemplateMessage);
    setCopied(false);
  };

  const handleCopyMessage = async () => {
    if (!kakaoMessage) return;
    try {
      await navigator.clipboard.writeText(kakaoMessage);
      setCopied(true);
      onNotify('success', '카카오톡 안내 문구가 복사되었습니다.');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback copy method
      const ta = document.createElement('textarea');
      ta.value = kakaoMessage;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      onNotify('success', '카카오톡 안내 문구가 복사되었습니다.');
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C1E16]/60 p-3 backdrop-blur-[2px] sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-modal-title"
    >
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#E5DACB] bg-[#FAF6F0] shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#E5DACB] bg-white px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FDF3E7] text-[#B85D19]">
              <ReceiptText className="h-5 w-5" />
            </div>
            <div>
              <h3 id="receipt-modal-title" className="text-lg font-bold text-[#2C1E16]">
                학부모 정산 영수증 발급
              </h3>
              <p className="text-xs text-[#745D4E]">
                직전 적립금 충전 시점부터 현재까지의 유효 거래 내역을 자동 검산했습니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[#745D4E] hover:bg-[#F3ECE1]"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body: Left Receipt Card Preview, Right Action & KakaoTalk Panel */}
        <div className="grid flex-1 grid-cols-1 gap-5 overflow-y-auto p-5 lg:grid-cols-12">
          {/* Receipt Capture Target (Pure Hex Classes Only for html2canvas) */}
          <div className="lg:col-span-7">
            <div ref={receiptRef} className="receipt-capture-root p-6 shadow-sm">
              {/* Store & Title Header */}
              <div className="receipt-header pb-4 text-center">
                <div className="receipt-store-title text-xl font-bold tracking-tight">
                  {settings.store_name || '우리동네 꽈배기'}
                </div>
                <div className="receipt-muted mt-1 text-sm font-semibold">
                  학생 선불 적립금 정산 이용내역서
                </div>
              </div>

              {/* Student Meta */}
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <div className="receipt-muted text-xs font-medium">학생 정보</div>
                  <div className="receipt-store-title mt-0.5 text-lg font-bold">
                    {student.name}
                    {student.info ? ` (${student.info})` : ''}
                  </div>
                </div>
                <div className="text-right">
                  <div className="receipt-muted text-xs font-medium">발행일시</div>
                  <div className="font-num receipt-muted mt-0.5 text-xs font-semibold">
                    {issuedAt}
                  </div>
                </div>
              </div>

              {/* Period & Math Summary Box */}
              <div className="receipt-summary-box mt-4 p-4">
                <div className="receipt-muted flex items-center justify-between text-xs font-medium">
                  <span>정산 기준</span>
                  <span>
                    {cycle.hasChargeAnchor ? '직전 충전 이후 전체' : '최초 기록 이후 전체'} (
                    {cycle.entries.length}건)
                  </span>
                </div>

                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="receipt-muted">이월 잔액</span>
                    <span className="font-num font-semibold">
                      {formatWon(cycle.carryOverBalance)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="receipt-muted">기간 내 충전 합계</span>
                    <span className="font-num receipt-positive font-semibold">
                      +{cycle.totalCharged.toLocaleString('ko-KR')}원
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="receipt-muted">기간 내 이용 합계</span>
                    <span className="font-num receipt-negative font-semibold">
                      -{cycle.totalUsed.toLocaleString('ko-KR')}원
                    </span>
                  </div>
                </div>

                <div className="receipt-highlight-box mt-3.5 flex items-center justify-between px-4 py-3">
                  <span className="text-sm font-bold">현재 남은 적립금</span>
                  <span className="font-num text-xl font-bold">
                    {formatWon(cycle.calculatedCurrentBalance)}
                  </span>
                </div>
              </div>

              {isLowBalance && (
                <div className="receipt-low-alert mt-3 px-4 py-2.5 text-xs font-semibold">
                  현재 잔액이 기준액({settings.low_balance_limit.toLocaleString('ko-KR')}원) 이하입니다. 편하실 때 충전을 부탁드립니다.
                </div>
              )}

              {/* Transactions Table */}
              <div className="mt-5">
                <div className="receipt-muted mb-2 text-xs font-bold">상세 이용 내역</div>
                {cycle.entries.length === 0 ? (
                  <div className="receipt-summary-box py-6 text-center text-sm receipt-muted">
                    표시할 유효 거래 내역이 없습니다.
                  </div>
                ) : (
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="receipt-divider border-y">
                        <th className="receipt-muted py-2 text-left font-semibold">일시</th>
                        <th className="receipt-muted py-2 text-left font-semibold">내용</th>
                        <th className="receipt-muted py-2 text-right font-semibold">금액</th>
                        <th className="receipt-muted py-2 text-right font-semibold">잔액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cycle.entries.map((tx) => {
                        const isCharge = String(tx.type).toUpperCase() === 'CHARGE';
                        return (
                          <tr key={tx.tx_id} className="receipt-divider border-b">
                            <td className="font-num receipt-muted py-2 pr-2 whitespace-nowrap">
                              {formatShortDate(tx.timestamp)}
                            </td>
                            <td className="py-2 pr-2 font-medium">
                              {isCharge ? `[충전] ${tx.items_summary || '적립금 충전'}` : tx.items_summary || '간식 이용'}
                            </td>
                            <td
                              className={`font-num py-2 pr-2 text-right font-bold whitespace-nowrap ${
                                isCharge ? 'receipt-positive' : 'receipt-negative'
                              }`}
                            >
                              {isCharge
                                ? `+${Math.abs(tx.amount).toLocaleString('ko-KR')}`
                                : `-${Math.abs(tx.amount).toLocaleString('ko-KR')}`}
                            </td>
                            <td className="font-num py-2 text-right font-semibold whitespace-nowrap">
                              {tx.balance_after.toLocaleString('ko-KR')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="receipt-muted mt-5 pt-3 text-center text-xs">
                항상 이용해 주셔서 감사합니다 · {settings.store_name}
              </div>
            </div>

            {hasDiscrepancy && (
              <p className="mt-2.5 rounded-xl bg-[#FEF3C7] px-3.5 py-2 text-xs font-semibold text-[#92400E]">
                참고: 원장 계산 잔액({formatWon(cycle.calculatedCurrentBalance)})과 학생 시트 잔액(
                {formatWon(cycle.studentCurrentBalance)})에 차이가 있습니다. 설정 탭의 [잔액 재검산]을 권장합니다.
              </p>
            )}
          </div>

          {/* Right Column: PNG Export + KakaoTalk Template Message */}
          <div className="flex flex-col gap-4 lg:col-span-5">
            <div className="rounded-2xl border border-[#E5DACB] bg-white p-5">
              <h4 className="text-sm font-bold text-[#2C1E16]">1. 영수증 이미지 저장</h4>
              <p className="mt-1 text-xs leading-relaxed text-[#745D4E]">
                왼쪽 영수증 카드를 고해상도 PNG 이미지로 저장해 카카오톡으로 바로 전송할 수 있습니다.
              </p>
              <button
                type="button"
                onClick={handleDownloadPng}
                disabled={exportingPng}
                className="mt-4 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-xl bg-[#B85D19] px-4 py-3 text-base font-bold text-white transition-colors hover:bg-[#9A4B11] active:scale-[0.99] disabled:opacity-60"
              >
                {exportingPng ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Download className="h-5 w-5" />
                )}
                <span>{exportingPng ? '이미지 생성 중...' : '영수증 이미지(PNG) 저장'}</span>
              </button>
            </div>

            <div className="flex flex-1 flex-col rounded-2xl border border-[#E5DACB] bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-[#2C1E16]">2. 학부모 카톡 안내 문구</h4>
                <button
                  type="button"
                  onClick={handleResetKakaoMessage}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#745D4E] hover:text-[#2C1E16]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>기본 문구</span>
                </button>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[#745D4E]">
                확정 정산 금액이 반영된 안내 문구가 즉시 완성됩니다. 필요 시 수정 후 바로 복사하세요.
              </p>

              <div className="mt-3.5 flex flex-1 flex-col">
                <textarea
                  value={kakaoMessage}
                  onChange={(e) => {
                    setKakaoMessage(e.target.value);
                    setCopied(false);
                  }}
                  rows={10}
                  className="w-full flex-1 rounded-xl border border-[#DECDB8] bg-[#FAF6F0] p-3.5 text-sm leading-relaxed text-[#2C1E16] focus:border-[#B85D19] focus:bg-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className="mt-3 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-[#2C1E16] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#433024] active:scale-[0.99]"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  <span>{copied ? '복사 완료!' : '카톡 안내 문구 원클릭 복사'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
