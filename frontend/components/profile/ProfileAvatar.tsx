"use client";

import type { CSSProperties } from "react";

interface ProfileAvatarProps {
  name: string;
  image: string | null;
  size?: number;
  className?: string;
}

export default function ProfileAvatar({
  name,
  image,
  size = 80,
  className = "",
}: ProfileAvatarProps) {
  const style = { width: size, height: size } satisfies CSSProperties;

  if (image) {
    return (
      <img
        src={image}
        alt={`${name} 프로필 이미지`}
        className={`rounded-full object-cover ${className}`}
        style={style}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`flex items-center justify-center rounded-full bg-gradient-to-br from-violet-500/90 via-violet-400/80 to-sky-400/80 text-lg font-semibold text-white ${className}`}
      style={style}
    >
      {name.slice(0, 1)}
    </div>
  );
}
