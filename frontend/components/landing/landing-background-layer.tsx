"use client";

import { useEffect, useRef } from "react";

type OrbConfig = {
  color: string;
  initialX: number;
  initialY: number;
  opacity: number;
  size: number;
  velocityX: number;
  velocityY: number;
};

const backgroundOrbs: OrbConfig[] = [
  {
    color: "rgba(255, 187, 152, 0.62)",
    initialX: 0.76,
    initialY: 0.12,
    opacity: 0.58,
    size: 560,
    velocityX: 256,
    velocityY: 172,
  },
  {
    color: "rgba(183, 244, 226, 0.66)",
    initialX: 0.9,
    initialY: 0.31,
    opacity: 0.56,
    size: 600,
    velocityX: -224,
    velocityY: 264,
  },
  {
    color: "rgba(137, 126, 242, 0.42)",
    initialX: 0.14,
    initialY: 0.1,
    opacity: 0.44,
    size: 520,
    velocityX: 236,
    velocityY: -184,
  },
  {
    color: "rgba(255, 187, 152, 0.42)",
    initialX: 0.88,
    initialY: 0.88,
    opacity: 0.42,
    size: 500,
    velocityX: -272,
    velocityY: -156,
  },
  {
    color: "rgba(129, 124, 242, 0.22)",
    initialX: 0.1,
    initialY: 0.62,
    opacity: 0.32,
    size: 520,
    velocityX: 184,
    velocityY: 236,
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function LandingBackgroundLayer() {
  const orbRefs = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let viewportWidth = window.innerWidth;
    let viewportHeight = window.innerHeight;

    const orbs = backgroundOrbs.map((orb) => ({
      ...orb,
      x: clamp(viewportWidth * orb.initialX - orb.size / 2, -orb.size * 0.15, viewportWidth - orb.size * 0.85),
      y: clamp(viewportHeight * orb.initialY - orb.size / 2, -orb.size * 0.15, viewportHeight - orb.size * 0.85),
    }));

    const paintOrbs = () => {
      orbs.forEach((orb, index) => {
        const element = orbRefs.current[index];

        if (!element) {
          return;
        }

        element.style.transform = `translate3d(${orb.x}px, ${orb.y}px, 0)`;
      });
    };

    const updateBounds = () => {
      viewportWidth = window.innerWidth;
      viewportHeight = window.innerHeight;

      orbs.forEach((orb) => {
        orb.x = clamp(orb.x, -orb.size * 0.15, viewportWidth - orb.size * 0.85);
        orb.y = clamp(orb.y, -orb.size * 0.15, viewportHeight - orb.size * 0.85);
      });

      paintOrbs();
    };

    updateBounds();

    if (prefersReducedMotion) {
      return undefined;
    }

    let animationFrame = 0;
    let previousTime = performance.now();

    const animate = (currentTime: number) => {
      const deltaSeconds = Math.min((currentTime - previousTime) / 1000, 0.034);
      previousTime = currentTime;

      if (!document.hidden) {
        orbs.forEach((orb) => {
          const minX = -orb.size * 0.15;
          const minY = -orb.size * 0.15;
          const maxX = viewportWidth - orb.size * 0.85;
          const maxY = viewportHeight - orb.size * 0.85;

          orb.x += orb.velocityX * deltaSeconds;
          orb.y += orb.velocityY * deltaSeconds;

          if (orb.x <= minX || orb.x >= maxX) {
            orb.x = clamp(orb.x, minX, maxX);
            orb.velocityX *= -1;
          }

          if (orb.y <= minY || orb.y >= maxY) {
            orb.y = clamp(orb.y, minY, maxY);
            orb.velocityY *= -1;
          }
        });

        paintOrbs();
      }

      animationFrame = window.requestAnimationFrame(animate);
    };

    window.addEventListener("resize", updateBounds);
    animationFrame = window.requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", updateBounds);
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, #fbfbff 0%, #ffffff 32%, #fbfbff 68%, #f8f7ff 100%)",
        }}
      />
      {backgroundOrbs.map((orb, index) => (
        <span
          key={`${orb.color}-${index}`}
          ref={(element) => {
            orbRefs.current[index] = element;
          }}
          className="absolute left-0 top-0 rounded-full blur-xl will-change-transform"
          style={{
            width: `${orb.size}px`,
            height: `${orb.size}px`,
            opacity: orb.opacity,
            background: `radial-gradient(circle, ${orb.color} 0%, ${orb.color} 34%, transparent 70%)`,
          }}
        />
      ))}
    </div>
  );
}
