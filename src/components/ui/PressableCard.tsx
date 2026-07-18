"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { motion } from "framer-motion";
import { useAppReducedMotion } from "@/hooks/useAppReducedMotion";
import Card, { type CardAccent, type CardPadding } from "./Card";

interface PressableCardProps {
  href: string;
  children: ReactNode;
  accent?: CardAccent;
  padding?: CardPadding;
  bevel?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * Link-wrapped card with the same spring press/hover feel as
 * src/components/juice/Pressable.tsx (which only wraps <button>).
 * Honors reduced-motion the same way — springs no-op, tap state stays instant.
 */
export default function PressableCard({
  href,
  children,
  accent,
  padding,
  bevel,
  className,
  style,
}: PressableCardProps) {
  const reduceMotion = useAppReducedMotion();

  return (
    <Link href={href} className="pw-press" style={{ textDecoration: "none", display: "block" }}>
      <motion.div
        whileTap={reduceMotion ? undefined : { scale: 0.97 }}
        whileHover={reduceMotion ? undefined : { scale: 1.015, y: -2 }}
        transition={{ type: "spring", stiffness: 550, damping: 28 }}
      >
        <Card accent={accent} padding={padding} bevel={bevel} className={className} style={style}>
          {children}
        </Card>
      </motion.div>
    </Link>
  );
}
