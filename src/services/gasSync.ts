import type {
  AppSnapshot,
  FontScaleLevel,
  GasActionPayload,
  LedgerEntry,
  MenuItem,
  OfflineQueueItem,
  StoreSettings,
  Student,
} from '../types';

export const STORAGE_KEYS = {
  GAS_URL: 'kkwabaegi_gas_url',
  SNAPSHOT: 'kkwabaegi_snapshot_v1',
  OFFLINE_QUEUE: 'kkwabaegi_offline_queue_v1',
  AUTO_KIOSK: 'kkwabaegi_auto_kiosk_v1',
  FONT_SCALE: 'kkwabaegi_font_scale_v1',
} as const;

export const FONT_SCALE_CONFIG: Record<
  FontScaleLevel,
  { px: string; label: string; shortLabel: string; description: string }
> = {
  normal: {
    px: '16px',
    label: '보통',
    shortLabel: '보통',
    description: '기본 화면 크기 (16px)',
  },
  large: {
    px: '18.5px',
    label: '크게',
    shortLabel: '크게',
    description: '눈이 편안한 큰 글자 (18.5px)',
  },
  xlarge: {
    px: '21px',
    label: '아주 크게',
    shortLabel: '특대',
    description: '멀리서도 또렷한 특대 글자 (21px)',
  },
};

export const FONT_SCALE_ORDER: FontScaleLevel[] = ['normal', 'large', 'xlarge'];

export const DEFAULT_SETTINGS: StoreSettings = {
  store_name: '우리동네 꽈배기',
  backup_email: '',
  low_balance_limit: 3000,
};

export const EMPTY_SNAPSHOT: AppSnapshot = {
  students: [],
  ledger: [],
  menus: [],
  settings: DEFAULT_SETTINGS,
  synced_at: '',
};

function toBoolean(val: unknown, fallback = true): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const lower = val.trim().toLowerCase();
    if (lower === 'true' || lower === '1' || lower === 'y' || lower === 'yes') return true;
    if (lower === 'false' || lower === '0' || lower === 'n' || lower === 'no') return false;
  }
  if (typeof val === 'number') return val !== 0;
  return fallback;
}

function toNumber(val: unknown, fallback = 0): number {
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[,\s원]/g, '');
    const parsed = Number(cleaned);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
}

/**
 * Normalizes raw JSON snapshot from Google Apps Script to strict TypeScript types.
 */
export function normalizeSnapshot(raw: unknown): AppSnapshot {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  const rawStudents = Array.isArray(data.students) ? data.students : [];
  const students: Student[] = rawStudents
    .filter((s): s is Record<string, unknown> => Boolean(s && typeof s === 'object'))
    .map((s) => ({
      student_id: String(s.student_id ?? s.id ?? ''),
      name: String(s.name ?? '').trim(),
      info: String(s.info ?? '').trim(),
      parent_phone: String(s.parent_phone ?? '').trim(),
      balance: toNumber(s.balance, 0),
      memo: String(s.memo ?? '').trim(),
      created_at: s.created_at ? String(s.created_at) : undefined,
      updated_at: s.updated_at ? String(s.updated_at) : undefined,
    }))
    .filter((s) => s.student_id !== '' || s.name !== '');

  const rawLedger = Array.isArray(data.ledger) ? data.ledger : [];
  const ledger: LedgerEntry[] = rawLedger
    .filter((l): l is Record<string, unknown> => Boolean(l && typeof l === 'object'))
    .map((l) => ({
      tx_id: String(l.tx_id ?? l.id ?? ''),
      student_id: String(l.student_id ?? ''),
      student_name: l.student_name ? String(l.student_name) : undefined,
      timestamp: String(l.timestamp ?? l.created_at ?? l.date ?? ''),
      type: String(l.type || 'USE').toUpperCase(),
      items_summary: String(l.items_summary ?? l.summary ?? ''),
      amount: toNumber(l.amount, 0),
      balance_before: toNumber(l.balance_before, 0),
      balance_after: toNumber(l.balance_after, 0),
      status: String(l.status || 'ACTIVE').toUpperCase(),
    }))
    .filter((l) => l.tx_id !== '' || l.student_id !== '');

  const rawMenus = Array.isArray(data.menus) ? data.menus : [];
  const menus: MenuItem[] = rawMenus
    .filter((m): m is Record<string, unknown> => Boolean(m && typeof m === 'object'))
    .map((m, idx) => ({
      menu_id: String(m.menu_id ?? m.id ?? ''),
      name: String(m.name ?? '').trim(),
      price: toNumber(m.price, 0),
      is_available: toBoolean(m.is_available, true),
      sort_order: m.sort_order !== undefined && m.sort_order !== '' ? toNumber(m.sort_order, idx) : idx,
    }))
    .filter((m) => m.name !== '')
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const rawSettings = (data.settings && typeof data.settings === 'object'
    ? data.settings
    : {}) as Record<string, unknown>;

  const settings: StoreSettings = {
    store_name: String(rawSettings.store_name ?? DEFAULT_SETTINGS.store_name).trim() || DEFAULT_SETTINGS.store_name,
    backup_email: String(rawSettings.backup_email ?? '').trim(),
    low_balance_limit: toNumber(rawSettings.low_balance_limit, DEFAULT_SETTINGS.low_balance_limit),
  };

  return {
    students,
    ledger,
    menus,
    settings,
    synced_at: String(data.synced_at ?? new Date().toISOString()),
  };
}

export function loadGasUrl(): string {
  try {
    return (localStorage.getItem(STORAGE_KEYS.GAS_URL) || '').trim();
  } catch {
    return '';
  }
}

export function saveGasUrl(url: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.GAS_URL, url.trim());
  } catch {
    // ignore storage quota errors
  }
}

export function loadCachedSnapshot(): AppSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SNAPSHOT);
    if (!raw) return EMPTY_SNAPSHOT;
    return normalizeSnapshot(JSON.parse(raw));
  } catch {
    return EMPTY_SNAPSHOT;
  }
}

export function saveCachedSnapshot(snapshot: AppSnapshot): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SNAPSHOT, JSON.stringify(snapshot));
  } catch {
    // ignore storage quota errors
  }
}

export function loadOfflineQueue(): OfflineQueueItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(queue: OfflineQueueItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
  } catch {
    // ignore storage quota errors
  }
}

export function loadAutoKioskSetting(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AUTO_KIOSK);
    return raw === 'true';
  } catch {
    return false;
  }
}

export function saveAutoKioskSetting(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEYS.AUTO_KIOSK, enabled ? 'true' : 'false');
  } catch {
    // ignore
  }
}

export function loadFontScale(): FontScaleLevel {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FONT_SCALE);
    if (raw === 'normal' || raw === 'large' || raw === 'xlarge') {
      return raw;
    }
    return 'normal';
  } catch {
    return 'normal';
  }
}

export function saveFontScale(level: FontScaleLevel): void {
  try {
    localStorage.setItem(STORAGE_KEYS.FONT_SCALE, level);
  } catch {
    // ignore
  }
}

export function applyFontScaleToDocument(level: FontScaleLevel): void {
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.style.fontSize = FONT_SCALE_CONFIG[level].px;
  }
}

export function getNextFontScale(current: FontScaleLevel): FontScaleLevel {
  const idx = FONT_SCALE_ORDER.indexOf(current);
  return FONT_SCALE_ORDER[(idx + 1) % FONT_SCALE_ORDER.length];
}

export class GasNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GasNetworkError';
  }
}

export class GasServerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GasServerError';
  }
}

interface GasResponseEnvelope {
  status?: string;
  success?: boolean;
  data?: unknown;
  error?: string;
  message?: string;
}

function validateGasUrl(gasUrl: string): string {
  const trimmed = gasUrl.trim();
  if (!trimmed) {
    throw new GasServerError('Apps Script URL이 설정되지 않았습니다.');
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new GasServerError(
      '올바른 Google Apps Script 웹 앱 URL(https://script.google.com/macros/s/.../exec)을 입력해 주세요.'
    );
  }
  return trimmed;
}

function isFullSnapshotData(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return (
    Array.isArray(obj.students) &&
    Array.isArray(obj.ledger) &&
    Array.isArray(obj.menus) &&
    Boolean(obj.settings && typeof obj.settings === 'object')
  );
}

function summarizeRawText(rawText: string): string {
  const trimmed = rawText.trim();
  if (!trimmed) return '(빈 응답)';
  const titleMatch = trimmed.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch?.[1]) {
    return `HTML 응답: ${titleMatch[1].replace(/\s+/g, ' ').trim()}`;
  }
  const singleLine = trimmed.replace(/\s+/g, ' ');
  return singleLine.length > 160 ? `${singleLine.slice(0, 160)}...` : singleLine;
}

function parseGasJsonResponse(rawText: string, status: number): GasResponseEnvelope {
  try {
    const parsed = JSON.parse(rawText);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error(`예상치 못한 JSON 값 타입(${typeof parsed})`);
    }
    return parsed as GasResponseEnvelope;
  } catch (err) {
    const parseErrMsg = err instanceof Error ? err.message : String(err);
    const preview = summarizeRawText(rawText);
    throw new GasServerError(
      `[HTTP ${status}] JSON 파싱 실패 (${parseErrMsg}) — 응답 내용: ${preview}`
    );
  }
}

export function generateTxId(suffix?: string | number): string {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  const tail = suffix !== undefined ? `_${suffix}` : '';
  return `TX_${Date.now()}_${rand}${tail}`;
}

/**
 * Normalize legacy offline-queue action names (if any exist in localStorage)
 * to the exact Code.gs doPost action names.
 */
function buildGasPostEnvelope(actionPayload: GasActionPayload): {
  action: string;
  payload: Record<string, unknown>;
} {
  const raw = actionPayload as unknown as Record<string, unknown>;
  const rawAction = String(raw.action || '');
  const { action: _ignored, ...rest } = raw;

  if (rawAction === 'RECORD_TX' || rawAction === 'recordTransaction') {
    return {
      action: 'recordTransaction',
      payload: {
        tx_id: rest.tx_id || generateTxId(),
        student_id: rest.student_id,
        type: rest.type,
        items_summary: rest.items_summary,
        amount: rest.amount,
        created_at: rest.created_at || new Date().toISOString(),
      },
    };
  }

  if (rawAction === 'BATCH_RECORD_TX' || rawAction === 'batchRecordTx') {
    const rawItems = Array.isArray(rest.items) ? rest.items : [];
    const nowIso = new Date().toISOString();
    const normalizedItems = rawItems.map((item, idx) => {
      const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      return {
        tx_id: row.tx_id || generateTxId(idx + 1),
        student_id: row.student_id,
        type: row.type,
        items_summary: row.items_summary,
        amount: row.amount,
        created_at: row.created_at || nowIso,
      };
    });
    return {
      action: 'batchRecordTx',
      payload: {
        items: normalizedItems,
      },
    };
  }

  if (rawAction === 'VOID_TX' || rawAction === 'cancelTransaction') {
    return {
      action: 'cancelTransaction',
      payload: {
        tx_id: rest.tx_id,
      },
    };
  }

  return {
    action: rawAction,
    payload: rest,
  };
}

/**
 * GET latest snapshot directly from Google Apps Script Web App URL.
 * Calls fetch(`${gasUrl}?t=${Date.now()}`, { method: 'GET', redirect: 'follow' })
 * without any custom headers to avoid CORS preflight (OPTIONS).
 * Expects `{ status: "success", data: { students, ledger, menus, settings } }`.
 */
export async function fetchGasSnapshot(gasUrl: string): Promise<AppSnapshot> {
  const trimmed = validateGasUrl(gasUrl);
  const separator = trimmed.includes('?') ? '&' : '?';
  const requestUrl = `${trimmed}${separator}t=${Date.now()}`;

  let response: Response;
  try {
    response = await fetch(requestUrl, {
      method: 'GET',
      redirect: 'follow',
    });
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    throw new GasNetworkError(`네트워크/CORS 요청 실패: ${rawMsg}`);
  }

  const rawText = await response.text();
  if (!response.ok) {
    throw new GasServerError(
      `[HTTP ${response.status}] 서버 응답 오류: ${summarizeRawText(rawText)}`
    );
  }

  const json = parseGasJsonResponse(rawText, response.status);
  if (json.status !== 'success') {
    throw new GasServerError(
      json.message ||
        json.error ||
        `구글 시트 조회 실패 (status: ${String(json.status ?? '없음')})`
    );
  }

  if (!json.data || typeof json.data !== 'object') {
    throw new GasServerError(
      `Apps Script 응답에 data 객체가 없습니다 (키 목록: ${Object.keys(json).join(', ') || '없음'}).`
    );
  }

  return normalizeSnapshot(json.data);
}

/**
 * POST mutation payload directly to Google Apps Script using text/plain;charset=utf-8
 * and redirect: 'follow' (never mode: 'no-cors') so real JSON errors & updated data are read.
 * Sends `{ action, payload }` JSON string matching Code.gs doPost(e).
 */
export async function postGasAction(
  gasUrl: string,
  actionPayload: GasActionPayload
): Promise<{ snapshot: AppSnapshot; message?: string }> {
  const trimmed = validateGasUrl(gasUrl);
  const requestBody = buildGasPostEnvelope(actionPayload);

  let response: Response;
  try {
    response = await fetch(trimmed, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      redirect: 'follow',
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    throw new GasNetworkError(`네트워크/CORS 전송 실패: ${rawMsg}`);
  }

  const rawText = await response.text();
  if (!response.ok) {
    throw new GasServerError(
      `[HTTP ${response.status}] 서버 요청 실패: ${summarizeRawText(rawText)}`
    );
  }

  const json = parseGasJsonResponse(rawText, response.status);
  if (json.status !== 'success') {
    throw new GasServerError(json.message || json.error || '구글 시트 반영 실패');
  }

  // If Code.gs returned the full updated snapshot inside json.data, use it directly
  if (isFullSnapshotData(json.data)) {
    return {
      snapshot: normalizeSnapshot(json.data),
      message: json.message,
    };
  }

  // If json.data is empty or partial, immediately fetch the full latest snapshot via GET
  try {
    const fresh = await fetchGasSnapshot(trimmed);
    return { snapshot: fresh, message: json.message };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new GasServerError(
      `시트 반영 후 최신 데이터 동기화에 실패했습니다. 상단 [동기화] 버튼을 눌러 잔액을 확인해 주세요. (${msg})`
    );
  }
}

export function describeActionPayload(payload: GasActionPayload): string {
  const action = String((payload as { action: string }).action);
  switch (action) {
    case 'recordTransaction':
    case 'RECORD_TX': {
      const tx = payload as Extract<GasActionPayload, { action: 'recordTransaction' }>;
      return tx.type === 'USE'
        ? `차감 (${tx.items_summary}, ${tx.amount.toLocaleString('ko-KR')}원)`
        : `충전 (+${tx.amount.toLocaleString('ko-KR')}원)`;
    }
    case 'cancelTransaction':
    case 'VOID_TX': {
      const tx = payload as Extract<GasActionPayload, { action: 'cancelTransaction' }>;
      return `거래 취소 (${tx.tx_id})`;
    }
    case 'UPSERT_STUDENT': {
      const st = payload as Extract<GasActionPayload, { action: 'UPSERT_STUDENT' }>;
      return st.student_id ? `학생 수정 (${st.name})` : `신규 학생 등록 (${st.name})`;
    }
    case 'DELETE_STUDENT':
      return `학생 삭제`;
    case 'BATCH_IMPORT': {
      const imp = payload as Extract<GasActionPayload, { action: 'BATCH_IMPORT' }>;
      return `장부 일괄 등록 (${imp.students.length}명)`;
    }
    case 'batchRecordTx':
    case 'BATCH_RECORD_TX': {
      const batch = payload as Extract<GasActionPayload, { action: 'batchRecordTx' }>;
      return `임시 장부 일괄 반영 (${batch.items.length}건)`;
    }
    case 'UPSERT_MENU': {
      const m = payload as Extract<GasActionPayload, { action: 'UPSERT_MENU' }>;
      return m.menu_id ? `메뉴 수정 (${m.name})` : `메뉴 추가 (${m.name})`;
    }
    case 'DELETE_MENU':
      return `메뉴 삭제`;
    case 'UPDATE_SETTINGS':
      return `가게 설정 저장`;
    case 'REBUILD_BALANCES':
      return `잔액 전체 재검산`;
    case 'MANUAL_BACKUP':
      return `수동 백업 실행`;
    default:
      return `요청 처리 (${action})`;
  }
}
