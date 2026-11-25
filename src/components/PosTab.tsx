import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Coins,
  Lock,
  Minus,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  UserPlus,
  X,
  RotateCcw,
  CheckCircle2,
  ShoppingBag,
} from 'lucide-react';
import type {
  CartItem,
  KioskDeductionContext,
  LedgerEntry,
  MenuItem,
  StoreSettings,
  Student,
} from '../types';
import {
  formatShortDate,
  formatWon,
  getPhoneLast4,
  matchesStudentQuery,
} from '../utils/koreanSearch';
import { appendTxMemo, extractOrdererQuickOptions } from '../utils/txMemoUtils';

interface PosTabProps {
  students: Student[];
  menus: MenuItem[];
  ledger: LedgerEntry[];
  settings: StoreSettings;
  selectedStudentId: string | null;
  busy: boolean;
  autoKiosk: boolean;
  onToggleAutoKiosk: (val: boolean) => void;
  onSelectStudent: (studentId: string) => void;
  onOpenNewStudent: () => void;
  onOpenEditStudent: (student: Student) => void;
  onOpenCharge: (student: Student, initialMemo?: string) => void;
  onOpenReceipt: (student: Student) => void;
  onOpenKiosk: (student: Student, deduction: KioskDeductionContext | null) => void;
  onConfirmDeduction: (
    student: Student,
    itemsSummary: string,
    totalAmount: number
  ) => Promise<boolean>;
  onRequestVoidTx: (tx: LedgerEntry) => void;
  chargeSuccessTick: number;
}

export const PosTab: React.FC<PosTabProps> = ({
  students,
  menus,
  ledger,
  settings,
  selectedStudentId,
  busy,
  autoKiosk,
  onToggleAutoKiosk,
  onSelectStudent,
  onOpenNewStudent,
  onOpenEditStudent,
  onOpenCharge,
  onOpenReceipt,
  onOpenKiosk,
  onConfirmDeduction,
  onRequestVoidTx,
  chargeSuccessTick,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'low'>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [txMemo, setTxMemo] = useState('');

  useEffect(() => {
    setTxMemo('');
  }, [selectedStudentId, chargeSuccessTick]);

  const lowBalanceLimit = Number(settings.low_balance_limit || 3000);

  const filteredStudents = useMemo(() => {
    return students
      .filter((s) => {
        if (filterMode === 'low' && s.balance > lowBalanceLimit) {
          return false;
        }
        return matchesStudentQuery(s, searchQuery);
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));
  }, [students, filterMode, lowBalanceLimit, searchQuery]);

  const lowBalanceCount = useMemo(
    () => students.filter((s) => s.balance <= lowBalanceLimit).length,
    [students, lowBalanceLimit]
  );

  const selectedStudent = useMemo(
    () => students.find((s) => s.student_id === selectedStudentId) || null,
    [students, selectedStudentId]
  );

  const availableMenus = useMemo(
    () => menus.filter((m) => m.is_available),
    [menus]
  );

  const studentRecentLedger = useMemo(() => {
    if (!selectedStudent) return [];
    return ledger
      .filter((l) => l.student_id === selectedStudent.student_id)
      .sort((a, b) => {
        const tA = new Date(a.timestamp).getTime() || 0;
        const tB = new Date(b.timestamp).getTime() || 0;
        return tB - tA;
      })
      .slice(0, 20);
  }, [ledger, selectedStudent]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.menu.price * item.quantity, 0),
    [cart]
  );

  const cartSummary = useMemo(
    () => cart.map((item) => `${item.menu.name} ${item.quantity}개`).join(', '),
    [cart]
  );

  const cartQuantityMap = useMemo(() => {
    const map = new Map<string, number>();
    cart.forEach((c) => map.set(c.menu.menu_id, c.quantity));
    return map;
  }, [cart]);

  const addMenuToCart = (menu: MenuItem, qtyToAdd = 1) => {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.menu.menu_id === menu.menu_id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + qtyToAdd };
        return updated;
      }
      return [...prev, { menu, quantity: qtyToAdd }];
    });
  };

  const updateCartQuantity = (menuId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.menu.menu_id === menuId
            ? { ...item, quantity: item.quantity + delta }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeCartItem = (menuId: string) => {
    setCart((prev) => prev.filter((item) => item.menu.menu_id !== menuId));
  };

  const clearCart = () => setCart([]);

  const handleSelectStudentCard = (studentId: string) => {
    if (studentId !== selectedStudentId) {
      onSelectStudent(studentId);
    }
  };

  const ordererQuickOptions = useMemo(
    () => (selectedStudent ? extractOrdererQuickOptions(selectedStudent.name) : []),
    [selectedStudent]
  );

  const handleToggleQuickOrderer = (label: string) => {
    setTxMemo((prev) => (prev.trim() === label ? '' : label));
  };

  const handleExecuteDeduction = async () => {
    if (!selectedStudent || cart.length === 0 || cartTotal <= 0) return;
    const summarySnapshot = appendTxMemo(cartSummary, txMemo);
    const totalSnapshot = cartTotal;
    const ok = await onConfirmDeduction(selectedStudent, summarySnapshot, totalSnapshot);
    if (ok) {
      setCart([]);
      setTxMemo('');
      if (autoKiosk) {
        onOpenKiosk(
          {
            ...selectedStudent,
            balance: selectedStudent.balance - totalSnapshot,
          },
          {
            itemsSummary: summarySnapshot,
            deductedAmount: totalSnapshot,
          }
        );
      }
    }
  };

  const projectedBalance = selectedStudent ? selectedStudent.balance - cartTotal : 0;
  const isDeficitAfter = selectedStudent !== null && cartTotal > 0 && projectedBalance < 0;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start">
      {/* LEFT PANEL: Student Search & Selection */}
      <section className="flex flex-col rounded-2xl border border-[#E5DACB] bg-white lg:col-span-4 xl:col-span-4 lg:sticky lg:top-[84px] lg:max-h-[calc(100vh-104px)]">
        {/* Search & New Student Header */}
        <div className="border-b border-[#EFE6DA] p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-[#2C1E16]">
              학생 선택 <span className="font-num text-sm font-semibold text-[#8D7665]">({filteredStudents.length})</span>
            </h2>
            <button
              type="button"
              onClick={onOpenNewStudent}
              disabled={busy}
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-[#B85D19] px-3.5 py-2 text-sm font-bold text-white transition-colors hover:bg-[#9A4B11] active:scale-[0.98] whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <UserPlus className="h-4 w-4" />
              <span>신규 학생 등록</span>
            </button>
          </div>

          {/* Search Input (Name, Chosung, Phone last 4) */}
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-[#8D7665]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="이름, 초성(ㄱㅁㅅ), 번호 뒷4자리"
              className="min-h-[48px] w-full rounded-xl border border-[#DECDB8] bg-[#FAF6F0] pr-10 pl-11 text-base font-medium text-[#2C1E16] placeholder:text-[#9D8978] focus:border-[#B85D19] focus:bg-white focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute top-1/2 right-2.5 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#745D4E] hover:bg-[#EFE6DA]"
                aria-label="검색어 지우기"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filter Segmented Control */}
          <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-xl bg-[#F3ECE1] p-1">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`min-h-[40px] rounded-lg px-2.5 py-1.5 text-sm font-semibold leading-snug transition-colors whitespace-normal break-keep ${
                filterMode === 'all'
                  ? 'bg-white text-[#2C1E16] shadow-xs'
                  : 'text-[#6E5849] hover:text-[#2C1E16]'
              }`}
            >
              전체 학생 ({students.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('low')}
              className={`min-h-[40px] rounded-lg px-2.5 py-1.5 text-sm font-semibold leading-snug transition-colors whitespace-normal break-keep ${
                filterMode === 'low'
                  ? 'bg-white text-[#C0302B] shadow-xs'
                  : 'text-[#6E5849] hover:text-[#2C1E16]'
              }`}
            >
              잔액 부족 ({lowBalanceCount})
            </button>
          </div>
        </div>

        {/* Scrollable Student List */}
        <div className="flex-1 divide-y divide-[#F1E8DC] overflow-y-auto max-h-[420px] lg:max-h-none">
          {filteredStudents.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm font-semibold text-[#6E5849]">
                {students.length === 0
                  ? '등록된 학생이 아직 없습니다.'
                  : '검색 조건에 맞는 학생이 없습니다.'}
              </p>
              <p className="mt-1 text-xs text-[#9A8574]">
                {students.length === 0
                  ? '상단 [신규 학생 등록] 버튼을 누르거나 시트 동기화를 실행해 학생을 불러오세요.'
                  : '초성(예: ㄱㅁㅅ) 또는 보호자 번호 뒷 4자리로 다시 찾아보세요.'}
              </p>
            </div>
          ) : (
            filteredStudents.map((student) => {
              const isSelected = student.student_id === selectedStudentId;
              const isLow = student.balance <= lowBalanceLimit;
              const isNeg = student.balance < 0;
              const hasMemo = Boolean(student.memo && student.memo.trim());

              return (
                <button
                  key={student.student_id}
                  type="button"
                  onClick={() => handleSelectStudentCard(student.student_id)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors ${
                    isSelected
                      ? 'bg-[#FDF3E7]'
                      : 'bg-white hover:bg-[#FAF6F0]'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-base font-bold text-[#2C1E16]">
                        {student.name}
                      </span>
                      {student.info && (
                        <span className="truncate text-xs font-medium text-[#745D4E]">
                          {student.info}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#745D4E]">
                      <span className="font-num">뒷자리 {getPhoneLast4(student.parent_phone)}</span>
                      {isLow && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-bold text-[#C0302B]">
                            {isNeg ? '미수금' : '잔액 부족'}
                          </span>
                        </>
                      )}
                      {hasMemo && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-bold text-[#C2610C]">주의 메모</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div
                      className={`font-num text-lg font-bold ${
                        isNeg
                          ? 'text-[#C0302B]'
                          : isLow
                            ? 'text-[#D9531E]'
                            : 'text-[#2C1E16]'
                      }`}
                    >
                      {formatWon(student.balance)}
                    </div>
                    {isSelected && (
                      <div className="mt-0.5 text-xs font-bold text-[#B85D19]">선택됨</div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </section>

      {/* RIGHT PANEL: Selected Student Register & Ledger */}
      <section className="flex flex-col gap-5 lg:col-span-8 xl:col-span-8">
        {/* Selected Student Register */}
        {!selectedStudent ? (
          <div className="flex min-h-[380px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#D9CBB8] bg-white px-6 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FAF6F0] text-[#B85D19]">
              <ShoppingBag className="h-8 w-8" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-[#2C1E16]">
              왼쪽에서 학생을 선택해 주세요
            </h3>
            <p className="mt-1.5 max-w-md text-sm text-[#745D4E]">
              학생을 선택하면 원터치 메뉴 차감, 적립금 충전, 학부모 정산 영수증 발급 및 학생 확인용 잠금 화면을 바로 사용할 수 있습니다.
            </p>
          </div>
        ) : (
          <>
            {/* Student Header & Action Controls */}
            <div className="rounded-2xl border border-[#E5DACB] bg-white p-5">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                <div>
                  <div className="flex flex-wrap items-baseline gap-2.5">
                    <h2 className="text-2xl font-bold text-[#2C1E16]">{selectedStudent.name}</h2>
                    {selectedStudent.info && (
                      <span className="text-sm font-semibold text-[#745D4E]">
                        {selectedStudent.info}
                      </span>
                    )}
                    {selectedStudent.parent_phone && (
                      <span className="font-num text-sm text-[#8D7665]">
                        · 보호자 {selectedStudent.parent_phone}
                      </span>
                    )}
                  </div>

                  {selectedStudent.memo && (
                    <div className="mt-2.5 inline-flex items-center gap-2 rounded-xl border border-[#F3D19C] bg-[#FFF8EB] px-3.5 py-2 text-sm font-semibold text-[#9A4B11]">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>메모: {selectedStudent.memo}</span>
                    </div>
                  )}
                </div>

                {/* Current Balance Highlight */}
                <div className="text-left md:text-right">
                  <div className="text-xs font-semibold text-[#745D4E]">현재 선불 잔액</div>
                  <div
                    className={`font-num mt-0.5 text-3xl font-bold ${
                      selectedStudent.balance < 0
                        ? 'text-[#C0302B]'
                        : selectedStudent.balance <= lowBalanceLimit
                          ? 'text-[#D9531E]'
                          : 'text-[#2C1E16]'
                    }`}
                  >
                    {formatWon(selectedStudent.balance)}
                  </div>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="mt-4 flex flex-wrap items-center gap-2.5 border-t border-[#EFE6DA] pt-4">
                <button
                  type="button"
                  onClick={() => onOpenCharge(selectedStudent, txMemo)}
                  disabled={busy}
                  className="inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-[#1E7A4C] px-4 py-2 text-sm font-bold leading-snug text-white transition-colors hover:bg-[#16603B] active:scale-[0.98] whitespace-normal break-keep disabled:opacity-50"
                >
                  <Coins className="h-4 w-4 shrink-0" />
                  <span>적립금 충전</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenKiosk(selectedStudent, null)}
                  className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-[#DECDB8] bg-[#FAF6F0] px-4 py-2 text-sm font-bold leading-snug text-[#2C1E16] transition-colors hover:bg-[#F3ECE1] active:scale-[0.98] whitespace-normal break-keep"
                >
                  <Lock className="h-4 w-4 shrink-0 text-[#B85D19]" />
                  <span>학생 보여주기</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenReceipt(selectedStudent)}
                  className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-[#DECDB8] bg-[#FAF6F0] px-4 py-2 text-sm font-bold leading-snug text-[#2C1E16] transition-colors hover:bg-[#F3ECE1] active:scale-[0.98] whitespace-normal break-keep"
                >
                  <ReceiptText className="h-4 w-4 shrink-0 text-[#B85D19]" />
                  <span>정산 영수증</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenEditStudent(selectedStudent)}
                  disabled={busy}
                  className="inline-flex min-h-[46px] items-center gap-1.5 rounded-xl border border-[#DECDB8] bg-white px-4 py-2 text-sm font-semibold leading-snug text-[#5A4538] transition-colors hover:bg-[#FAF6F0] whitespace-normal break-keep disabled:opacity-50"
                >
                  <Pencil className="h-4 w-4 shrink-0" />
                  <span>정보 수정</span>
                </button>
              </div>
            </div>

            {/* One-Touch Menu Grid */}
            <div className="rounded-2xl border border-[#E5DACB] bg-white p-5">
              <div className="mb-3.5 flex items-center justify-between">
                <h3 className="text-base font-bold text-[#2C1E16]">원터치 메뉴 선택</h3>
                <span className="text-xs font-medium text-[#745D4E]">
                  버튼을 누를 때마다 수량이 +1 됩니다
                </span>
              </div>

              {availableMenus.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#DFD3C3] bg-[#FAF6F0] py-10 text-center text-sm text-[#745D4E]">
                  판매 중인 메뉴가 없습니다. 상단 [메뉴·원장] 탭에서 메뉴를 등록해 주세요.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {availableMenus.map((menu) => {
                    const inCartQty = cartQuantityMap.get(menu.menu_id) || 0;
                    return (
                      <button
                        key={menu.menu_id}
                        type="button"
                        onClick={() => addMenuToCart(menu, 1)}
                        disabled={busy}
                        className={`relative flex min-h-[82px] flex-col items-start justify-between rounded-xl border p-3.5 text-left transition-all active:scale-[0.97] disabled:opacity-50 ${
                          inCartQty > 0
                            ? 'border-[#B85D19] bg-[#FDF3E7] ring-1 ring-[#B85D19]/30'
                            : 'border-[#E5DACB] bg-[#FAF6F0] hover:border-[#C9B7A0] hover:bg-[#F5EFE6]'
                        }`}
                      >
                        <div className="flex w-full items-start justify-between gap-2">
                          <span className="text-base font-bold leading-snug text-[#2C1E16] whitespace-normal break-keep">
                            {menu.name}
                          </span>
                          {inCartQty > 0 && (
                            <span className="font-num flex h-6 min-w-[24px] shrink-0 items-center justify-center rounded-md bg-[#B85D19] px-1.5 text-xs font-bold text-white">
                              {inCartQty}
                            </span>
                          )}
                        </div>
                        <span className="font-num mt-2 text-sm font-bold text-[#6E5849]">
                          {menu.price.toLocaleString('ko-KR')}원
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Cart Items & Poka-Yoke Confirmation Bar */}
              <div className="mt-5 border-t border-[#EFE6DA] pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[#2C1E16]">
                    선택한 메뉴 장바구니
                  </span>
                  {cart.length > 0 && (
                    <button
                      type="button"
                      onClick={clearCart}
                      className="text-xs font-semibold text-[#8D7665] hover:text-[#C0302B]"
                    >
                      전체 비우기
                    </button>
                  )}
                </div>

                {cart.length === 0 ? (
                  <p className="mt-2 text-sm text-[#8D7665]">
                    위 메뉴 버튼을 눌러 차감할 간식을 담아주세요.
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {cart.map((item) => (
                      <div
                        key={item.menu.menu_id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#FAF6F0] px-3.5 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-bold text-[#2C1E16]">
                            {item.menu.name}
                          </span>
                          <span className="font-num ml-2 text-xs text-[#745D4E]">
                            ({item.menu.price.toLocaleString('ko-KR')}원)
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(item.menu.menu_id, -1)}
                            className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#DECDB8] bg-white text-[#2C1E16] hover:bg-[#F3ECE1]"
                            aria-label="수량 줄이기"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="font-num w-8 text-center text-base font-bold text-[#2C1E16]">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(item.menu.menu_id, 1)}
                            className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#DECDB8] bg-white text-[#2C1E16] hover:bg-[#F3ECE1]"
                            aria-label="수량 늘리기"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                          <span className="font-num w-20 text-right text-sm font-bold text-[#2C1E16]">
                            {(item.menu.price * item.quantity).toLocaleString('ko-KR')}원
                          </span>
                          <button
                            type="button"
                            onClick={() => removeCartItem(item.menu.menu_id)}
                            className="flex h-10 w-10 items-center justify-center rounded-lg text-[#8D7665] hover:bg-[#FDECEC] hover:text-[#C0302B]"
                            aria-label="삭제"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Poka-Yoke Deduction Summary Bar */}
                <div
                  className={`mt-4 rounded-2xl border p-4 ${
                    isDeficitAfter
                      ? 'border-[#E89B98] bg-[#FFF5F5]'
                      : 'border-[#E5DACB] bg-[#FAF6F0]'
                  }`}
                >
                  {isDeficitAfter && (
                    <div className="mb-3 flex items-center gap-2 rounded-xl bg-[#FDECEC] px-3.5 py-2.5 text-sm font-bold text-[#C0302B]">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>⚠️ 잔액 부족 (미수금 발생) — 차감 확정은 가능합니다.</span>
                    </div>
                  )}

                  {/* Optional Transaction Memo & Sibling/Shared Ledger Quick Orderer Chips */}
                  <div className="mb-4 border-b border-[#E5DACB]/80 pb-4">
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                      <label
                        htmlFor="pos-tx-memo"
                        className="text-xs font-bold text-[#5A4538]"
                      >
                        거래 메모 (선택 · 예: 주문자 이름)
                      </label>
                      {txMemo.trim() && cartSummary && (
                        <span className="text-xs font-medium text-[#745D4E]">
                          저장 예시: {appendTxMemo(cartSummary, txMemo)}
                        </span>
                      )}
                    </div>

                    {ordererQuickOptions.length > 0 && (
                      <div className="mb-2.5 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-[#745D4E]">
                          주문자 빠른 선택:
                        </span>
                        {ordererQuickOptions.map((option) => {
                          const isActive = txMemo.trim() === option;
                          return (
                            <button
                              key={option}
                              type="button"
                              onClick={() => handleToggleQuickOrderer(option)}
                              disabled={busy}
                              className={`min-h-[40px] rounded-xl border px-3.5 py-1.5 text-sm font-bold transition-colors active:scale-[0.98] disabled:opacity-50 ${
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

                    <div className="relative">
                      <input
                        id="pos-tx-memo"
                        type="text"
                        value={txMemo}
                        onChange={(e) => setTxMemo(e.target.value)}
                        placeholder="예: 서영, 보호자, 현금 결제 등 (입력 시 거래 내역 뒤에 자동 표시)"
                        disabled={busy}
                        className="min-h-[46px] w-full rounded-xl border border-[#DECDB8] bg-white pr-10 pl-3.5 text-sm font-medium text-[#2C1E16] placeholder:text-[#9D8978] focus:border-[#B85D19] focus:outline-none disabled:opacity-50"
                      />
                      {txMemo && (
                        <button
                          type="button"
                          onClick={() => setTxMemo('')}
                          className="absolute top-1/2 right-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#745D4E] hover:bg-[#F3ECE1]"
                          aria-label="메모 지우기"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <div>
                        <div className="text-xs font-medium text-[#745D4E]">현재 잔액</div>
                        <div className="font-num text-lg font-bold text-[#5A4538]">
                          {formatWon(selectedStudent.balance)}
                        </div>
                      </div>

                      <div className="font-num text-sm font-bold text-[#C0302B]">
                        -{cartTotal.toLocaleString('ko-KR')}원 →
                      </div>

                      <div>
                        <div className="text-xs font-medium text-[#745D4E]">차감 후 예상 잔액</div>
                        <div
                          className={`font-num text-2xl font-bold ${
                            isDeficitAfter ? 'text-[#C0302B]' : 'text-[#2C1E16]'
                          }`}
                        >
                          {formatWon(projectedBalance)}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 sm:justify-end">
                      <button
                        type="button"
                        onClick={() => onOpenCharge(selectedStudent, txMemo)}
                        disabled={busy}
                        className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-xl border border-[#1E7A4C] bg-white px-5 py-3 text-base font-bold text-[#1E7A4C] transition-colors hover:bg-[#ECF7F1] active:scale-[0.98] whitespace-normal break-keep disabled:opacity-40"
                      >
                        <Coins className="h-5 w-5 shrink-0" />
                        <span>충전하기</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleExecuteDeduction()}
                        disabled={busy || cart.length === 0 || cartTotal <= 0}
                        className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-xl bg-[#B85D19] px-6 py-3 text-base font-bold text-white transition-colors hover:bg-[#9A4B11] active:scale-[0.98] whitespace-normal break-keep disabled:opacity-40"
                      >
                        <CheckCircle2 className="h-5 w-5 shrink-0" />
                        <span>
                          {busy
                            ? '처리 중...'
                            : cartTotal > 0
                              ? `${cartTotal.toLocaleString('ko-KR')}원 차감 확정`
                              : '차감 확정'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Auto-Kiosk Toggle */}
                  <label className="mt-3.5 flex cursor-pointer items-center gap-2.5 border-t border-[#E5DACB]/70 pt-3 text-sm font-medium text-[#4A372B]">
                    <input
                      type="checkbox"
                      checked={autoKiosk}
                      onChange={(e) => onToggleAutoKiosk(e.target.checked)}
                      className="h-5 w-5 rounded border-[#C9B7A0] accent-[#B85D19]"
                    />
                    <span>차감 후 자동으로 학생 확인용 잠금 화면 띄우기</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Student Recent Transactions */}
            <div className="rounded-2xl border border-[#E5DACB] bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-bold text-[#2C1E16]">
                  {selectedStudent.name} 학생 최근 거래 내역
                </h3>
                <span className="text-xs font-medium text-[#745D4E]">최근 20건</span>
              </div>

              {studentRecentLedger.length === 0 ? (
                <div className="rounded-xl bg-[#FAF6F0] py-8 text-center text-sm text-[#8D7665]">
                  아직 기록된 거래 내역이 없습니다.
                </div>
              ) : (
                <div className="divide-y divide-[#F1E8DC]">
                  {studentRecentLedger.map((tx) => {
                    const isCharge = String(tx.type).toUpperCase() === 'CHARGE';
                    const isActive = String(tx.status).toUpperCase() === 'ACTIVE';

                    return (
                      <div
                        key={tx.tx_id}
                        className={`flex flex-wrap items-center justify-between gap-3 py-3 ${
                          !isActive ? 'opacity-50' : ''
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`text-xs font-bold ${
                                !isActive
                                  ? 'text-[#8D7665]'
                                  : isCharge
                                    ? 'text-[#1E7A4C]'
                                    : 'text-[#B85D19]'
                              }`}
                            >
                              {!isActive ? '[취소됨]' : isCharge ? '[충전]' : '[차감]'}
                            </span>
                            <span
                              className={`truncate text-sm font-semibold text-[#2C1E16] ${
                                !isActive ? 'line-through' : ''
                              }`}
                            >
                              {tx.items_summary || (isCharge ? '적립금 충전' : '간식 차감')}
                            </span>
                          </div>
                          <div className="font-num mt-0.5 text-xs text-[#8D7665]">
                            {formatShortDate(tx.timestamp)} · 잔액{' '}
                            {tx.balance_before.toLocaleString('ko-KR')}원 →{' '}
                            {tx.balance_after.toLocaleString('ko-KR')}원
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span
                            className={`font-num text-base font-bold ${
                              !isActive
                                ? 'text-[#8D7665] line-through'
                                : isCharge
                                  ? 'text-[#1E7A4C]'
                                  : 'text-[#C0302B]'
                            }`}
                          >
                            {isCharge
                              ? `+${Math.abs(tx.amount).toLocaleString('ko-KR')}원`
                              : `-${Math.abs(tx.amount).toLocaleString('ko-KR')}원`}
                          </span>

                          {isActive && (
                            <button
                              type="button"
                              onClick={() => onRequestVoidTx(tx)}
                              disabled={busy}
                              className="inline-flex min-h-[38px] items-center gap-1 rounded-lg border border-[#E5DACB] bg-[#FAF6F0] px-3 py-1.5 text-xs font-semibold text-[#6E5849] transition-colors hover:border-[#F5C2C0] hover:bg-[#FDECEC] hover:text-[#C0302B] disabled:opacity-50"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              <span>취소</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
};
