import React, { useEffect, useState } from 'react';
import {
  FileSpreadsheet,
  Link2,
  RefreshCw,
  Save,
  ShieldCheck,
  Store,
  CheckCircle2,
  AlertCircle,
  Type,
} from 'lucide-react';
import type { FontScaleLevel, StoreSettings, Student } from '../types';
import { FONT_SCALE_CONFIG, FONT_SCALE_ORDER } from '../services/gasSync';
import { downloadStudentsCsv, formatDateTime } from '../utils/koreanSearch';

interface SettingsTabProps {
  gasUrl: string;
  settings: StoreSettings;
  students: Student[];
  syncedAt: string;
  busy: boolean;
  fontScale: FontScaleLevel;
  onChangeFontScale: (level: FontScaleLevel) => void;
  onSaveAndTestGasUrl: (url: string) => Promise<{ ok: boolean; error?: string }>;
  onSaveSettings: (nextSettings: StoreSettings) => Promise<boolean>;
  onManualBackup: () => Promise<boolean>;
  onRequestRebuildBalances: () => void;
  onNotify: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  gasUrl,
  settings,
  students,
  syncedAt,
  busy,
  fontScale,
  onChangeFontScale,
  onSaveAndTestGasUrl,
  onSaveSettings,
  onManualBackup,
  onRequestRebuildBalances,
  onNotify,
}) => {
  const [urlInput, setUrlInput] = useState(gasUrl);
  const [storeName, setStoreName] = useState(settings.store_name);
  const [backupEmail, setBackupEmail] = useState(settings.backup_email);
  const [lowBalanceLimit, setLowBalanceLimit] = useState(String(settings.low_balance_limit));
  const [testResult, setTestResult] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [testError, setTestError] = useState<string>('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setUrlInput(gasUrl);
  }, [gasUrl]);

  useEffect(() => {
    setStoreName(settings.store_name);
    setBackupEmail(settings.backup_email);
    setLowBalanceLimit(String(settings.low_balance_limit));
  }, [settings]);

  const handleTestConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestResult('idle');
    setTestError('');
    setTesting(true);
    try {
      const result = await onSaveAndTestGasUrl(urlInput.trim());
      if (result.ok) {
        setTestResult('ok');
      } else {
        setTestResult('fail');
        setTestError(result.error || '알 수 없는 연결 오류가 발생했습니다.');
      }
    } catch (err) {
      setTestResult('fail');
      setTestError(err instanceof Error ? err.message : String(err));
    } finally {
      setTesting(false);
    }
  };

  const handleSaveStoreSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedLimit = Math.max(0, Math.round(Number(lowBalanceLimit.replace(/[,\s]/g, '')) || 0));
    await onSaveSettings({
      store_name: storeName.trim() || '우리동네 꽈배기',
      backup_email: backupEmail.trim(),
      low_balance_limit: parsedLimit,
    });
  };

  const handleDownloadCsv = () => {
    if (students.length === 0) {
      onNotify('warning', '다운로드할 학생 데이터가 없습니다.');
      return;
    }
    downloadStudentsCsv(students, settings.store_name);
    onNotify('success', `현재 잔액표 CSV (${students.length}명) 다운로드가 시작되었습니다.`);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* 0. Screen Font Size Setting (3-Level Selector + Preview) */}
      <section className="rounded-2xl border border-[#E5DACB] bg-white p-6">
        <div className="flex items-center gap-2.5">
          <Type className="h-5 w-5 text-[#B85D19]" />
          <h2 className="text-lg font-bold text-[#2C1E16]">화면 글자 크기 설정</h2>
        </div>
        <p className="mt-1 text-sm text-[#745D4E]">
          매장에서 보기 편한 크기로 앱 전체 글자와 버튼 비율을 즉시 조절합니다. 선택한 크기는 이 기기에 자동 저장됩니다.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {FONT_SCALE_ORDER.map((level) => {
            const cfg = FONT_SCALE_CONFIG[level];
            const isSelected = fontScale === level;
            return (
              <button
                key={level}
                type="button"
                onClick={() => onChangeFontScale(level)}
                aria-pressed={isSelected}
                className={`flex min-h-[76px] flex-col items-start justify-center rounded-xl border px-4 py-3 text-left transition-all active:scale-[0.99] ${
                  isSelected
                    ? 'border-[#B85D19] bg-[#FDF3E7] text-[#2C1E16] ring-2 ring-[#B85D19]/25'
                    : 'border-[#E5DACB] bg-[#FAF6F0] text-[#4A372B] hover:border-[#C9B7A0] hover:bg-[#F3ECE1]'
                }`}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="text-base font-bold text-[#2C1E16]">{cfg.label}</span>
                  {isSelected && (
                    <span className="text-xs font-bold text-[#B85D19]">적용 중</span>
                  )}
                </div>
                <span className="mt-1 text-xs font-medium text-[#745D4E]">
                  {cfg.description}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-xl border border-[#EFE6DA] bg-[#FAF6F0] px-4 py-3.5">
          <div className="text-xs font-bold text-[#745D4E]">
            현재 글자 크기 미리보기 ({FONT_SCALE_CONFIG[fontScale].label} ·{' '}
            {FONT_SCALE_CONFIG[fontScale].px})
          </div>
          <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <span className="text-base font-bold text-[#2C1E16]">박서진, 서영</span>
              <span className="ml-2 text-sm text-[#6E5849]">찹쌀꽈배기 2개 (서영)</span>
            </div>
            <span className="font-num text-lg font-bold text-[#B85D19]">
              남은 잔액 15,000원
            </span>
          </div>
          <p className="mt-1 text-xs text-[#745D4E]">
            상단 메뉴 우측의 [가 글자] 버튼을 눌러서도 언제든 1탭으로 크기를 순환할 수 있습니다.
          </p>
        </div>
      </section>

      {/* 1. Google Apps Script Web App URL */}
      <section className="rounded-2xl border border-[#E5DACB] bg-white p-6">
        <div className="flex items-center gap-2.5">
          <Link2 className="h-5 w-5 text-[#B85D19]" />
          <h2 className="text-lg font-bold text-[#2C1E16]">
            Google Apps Script 백엔드 연동
          </h2>
        </div>
        <p className="mt-1 text-sm text-[#745D4E]">
          Google 스프레드시트 Apps Script 웹 앱 배포 URL을 입력하세요. 입력한 URL은 이 기기의 브라우저에 안전하게 저장됩니다.
        </p>

        <form onSubmit={handleTestConnection} className="mt-4 space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-[#5A4538]">
              Apps Script 웹 앱 URL (`.../exec`)
            </label>
            <input
              type="url"
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                setTestResult('idle');
                setTestError('');
              }}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="font-num min-h-[50px] w-full rounded-xl border border-[#DECDB8] bg-[#FAF6F0] px-4 text-sm text-[#2C1E16] placeholder:text-[#9A8574] focus:border-[#B85D19] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-[#745D4E]">
              {syncedAt ? (
                <span className="font-num">마지막 동기화: {formatDateTime(syncedAt)}</span>
              ) : (
                <span>아직 동기화된 기록이 없습니다.</span>
              )}
            </div>

            <button
              type="submit"
              disabled={busy || testing || !urlInput.trim()}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-[#B85D19] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#9A4B11] disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${busy || testing ? 'animate-spin' : ''}`} />
              <span>{testing ? '연결 테스트 중...' : 'URL 저장 및 연결 테스트'}</span>
            </button>
          </div>

          {testResult === 'ok' && (
            <div className="flex items-center gap-2 rounded-xl bg-[#ECF7F1] px-4 py-3 text-sm font-semibold text-[#1E7A4C]">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>연결 성공! 최신 스프레드시트 데이터를 불러왔습니다.</span>
            </div>
          )}
          {testResult === 'fail' && (
            <div className="rounded-xl border border-[#F5C2C0] bg-[#FDECEC] px-4 py-3 text-sm text-[#991B1B]">
              <div className="flex items-start gap-2 font-bold">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>연결에 실패했습니다.</span>
              </div>
              {testError && (
                <p className="font-num mt-1.5 break-all rounded-lg bg-white/80 px-3 py-2 text-xs font-medium text-[#7F1D1D]">
                  오류 원인: {testError}
                </p>
              )}
              <p className="mt-1.5 text-xs text-[#991B1B]/85">
                URL 끝이 <code className="font-num font-semibold">/exec</code>인지, Apps Script 웹 앱 배포 설정과 실행 권한을 함께 점검해 주세요.
              </p>
            </div>
          )}
        </form>
      </section>

      {/* 2. Store Settings */}
      <section className="rounded-2xl border border-[#E5DACB] bg-white p-6">
        <div className="flex items-center gap-2.5">
          <Store className="h-5 w-5 text-[#B85D19]" />
          <h2 className="text-lg font-bold text-[#2C1E16]">매장 기본 설정</h2>
        </div>
        <p className="mt-1 text-sm text-[#745D4E]">
          정산 영수증 제목, 밤 11시 마감 백업 이메일, 잔액 부족 알림 기준액을 설정합니다.
        </p>

        <form onSubmit={handleSaveStoreSettings} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[#3F2E23]">
                가게 이름 (`store_name`)
              </label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="예: 우리동네 꽈배기"
                className="min-h-[48px] w-full rounded-xl border border-[#DECDB8] bg-[#FAF6F0] px-3.5 text-sm font-semibold text-[#2C1E16] focus:border-[#B85D19] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[#3F2E23]">
                잔액 부족 기준액 (`low_balance_limit`, 원)
              </label>
              <input
                type="number"
                min="0"
                step="500"
                value={lowBalanceLimit}
                onChange={(e) => setLowBalanceLimit(e.target.value)}
                placeholder="3000"
                className="font-num min-h-[48px] w-full rounded-xl border border-[#DECDB8] bg-[#FAF6F0] px-3.5 text-sm font-bold text-[#2C1E16] focus:border-[#B85D19] focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-[#3F2E23]">
              마감 백업 수신 이메일 (`backup_email`)
            </label>
            <input
              type="email"
              value={backupEmail}
              onChange={(e) => setBackupEmail(e.target.value)}
              placeholder="예: owner@example.com"
              className="min-h-[48px] w-full rounded-xl border border-[#DECDB8] bg-[#FAF6F0] px-3.5 text-sm font-medium text-[#2C1E16] focus:border-[#B85D19] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-[50px] items-center gap-2 rounded-xl bg-[#2C1E16] px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#433024] disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>시트에 설정 저장</span>
            </button>
          </div>
        </form>
      </section>

      {/* 3. Data Safety, Recovery & Backup Tools */}
      <section className="rounded-2xl border border-[#E5DACB] bg-white p-6">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="h-5 w-5 text-[#1E7A4C]" />
          <h2 className="text-lg font-bold text-[#2C1E16]">데이터 안전 관리 및 긴급 복구</h2>
        </div>
        <p className="mt-1 text-sm text-[#745D4E]">
          마감 백업, 전체 학생 잔액 원장 재검산, 엑셀용 CSV 백업 파일을 즉시 실행할 수 있습니다.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-3.5 md:grid-cols-3">
          <button
            type="button"
            onClick={() => void onManualBackup()}
            disabled={busy}
            className="flex min-h-[86px] flex-col items-start justify-between rounded-xl border border-[#D4E7DC] bg-[#F5FBF7] p-4 text-left transition-colors hover:bg-[#ECF7F1] active:scale-[0.99] disabled:opacity-50"
          >
            <div className="flex items-center gap-2 text-sm font-bold text-[#1E7A4C]">
              <ShieldCheck className="h-5 w-5 shrink-0" />
              <span>지금 즉시 드라이브/이메일 백업</span>
            </div>
            <span className="mt-2 text-xs text-[#4A6B58]">
              현재 시트 스냅샷을 즉시 백업합니다.
            </span>
          </button>

          <button
            type="button"
            onClick={onRequestRebuildBalances}
            disabled={busy}
            className="flex min-h-[86px] flex-col items-start justify-between rounded-xl border border-[#F3D19C] bg-[#FFFBF2] p-4 text-left transition-colors hover:bg-[#FEF3D9] active:scale-[0.99] disabled:opacity-50"
          >
            <div className="flex items-center gap-2 text-sm font-bold text-[#9A4B11]">
              <RefreshCw className="h-5 w-5 shrink-0" />
              <span>원장 기준 전 학생 잔액 재검산</span>
            </div>
            <span className="mt-2 text-xs text-[#7D5836]">
              전체 거래 원장을 다시 합산해 잔액을 맞춥니다.
            </span>
          </button>

          <button
            type="button"
            onClick={handleDownloadCsv}
            className="flex min-h-[86px] flex-col items-start justify-between rounded-xl border border-[#DECDB8] bg-[#FAF6F0] p-4 text-left transition-colors hover:bg-[#F3ECE1] active:scale-[0.99]"
          >
            <div className="flex items-center gap-2 text-sm font-bold text-[#2C1E16]">
              <FileSpreadsheet className="h-5 w-5 shrink-0 text-[#B85D19]" />
              <span>현재 잔액표 CSV 즉시 다운로드</span>
            </div>
            <span className="mt-2 text-xs text-[#745D4E]">
              한글 깨짐 방지(UTF-8 BOM) 엑셀 파일 저장
            </span>
          </button>
        </div>
      </section>
    </div>
  );
};
