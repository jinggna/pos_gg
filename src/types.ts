export interface Student {
  student_id: string;
  name: string;
  info: string;
  parent_phone: string;
  balance: number;
  memo: string;
  created_at?: string;
  updated_at?: string;
}

export interface LedgerEntry {
  tx_id: string;
  student_id: string;
  student_name?: string;
  timestamp: string;
  type: 'USE' | 'CHARGE' | 'VOID' | string;
  items_summary: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  status: 'ACTIVE' | 'VOIDED' | string;
}

export interface MenuItem {
  menu_id: string;
  name: string;
  price: number;
  is_available: boolean;
  sort_order?: number;
}

export interface StoreSettings {
  store_name: string;
  backup_email: string;
  low_balance_limit: number;
}

export interface AppSnapshot {
  students: Student[];
  ledger: LedgerEntry[];
  menus: MenuItem[];
  settings: StoreSettings;
  synced_at: string;
}

export type GasActionPayload =
  | {
      action: 'recordTransaction';
      tx_id: string;
      student_id: string;
      type: 'USE' | 'CHARGE';
      items_summary: string;
      amount: number;
      created_at: string;
    }
  | {
      action: 'cancelTransaction';
      tx_id: string;
    }
  | {
      action: 'UPSERT_STUDENT';
      student_id?: string;
      name: string;
      info: string;
      parent_phone: string;
      initial_balance?: number;
      memo: string;
    }
  | {
      action: 'DELETE_STUDENT';
      student_id: string;
    }
  | {
      action: 'BATCH_IMPORT';
      students: Array<{
        name: string;
        info: string;
        parent_phone: string;
        balance: number;
        memo: string;
      }>;
    }
  | {
      action: 'batchRecordTx';
      items: BatchTxItem[];
    }
  | {
      action: 'UPSERT_MENU';
      menu_id?: string;
      name: string;
      price: number;
      is_available: boolean;
      sort_order?: number;
    }
  | {
      action: 'DELETE_MENU';
      menu_id: string;
    }
  | {
      action: 'UPDATE_SETTINGS';
      settings: {
        backup_email: string;
        store_name: string;
        low_balance_limit: number;
      };
    }
  | {
      action: 'REBUILD_BALANCES';
    }
  | {
      action: 'MANUAL_BACKUP';
    };

export interface OfflineQueueItem {
  id: string;
  createdAt: string;
  label: string;
  payload: GasActionPayload;
}

export interface CartItem {
  menu: MenuItem;
  quantity: number;
}

export interface StagingTxRow {
  rowId: string;
  student_id: string;
  type: 'USE' | 'CHARGE';
  items_summary: string;
  amount: number;
}

export interface BatchTxItem {
  tx_id?: string;
  student_id: string;
  type: 'USE' | 'CHARGE';
  items_summary: string;
  amount: number;
  created_at?: string;
}

export interface KioskDeductionContext {
  itemsSummary: string;
  deductedAmount: number;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

export type ActiveTab = 'pos' | 'ocr' | 'menu-ledger' | 'settings';

export type FontScaleLevel = 'normal' | 'large' | 'xlarge';
