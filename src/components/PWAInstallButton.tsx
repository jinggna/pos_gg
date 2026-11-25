import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Already running as a standalone installed PWA
  if (isInstalled) {
    return null;
  }

  // Android Chrome / Chromium tablet & desktop native install flow
  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        title="홈 화면에 단독 전체 화면 앱으로 설치"
        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#B85D19]/30 bg-[#FDF3E7] px-3 py-1.5 text-xs font-bold text-[#9A4B11] transition-colors hover:border-[#B85D19] hover:bg-[#F9E6CE] active:scale-[0.98] whitespace-nowrap shrink-0"
      >
        <Download className="h-3.5 w-3.5 shrink-0" />
        <span>앱 설치</span>
      </button>
    );
  }

  // iPad / iPhone Safari guided install flow
  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          title="아이패드 홈 화면에 전체 화면 앱으로 추가하는 방법 보기"
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#B85D19]/30 bg-[#FDF3E7] px-3 py-1.5 text-xs font-bold text-[#9A4B11] transition-colors hover:border-[#B85D19] hover:bg-[#F9E6CE] active:scale-[0.98] whitespace-nowrap shrink-0"
        >
          <Download className="h-3.5 w-3.5 shrink-0" />
          <span>홈 화면 추가</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-[105] flex items-center justify-center bg-[#2C1E16]/45 p-4 backdrop-blur-[1px]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-pwa-guide-title"
          >
            <div className="w-full max-w-md rounded-2xl border border-[#E5DACB] bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <h3
                  id="ios-pwa-guide-title"
                  className="text-lg font-bold text-[#2C1E16]"
                >
                  아이패드·아이폰 전체 화면 앱 설치
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[#745D4E] hover:bg-[#FAF6F0]"
                  aria-label="닫기"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <ol className="mt-4 space-y-2.5 text-sm leading-relaxed text-[#4A372B]">
                <li className="flex items-start gap-2.5 rounded-xl bg-[#FAF6F0] px-3.5 py-2.5">
                  <span className="font-num font-bold text-[#B85D19]">1.</span>
                  <span>
                    Safari 상단(또는 하단) 도구 모음의{' '}
                    <strong className="inline-flex items-center gap-1 font-bold text-[#2C1E16]">
                      <Share className="inline h-3.5 w-3.5" /> 공유
                    </strong>{' '}
                    버튼을 눌러 주세요.
                  </span>
                </li>
                <li className="flex items-start gap-2.5 rounded-xl bg-[#FAF6F0] px-3.5 py-2.5">
                  <span className="font-num font-bold text-[#B85D19]">2.</span>
                  <span>
                    메뉴에서 <strong className="font-bold text-[#2C1E16]">홈 화면에 추가</strong>를 선택한 뒤 오른쪽 위{' '}
                    <strong className="font-bold text-[#2C1E16]">추가</strong>를 눌러 주세요.
                  </span>
                </li>
                <li className="flex items-start gap-2.5 rounded-xl bg-[#FAF6F0] px-3.5 py-2.5">
                  <span className="font-num font-bold text-[#B85D19]">3.</span>
                  <span>
                    홈 화면에 생성된 <strong className="font-bold text-[#2C1E16]">꽈배기 POS</strong> 아이콘으로 실행하면 주소창 없는 단독 전체 화면으로 열립니다.
                  </span>
                </li>
              </ol>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 min-h-[46px] w-full rounded-xl bg-[#B85D19] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#9A4B11]"
              >
                확인
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
