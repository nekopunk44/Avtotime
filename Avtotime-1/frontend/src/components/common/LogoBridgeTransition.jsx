import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const EVENT_NAME = "avtotime:logo-bridge";
const FADE_IN_MS = 120;
const FADE_OUT_MS = 180;
const HOLD_MS = 60;

const prefersReducedMotion = () => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

export default function LogoBridgeTransition() {
  const navigate = useNavigate();
  const [active, setActive] = useState(false);
  const timersRef = useRef([]);
  const inTransitionRef = useRef(false);
  const overlayRef = useRef(null);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      clearTimers();
      inTransitionRef.current = false;
    };
  }, [clearTimers]);

  useEffect(() => {
    const handle = (event) => {
      const detail = event?.detail || {};
      const to = typeof detail.to === "string" && detail.to ? detail.to : "/";

      if (prefersReducedMotion() || typeof window === "undefined") {
        inTransitionRef.current = false;
        navigate(to, { state: { transition: "social-to-market" } });
        return;
      }

      if (inTransitionRef.current) return;
      inTransitionRef.current = true;

      setActive(true);

      // Next frame: start fade-in from 0 → 1, navigate immediately under the overlay
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const el = overlayRef.current;
          if (el) {
            el.style.transition = `opacity ${FADE_IN_MS}ms ease-out`;
            el.style.opacity = "1";
          }
          navigate(to, { state: { transition: "social-to-market" } });
        });
      });

      timersRef.current.push(
        window.setTimeout(() => {
          const el = overlayRef.current;
          if (el) {
            el.style.transition = `opacity ${FADE_OUT_MS}ms ease-in`;
            el.style.opacity = "0";
          }

          timersRef.current.push(
            window.setTimeout(() => {
              inTransitionRef.current = false;
              setActive(false);
            }, FADE_OUT_MS),
          );
        }, FADE_IN_MS + HOLD_MS),
      );
    };

    window.addEventListener(EVENT_NAME, handle);
    return () => window.removeEventListener(EVENT_NAME, handle);
  }, [clearTimers, navigate]);

  if (!active) return null;

  return (
    <div
      ref={overlayRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "radial-gradient(circle at center, rgba(255,255,255,0.08), rgba(0,0,0,0.18) 55%, rgba(0,0,0,0.28) 100%)",
        opacity: 0,
        transition: "none",
        pointerEvents: "none",
        backdropFilter: "blur(6px)",
      }}
    />
  );
}
