import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CloudOff,
  Info,
  Loader2,
  RefreshCw,
  Settings,
  X,
  XCircle,
} from 'lucide-react';
import type {
  ActiveTab,
  AppSnapshot,
  BatchTxItem,
  FontScaleLevel,
  GasActionPayload,
  KioskDeductionContext,
  LedgerEntry,
  MenuItem,
  OfflineQueueItem,
  StoreSettings,
  Student,
  ToastMessage,
} from './types';
import {
  applyFontScaleToDocument,
  describeActionPayload,
  fetchGasSnapshot,
  FONT_SCALE_CONFIG,
  GasNetworkError,
  generateTxId,
  getNextFontScale,
  loadAutoKioskSetting,
  loadCachedSnapshot,
  loadFontScale,
  loadGasUrl,
  loadOfflineQueue,
  postGasAction,
  saveAutoKioskSetting,
  saveCachedSnapshot,
  saveFontScale,
  saveGasUrl,
  saveOfflineQueue,
} from './services/gasSync';
import { PosTab } from './components/PosTab';
import { OcrTab } from './components/OcrTab';
import { MenuLedgerTab } from './components/MenuLedgerTab';
import { SettingsTab } from './components/SettingsTab';
import { KioskOverlay } from './components/KioskOverlay';
import { ReceiptModal } from './components/ReceiptModal';
import { StudentFormModal } from './components/StudentFormModal';
import { ChargeModal } from './components/ChargeModal';
import { ConfirmModal } from './components/ConfirmModal';
import { PWAInstallButton } from './components/PWAInstallButton';

interface ConfirmState {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone: 'danger' | 'primary';
  onConfirm: () => Promise<void>;
}

const NAV_TABS: Array<{ id: ActiveTab; label: string }> = [
  { id: 'pos', label: '매장 POS' },
  { id: 'ocr', label: '임시 장부 반영' },
  { id: 'menu-ledger', label: '메뉴·원장' },
  { id: 'settings', label: '설정' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('pos');
  const [gasUrl, setGasUrl] = useState<string>(() => loadGasUrl());
  const [snapshot, setSnapshot] = useState<AppSnapshot>(() => loadCachedSnapshot());
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueItem[]>(() => loadOfflineQueue());
  const [autoKiosk, setAutoKiosk] = useState<boolean>(() => loadAutoKioskSetting());
  const [fontScale, setFontScale] = useState<FontScaleLevel>(() => loadFontScale());

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Modal states
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [chargeStudent, setChargeStudent] = useState<Student | null>(null);
  const [chargeInitialMemo, setChargeInitialMemo] = useState<string>('');
  const [chargeSuccessTick, setChargeSuccessTick] = useState<number>(0);
  const [receiptStudent, setReceiptStudent] = useState<Student | null>(null);
  const [kioskState, setKioskState] = useState<{
    open: boolean;
    student: Student | null;
    deduction: KioskDeductionContext | null;
  }>({ open: false, student: null, deduction: null });

  const [confirmState, setConfirmState] = useState<ConfirmState>({
    open: false,
    title: '',
    description: '',
    confirmLabel: '확인',
    tone: 'danger',
    onConfirm: async () => {},
  });

  const syncLockRef = useRef(false);
  const gasUrlRef = useRef(gasUrl);
  gasUrlRef.current = gasUrl;

  const isBusy = busyMessage !== null;

  const addToast = useCallback((type: ToastMessage['type'], message: string) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, type, message }]);
    const duration = type === 'error' ? 7500 : 4200;
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const applySnapshot = useCallback((next: AppSnapshot) => {
    setSnapshot(next);
    saveCachedSnapshot(next);
  }, []);

  const updateOfflineQueue = useCallback((updater: (prev: OfflineQueueItem[]) => OfflineQueueItem[]) => {
    setOfflineQueue((prev) => {
      const next = updater(prev);
      saveOfflineQueue(next);
      return next;
    });
  }, []);

  const handleToggleAutoKiosk = useCallback((val: boolean) => {
    setAutoKiosk(val);
    saveAutoKioskSetting(val);
  }, []);

  useEffect(() => {
    applyFontScaleToDocument(fontScale);
  }, [fontScale]);

  const handleChangeFontScale = useCallback((level: FontScaleLevel) => {
    setFontScale(level);
    saveFontScale(level);
    applyFontScaleToDocument(level);
  }, []);

  const handleCycleFontScale = useCallback(() => {
    setFontScale((prev) => {
      const next = getNextFontScale(prev);
      saveFontScale(next);
      applyFontScaleToDocument(next);
      return next;
    });
  }, []);

  // GET sync from Google Apps Script
  const syncFromServer = useCallback(
    async (
      targetUrl?: string,
      silent = false
    ): Promise<{ ok: boolean; error?: string }> => {
      const urlToUse = (targetUrl ?? gasUrlRef.current).trim();
      if (!urlToUse) {
        const msg = '설정 탭에서 Google Apps Script URL을 먼저 입력해 주세요.';
        if (!silent) {
          addToast('warning', msg);
        }
        return { ok: false, error: msg };
      }

      setRefreshing(true);
      try {
        const fresh = await fetchGasSnapshot(urlToUse);
        applySnapshot(fresh);
        if (!silent) {
          addToast('success', '최신 매장 데이터를 동기화했습니다.');
        }
        return { ok: true };
      } catch (err) {
        const errMsg =
          err instanceof Error
            ? err.message
            : '데이터를 불러오는 중 알 수 없는 오류가 발생했습니다.';
        if (!silent) {
          addToast('error', errMsg);
        }
        return { ok: false, error: errMsg };
      } finally {
        setRefreshing(false);
      }
    },
    [addToast, applySnapshot]
  );

  // Flush offline queue sequentially
  const flushOfflineQueue = useCallback(
    async (silentIfEmpty = false) => {
      const currentQueue = loadOfflineQueue();
      if (currentQueue.length === 0) {
        if (!silentIfEmpty) {
          addToast('info', '재전송할 오프라인 대기 항목이 없습니다.');
        }
        return;
      }

      const url = gasUrlRef.current.trim();
      if (!url) {
        addToast('warning', 'Apps Script URL이 없어 대기열을 전송할 수 없습니다.');
        return;
      }

      if (syncLockRef.current) return;
      syncLockRef.current = true;
      setBusyMessage(`오프라인 대기열 재전송 중 (총 ${currentQueue.length}건)...`);

      let remaining = [...currentQueue];
      let successCount = 0;

      try {
        while (remaining.length > 0) {
          const current = remaining[0];
          setBusyMessage(
            `오프라인 대기열 전송 중 (${successCount + 1}/${currentQueue.length}): ${current.label}`
          );
          try {
            const { snapshot: updatedSnapshot } = await postGasAction(url, current.payload);
            applySnapshot(updatedSnapshot);
            remaining = remaining.slice(1);
            saveOfflineQueue(remaining);
            setOfflineQueue(remaining);
            successCount += 1;
          } catch (err) {
            if (err instanceof GasNetworkError) {
              addToast(
                'warning',
                `네트워크가 아직 불안정합니다. ${successCount}건 전송 완료, ${remaining.length}건 대기 중.`
              );
              break;
            }
            // Server rejected this specific item; keep remaining and notify user clearly
            addToast(
              'error',
              `대기 항목 전송 실패 (${current.label}): ${
                err instanceof Error ? err.message : '서버 오류'
              }`
            );
            break;
          }
        }

        if (remaining.length === 0 && successCount > 0) {
          addToast('success', `오프라인 대기열 ${successCount}건을 모두 서버에 반영했습니다.`);
        }
      } finally {
        syncLockRef.current = false;
        setBusyMessage(null);
      }
    },
    [addToast, applySnapshot]
  );

  // Initial sync on load + auto flush when browser regains online status
  useEffect(() => {
    if (gasUrlRef.current) {
      if (loadOfflineQueue().length > 0 && navigator.onLine) {
        void flushOfflineQueue(true);
      } else {
        void syncFromServer(gasUrlRef.current, true);
      }
    }

    const handleOnline = () => {
      if (gasUrlRef.current && loadOfflineQueue().length > 0) {
        addToast('info', '인터넷 연결이 복구되었습니다. 대기 중인 거래를 자동 전송합니다.');
        void flushOfflineQueue(true);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [addToast, flushOfflineQueue, syncFromServer]);

  // Pessimistic Sync POST executor with offline Fail-Safe queue fallback
  const executeMutation = useCallback(
    async (
      payload: GasActionPayload,
      options?: { loadingText?: string; successText?: string }
    ): Promise<boolean> => {
      const url = gasUrlRef.current.trim();
      if (!url) {
        addToast('warning', '먼저 [설정] 탭에서 Google Apps Script URL을 연결해 주세요.');
        setActiveTab('settings');
        return false;
      }

      if (syncLockRef.current) return false;
      syncLockRef.current = true;
      const actionLabel = describeActionPayload(payload);
      setBusyMessage(options?.loadingText || `${actionLabel} 처리 중...`);

      try {
        const { snapshot: serverSnapshot, message } = await postGasAction(url, payload);
        applySnapshot(serverSnapshot);
        addToast('success', options?.successText || message || `${actionLabel} 완료`);
        return true;
      } catch (err) {
        if (err instanceof GasNetworkError || !navigator.onLine) {
          const queuedItem: OfflineQueueItem = {
            id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            createdAt: new Date().toISOString(),
            label: actionLabel,
            payload,
          };
          updateOfflineQueue((prev) => [...prev, queuedItem]);
          addToast(
            'warning',
            `네트워크 오류로 오프라인 대기열에 저장되었습니다 (${actionLabel}). 온라인 복구 시 자동 전송됩니다.`
          );
          return false;
        }

        addToast(
          'error',
          err instanceof Error ? err.message : `${actionLabel} 처리에 실패했습니다.`
        );
        return false;
      } finally {
        syncLockRef.current = false;
        setBusyMessage(null);
      }
    },
    [addToast, applySnapshot, updateOfflineQueue]
  );

  // Domain handlers mapped strictly to Code.gs doPost({ action, payload }) specifications
  const handleConfirmDeduction = async (
    student: Student,
    itemsSummary: string,
    totalAmount: number
  ): Promise<boolean> => {
    // CRITICAL SPEC: type === "USE" MUST send negative amount
    const negativeAmount = -Math.abs(Math.round(totalAmount));
    return executeMutation(
      {
        action: 'recordTransaction',
        tx_id: generateTxId(),
        student_id: student.student_id,
        type: 'USE',
        items_summary: itemsSummary,
        amount: negativeAmount,
        created_at: new Date().toISOString(),
      },
      {
        loadingText: `${student.name} 학생 적립금 차감 중...`,
        successText: `${student.name} 학생 ${Math.abs(negativeAmount).toLocaleString('ko-KR')}원 차감 완료`,
      }
    );
  };

  const handleChargeStudent = async (amount: number, memoLabel: string): Promise<boolean> => {
    if (!chargeStudent) return false;
    // CRITICAL SPEC: type === "CHARGE" MUST send positive amount
    const positiveAmount = Math.abs(Math.round(amount));
    const ok = await executeMutation(
      {
        action: 'recordTransaction',
        tx_id: generateTxId(),
        student_id: chargeStudent.student_id,
        type: 'CHARGE',
        items_summary: memoLabel,
        amount: positiveAmount,
        created_at: new Date().toISOString(),
      },
      {
        loadingText: `${chargeStudent.name} 학생 적립금 충전 중...`,
        successText: `${chargeStudent.name} 학생 +${positiveAmount.toLocaleString('ko-KR')}원 충전 완료`,
      }
    );
    if (ok) {
      setChargeSuccessTick((prev) => prev + 1);
    }
    return ok;
  };

  const handleUpsertStudent = async (data: {
    student_id?: string;
    name: string;
    info: string;
    parent_phone: string;
    initial_balance?: number;
    memo: string;
  }): Promise<boolean> => {
    const payload: GasActionPayload = data.student_id
      ? {
          action: 'UPSERT_STUDENT',
          student_id: data.student_id,
          name: data.name,
          info: data.info,
          parent_phone: data.parent_phone,
          memo: data.memo,
        }
      : {
          action: 'UPSERT_STUDENT',
          name: data.name,
          info: data.info,
          parent_phone: data.parent_phone,
          initial_balance: data.initial_balance ?? 0,
          memo: data.memo,
        };

    return executeMutation(payload, {
      loadingText: data.student_id ? '학생 정보 수정 중...' : '신규 학생 등록 중...',
      successText: data.student_id
        ? `${data.name} 학생 정보가 수정되었습니다.`
        : `${data.name} 학생이 등록되었습니다.`,
    });
  };

  const handleRequestDeleteStudent = (student: Student) => {
    setStudentModalOpen(false);
    setConfirmState({
      open: true,
      title: '학생 삭제 확인',
      description: `'${student.name}${
        student.info ? ` (${student.info})` : ''
      }' 학생을 삭제하시겠습니까?\n삭제 후에는 학생 목록에서 제외됩니다.`,
      confirmLabel: '학생 삭제',
      tone: 'danger',
      onConfirm: async () => {
        const ok = await executeMutation(
          { action: 'DELETE_STUDENT', student_id: student.student_id },
          {
            loadingText: '학생 삭제 중...',
            successText: `${student.name} 학생이 삭제되었습니다.`,
          }
        );
        if (ok && selectedStudentId === student.student_id) {
          setSelectedStudentId(null);
        }
        setConfirmState((prev) => ({ ...prev, open: false }));
      },
    });
  };

  const handleRequestVoidTx = (tx: LedgerEntry) => {
    const isCharge = String(tx.type).toUpperCase() === 'CHARGE';
    const student = snapshot.students.find((s) => s.student_id === tx.student_id);
    const labelName = student?.name || tx.student_name || tx.student_id;

    setConfirmState({
      open: true,
      title: '거래 취소 (역분개) 확인',
      description: `${labelName} 학생의 [${isCharge ? '충전' : '차감'}] 거래를 취소하시겠습니까?\n\n내용: ${
        tx.items_summary || '-'
      }\n금액: ${isCharge ? '+' : '-'}${Math.abs(tx.amount).toLocaleString(
        'ko-KR'
      )}원\n\n취소 시 해당 금액이 잔액에 자동으로 원복됩니다.`,
      confirmLabel: '거래 취소 확정',
      tone: 'danger',
      onConfirm: async () => {
        await executeMutation(
          { action: 'cancelTransaction', tx_id: tx.tx_id },
          {
            loadingText: '거래 취소(역분개) 처리 중...',
            successText: '거래가 취소되고 잔액이 원복되었습니다.',
          }
        );
        setConfirmState((prev) => ({ ...prev, open: false }));
      },
    });
  };

  const handleRequestBatchRecordTx = (items: BatchTxItem[], onSuccess: () => void) => {
    const nowIso = new Date().toISOString();
    const normalizedItems: BatchTxItem[] = items.map((item, idx) => {
      const absAmt = Math.round(Math.abs(Number(item.amount) || 0));
      return {
        tx_id: item.tx_id || generateTxId(idx + 1),
        student_id: item.student_id,
        type: item.type === 'CHARGE' ? 'CHARGE' : 'USE',
        items_summary: item.items_summary,
        amount: item.type === 'CHARGE' ? absAmt : -absAmt,
        created_at: item.created_at || nowIso,
      };
    });

    const totalCharge = normalizedItems
      .filter((i) => i.type === 'CHARGE')
      .reduce((sum, i) => sum + Math.abs(i.amount), 0);
    const totalUse = normalizedItems
      .filter((i) => i.type === 'USE')
      .reduce((sum, i) => sum + Math.abs(i.amount), 0);

    setConfirmState({
      open: true,
      title: '임시 장부 일괄 원장 반영 확인',
      description: `검수 표에 담긴 ${normalizedItems.length}건의 거래를 학생 장부에 한 번에 반영하시겠습니까?\n\n• 차감 합계: -${totalUse.toLocaleString(
        'ko-KR'
      )}원\n• 충전 합계: +${totalCharge.toLocaleString(
        'ko-KR'
      )}원\n\n반영 후 최신 스프레드시트 잔액으로 즉시 동기화됩니다.`,
      confirmLabel: `${normalizedItems.length}건 일괄 반영`,
      tone: 'primary',
      onConfirm: async () => {
        const ok = await executeMutation(
          {
            action: 'batchRecordTx',
            items: normalizedItems,
          },
          {
            loadingText: `임시 장부 ${normalizedItems.length}건 일괄 반영 중...`,
            successText: `임시 장부 ${normalizedItems.length}건이 원장에 일괄 반영되었습니다.`,
          }
        );
        if (ok) {
          onSuccess();
        }
        setConfirmState((prev) => ({ ...prev, open: false }));
      },
    });
  };

  const handleUpsertMenu = async (data: {
    menu_id?: string;
    name: string;
    price: number;
    is_available: boolean;
    sort_order?: number;
  }): Promise<boolean> => {
    const payload: GasActionPayload = {
      action: 'UPSERT_MENU',
      ...(data.menu_id ? { menu_id: data.menu_id } : {}),
      name: data.name,
      price: data.price,
      is_available: data.is_available,
      ...(data.sort_order !== undefined ? { sort_order: data.sort_order } : {}),
    };
    return executeMutation(payload, {
      loadingText: '메뉴 저장 중...',
      successText: `'${data.name}' 메뉴가 저장되었습니다.`,
    });
  };

  const handleRequestDeleteMenu = (menu: MenuItem) => {
    setConfirmState({
      open: true,
      title: '메뉴 삭제 확인',
      description: `'${menu.name} (${menu.price.toLocaleString(
        'ko-KR'
      )}원)' 메뉴를 삭제하시겠습니까?`,
      confirmLabel: '메뉴 삭제',
      tone: 'danger',
      onConfirm: async () => {
        await executeMutation(
          { action: 'DELETE_MENU', menu_id: menu.menu_id },
          {
            loadingText: '메뉴 삭제 중...',
            successText: `'${menu.name}' 메뉴가 삭제되었습니다.`,
          }
        );
        setConfirmState((prev) => ({ ...prev, open: false }));
      },
    });
  };

  const handleSaveAndTestGasUrl = async (
    newUrl: string
  ): Promise<{ ok: boolean; error?: string }> => {
    setGasUrl(newUrl);
    saveGasUrl(newUrl);
    gasUrlRef.current = newUrl;
    return syncFromServer(newUrl, false);
  };

  const handleSaveSettings = async (nextSettings: StoreSettings): Promise<boolean> => {
    return executeMutation(
      {
        action: 'UPDATE_SETTINGS',
        settings: {
          backup_email: nextSettings.backup_email,
          store_name: nextSettings.store_name,
          low_balance_limit: nextSettings.low_balance_limit,
        },
      },
      {
        loadingText: '시트에 가게 설정 저장 중...',
        successText: '가게 설정이 스프레드시트에 저장되었습니다.',
      }
    );
  };

  const handleManualBackup = async (): Promise<boolean> => {
    return executeMutation(
      { action: 'MANUAL_BACKUP' },
      {
        loadingText: '드라이브/이메일 수동 백업 실행 중...',
        successText: '드라이브 및 이메일 백업이 완료되었습니다.',
      }
    );
  };

  const handleRequestRebuildBalances = () => {
    setConfirmState({
      open: true,
      title: '전 학생 잔액 재검산 확인',
      description:
        '전체 거래 원장(유효 거래)을 기준으로 모든 학생의 현재 잔액을 처음부터 다시 계산하여 시트를 맞춥니다.\n실행하시겠습니까?',
      confirmLabel: '재검산 실행',
      tone: 'primary',
      onConfirm: async () => {
        await executeMutation(
          { action: 'REBUILD_BALANCES' },
          {
            loadingText: '원장 기준 전 학생 잔액 재검산 중...',
            successText: '전 학생 잔액 재검산이 완료되었습니다.',
          }
        );
        setConfirmState((prev) => ({ ...prev, open: false }));
      },
    });
  };

  // Keep modal student references synced with latest snapshot
  const activeKioskStudent = kioskState.student
    ? snapshot.students.find((s) => s.student_id === kioskState.student!.student_id) ||
      kioskState.student
    : null;

  const activeKioskLedger = activeKioskStudent
    ? snapshot.ledger.filter(
        (entry) =>
          entry.student_id === activeKioskStudent.student_id &&
          String(entry.status || 'ACTIVE').toUpperCase() === 'ACTIVE'
      )
    : [];

  const activeReceiptStudent = receiptStudent
    ? snapshot.students.find((s) => s.student_id === receiptStudent.student_id) || receiptStudent
    : null;

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#2C1E16]">
      {/* Standalone Status-Bar Safe Area Cover (matches #FFFFFF header & theme-color) */}
      <div
        className="pointer-events-none fixed top-0 right-0 left-0 z-40 h-[env(safe-area-inset-top)] bg-white"
        aria-hidden="true"
      />

      {/* Top Navigation Bar — Responsive across Normal / Large / X-Large Font Scales */}
      <header className="sticky top-[env(safe-area-inset-top)] z-30 border-b border-[#E5DACB] bg-white/95 backdrop-blur-xs">
        <div className="mx-auto flex min-h-16 max-w-[1440px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 sm:px-6 lg:flex-nowrap lg:gap-x-6">
          {/* Zone 1: Store Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('pos')}
            className="text-left text-lg font-bold tracking-tight text-[#2C1E16] whitespace-nowrap shrink-0"
          >
            {snapshot.settings.store_name || '우리동네 꽈배기'}
          </button>

          {/* Zone 2: 4 Navigation Links (wraps to clean row on narrow screens at large font scale) */}
          <nav
            className="order-3 flex w-full items-center justify-between gap-1 border-t border-[#EFE6DA] pt-1.5 sm:justify-start sm:gap-5 lg:order-none lg:w-auto lg:border-t-0 lg:pt-0"
            aria-label="주 메뉴"
          >
            {NAV_TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative min-h-[40px] px-2 py-1.5 text-center text-sm font-bold leading-tight transition-colors whitespace-normal break-keep sm:px-1.5 lg:whitespace-nowrap ${
                    active
                      ? 'text-[#B85D19]'
                      : 'text-[#6E5849] hover:text-[#2C1E16]'
                  }`}
                >
                  {tab.label}
                  {active && (
                    <span className="absolute right-1 bottom-0 left-1 h-0.5 rounded-full bg-[#B85D19]" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: PWA Install + Font Scale 1-Tap Cycle Toggle + Primary Sync Action */}
          <div className="flex shrink-0 items-center gap-2">
            <PWAInstallButton />

            <button
              type="button"
              onClick={handleCycleFontScale}
              title="누를 때마다 글자 크기가 보통 → 크게 → 아주 크게 순으로 바뀝니다"
              className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-[#DECDB8] bg-[#FAF6F0] px-3 py-1.5 text-xs font-bold text-[#4A372B] transition-colors hover:border-[#B85D19] hover:bg-[#FDF3E7] active:scale-[0.98] whitespace-nowrap shrink-0"
            >
              <span className="text-sm font-extrabold text-[#B85D19]" aria-hidden="true">
                가
              </span>
              <span>글자: {FONT_SCALE_CONFIG[fontScale].shortLabel}</span>
            </button>

            <button
              type="button"
              onClick={() => void syncFromServer()}
              disabled={refreshing || isBusy || !gasUrl}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#2C1E16] px-3.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-[#433024] whitespace-nowrap shrink-0 disabled:opacity-45"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>동기화</span>
            </button>
          </div>
        </div>
      </header>

      {/* Conditional System Banners (Offline Queue & GAS URL Setup Notice) */}
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6">
        {offlineQueue.length > 0 && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => void flushOfflineQueue(false)}
              disabled={isBusy}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#EAB308] bg-[#FEF9C3] px-4 py-3 text-left text-sm font-bold text-[#854D0E] transition-colors hover:bg-[#FEF08A] disabled:opacity-60"
            >
              <div className="flex items-center gap-2.5">
                <CloudOff className="h-5 w-5 shrink-0" />
                <span>[오프라인 대기열: {offlineQueue.length}건] - 클릭 시 재전송</span>
              </div>
              <span className="text-xs underline underline-offset-2 whitespace-nowrap">
                지금 재전송
              </span>
            </button>
          </div>
        )}

        {!gasUrl && (
          <div className="mt-4 flex flex-col items-start justify-between gap-3 rounded-xl border border-[#F3D19C] bg-[#FFF8EB] px-4 py-3.5 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2.5 text-sm font-semibold text-[#9A4B11]">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span>
                Google Apps Script 웹 앱 URL이 연결되지 않았습니다. 설정에서 URL을 입력해야 시트와 실시간 동기화됩니다.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#B85D19] px-4 py-2 text-xs font-bold text-white hover:bg-[#9A4B11] whitespace-nowrap shrink-0"
            >
              <Settings className="h-3.5 w-3.5" />
              <span>설정 바로가기</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <main className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6">
        {activeTab === 'pos' && (
          <PosTab
            students={snapshot.students}
            menus={snapshot.menus}
            ledger={snapshot.ledger}
            settings={snapshot.settings}
            selectedStudentId={selectedStudentId}
            busy={isBusy}
            autoKiosk={autoKiosk}
            onToggleAutoKiosk={handleToggleAutoKiosk}
            onSelectStudent={setSelectedStudentId}
            onOpenNewStudent={() => {
              setEditingStudent(null);
              setStudentModalOpen(true);
            }}
            onOpenEditStudent={(st) => {
              setEditingStudent(st);
              setStudentModalOpen(true);
            }}
            onOpenCharge={(st, memo) => {
              setChargeStudent(st);
              setChargeInitialMemo(memo || '');
            }}
            onOpenReceipt={(st) => setReceiptStudent(st)}
            onOpenKiosk={(st, deduction) =>
              setKioskState({ open: true, student: st, deduction })
            }
            onConfirmDeduction={handleConfirmDeduction}
            onRequestVoidTx={handleRequestVoidTx}
            chargeSuccessTick={chargeSuccessTick}
          />
        )}

        {activeTab === 'ocr' && (
          <OcrTab
            students={snapshot.students}
            menus={snapshot.menus}
            settings={snapshot.settings}
            busy={isBusy}
            onRequestBatchRecordTx={handleRequestBatchRecordTx}
            onNotify={addToast}
          />
        )}

        {activeTab === 'menu-ledger' && (
          <MenuLedgerTab
            menus={snapshot.menus}
            ledger={snapshot.ledger}
            students={snapshot.students}
            busy={isBusy}
            onUpsertMenu={handleUpsertMenu}
            onRequestDeleteMenu={handleRequestDeleteMenu}
            onRequestVoidTx={handleRequestVoidTx}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            gasUrl={gasUrl}
            settings={snapshot.settings}
            students={snapshot.students}
            syncedAt={snapshot.synced_at}
            busy={isBusy}
            fontScale={fontScale}
            onChangeFontScale={handleChangeFontScale}
            onSaveAndTestGasUrl={handleSaveAndTestGasUrl}
            onSaveSettings={handleSaveSettings}
            onManualBackup={handleManualBackup}
            onRequestRebuildBalances={handleRequestRebuildBalances}
            onNotify={addToast}
          />
        )}
      </main>

      {/* Pessimistic Sync Lock Overlay (Prevents Duplicate Clicks During POST) */}
      {isBusy && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-[#2C1E16]/35 backdrop-blur-[1px]"
          aria-live="assertive"
          role="status"
        >
          <div className="flex items-center gap-3.5 rounded-2xl border border-[#E5DACB] bg-white px-6 py-4 shadow-xl">
            <Loader2 className="h-6 w-6 animate-spin text-[#B85D19]" />
            <span className="text-base font-bold text-[#2C1E16]">{busyMessage}</span>
          </div>
        </div>
      )}

      {/* Modals & Fullscreen Kiosk Mode */}
      <StudentFormModal
        open={studentModalOpen}
        student={editingStudent}
        busy={isBusy}
        onClose={() => setStudentModalOpen(false)}
        onSubmit={handleUpsertStudent}
        onRequestDelete={handleRequestDeleteStudent}
      />

      <ChargeModal
        open={Boolean(chargeStudent)}
        student={
          chargeStudent
            ? snapshot.students.find((s) => s.student_id === chargeStudent.student_id) ||
              chargeStudent
            : null
        }
        initialMemo={chargeInitialMemo}
        busy={isBusy}
        onClose={() => {
          setChargeStudent(null);
          setChargeInitialMemo('');
        }}
        onCharge={handleChargeStudent}
      />

      <ReceiptModal
        open={Boolean(activeReceiptStudent)}
        student={activeReceiptStudent}
        ledger={snapshot.ledger}
        settings={snapshot.settings}
        onClose={() => setReceiptStudent(null)}
        onNotify={addToast}
      />

      <KioskOverlay
        open={kioskState.open}
        storeName={snapshot.settings.store_name || '우리동네 꽈배기'}
        student={activeKioskStudent}
        ledger={activeKioskLedger}
        lowBalanceLimit={Number(snapshot.settings.low_balance_limit || 3000)}
        recentDeduction={kioskState.deduction}
        onUnlock={() => setKioskState({ open: false, student: null, deduction: null })}
      />

      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        description={confirmState.description}
        confirmLabel={confirmState.confirmLabel}
        tone={confirmState.tone}
        busy={isBusy}
        onConfirm={() => void confirmState.onConfirm()}
        onCancel={() => setConfirmState((prev) => ({ ...prev, open: false }))}
      />

      {/* Toast Stack */}
      {toasts.length > 0 && (
        <div
          className="fixed right-4 bottom-4 z-[110] flex w-full max-w-sm flex-col gap-2"
          aria-live="polite"
        >
          {toasts.map((toast) => {
            const toneStyles =
              toast.type === 'success'
                ? 'border-[#B7DFC9] bg-[#ECF7F1] text-[#145334]'
                : toast.type === 'error'
                  ? 'border-[#F5C2C0] bg-[#FDECEC] text-[#991B1B]'
                  : toast.type === 'warning'
                    ? 'border-[#F3D19C] bg-[#FFF8EB] text-[#9A4B11]'
                    : 'border-[#DECDB8] bg-white text-[#2C1E16]';

            return (
              <div
                key={toast.id}
                className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg ${toneStyles}`}
              >
                {toast.type === 'success' && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
                {toast.type === 'error' && <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                {toast.type === 'warning' && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
                {toast.type === 'info' && <Info className="mt-0.5 h-4 w-4 shrink-0" />}
                <span className="flex-1 leading-snug">{toast.message}</span>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="shrink-0 opacity-70 hover:opacity-100"
                  aria-label="알림 닫기"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
