import React, { useEffect, useState } from 'react';
import { Trash2, UserPlus, UserPen, X } from 'lucide-react';
import type { Student } from '../types';

interface StudentFormModalProps {
  open: boolean;
  student: Student | null; // null = create mode, non-null = edit mode
  busy: boolean;
  onClose: () => void;
  onSubmit: (data: {
    student_id?: string;
    name: string;
    info: string;
    parent_phone: string;
    initial_balance?: number;
    memo: string;
  }) => Promise<boolean>;
  onRequestDelete?: (student: Student) => void;
}

export const StudentFormModal: React.FC<StudentFormModalProps> = ({
  open,
  student,
  busy,
  onClose,
  onSubmit,
  onRequestDelete,
}) => {
  const isEdit = Boolean(student);
  const [name, setName] = useState('');
  const [info, setInfo] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [initialBalance, setInitialBalance] = useState('0');
  const [memo, setMemo] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!open) return;
    setFormError('');
    if (student) {
      setName(student.name || '');
      setInfo(student.info || '');
      setParentPhone(student.parent_phone || '');
      setInitialBalance(String(student.balance ?? 0));
      setMemo(student.memo || '');
    } else {
      setName('');
      setInfo('');
      setParentPhone('');
      setInitialBalance('0');
      setMemo('');
    }
  }, [open, student]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError('학생 이름을 입력해 주세요.');
      return;
    }

    const parsedBalance = Math.round(Number(initialBalance.replace(/[,\s]/g, '')) || 0);
    const payload = isEdit
      ? {
          student_id: student!.student_id,
          name: trimmedName,
          info: info.trim(),
          parent_phone: parentPhone.trim(),
          memo: memo.trim(),
        }
      : {
          name: trimmedName,
          info: info.trim(),
          parent_phone: parentPhone.trim(),
          initial_balance: parsedBalance,
          memo: memo.trim(),
        };

    const ok = await onSubmit(payload);
    if (ok) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C1E16]/55 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="student-form-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-[#E5DACB] bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-[#EFE6DA] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FDF3E7] text-[#B85D19]">
              {isEdit ? <UserPen className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
            </div>
            <div>
              <h3 id="student-form-title" className="text-lg font-bold text-[#2C1E16]">
                {isEdit ? '학생 정보 수정' : '신규 학생 등록'}
              </h3>
              <p className="text-xs text-[#745D4E]">
                {isEdit
                  ? '이름, 학년, 보호자 연락처, 내부 메모를 수정합니다.'
                  : '선불 적립금을 사용할 학생을 등록합니다.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[#745D4E] hover:bg-[#F3ECE1] disabled:opacity-50"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[#3F2E23]">
                학생 이름 <span className="text-[#C0302B]">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setFormError('');
                }}
                placeholder="예: 김민수"
                className="min-h-[48px] w-full rounded-xl border border-[#DECDB8] bg-[#FAF6F0] px-3.5 text-base font-medium text-[#2C1E16] placeholder:text-[#A49080] focus:border-[#B85D19] focus:bg-white focus:outline-none"
                autoFocus
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[#3F2E23]">
                학교 / 학년
              </label>
              <input
                type="text"
                value={info}
                onChange={(e) => setInfo(e.target.value)}
                placeholder="예: 초3, 한빛초 4학년"
                className="min-h-[48px] w-full rounded-xl border border-[#DECDB8] bg-[#FAF6F0] px-3.5 text-base font-medium text-[#2C1E16] placeholder:text-[#A49080] focus:border-[#B85D19] focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[#3F2E23]">
                보호자 연락처
              </label>
              <input
                type="tel"
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
                placeholder="예: 010-1234-5678"
                className="font-num min-h-[48px] w-full rounded-xl border border-[#DECDB8] bg-[#FAF6F0] px-3.5 text-base font-medium text-[#2C1E16] placeholder:text-[#A49080] focus:border-[#B85D19] focus:bg-white focus:outline-none"
              />
            </div>

            {!isEdit && (
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-[#3F2E23]">
                  초기 선불 적립금 (원)
                </label>
                <input
                  type="number"
                  step="500"
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(e.target.value)}
                  placeholder="0"
                  className="font-num min-h-[48px] w-full rounded-xl border border-[#DECDB8] bg-[#FAF6F0] px-3.5 text-base font-semibold text-[#2C1E16] placeholder:text-[#A49080] focus:border-[#B85D19] focus:bg-white focus:outline-none"
                />
              </div>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-[#3F2E23]">
              내부 메모 (알레르기, 주의사항 등)
            </label>
            <textarea
              rows={2}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="예: 계피 알레르기, 하루 2개 제한 등 (학생 확인 화면에는 표시되지 않습니다)"
              className="w-full rounded-xl border border-[#DECDB8] bg-[#FAF6F0] p-3.5 text-sm font-medium text-[#2C1E16] placeholder:text-[#A49080] focus:border-[#B85D19] focus:bg-white focus:outline-none"
            />
          </div>

          {formError && (
            <p className="rounded-xl bg-[#FDECEC] px-3.5 py-2.5 text-sm font-semibold text-[#C0302B]">
              {formError}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-[#EFE6DA] pt-4">
            {isEdit && onRequestDelete && student ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => onRequestDelete(student)}
                className="inline-flex min-h-[48px] items-center gap-1.5 rounded-xl border border-[#F5C2C0] bg-[#FDECEC] px-4 py-2.5 text-sm font-semibold text-[#C0302B] transition-colors hover:bg-[#FADADA] disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                학생 삭제
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="min-h-[48px] rounded-xl border border-[#DECDB8] bg-[#FAF6F0] px-5 py-2.5 text-sm font-semibold text-[#4A372B] hover:bg-[#F3ECE1] disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={busy}
                className="min-h-[48px] rounded-xl bg-[#B85D19] px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#9A4B11] disabled:opacity-50"
              >
                {busy ? '저장 중...' : isEdit ? '수정 저장' : '학생 등록'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
