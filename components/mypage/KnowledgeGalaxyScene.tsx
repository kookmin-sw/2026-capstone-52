"use client";

import { motion } from "framer-motion";
import type { GraphNodeRecord } from "@/types/profile";

const starSeed = Array.from({ length: 36 }, (_, index) => ({
  id: `star-${index}`,
  left: `${(index * 13) % 100}%`,
  top: `${(index * 23) % 100}%`,
  size: 1 + (index % 3),
  delay: (index % 6) * 0.4,
}));

const orbitSeed = [
  { id: "orbit-1", left: "7%", top: "7%", size: 360, color: "rgba(140,82,23,0.58)" },
  { id: "orbit-2", left: "64%", top: "3%", size: 320, color: "rgba(34,91,132,0.58)" },
  { id: "orbit-3", left: "76%", top: "25%", size: 400, color: "rgba(31,83,123,0.58)" },
  { id: "orbit-4", left: "43%", top: "46%", size: 240, color: "rgba(97,55,20,0.48)" },
  { id: "orbit-5", left: "8%", top: "58%", size: 180, color: "rgba(98,59,22,0.5)" },
  { id: "orbit-6", left: "56%", top: "77%", size: 280, color: "rgba(72,44,139,0.58)" },
  { id: "orbit-7", left: "13%", top: "83%", size: 170, color: "rgba(29,96,65,0.45)" },
  { id: "orbit-8", left: "30%", top: "91%", size: 190, color: "rgba(35,116,75,0.48)" },
];

const dustSeed = Array.from({ length: 28 }, (_, index) => ({
  id: `dust-${index}`,
  left: `${(index * 17 + 3) % 96}%`,
  top: `${(index * 31 + 6) % 98}%`,
  size: 4 + (index % 5) * 3,
  color: ["#8b5cf6", "#60a5fa", "#f59e0b", "#22c55e", "#737373"][index % 5],
  opacity: 0.22 + (index % 4) * 0.08,
}));

interface KnowledgeGalaxySceneProps {
  nodes: GraphNodeRecord[];
  dense?: boolean;
}

export default function KnowledgeGalaxyScene({
  nodes,
  dense = false,
}: KnowledgeGalaxySceneProps) {
  if (dense) {
    return (
      <div className="relative h-full min-h-full overflow-hidden rounded-[19px] bg-[#080910]">
        {starSeed.concat(starSeed).map((star, index) => (
          <motion.span
            key={`${star.id}-${index}`}
            aria-hidden="true"
            className="pointer-events-none absolute rounded-full bg-white/55"
            style={{
              left: `${(Number.parseFloat(star.left) + index * 7) % 100}%`,
              top: `${(Number.parseFloat(star.top) + index * 11) % 100}%`,
              width: index % 4 === 0 ? 2 : 1,
              height: index % 4 === 0 ? 2 : 1,
            }}
            animate={{ opacity: [0.15, 0.6, 0.15] }}
            transition={{
              duration: 4.8 + (index % 6),
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
              delay: (index % 8) * 0.25,
            }}
          />
        ))}

        {orbitSeed.map((orbit, index) => (
          <motion.span
            key={orbit.id}
            aria-hidden="true"
            className="pointer-events-none absolute rounded-full"
            style={{
              left: orbit.left,
              top: orbit.top,
              width: orbit.size,
              height: orbit.size,
              backgroundColor: orbit.color,
            }}
            animate={{
              x: [0, index % 2 === 0 ? 8 : -8, 0],
              y: [0, index % 2 === 0 ? -5 : 5, 0],
            }}
            transition={{
              duration: 10 + index,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
              delay: index * 0.2,
            }}
          />
        ))}

        {dustSeed.map((dust, index) => (
          <motion.span
            key={dust.id}
            aria-hidden="true"
            className="pointer-events-none absolute rounded-full"
            style={{
              left: dust.left,
              top: dust.top,
              width: dust.size,
              height: dust.size,
              backgroundColor: dust.color,
              opacity: dust.opacity,
            }}
            animate={{
              opacity: [dust.opacity, dust.opacity + 0.18, dust.opacity],
              scale: [1, 1.08, 1],
            }}
            transition={{
              duration: 6 + (index % 5),
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
              delay: index * 0.12,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[22rem] overflow-hidden rounded-[1.8rem] bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.22),transparent_22%),radial-gradient(circle_at_20%_80%,rgba(56,189,248,0.15),transparent_25%),linear-gradient(180deg,#09090f_0%,#11111a_48%,#09090f_100%)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.04)_0,transparent_52%)]" />

      {starSeed.map((star) => (
        <motion.span
          key={star.id}
          aria-hidden="true"
          className="pointer-events-none absolute rounded-full bg-white/75"
          style={{
            left: star.left,
            top: star.top,
            width: star.size,
            height: star.size,
            boxShadow: "0 0 12px rgba(255,255,255,0.35)",
          }}
          animate={{
            opacity: [0.25, 0.8, 0.25],
            scale: [1, 1.3, 1],
          }}
          transition={{
            duration: 4.4 + star.delay,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
            delay: star.delay,
          }}
        />
      ))}

      <div className="pointer-events-none absolute inset-[10%] rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.14),transparent_65%)] blur-3xl" />

      {nodes.map((node, index) => (
        <motion.div
          key={node.id}
          className="absolute"
          style={{
            left: `${node.x}%`,
            top: `${node.y}%`,
          }}
          animate={{
            x: [0, dense ? 5 : 8, 0],
            y: [0, dense ? -4 : -7, 0],
          }}
          transition={{
            duration: 6 + (index % 4),
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
            delay: index * 0.18,
          }}
        >
          <div
            className="absolute left-1/2 top-1/2 h-px -translate-x-1/2 -translate-y-1/2 bg-white/10"
            style={{
              width: dense ? 92 : 120,
              transform: `translate(-50%, -50%) rotate(${(index * 27) % 180}deg)`,
            }}
          />
          <div
            className="relative rounded-full border border-white/20"
            style={{
              width: `${node.size * (dense ? 12 : 15)}px`,
              height: `${node.size * (dense ? 12 : 15)}px`,
              backgroundColor: node.color,
              boxShadow: `0 0 35px ${node.color}66, 0 0 12px ${node.color}`,
            }}
          />
          {!dense ? (
            <span className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap text-[11px] text-zinc-200/78">
              {node.name}
            </span>
          ) : null}
        </motion.div>
      ))}
    </div>
  );
}
