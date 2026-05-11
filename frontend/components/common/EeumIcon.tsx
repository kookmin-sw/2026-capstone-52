import { useId } from "react";

type EeumIconProps = {
  className?: string;
  title?: string;
  isLoading?: boolean;
};

export default function EeumIcon({ className = "h-7 w-7", title, isLoading = false }: EeumIconProps) {
  const id = useId();
  const gradientId = `eeum-icon-bg-${id}`;
  const sparkleId = `eeum-icon-sparkle-${id}`;

  return (
    <svg
      aria-hidden={title ? undefined : true}
      aria-label={title}
      role={title ? "img" : undefined}
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} eeum-logo ${isLoading ? "eeum-logo-loading" : ""}`}
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
