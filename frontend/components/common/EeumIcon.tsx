"use client";

import type { CSSProperties } from "react";
import { useEffect, useId, useRef, useState } from "react";

type EeumIconProps = {
  className?: string;
  title?: string;
  isLoading?: boolean;
  variant?: "default" | "sparkle";
};

const BIG_SPIN_DURATION_MS = 3200;
const SMALL_SPIN_DURATION_MS = 2400;
const SETTLE_DURATION_MAX_MS = 780;
const SETTLE_DURATION_MIN_MS = 220;

function getSpinAngle(elapsedMs: number, durationMs: number) {
  return ((elapsedMs % durationMs) / durationMs) * 360;
}

function getSettleMotion(angle: number) {
  const targetAngle = angle > 180 ? 360 : 0;
  const distance = Math.abs(targetAngle - angle);
  const duration = Math.round(
    SETTLE_DURATION_MIN_MS +
      (SETTLE_DURATION_MAX_MS - SETTLE_DURATION_MIN_MS) * (distance / 180)
  );

  return { targetAngle, duration };
}

export default function EeumIcon({
  className = "h-7 w-7",
  title,
  isLoading = false,
  variant = "default",
}: EeumIconProps) {
  const id = useId();
  const gradientId = `eeum-icon-bg-${id}`;
  const sparkleId = `eeum-icon-sparkle-${id}`;
  const [isSettling, setIsSettling] = useState(false);
  const [settleMotion, setSettleMotion] = useState({
    bigAngle: 0,
    smallAngle: 0,
    bigTargetAngle: 0,
    smallTargetAngle: 0,
    bigDuration: SETTLE_DURATION_MIN_MS,
    smallDuration: SETTLE_DURATION_MIN_MS,
  });
  const loadingStartedAtRef = useRef<number | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasLoadingRef = useRef(isLoading);
  const variantClassName = variant === "sparkle" ? "eeum-logo-sparkle" : "";
  const settleClassName = variant === "sparkle" && isSettling && !isLoading ? "eeum-logo-settling" : "";
  const motionStyle =
    variant === "sparkle"
      ? ({
          "--eeum-logo-settle-big-from": `${settleMotion.bigAngle}deg`,
          "--eeum-logo-settle-small-from": `${settleMotion.smallAngle}deg`,
          "--eeum-logo-settle-big-to": `${settleMotion.bigTargetAngle}deg`,
          "--eeum-logo-settle-small-to": `${settleMotion.smallTargetAngle}deg`,
          "--eeum-logo-settle-big-duration": `${settleMotion.bigDuration}ms`,
          "--eeum-logo-settle-small-duration": `${settleMotion.smallDuration}ms`,
        } as CSSProperties)
      : undefined;

  useEffect(() => {
    if (variant !== "sparkle") {
      wasLoadingRef.current = isLoading;
      return;
    }

    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }

    if (isLoading) {
      loadingStartedAtRef.current = performance.now();
      setIsSettling(false);
      wasLoadingRef.current = true;
      return;
    }

    if (wasLoadingRef.current) {
      const elapsedMs =
        loadingStartedAtRef.current === null ? 0 : performance.now() - loadingStartedAtRef.current;
      const bigAngle = getSpinAngle(elapsedMs, BIG_SPIN_DURATION_MS);
      const smallAngle = getSpinAngle(elapsedMs, SMALL_SPIN_DURATION_MS);
      const bigSettleMotion = getSettleMotion(bigAngle);
      const smallSettleMotion = getSettleMotion(smallAngle);

      setSettleMotion({
        bigAngle,
        smallAngle,
        bigTargetAngle: bigSettleMotion.targetAngle,
        smallTargetAngle: smallSettleMotion.targetAngle,
        bigDuration: bigSettleMotion.duration,
        smallDuration: smallSettleMotion.duration,
      });
      setIsSettling(true);
      loadingStartedAtRef.current = null;

      settleTimerRef.current = setTimeout(() => {
        setIsSettling(false);
        settleTimerRef.current = null;
      }, Math.max(bigSettleMotion.duration, smallSettleMotion.duration) + 80);
    }

    wasLoadingRef.current = false;
  }, [isLoading, variant]);

  useEffect(() => {
    return () => {
      if (settleTimerRef.current) {
        clearTimeout(settleTimerRef.current);
      }
    };
  }, []);

  return (
    <svg
      aria-hidden={title ? undefined : true}
      aria-label={title}
      role={title ? "img" : undefined}
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} eeum-logo ${variantClassName} ${
        isLoading ? "eeum-logo-loading" : ""
      } ${settleClassName}`}
      style={motionStyle}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8B7FC7" />
          <stop offset="55%" stopColor="#E57FA3" />
          <stop offset="100%" stopColor="#F4A97A" />
        </linearGradient>
        <path
          id={sparkleId}
          d="M 0 -38 C 3 -12 12 -3 38 0 C 12 3 3 12 0 38 C -3 12 -12 3 -38 0 C -12 -3 -3 -12 0 -38 Z"
          fill="white"
        />
      </defs>

      <rect width="200" height="200" rx="45" fill={`url(#${gradientId})`} />

      <g className="eeum-logo-triangle">
        <line x1="60" y1="55" x2="140" y2="55" stroke="white" strokeWidth="6" strokeOpacity="0.6" />
        <line x1="60" y1="55" x2="100" y2="145" stroke="white" strokeWidth="6" strokeOpacity="0.6" />
        <line x1="140" y1="55" x2="100" y2="145" stroke="white" strokeWidth="6" strokeOpacity="0.6" />
        <circle cx="60" cy="55" r="21" fill="white" />
        <circle cx="140" cy="55" r="21" fill="white" />
        <circle cx="100" cy="145" r="21" fill="white" />
      </g>

      <g className="eeum-logo-star-wrapper eeum-logo-star-big">
        <g transform="translate(100, 100)">
          <use className="eeum-logo-star-shape eeum-logo-star-shape-big" href={`#${sparkleId}`} />
        </g>
      </g>

      <g className="eeum-logo-star-wrapper eeum-logo-star-small">
        <g transform="translate(100, 100)">
          <use className="eeum-logo-star-shape eeum-logo-star-shape-small" href={`#${sparkleId}`} />
        </g>
      </g>
    </svg>
  );
}
