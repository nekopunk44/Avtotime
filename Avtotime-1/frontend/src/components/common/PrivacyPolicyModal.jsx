import React, { useEffect, useMemo, useRef, useState } from "react";
import PrivacyPolicy from "../../pages/PrivacyPolicy";

const CLOSE_ANIMATION_MS = 260;

export default function PrivacyPolicyModal({ open, onClose }) {
  const [shouldRender, setShouldRender] = useState(Boolean(open));
  const closeTimerRef = useRef(null);

  const state = useMemo(() => (open ? "open" : "closing"), [open]);

  useEffect(() => {
    if (open) {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      setShouldRender(true);
      return;
    }

    if (!shouldRender) return;

    closeTimerRef.current = setTimeout(() => {
      setShouldRender(false);
    }, CLOSE_ANIMATION_MS);

    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [open, shouldRender]);

  useEffect(() => {
    if (!shouldRender) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [shouldRender, onClose]);

  if (!shouldRender) return null;

  return (
    <div
      data-state={state}
      className="pp-modal-overlay fixed inset-0 z-[9999] flex items-center justify-center px-4 py-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        data-state={state}
        role="dialog"
        aria-modal="true"
        className="pp-modal-panel w-full max-w-[920px] max-h-[88vh] overflow-hidden rounded-2xl border-2 border-[#1a1f23] bg-white shadow-2xl"
      >
        <div className="relative max-h-[88vh] overflow-y-auto">
          <button
            type="button"
            aria-label="Close"
            className="sticky top-4 float-right mr-4 mt-4 rounded-xl border border-gray-200 bg-white/90 px-3 py-2 text-[14px] font-bold text-gray-700 backdrop-blur hover:bg-gray-50"
            onClick={() => onClose?.()}
          >
            ✕
          </button>
          <PrivacyPolicy inModal onClose={onClose} />
        </div>
      </div>
    </div>
  );
}
