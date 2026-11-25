import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import type {
  BatchTxItem,
  MenuItem,
  StagingTxRow,
  StoreSettings,
  Student,
} from '../types';
import {
  formatWon,
  getPhoneLast4,
  matchesStudentQuery,
} from '../utils/koreanSearch';
import { appendTxMemo, extractOrdererQuickOptions } from '../utils/txMemoUtils';

interface OcrTabProps {
  students: Student[];
  menus: MenuItem[];
  settings: StoreSettings;
  busy: boolean;
  onRequestBatchRecordTx: (items: BatchTxItem[], onSuccess: () => void) => void;
  onNotify: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
}

interface RowBalancePreview {
  student: Student | null;
  beforeBalance: number;
  afterBalance: number;
  occurrenceIndex: number;
}

interface QuickMenuPick {
  menu: MenuItem;
  qty: number;
}

const CHARGE_PRESETS = [5000, 10000, 20000, 30000, 50000];

function makeRowId(): string {
  return `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeSignedAmount(type: 'USE' | 'CHARGE', rawAmount: number): number {
  const abs = Math.round(Math.abs(Number(rawAmount) || 0));
  if (abs === 0) return 0;
  return type === 'USE' ? -abs : abs;
}

function buildPickedMenuSummary(picks: QuickMenuPick[]): string {
  return picks
    .map((p) => (p.qty > 1 ? `${p.menu.name} ${p.qty}개` : p.menu.name))
    .join(', ');
}

export const OcrTab: React.FC<OcrTabProps> = ({
  students,
  menus,
  settings,
  busy,
  onRequestBatchRecordTx,
  onNotify,
}) => {
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const studentSearchInputRef = useRef<HTMLInputElement | null>(null);

  // Quick Entry Form states
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentQuery, setStudentQuery] = useState<string>('');
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [keepStudentSelected, setKeepStudentSelected] = useState<boolean>(false);

  const [entryType, setEntryType] = useState<'USE' | 'CHARGE'>('USE');
  const [pickedMenus, setPickedMenus] = useState<QuickMenuPick[]>([]);
  const [itemsSummaryInput, setItemsSummaryInput] = useState<string>('');
  const [txMemoInput, setTxMemoInput] = useState<string>('');
  const [amountInput, setAmountInput] = useState<string>('');

  // Staging Table rows
  const [rows, setRows] = useState<StagingTxRow[]>([]);

  const lowBalanceLimit = Number(settings.low_balance_limit || 3000);

  const sortedStudents = useMemo(
    () => [...students].sort((a, b) => a.name.localeCompare(b.name, 'ko-KR')),
    [students]
  );

  const studentMap = useMemo(() => {
    const map = new Map<string, Student>();
    students.forEach((s) => map.set(s.student_id, s));
    return map;
  }, [students]);

  const availableMenus = useMemo(
    () => menus.filter((m) => m.is_available),
    [menus]
  );

  const filteredStudents = useMemo(() => {
    return sortedStudents.filter((s) => matchesStudentQuery(s, studentQuery));
  }, [sortedStudents, studentQuery]);

  const selectedStudent = useMemo(
    () => (selectedStudentId ? studentMap.get(selectedStudentId) || null : null),
    [selectedStudentId, studentMap]
  );

  const ordererQuickOptions = useMemo(
    () => (selectedStudent ? extractOrdererQuickOptions(selectedStudent.name) : []),
    [selectedStudent]
  );

  // Close searchable student dropdown when clicking outside
  useEffect(() => {
    const handlePointerDownOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDownOutside);
    return () => document.removeEventListener('mousedown', handlePointerDownOutside);
  }, []);

  // Top-to-bottom cumulative balance preview for each row + running balance map
  const { rowPreviews, finalProjectedBalanceMap } = useMemo(() => {
    const runningMap = new Map<string, { current: number; count: number }>();
    const previews = new Map<string, RowBalancePreview>();

    for (const row of rows) {
      const student = row.student_id ? studentMap.get(row.student_id) || null : null;
      if (!student) {
        previews.set(row.rowId, {
          student: null,
          beforeBalance: 0,
          afterBalance: 0,
          occurrenceIndex: 0,
        });
        continue;
      }

      const prevState = runningMap.get(student.student_id) ?? {
        current: student.balance,
        count: 0,
      };
      const beforeBalance = prevState.current;
      const afterBalance = beforeBalance + row.amount;
      const occurrenceIndex = prevState.count + 1;

      runningMap.set(student.student_id, {
        current: afterBalance,
        count: occurrenceIndex,
      });

      previews.set(row.rowId, {
        student,
        beforeBalance,
        afterBalance,
        occurrenceIndex,
      });
    }

    const projectedMap = new Map<string, number>();
    runningMap.forEach((val, key) => projectedMap.set(key, val.current));

    return { rowPreviews: previews, finalProjectedBalanceMap: projectedMap };
  }, [rows, studentMap]);

  // Summary & validation stats
  const summaryStats = useMemo(() => {
    let missingStudentCount = 0;
    let zeroAmountCount = 0;
    let totalCharge = 0;
    let totalUseAbs = 0;

    for (const row of rows) {
      if (!row.student_id || !studentMap.has(row.student_id)) {
        missingStudentCount += 1;
      }
      if (row.amount === 0) {
        zeroAmountCount += 1;
      } else if (row.type === 'CHARGE') {
        totalCharge += Math.abs(row.amount);
      } else {
        totalUseAbs += Math.abs(row.amount);
      }
    }

    const canSubmit = rows.length > 0 && missingStudentCount === 0 && zeroAmountCount === 0;

    return {
      missingStudentCount,
      zeroAmountCount,
      totalCharge,
      totalUseAbs,
      canSubmit,
    };
  }, [rows, studentMap]);

  const pickedMenuQtyMap = useMemo(() => {
    const map = new Map<string, number>();
    pickedMenus.forEach((p) => map.set(p.menu.menu_id, p.qty));
    return map;
  }, [pickedMenus]);

  const handleSelectStudentFromDropdown = (student: Student) => {
    if (student.student_id !== selectedStudentId) {
      setTxMemoInput('');
    }
    setSelectedStudentId(student.student_id);
    setStudentQuery(student.info ? `${student.name} (${student.info})` : student.name);
    setDropdownOpen(false);
  };

  const handleClearSelectedStudent = () => {
    setSelectedStudentId('');
    setStudentQuery('');
    setTxMemoInput('');
    setDropdownOpen(true);
    studentSearchInputRef.current?.focus();
  };

  const handleToggleQuickOrderer = (label: string) => {
    setTxMemoInput((prev) => (prev.trim() === label ? '' : label));
  };

  const handleChangeEntryType = (nextType: 'USE' | 'CHARGE') => {
    if (nextType === entryType) return;
    setEntryType(nextType);
    setPickedMenus([]);
    if (nextType === 'CHARGE') {
      if (!itemsSummaryInput.trim() || pickedMenus.length > 0) {
        setItemsSummaryInput('적립금 충전');
      }
    } else if (itemsSummaryInput.trim() === '적립금 충전') {
      setItemsSummaryInput('');
    }
    setAmountInput('');
  };

  const handleQuickPickMenu = (menu: MenuItem) => {
    setEntryType('USE');
    setPickedMenus((prev) => {
      const idx = prev.findIndex((p) => p.menu.menu_id === menu.menu_id);
      const next =
        idx >= 0
          ? prev.map((p, i) => (i === idx ? { ...p, qty: p.qty + 1 } : p))
          : [...prev, { menu, qty: 1 }];
      const nextSummary = buildPickedMenuSummary(next);
      const nextTotal = next.reduce((sum, p) => sum + p.menu.price * p.qty, 0);
      setItemsSummaryInput(nextSummary);
      setAmountInput(String(nextTotal));
      return next;
    });
  };

  const handleQuickChargePreset = (presetAmount: number) => {
    setEntryType('CHARGE');
    setPickedMenus([]);
    const current = Number(amountInput.replace(/[^\d]/g, '')) || 0;
    setAmountInput(String(current + presetAmount));
    if (!itemsSummaryInput.trim()) {
      setItemsSummaryInput('적립금 충전');
    }
  };

  const handleResetQuickItems = () => {
    setPickedMenus([]);
    setItemsSummaryInput(entryType === 'CHARGE' ? '적립금 충전' : '');
    setTxMemoInput('');
    setAmountInput('');
  };

  const handleAddRowToStaging = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!selectedStudent) {
      onNotify('warning', '먼저 거래를 기록할 학생을 선택해 주세요.');
      setDropdownOpen(true);
      studentSearchInputRef.current?.focus();
      return;
    }

    const numericAmount = Math.round(
      Math.abs(Number(amountInput.replace(/[^\d]/g, '')) || 0)
    );
    if (numericAmount <= 0) {
      onNotify('warning', '금액은 0원보다 크게 입력해 주세요.');
      return;
    }

    const baseSummary =
      itemsSummaryInput.trim() || (entryType === 'CHARGE' ? '적립금 충전' : '간식 이용');
    const finalSummary = appendTxMemo(baseSummary, txMemoInput);

    const newRow: StagingTxRow = {
      rowId: makeRowId(),
      student_id: selectedStudent.student_id,
      type: entryType,
      items_summary: finalSummary,
      amount: normalizeSignedAmount(entryType, numericAmount),
    };

    setRows((prev) => [...prev, newRow]);
    setPickedMenus([]);
    setItemsSummaryInput(entryType === 'CHARGE' ? '적립금 충전' : '');
    setTxMemoInput('');
    setAmountInput('');

    if (!keepStudentSelected) {
      setSelectedStudentId('');
      setStudentQuery('');
      studentSearchInputRef.current?.focus();
    }
  };

  const handleRowChangeStudent = (rowId: string, nextStudentId: string) => {
    setRows((prev) =>
      prev.map((row) =>
        row.rowId === rowId ? { ...row, student_id: nextStudentId } : row
      )
    );
  };

  const handleRowToggleType = (rowId: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.rowId !== rowId) return row;
        const nextType: 'USE' | 'CHARGE' = row.type === 'USE' ? 'CHARGE' : 'USE';
        return {
          ...row,
          type: nextType,
          amount: normalizeSignedAmount(nextType, row.amount),
        };
      })
    );
  };

  const handleRowChangeSummary = (rowId: string, nextSummary: string) => {
    setRows((prev) =>
      prev.map((row) =>
        row.rowId === rowId ? { ...row, items_summary: nextSummary } : row
      )
    );
  };

  const handleRowChangeAmount = (rowId: string, rawVal: string) => {
    const cleaned = rawVal.replace(/[^\d]/g, '');
    const absNum = cleaned ? Number(cleaned) : 0;
    setRows((prev) =>
      prev.map((row) =>
        row.rowId === rowId
          ? { ...row, amount: normalizeSignedAmount(row.type, absNum) }
          : row
      )
    );
  };

  const handleRemoveRow = (rowId: string) => {
    setRows((prev) => prev.filter((row) => row.rowId !== rowId));
  };

  const handleClearAllRows = () => {
    setRows([]);
  };

  const handleSubmitBatch = () => {
    if (rows.length === 0) {
      onNotify('warning', '일괄 반영할 거래 내역을 먼저 검수 표에 추가해 주세요.');
      return;
    }

    if (summaryStats.missingStudentCount > 0) {
      onNotify(
        'warning',
        `학생이 선택되지 않은 행이 ${summaryStats.missingStudentCount}건 있습니다. 학생을 지정한 뒤 반영해 주세요.`
      );
      return;
    }

    if (summaryStats.zeroAmountCount > 0) {
      onNotify(
        'warning',
        `금액이 0원인 행이 ${summaryStats.zeroAmountCount}건 있습니다. 금액을 확인해 주세요.`
      );
      return;
    }

    const batchItems: BatchTxItem[] = rows.map((row) => ({
      student_id: row.student_id,
      type: row.type,
      items_summary:
        row.items_summary.trim() || (row.type === 'CHARGE' ? '적립금 충전' : '간식 이용'),
      amount: normalizeSignedAmount(row.type, row.amount),
    }));

    onRequestBatchRecordTx(batchItems, () => {
      setRows([]);
      setPickedMenus([]);
      setItemsSummaryInput(entryType === 'CHARGE' ? '적립금 충전' : '');
      setTxMemoInput('');
      setAmountInput('');
    });
  };

  const selectedStudentCurrentRunningBalance = selectedStudent
    ? (finalProjectedBalanceMap.get(selectedStudent.student_id) ?? selectedStudent.balance)
    : null;

  const hasQueuedRowsForSelected =
    selectedStudent !== null && finalProjectedBalanceMap.has(selectedStudent.student_id);

  const parsedInputAmount = Math.round(
    Math.abs(Number(amountInput.replace(/[^\d]/g, '')) || 0)
  );

  return (
    <div className="space-y-5">
      {/* TOP SECTION: Fast Batch Entry Form */}
      <section className="rounded-2xl border border-[#E5DACB] bg-white p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#2C1E16]">
              임시 장부 일괄 반영
            </h1>
            <p className="mt-1 text-sm text-[#745D4E]">
              바쁜 시간대나 오프라인 중에 종이에 적어둔 차감·충전 내역을 빠르게 쌓아 한 번에 원장에 반영합니다.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-[#745D4E]">
            <span>등록 학생 {students.length}명</span>
            <span aria-hidden="true">·</span>
            <span>판매 메뉴 {availableMenus.length}종</span>
          </div>
        </div>

        <form onSubmit={handleAddRowToStaging} className="mt-5 space-y-4">
          {/* Row 1: Student Searchable Dropdown + Type Toggle */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* (1) Searchable Student Dropdown (Chosung / Name / Phone Last 4) */}
            <div className="lg:col-span-7" ref={dropdownRef}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label
                  htmlFor="batch-student-search"
                  className="text-xs font-bold text-[#5A4538]"
                >
                  1. 학생 선택 (이름·초성·뒷4자리 검색)
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-[#745D4E]">
                  <input
                    type="checkbox"
                    checked={keepStudentSelected}
                    onChange={(e) => setKeepStudentSelected(e.target.checked)}
                    className="h-4 w-4 rounded border-[#C9B7A0] accent-[#B85D19]"
                  />
                  <span>추가 후 같은 학생 유지</span>
                </label>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#8D7665]" />
                <input
                  id="batch-student-search"
                  ref={studentSearchInputRef}
                  type="text"
                  value={studentQuery}
                  onFocus={() => setDropdownOpen(true)}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStudentQuery(val);
                    setSelectedStudentId('');
                    setDropdownOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setDropdownOpen(false);
                    } else if (e.key === 'Enter' && dropdownOpen && !selectedStudentId) {
                      if (filteredStudents.length > 0) {
                        e.preventDefault();
                        handleSelectStudentFromDropdown(filteredStudents[0]);
                      }
                    }
                  }}
                  placeholder="학생 이름 또는 초성(예: ㄱㅁㅅ), 번호 뒷4자리 입력"
                  autoComplete="off"
                  className={`min-h-[48px] w-full rounded-xl border pr-16 pl-10 text-sm font-semibold text-[#2C1E16] placeholder:font-normal placeholder:text-[#9D8978] focus:outline-none ${
                    selectedStudent
                      ? 'border-[#B85D19] bg-[#FDF9F3]'
                      : 'border-[#DECDB8] bg-[#FAF6F0] focus:border-[#B85D19] focus:bg-white'
                  }`}
                />

                <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
                  {(studentQuery || selectedStudentId) && (
                    <button
                      type="button"
                      onClick={handleClearSelectedStudent}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-[#745D4E] hover:bg-[#EFE6DA]"
                      aria-label="선택 초기화"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDropdownOpen((prev) => !prev)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[#745D4E] hover:bg-[#EFE6DA]"
                    aria-label="학생 목록 열기"
                  >
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        dropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                </div>

                {/* Dropdown List */}
                {dropdownOpen && (
                  <div className="absolute z-30 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl border border-[#DECDB8] bg-white shadow-xl">
                    {filteredStudents.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-[#8D7665]">
                        {students.length === 0
                          ? '등록된 학생이 없습니다. 먼저 시트를 동기화하거나 학생을 등록해 주세요.'
                          : `'${studentQuery}'에 해당하는 학생이 없습니다.`}
                      </div>
                    ) : (
                      <ul className="divide-y divide-[#F1E8DC]">
                        {filteredStudents.map((st) => {
                          const isPicked = st.student_id === selectedStudentId;
                          const projected = finalProjectedBalanceMap.get(st.student_id);
                          const displayBalance = projected ?? st.balance;
                          return (
                            <li key={st.student_id}>
                              <button
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleSelectStudentFromDropdown(st);
                                }}
                                className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${
                                  isPicked
                                    ? 'bg-[#FDF3E7]'
                                    : 'bg-white hover:bg-[#FAF6F0]'
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="truncate text-sm font-bold text-[#2C1E16]">
                                      {st.name}
                                    </span>
                                    {st.info && (
                                      <span className="truncate text-xs font-medium text-[#745D4E]">
                                        {st.info}
                                      </span>
                                    )}
                                  </div>
                                  <div className="font-num mt-0.5 text-xs text-[#8D7665]">
                                    뒷자리 {getPhoneLast4(st.parent_phone)}
                                    {projected !== undefined && (
                                      <span className="ml-2 font-sans font-semibold text-[#B85D19]">
                                        · 검수표 반영 예정
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="shrink-0 text-right">
                                  <div
                                    className={`font-num text-sm font-bold ${
                                      displayBalance < 0
                                        ? 'text-[#C0302B]'
                                        : displayBalance <= lowBalanceLimit
                                          ? 'text-[#D9531E]'
                                          : 'text-[#2C1E16]'
                                    }`}
                                  >
                                    {formatWon(displayBalance)}
                                  </div>
                                  {projected !== undefined && (
                                    <div className="font-num text-xs text-[#8D7665]">
                                      현재 {formatWon(st.balance)}
                                    </div>
                                  )}
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* Selected Student Balance Inline Readout */}
              {selectedStudent && selectedStudentCurrentRunningBalance !== null && (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#5A4538]">
                  <span className="inline-flex items-center gap-1 font-bold text-[#B85D19]">
                    <UserCheck className="h-3.5 w-3.5" />
                    {selectedStudent.name}
                    {selectedStudent.info ? ` (${selectedStudent.info})` : ''}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-num font-semibold">
                    현재 잔액 {formatWon(selectedStudent.balance)}
                  </span>
                  {hasQueuedRowsForSelected && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-num font-bold text-[#B85D19]">
                        검수표 누적 잔액 {formatWon(selectedStudentCurrentRunningBalance)}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* (2) Transaction Type Segmented Selector */}
            <div className="lg:col-span-5">
              <div className="mb-1.5 text-xs font-bold text-[#5A4538]">2. 거래 구분</div>
              <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-[#F3ECE1] p-1">
                <button
                  type="button"
                  onClick={() => handleChangeEntryType('USE')}
                  className={`min-h-[42px] rounded-lg px-3 py-2 text-sm font-bold transition-colors whitespace-nowrap ${
                    entryType === 'USE'
                      ? 'bg-white text-[#C0302B] shadow-xs'
                      : 'text-[#6E5849] hover:text-[#2C1E16]'
                  }`}
                >
                  간식 차감 (-)
                </button>
                <button
                  type="button"
                  onClick={() => handleChangeEntryType('CHARGE')}
                  className={`min-h-[42px] rounded-lg px-3 py-2 text-sm font-bold transition-colors whitespace-nowrap ${
                    entryType === 'CHARGE'
                      ? 'bg-white text-[#1E7A4C] shadow-xs'
                      : 'text-[#6E5849] hover:text-[#2C1E16]'
                  }`}
                >
                  적립 충전 (+)
                </button>
              </div>
            </div>
          </div>

          {/* Row 2: Quick Menu Buttons (USE) or Charge Presets (CHARGE) */}
          <div className="border-t border-[#EFE6DA] pt-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#5A4538]">
                {entryType === 'USE'
                  ? '3. 메뉴 빠른 선택 (누를 때마다 품목명·금액 자동 누적)'
                  : '3. 빠른 충전 금액 선택 (누를 때마다 합산)'}
              </span>
              {(pickedMenus.length > 0 || itemsSummaryInput || txMemoInput || amountInput) && (
                <button
                  type="button"
                  onClick={handleResetQuickItems}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#8D7665] hover:text-[#2C1E16]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>입력 초기화</span>
                </button>
              )}
            </div>

            {entryType === 'USE' ? (
              availableMenus.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#DFD3C3] bg-[#FAF6F0] px-4 py-3 text-xs text-[#745D4E]">
                  등록된 판매 메뉴가 없습니다. 아래 품목명과 금액 칸에 직접 입력해 주세요.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availableMenus.map((menu) => {
                    const qty = pickedMenuQtyMap.get(menu.menu_id) || 0;
                    return (
                      <button
                        key={menu.menu_id}
                        type="button"
                        onClick={() => handleQuickPickMenu(menu)}
                        disabled={busy}
                        className={`inline-flex min-h-[42px] items-center gap-2 rounded-xl border px-3.5 py-2 text-left text-sm font-bold leading-snug transition-all active:scale-[0.98] whitespace-normal break-keep disabled:opacity-50 ${
                          qty > 0
                            ? 'border-[#B85D19] bg-[#FDF3E7] text-[#2C1E16]'
                            : 'border-[#E5DACB] bg-[#FAF6F0] text-[#2C1E16] hover:border-[#C9B7A0] hover:bg-[#F3ECE1]'
                        }`}
                      >
                        <span>{menu.name}</span>
                        <span className="font-num text-xs font-semibold text-[#745D4E]">
                          {menu.price.toLocaleString('ko-KR')}원
                        </span>
                        {qty > 0 && (
                          <span className="font-num rounded-md bg-[#B85D19] px-1.5 py-0.5 text-xs font-bold text-white">
                            {qty}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )
            ) : (
              <div className="flex flex-wrap gap-2">
                {CHARGE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleQuickChargePreset(preset)}
                    disabled={busy}
                    className="font-num inline-flex min-h-[42px] items-center rounded-xl border border-[#B7DFC9] bg-[#ECF7F1] px-4 py-2 text-sm font-bold text-[#145334] transition-colors hover:bg-[#DCF1E5] active:scale-[0.98] whitespace-nowrap disabled:opacity-50"
                  >
                    +{preset.toLocaleString('ko-KR')}원
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Row 3: Direct Item Summary + Optional Orderer Memo + Amount + Add Button */}
          <div className="space-y-3 pt-1">
            {ordererQuickOptions.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[#FAF6F0] px-3.5 py-2.5">
                <span className="text-xs font-bold text-[#6E5849]">
                  주문자 빠른 선택:
                </span>
                {ordererQuickOptions.map((option) => {
                  const isActive = txMemoInput.trim() === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => handleToggleQuickOrderer(option)}
                      disabled={busy}
                      className={`min-h-[38px] rounded-xl border px-3.5 py-1.5 text-sm font-bold transition-colors active:scale-[0.98] disabled:opacity-50 ${
                        isActive
                          ? 'border-[#B85D19] bg-[#B85D19] text-white'
                          : 'border-[#DECDB8] bg-white text-[#4A372B] hover:border-[#B85D19] hover:bg-[#FDF3E7]'
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
              <div className="md:col-span-4">
                <label
                  htmlFor="batch-items-summary"
                  className="mb-1.5 block text-xs font-bold text-[#5A4538]"
                >
                  품목명 (직접 입력·수정 가능)
                </label>
                <input
                  id="batch-items-summary"
                  type="text"
                  value={itemsSummaryInput}
                  onChange={(e) => setItemsSummaryInput(e.target.value)}
                  placeholder={
                    entryType === 'CHARGE'
                      ? '예: 적립금 충전'
                      : '예: 찹쌀꽈배기 2개, 슬러시 1개'
                  }
                  className="min-h-[48px] w-full rounded-xl border border-[#DECDB8] bg-[#FAF6F0] px-3.5 text-sm font-semibold text-[#2C1E16] placeholder:font-normal placeholder:text-[#9D8978] focus:border-[#B85D19] focus:bg-white focus:outline-none"
                />
              </div>

              <div className="md:col-span-3">
                <label
                  htmlFor="batch-tx-memo"
                  className="mb-1.5 block text-xs font-bold text-[#5A4538]"
                >
                  메모 (선택 · 주문자 등)
                </label>
                <div className="relative">
                  <input
                    id="batch-tx-memo"
                    type="text"
                    value={txMemoInput}
                    onChange={(e) => setTxMemoInput(e.target.value)}
                    placeholder="예: 서영, 보호자"
                    className="min-h-[48px] w-full rounded-xl border border-[#DECDB8] bg-[#FAF6F0] pr-9 pl-3.5 text-sm font-medium text-[#2C1E16] placeholder:font-normal placeholder:text-[#9D8978] focus:border-[#B85D19] focus:bg-white focus:outline-none"
                  />
                  {txMemoInput && (
                    <button
                      type="button"
                      onClick={() => setTxMemoInput('')}
                      className="absolute top-1/2 right-2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[#745D4E] hover:bg-[#EFE6DA]"
                      aria-label="메모 지우기"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="md:col-span-3">
                <label
                  htmlFor="batch-amount-input"
                  className="mb-1.5 block text-xs font-bold text-[#5A4538]"
                >
                  {entryType === 'CHARGE' ? '충전 금액 (원)' : '차감 금액 (원)'}
                </label>
                <div className="relative">
                  <span
                    className={`font-num pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-base font-bold ${
                      entryType === 'CHARGE' ? 'text-[#1E7A4C]' : 'text-[#C0302B]'
                    }`}
                  >
                    {entryType === 'CHARGE' ? '+' : '-'}
                  </span>
                  <input
                    id="batch-amount-input"
                    type="text"
                    inputMode="numeric"
                    value={
                      parsedInputAmount > 0 ? parsedInputAmount.toLocaleString('ko-KR') : ''
                    }
                    onChange={(e) => {
                      const digits = e.target.value.replace(/[^\d]/g, '');
                      setAmountInput(digits);
                    }}
                    placeholder="0"
                    className="font-num min-h-[48px] w-full rounded-xl border border-[#DECDB8] bg-[#FAF6F0] pr-9 pl-8 text-right text-base font-bold text-[#2C1E16] placeholder:text-[#9D8978] focus:border-[#B85D19] focus:bg-white focus:outline-none"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-sm font-semibold text-[#745D4E]">
                    원
                  </span>
                </div>
              </div>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-xl bg-[#2C1E16] px-4 py-2.5 text-sm font-bold leading-snug text-white transition-colors hover:bg-[#433024] active:scale-[0.98] whitespace-normal break-keep disabled:opacity-50"
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  <span>검수 표에 추가</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      </section>

      {/* BOTTOM SECTION: Transaction Staging Review Table */}
      <section className="overflow-hidden rounded-2xl border border-[#E5DACB] bg-white">
        {/* Table Header Bar */}
        <div className="flex flex-col justify-between gap-3 border-b border-[#EFE6DA] px-5 py-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-[#B85D19]" />
              <h2 className="text-base font-bold text-[#2C1E16]">
                거래 매칭 검수 테이블{' '}
                <span className="font-num text-sm font-semibold text-[#8D7665]">
                  ({rows.length}건)
                </span>
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-[#745D4E]">
              같은 학생의 거래가 여러 줄이면 위에서 아래로 누적 계산해 변경 전·후 잔액을 실시간으로 표시합니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
            <span className="font-num text-[#C0302B]">
              차감 합계 -{summaryStats.totalUseAbs.toLocaleString('ko-KR')}원
            </span>
            <span className="text-[#D9CBB8]" aria-hidden="true">
              |
            </span>
            <span className="font-num text-[#1E7A4C]">
              충전 합계 +{summaryStats.totalCharge.toLocaleString('ko-KR')}원
            </span>
            {rows.length > 0 && (
              <button
                type="button"
                onClick={handleClearAllRows}
                disabled={busy}
                className="ml-1 inline-flex min-h-[34px] items-center rounded-lg border border-[#E5DACB] bg-[#FAF6F0] px-3 py-1 text-xs font-semibold text-[#6E5849] hover:border-[#F5C2C0] hover:bg-[#FDECEC] hover:text-[#C0302B] disabled:opacity-50"
              >
                전체 비우기
              </button>
            )}
          </div>
        </div>

        {/* Table Body / Empty State */}
        {rows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#FAF6F0] text-[#B85D19]">
              <ClipboardList className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-bold text-[#2C1E16]">
              아직 검수 표에 추가된 임시 거래가 없습니다
            </p>
            <p className="mt-1 text-xs text-[#8D7665]">
              위 입력 폼에서 학생을 찾고 메뉴 버튼이나 금액을 입력해 [검수 표에 추가]를 눌러 주세요.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#EFE6DA] bg-[#FAF6F0] text-left text-xs font-bold text-[#6E5849]">
                  <th className="w-12 py-3 pr-2 pl-5 text-center">#</th>
                  <th className="w-56 px-3 py-3">학생</th>
                  <th className="w-28 px-3 py-3">구분</th>
                  <th className="px-3 py-3">품목명 / 메모</th>
                  <th className="w-36 px-3 py-3 text-right">금액</th>
                  <th className="w-60 px-3 py-3 text-right">변경 전 → 변경 후 잔액</th>
                  <th className="w-14 py-3 pr-5 pl-2 text-center">삭제</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1E8DC]">
                {rows.map((row, idx) => {
                  const preview = rowPreviews.get(row.rowId);
                  const isCharge = row.type === 'CHARGE';
                  const hasStudent = Boolean(preview?.student);
                  const isZero = row.amount === 0;
                  const isDeficit = hasStudent && preview!.afterBalance < 0;
                  const isLowAfter =
                    hasStudent &&
                    preview!.afterBalance >= 0 &&
                    preview!.afterBalance <= lowBalanceLimit;

                  return (
                    <tr
                      key={row.rowId}
                      className={`transition-colors ${
                        !hasStudent || isZero
                          ? 'bg-[#FFF5F5]'
                          : 'bg-white hover:bg-[#FCF9F4]'
                      }`}
                    >
                      {/* Index */}
                      <td className="font-num py-3 pr-2 pl-5 text-center text-xs font-bold text-[#8D7665]">
                        {idx + 1}
                      </td>

                      {/* Student Select */}
                      <td className="px-3 py-2.5">
                        <select
                          value={row.student_id}
                          onChange={(e) => handleRowChangeStudent(row.rowId, e.target.value)}
                          disabled={busy}
                          aria-label={`${idx + 1}번 행 학생 선택`}
                          className={`min-h-[40px] w-full rounded-lg border px-2.5 text-sm font-semibold text-[#2C1E16] focus:outline-none ${
                            hasStudent
                              ? 'border-[#E5DACB] bg-[#FAF6F0] focus:border-[#B85D19] focus:bg-white'
                              : 'border-[#E89B98] bg-white text-[#C0302B]'
                          }`}
                        >
                          <option value="">-- 학생 선택 --</option>
                          {sortedStudents.map((st) => (
                            <option key={st.student_id} value={st.student_id}>
                              {st.name}
                              {st.info ? ` (${st.info})` : ''} · {formatWon(st.balance)}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Type Toggle */}
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => handleRowToggleType(row.rowId)}
                          disabled={busy}
                          className={`min-h-[40px] w-full rounded-lg border px-2.5 text-xs font-bold transition-colors whitespace-nowrap ${
                            isCharge
                              ? 'border-[#B7DFC9] bg-[#ECF7F1] text-[#145334] hover:bg-[#DCF1E5]'
                              : 'border-[#F3D19C] bg-[#FFF8EB] text-[#9A4B11] hover:bg-[#FCECD0]'
                          }`}
                          title="클릭하여 차감/충전 전환"
                        >
                          {isCharge ? '적립 충전 (+)' : '간식 차감 (-)'}
                        </button>
                      </td>

                      {/* Items Summary */}
                      <td className="px-3 py-2.5">
                        <input
                          type="text"
                          value={row.items_summary}
                          onChange={(e) => handleRowChangeSummary(row.rowId, e.target.value)}
                          disabled={busy}
                          placeholder={isCharge ? '적립금 충전' : '품목명 입력'}
                          className="min-h-[40px] w-full rounded-lg border border-[#E5DACB] bg-[#FAF6F0] px-3 text-sm font-medium text-[#2C1E16] focus:border-[#B85D19] focus:bg-white focus:outline-none"
                        />
                      </td>

                      {/* Amount Input */}
                      <td className="px-3 py-2.5">
                        <div className="relative">
                          <span
                            className={`font-num pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs font-bold ${
                              isCharge ? 'text-[#1E7A4C]' : 'text-[#C0302B]'
                            }`}
                          >
                            {isCharge ? '+' : '-'}
                          </span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={
                              Math.abs(row.amount) > 0
                                ? Math.abs(row.amount).toLocaleString('ko-KR')
                                : ''
                            }
                            onChange={(e) => handleRowChangeAmount(row.rowId, e.target.value)}
                            disabled={busy}
                            placeholder="0"
                            aria-label={`${idx + 1}번 행 금액`}
                            className={`font-num min-h-[40px] w-full rounded-lg border pr-7 pl-6 text-right text-sm font-bold focus:outline-none ${
                              isZero
                                ? 'border-[#E89B98] bg-white text-[#C0302B]'
                                : 'border-[#E5DACB] bg-[#FAF6F0] text-[#2C1E16] focus:border-[#B85D19] focus:bg-white'
                            }`}
                          />
                          <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs font-medium text-[#745D4E]">
                            원
                          </span>
                        </div>
                      </td>

                      {/* Cumulative Balance Preview */}
                      <td className="px-3 py-2.5 text-right">
                        {!hasStudent || !preview ? (
                          <span className="text-xs font-bold text-[#C0302B]">
                            학생 미지정
                          </span>
                        ) : (
                          <div>
                            <div className="font-num text-sm font-bold whitespace-nowrap">
                              <span className="text-[#745D4E]">
                                {formatWon(preview.beforeBalance)}
                              </span>
                              <span className="mx-1.5 text-[#A4907E]">→</span>
                              <span
                                className={
                                  isDeficit
                                    ? 'text-[#C0302B]'
                                    : isLowAfter
                                      ? 'text-[#D9531E]'
                                      : 'text-[#2C1E16]'
                                }
                              >
                                {formatWon(preview.afterBalance)}
                              </span>
                            </div>
                            <div className="mt-0.5 flex items-center justify-end gap-1.5 text-xs">
                              {preview.occurrenceIndex > 1 && (
                                <span className="font-semibold text-[#B85D19]">
                                  누적 {preview.occurrenceIndex}건째
                                </span>
                              )}
                              {isDeficit && (
                                <span className="font-bold text-[#C0302B]">미수금</span>
                              )}
                              {isLowAfter && (
                                <span className="font-semibold text-[#D9531E]">잔액 부족</span>
                              )}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Delete Row */}
                      <td className="py-2.5 pr-5 pl-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.rowId)}
                          disabled={busy}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#8D7665] transition-colors hover:bg-[#FDECEC] hover:text-[#C0302B] disabled:opacity-40"
                          aria-label={`${idx + 1}번 행 삭제`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Action Bar */}
        <div className="flex flex-col justify-between gap-3 border-t border-[#EFE6DA] bg-[#FAF6F0] px-5 py-4 sm:flex-row sm:items-center">
          <div className="text-xs font-medium text-[#6E5849]">
            {rows.length === 0 ? (
              <span>검수 표에 거래를 추가하면 한 번에 Google 시트 원장에 반영할 수 있습니다.</span>
            ) : !summaryStats.canSubmit ? (
              <span className="inline-flex items-center gap-1.5 font-bold text-[#C0302B]">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  {summaryStats.missingStudentCount > 0
                    ? `학생이 지정되지 않은 행 ${summaryStats.missingStudentCount}건을 확인해 주세요.`
                    : `금액이 0원인 행 ${summaryStats.zeroAmountCount}건을 수정해 주세요.`}
                </span>
              </span>
            ) : (
              <span>
                총 <strong className="font-num text-[#2C1E16]">{rows.length}건</strong> 반영 준비 완료
                (차감{' '}
                <strong className="font-num text-[#C0302B]">
                  -{summaryStats.totalUseAbs.toLocaleString('ko-KR')}원
                </strong>
                , 충전{' '}
                <strong className="font-num text-[#1E7A4C]">
                  +{summaryStats.totalCharge.toLocaleString('ko-KR')}원
                </strong>
                )
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleSubmitBatch}
            disabled={busy || !summaryStats.canSubmit}
            className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-xl bg-[#B85D19] px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#9A4B11] active:scale-[0.98] whitespace-nowrap disabled:opacity-40"
          >
            <CheckCircle2 className="h-5 w-5" />
            <span>
              {rows.length > 0
                ? `전체 일괄 원장 반영 (${rows.length}건)`
                : '전체 일괄 원장 반영'}
            </span>
          </button>
        </div>
      </section>
    </div>
  );
};
