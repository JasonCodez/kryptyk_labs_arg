"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ToastItem {
  id: string;
  message: string;
  type?: "info" | "success" | "error";
}

export default function Toasts({ toasts, onRemove, inline = false }: { toasts: ToastItem[]; onRemove: (id: string) => void; inline?: boolean }) {
  const containerStyleInline: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    justifyContent: 'center',
    zIndex: 30,
    marginBottom: 12,
  };

  const containerStyleFixed: React.CSSProperties = { position: 'fixed', top: 20, right: 20, zIndex: 60 };

  const containerStyle = inline ? containerStyleInline : containerStyleFixed;

  return (
    <div style={containerStyle}>
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            onClick={() => onRemove(t.id)}
            style={{
              marginBottom: 8,
              minWidth: 220,
              background: 'rgba(10,10,10,0.9)',
              border: '1px solid rgba(255,255,255,0.06)',
              padding: '10px 14px',
              borderRadius: 8,
              color: '#FFF',
              cursor: 'pointer',
              boxShadow: '0 6px 20px rgba(2,6,23,0.6)'
            }}
          >
            <div style={{ fontWeight: 600, color: t.type === 'error' ? '#FF6B6B' : t.type === 'success' ? '#FDE74C' : '#FFF' }}>{t.message}</div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
