"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ToastItem {
  id: string;
  message: string;
  type?: "info" | "success" | "error";
}

export default function Toasts({ toasts, onRemove, inline = false }: { toasts: ToastItem[]; onRemove: (id: string) => void; inline?: boolean }) {
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const isExpanded = (id: string) => !!expanded[id];

  const SHOW_MORE_THRESHOLD = 140; // chars

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
    <div className={inline ? "pw-inline-toasts" : "pw-fixed-toasts"} style={containerStyle}>
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const needsMore = t.message && t.message.length > SHOW_MORE_THRESHOLD;
          const exp = isExpanded(t.id);
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 420, damping: 26 }}
              style={{
                marginBottom: 8,
                minWidth: 220,
                background: 'rgba(10,10,10,0.9)',
                border: '1px solid rgba(255,255,255,0.06)',
                padding: '10px 14px',
                borderRadius: 8,
                color: '#FFF',
                boxShadow: '0 6px 20px rgba(2,6,23,0.6)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: t.type === 'error' ? '#FF6B6B' : t.type === 'success' ? '#FDE74C' : '#FFF', marginBottom: 6 }}>
                    {needsMore && !exp ? t.message.slice(0, SHOW_MORE_THRESHOLD) + '…' : t.message}
                  </div>
                  {needsMore && (
                    <div style={{ marginTop: 6 }}>
                      <button
                        onClick={() => toggleExpanded(t.id)}
                        style={{ background: 'transparent', border: 'none', color: '#FDE74C', cursor: 'pointer', padding: 0 }}
                      >
                        {exp ? 'Show less' : 'Show more'}
                      </button>
                    </div>
                  )}
                </div>
                <div style={{ marginLeft: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button
                    onClick={() => onRemove(t.id)}
                    aria-label="Dismiss notification"
                    style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', color: 'white', padding: '6px 8px', borderRadius: 6, cursor: 'pointer' }}
                  >
                    ×
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
