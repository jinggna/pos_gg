import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  title,
  description,
  confirmLabel = '확인',
  cancelLabel = '취소',
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C1E16]/55 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-[#E5DACB] bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                tone === 'danger' ? 'bg-[#FDECEC] text-[#C0302B]' : 'bg-[#FDF3E7] text-[#B85D19]'
              }`}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h3 id="confirm-modal-title" className="text-lg font-bold text-[#2C1E16]">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[#745D4E] transition-colors hover:bg-[#F3ECE1] disabled:opacity-50"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-[#5A4538]">
          {description}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="min-h-[52px] rounded-xl border border-[#DECDB8] bg-[#FAF6F0] px-4 py-3 text-base font-semibold text-[#4A372B] transition-colors hover:bg-[#F3ECE1] active:scale-[0.99] disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`min-h-[52px] rounded-xl px-4 py-3 text-base font-bold text-white transition-colors active:scale-[0.99] disabled:opacity-50 ${
              tone === 'danger'
                ? 'bg-[#C0302B] hover:bg-[#A32622]'
                : 'bg-[#B85D19] hover:bg-[#9A4B11]'
            }`}
          >
            {busy ? '처리 중...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
