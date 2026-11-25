import React, { useMemo, useState } from 'react';
import {
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UtensilsCrossed,
  BookOpenText,
  X,
} from 'lucide-react';
import type { LedgerEntry, MenuItem, Student } from '../types';
import { formatDateTime, matchesStudentQuery } from '../utils/koreanSearch';

interface MenuLedgerTabProps {
  menus: MenuItem[];
  ledger: LedgerEntry[];
  students: Student[];
  busy: boolean;
  onUpsertMenu: (data: {
    menu_id?: string;
    name: string;
    price: number;
    is_available: boolean;
    sort_order?: number;
  }) => Promise<boolean>;
  onRequestDeleteMenu: (menu: MenuItem) => void;
  onRequestVoidTx: (tx: LedgerEntry) => void;
}

export const MenuLedgerTab: React.FC<MenuLedgerTabProps> = ({
  menus,
  ledger,
  students,
  busy,
  onUpsertMenu,
  onRequestDeleteMenu,
  onRequestVoidTx,
}) => {
  // Menu editor state
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);
  const [menuName, setMenuName] = useState('');
  const [menuPrice, setMenuPrice] = useState('');
  const [menuAvailable, setMenuAvailable] = useState(true);

  // Ledger filter state
  const [dateFilter, setDateFilter] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'USE' | 'CHARGE' | 'VOIDED'>('ALL');

  const studentMap = useMemo(() => {
    const map = new Map<string, Student>();
    students.forEach((s) => map.set(s.student_id, s));
    return map;
  }, [students]);

  const resetMenuForm = () => {
    setEditingMenuId(null);
    setMenuName('');
    setMenuPrice('');
    setMenuAvailable(true);
  };

  const handleStartEditMenu = (menu: MenuItem) => {
    setEditingMenuId(menu.menu_id);
    setMenuName(menu.name);
    setMenuPrice(String(menu.price));
    setMenuAvailable(menu.is_available);
  };

  const handleSaveMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = menuName.trim();
    const parsedPrice = Math.max(0, Math.round(Number(menuPrice.replace(/[,\s]/g, '')) || 0));
    if (!trimmed || parsedPrice <= 0) return;

    const existing = editingMenuId ? menus.find((m) => m.menu_id === editingMenuId) : null;
    const ok = await onUpsertMenu({
      ...(editingMenuId ? { menu_id: editingMenuId } : {}),
      name: trimmed,
      price: parsedPrice,
      is_available: menuAvailable,
      sort_order: existing?.sort_order ?? menus.length + 1,
    });
    if (ok) {
      resetMenuForm();
    }
  };

  const handleToggleMenuAvailability = async (menu: MenuItem) => {
    await onUpsertMenu({
      menu_id: menu.menu_id,
      name: menu.name,
      price: menu.price,
      is_available: !menu.is_available,
      sort_order: menu.sort_order,
    });
  };

  const filteredLedger = useMemo(() => {
    return [...ledger]
      .sort((a, b) => {
        const tA = new Date(a.timestamp).getTime() || 0;
        const tB = new Date(b.timestamp).getTime() || 0;
        return tB - tA;
      })
      .filter((tx) => {
        const statusUpper = String(tx.status).toUpperCase();
        const typeUpper = String(tx.type).toUpperCase();

        if (typeFilter === 'VOIDED' && statusUpper !== 'VOIDED') return false;
        if (typeFilter === 'USE' && (typeUpper !== 'USE' || statusUpper !== 'ACTIVE')) return false;
        if (typeFilter === 'CHARGE' && (typeUpper !== 'CHARGE' || statusUpper !== 'ACTIVE')) {
          return false;
        }

        if (dateFilter) {
          const d = new Date(tx.timestamp);
          if (!Number.isNaN(d.getTime())) {
            const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
              2,
              '0'
            )}-${String(d.getDate()).padStart(2, '0')}`;
            if (localDate !== dateFilter) return false;
          } else if (!tx.timestamp.startsWith(dateFilter)) {
            return false;
          }
        }

        if (studentQuery.trim()) {
          const st = studentMap.get(tx.student_id);
          if (st) {
            if (!matchesStudentQuery(st, studentQuery)) {
              // Also allow matching items_summary
              if (!tx.items_summary.toLowerCase().includes(studentQuery.trim().toLowerCase())) {
                return false;
              }
            }
          } else {
            const fallbackName = (tx.student_name || '').toLowerCase();
            if (!fallbackName.includes(studentQuery.trim().toLowerCase())) return false;
          }
        }

        return true;
      });
  }, [ledger, typeFilter, dateFilter, studentQuery, studentMap]);

  return (
    <div className="space-y-6">
      {/* Section 1: Menu Management */}
      <section className="rounded-2xl border border-[#E5DACB] bg-white p-6">
        <div className="flex items-center gap-2.5">
          <UtensilsCrossed className="h-5 w-5 text-[#B85D19]" />
          <h2 className="text-lg font-bold text-[#2C1E16]">메뉴판 관리</h2>
        </div>
        <p className="mt-1 text-sm text-[#745D4E]">
          POS 원터치 화면에 표시될 메뉴와 가격, 판매/품절 상태를 관리합니다.
        </p>

        {/* Add / Edit Menu Form */}
        <form
          onSubmit={handleSaveMenu}
          className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-[#EFE6DA] bg-[#FAF6F0] p-4 sm:grid-cols-12 sm:items-end"
        >
          <div className="sm:col-span-4">
            <label className="mb-1 block text-xs font-bold text-[#5A4538]">메뉴 이름</label>
            <input
              type="text"
              value={menuName}
              onChange={(e) => setMenuName(e.target.value)}
              placeholder="예: 찹쌀꽈배기, 공룡알"
              className="min-h-[46px] w-full rounded-xl border border-[#DECDB8] bg-white px-3.5 text-sm font-semibold text-[#2C1E16] focus:border-[#B85D19] focus:outline-none"
            />
          </div>

          <div className="sm:col-span-3">
            <label className="mb-1 block text-xs font-bold text-[#5A4538]">가격 (원)</label>
            <input
              type="number"
              min="100"
              step="100"
              value={menuPrice}
              onChange={(e) => setMenuPrice(e.target.value)}
              placeholder="예: 1000"
              className="font-num min-h-[46px] w-full rounded-xl border border-[#DECDB8] bg-white px-3.5 text-sm font-bold text-[#2C1E16] focus:border-[#B85D19] focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="flex min-h-[46px] cursor-pointer items-center gap-2 rounded-xl border border-[#DECDB8] bg-white px-3 text-sm font-semibold text-[#2C1E16]">
              <input
                type="checkbox"
                checked={menuAvailable}
                onChange={(e) => setMenuAvailable(e.target.checked)}
                className="h-4 w-4 accent-[#1E7A4C]"
              />
              <span>판매중</span>
            </label>
          </div>

          <div className="flex items-center gap-2 sm:col-span-3">
            <button
              type="submit"
              disabled={busy || !menuName.trim() || Number(menuPrice) <= 0}
              className="inline-flex min-h-[46px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#B85D19] px-4 py-2 text-sm font-bold text-white hover:bg-[#9A4B11] disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              <span>{editingMenuId ? '수정 저장' : '메뉴 추가'}</span>
            </button>
            {editingMenuId && (
              <button
                type="button"
                onClick={resetMenuForm}
                className="flex h-[46px] w-[46px] items-center justify-center rounded-xl border border-[#DECDB8] bg-white text-[#6E5849] hover:bg-[#F3ECE1]"
                aria-label="수정 취소"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </form>

        {/* Menu List */}
        <div className="mt-4 divide-y divide-[#F1E8DC]">
          {menus.length === 0 ? (
            <div className="rounded-xl bg-[#FAF6F0] py-10 text-center text-sm text-[#8D7665]">
              등록된 메뉴가 없습니다. 위 입력창에서 첫 메뉴를 추가해 주세요.
            </div>
          ) : (
            menus.map((menu) => (
              <div
                key={menu.menu_id}
                className="flex flex-wrap items-center justify-between gap-3 py-3.5"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`text-base font-bold ${
                      menu.is_available ? 'text-[#2C1E16]' : 'text-[#9A8574] line-through'
                    }`}
                  >
                    {menu.name}
                  </span>
                  <span className="font-num text-sm font-bold text-[#6E5849]">
                    {menu.price.toLocaleString('ko-KR')}원
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  {/* Availability Switch */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={menu.is_available}
                    disabled={busy}
                    onClick={() => void handleToggleMenuAvailability(menu)}
                    className={`inline-flex min-h-[40px] items-center gap-2 rounded-xl border px-3.5 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${
                      menu.is_available
                        ? 'border-[#B7DFC9] bg-[#ECF7F1] text-[#1E7A4C]'
                        : 'border-[#E5DACB] bg-[#F3ECE1] text-[#745D4E]'
                    }`}
                  >
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${
                        menu.is_available ? 'bg-[#1E7A4C]' : 'bg-[#9A8574]'
                      }`}
                    />
                    <span>{menu.is_available ? '판매중' : '품절'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStartEditMenu(menu)}
                    disabled={busy}
                    className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-[#E5DACB] bg-[#FAF6F0] px-3 py-1.5 text-xs font-semibold text-[#4A372B] hover:bg-[#F3ECE1] disabled:opacity-50"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span>수정</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onRequestDeleteMenu(menu)}
                    disabled={busy}
                    className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-[#F5C2C0] bg-[#FFF5F5] px-3 py-1.5 text-xs font-semibold text-[#C0302B] hover:bg-[#FDECEC] disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>삭제</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Section 2: Global Transaction Ledger Audit */}
      <section className="rounded-2xl border border-[#E5DACB] bg-white p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2.5">
              <BookOpenText className="h-5 w-5 text-[#B85D19]" />
              <h2 className="text-lg font-bold text-[#2C1E16]">전체 거래 원장 감사</h2>
            </div>
            <p className="mt-1 text-sm text-[#745D4E]">
              전체 학생의 충전·차감 기록을 날짜와 학생별로 조회하고 잘못된 거래를 취소(역분개)할 수 있습니다.
            </p>
          </div>
          <span className="font-num text-sm font-semibold text-[#745D4E]">
            조회 결과 {filteredLedger.length}건
          </span>
        </div>

        {/* Filters */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-12">
          <div className="relative sm:col-span-5">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#8D7665]" />
            <input
              type="text"
              value={studentQuery}
              onChange={(e) => setStudentQuery(e.target.value)}
              placeholder="학생 이름, 초성(ㄱㅁㅅ), 번호 뒷자리, 메뉴명"
              className="min-h-[46px] w-full rounded-xl border border-[#DECDB8] bg-[#FAF6F0] pr-3 pl-10 text-sm font-medium text-[#2C1E16] focus:border-[#B85D19] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="sm:col-span-3">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="font-num min-h-[46px] w-full rounded-xl border border-[#DECDB8] bg-[#FAF6F0] px-3.5 text-sm font-medium text-[#2C1E16] focus:border-[#B85D19] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-4 gap-1 rounded-xl bg-[#F3ECE1] p-1 sm:col-span-4">
            {(
              [
                { id: 'ALL', label: '전체' },
                { id: 'USE', label: '차감' },
                { id: 'CHARGE', label: '충전' },
                { id: 'VOIDED', label: '취소됨' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTypeFilter(opt.id)}
                className={`min-h-[38px] rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  typeFilter === opt.id
                    ? 'bg-white text-[#2C1E16] shadow-xs'
                    : 'text-[#6E5849] hover:text-[#2C1E16]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Ledger Table */}
        <div className="mt-4 overflow-x-auto">
          {filteredLedger.length === 0 ? (
            <div className="rounded-xl bg-[#FAF6F0] py-12 text-center text-sm text-[#8D7665]">
              조건에 해당하는 거래 내역이 없습니다.
            </div>
          ) : (
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-y border-[#E5DACB] bg-[#FAF6F0] text-left text-xs font-bold text-[#6E5849]">
                  <th className="px-3 py-3">일시</th>
                  <th className="px-3 py-3">학생</th>
                  <th className="px-3 py-3">구분</th>
                  <th className="px-3 py-3">내용</th>
                  <th className="px-3 py-3 text-right">금액</th>
                  <th className="px-3 py-3 text-right">잔액 변화</th>
                  <th className="px-3 py-3 text-center">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE6DA]">
                {filteredLedger.slice(0, 150).map((tx) => {
                  const st = studentMap.get(tx.student_id);
                  const displayName = st
                    ? `${st.name}${st.info ? ` (${st.info})` : ''}`
                    : tx.student_name || tx.student_id;
                  const isCharge = String(tx.type).toUpperCase() === 'CHARGE';
                  const isActive = String(tx.status).toUpperCase() === 'ACTIVE';

                  return (
                    <tr
                      key={tx.tx_id}
                      className={`hover:bg-[#FAF6F0]/70 ${!isActive ? 'opacity-50' : ''}`}
                    >
                      <td className="font-num px-3 py-3 text-xs text-[#6E5849] whitespace-nowrap">
                        {formatDateTime(tx.timestamp)}
                      </td>
                      <td className="px-3 py-3 font-bold text-[#2C1E16] whitespace-nowrap">
                        {displayName}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span
                          className={`text-xs font-bold ${
                            !isActive
                              ? 'text-[#8D7665]'
                              : isCharge
                                ? 'text-[#1E7A4C]'
                                : 'text-[#B85D19]'
                          }`}
                        >
                          {!isActive ? '취소됨' : isCharge ? '충전' : '차감'}
                        </span>
                      </td>
                      <td
                        className={`px-3 py-3 text-[#3F2E23] ${
                          !isActive ? 'line-through' : ''
                        }`}
                      >
                        {tx.items_summary || '-'}
                      </td>
                      <td
                        className={`font-num px-3 py-3 text-right font-bold whitespace-nowrap ${
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
                      </td>
                      <td className="font-num px-3 py-3 text-right text-xs text-[#6E5849] whitespace-nowrap">
                        {tx.balance_before.toLocaleString('ko-KR')} →{' '}
                        <strong className="text-[#2C1E16]">
                          {tx.balance_after.toLocaleString('ko-KR')}원
                        </strong>
                      </td>
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        {isActive ? (
                          <button
                            type="button"
                            onClick={() => onRequestVoidTx(tx)}
                            disabled={busy}
                            className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-[#E5DACB] bg-[#FAF6F0] px-2.5 py-1 text-xs font-semibold text-[#5A4538] hover:border-[#F5C2C0] hover:bg-[#FDECEC] hover:text-[#C0302B] disabled:opacity-50"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>취소(역분개)</span>
                          </button>
                        ) : (
                          <span className="text-xs text-[#9A8574]">완료</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
};
