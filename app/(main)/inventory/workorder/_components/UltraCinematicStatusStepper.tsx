"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * AnimatedCinematicStepper.tsx
 *
 * Usage:
 *  <AnimatedCinematicStepper status="Pending" />
 *  <AnimatedCinematicStepper status="Processing" />
 *  <AnimatedCinematicStepper status="Completed" />
 *  <AnimatedCinematicStepper status="Cancelled" />
 *
 * Props:
 *  - status: "Pending" | "Processing" | "Completed" | "Cancelled"
 *  - width: optional width of the track (default 320)
 *  - demo: boolean to auto-play statuses for preview
 */

type Status = "Pending" | "Processing" | "Completed" | "Cancelled" | string;

export default function AnimatedCinematicStepper({
  status = "Pending",
  width = 320,
  demo = false,
}: {
  status?: Status;
  width?: number;
  demo?: boolean;
}) {
  const STEPS: Status[] = ["Pending", "Processing", "Completed"];
  const idx = Math.max(0, STEPS.indexOf(status as Status));
  const percent = idx < 0 ? 0 : (idx / (STEPS.length - 1)) * 100;

  // track measurement (falls back to `width` prop)
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [trackWidth, setTrackWidth] = useState<number>(width);

  useLayoutEffect(() => {
    function update() {
      const w = trackRef.current?.clientWidth;
      if (w && w > 0) setTrackWidth(w);
      else setTrackWidth(width);
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [width]);

  // vehicle dimensions and target
  const vehicleW = Math.min(72, Math.max(40, Math.round(trackWidth * 0.16)));
  const padding = 8;
  const maxTravel = Math.max(0, trackWidth - vehicleW - padding * 2);
  const targetX = (percent / 100) * maxTravel;

  // confetti key to replay bursts
  const [burstKey, setBurstKey] = useState(0);
  useEffect(() => {
    if (status === "Completed") setBurstKey((k) => k + 1);
  }, [status]);

  // demo autoplay for preview
  useEffect(() => {
    if (!demo) return;
    const demoOrder: Status[] = ["Pending", "Processing", "Completed"];
    let i = 0;
    const t = setInterval(() => {
      // emit custom event so parent could listen (optional) — but here we visually animate only
      i = (i + 1) % demoOrder.length;
      // visually animate by updating local percent via key change: we simulate by flash confetti when completed
      if (demoOrder[i] === "Completed") setBurstKey((k) => k + 1);
    }, 2500);
    return () => clearInterval(t);
  }, [demo]);

  /* ---------- Sub SVGs & parts ---------- */

  function VanSVG({ color = "#4f46e5" }: { color?: string }) {
    return (
      <svg
        width={vehicleW}
        height="36"
        viewBox="0 0 64 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="2" y="8" rx="5" width="44" height="18" fill={color} />
        <rect
          x="40"
          y="6"
          rx="3"
          width="20"
          height="12"
          fill="#0f172a"
          opacity="0.05"
        />
        <rect
          x="8"
          y="12"
          width="8"
          height="8"
          rx="1"
          fill="white"
          opacity="0.06"
        />
        <circle cx="16" cy="28" r="4" fill="#0b1220" />
        <circle cx="44" cy="28" r="4" fill="#0b1220" />
        <circle cx="16" cy="28" r="2.2" fill="#d1d5db" />
        <circle cx="44" cy="28" r="2.2" fill="#d1d5db" />
      </svg>
    );
  }

  function WalkerSVG({ color = "#111827" }: { color?: string }) {
    return (
      <svg
        width="40"
        height="48"
        viewBox="0 0 24 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="12" cy="6" r="4" fill={color} />
        <rect x="9" y="10" width="6" height="10" rx="2" fill={color} />
        <path
          d="M9 20c0 0-2 8 3 10s6-1 6-1"
          stroke={color}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M9 12l-4 6"
          stroke={color}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M15 12l4 6"
          stroke={color}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  /* Small smoke puffs */
  function SmokePuffs() {
    return (
      <div
        style={{
          position: "absolute",
          left: -18,
          bottom: 6,
          width: 46,
          height: 28,
          pointerEvents: "none",
          overflow: "visible",
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.3, x: 0 }}
          animate={{ opacity: 0.38, scale: 1, x: -12 }}
          transition={{
            duration: 1.4,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "easeInOut",
          }}
          style={{
            position: "absolute",
            left: 6,
            bottom: 4,
            width: 18,
            height: 10,
            borderRadius: 12,
            background: "rgba(99,102,241,0.10)",
          }}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.2, x: 0 }}
          animate={{ opacity: 0.25, scale: 1.15, x: -26 }}
          transition={{
            duration: 1.8,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "easeInOut",
            delay: 0.32,
          }}
          style={{
            position: "absolute",
            left: 22,
            bottom: 6,
            width: 22,
            height: 12,
            borderRadius: 14,
            background: "rgba(6,182,212,0.06)",
          }}
        />
      </div>
    );
  }

  /* Confetti burst */
  function ConfettiBurst({ keyProp = 0 }: { keyProp?: number }) {
    const pieces = new Array(12).fill(0);
    return (
      <div
        style={{
          position: "absolute",
          left: 0,
          top: -36,
          pointerEvents: "none",
          width: trackWidth,
        }}
      >
        {pieces.map((_, i) => {
          const left = Math.random() * trackWidth;
          const bg = ["#FB7185", "#F59E0B", "#60A5FA", "#34D399", "#A78BFA"][
            i % 5
          ];
          const size = 6 + (i % 3) * 3;
          return (
            <motion.div
              key={`${keyProp}-${i}`}
              initial={{ opacity: 0, y: 0, scale: 0.3, x: left }}
              animate={{
                opacity: 1,
                y: -60 - Math.random() * 20,
                scale: 1,
                x: left + (Math.random() - 0.5) * 40,
              }}
              exit={{ opacity: 0, y: -120 }}
              transition={{
                duration: 1 + Math.random() * 0.6,
                ease: "easeOut",
                delay: i * 0.02,
              }}
              style={{
                position: "absolute",
                left,
                width: size,
                height: size,
                borderRadius: 3,
                background: bg,
              }}
            />
          );
        })}
      </div>
    );
  }

  /* ---------- layout & style ---------- */
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 280 }}
    >
      {/* small inline styles (scoped inside component) */}
      <style>{`
        .acs-badge { min-width:88px; display:inline-flex; align-items:center; justify-content:center; padding:6px 12px; border-radius:999px; color:#fff; font-weight:700; font-size:13px; }
        .acs-pending { background: linear-gradient(90deg,#f59e0b,#f97316); }
        .acs-processing { background: linear-gradient(90deg,#06b6d4,#3b82f6); }
        .acs-completed { background: linear-gradient(90deg,#10b981,#059669); }
        .acs-cancelled { background: linear-gradient(90deg,#ef4444,#dc2626); }
        @media (max-width:720px) {
          .acs-hidden-xs { display:none; }
        }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ width: 10 }} />

          {/* track */}
          <div
            ref={trackRef}
            style={{
              position: "relative",
              width: "100%",
              maxWidth: width,
              minWidth: 220,
              height: 14,
              borderRadius: 999,
              background: "#f3f4f6",
              overflow: "visible",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)",
            }}
          >
            {/* fill bar */}
            <motion.div
              style={{
                position: "absolute",
                left: 6,
                top: 0,
                bottom: 0,
                height: "100%",
                borderRadius: 999,
                background: "linear-gradient(90deg,#4f46e5,#06b6d4)",
                width: `${Math.max(0, percent)}%`,
                transformOrigin: "left center",
              }}
              animate={{ width: `${Math.max(0, percent)}%` }}
              transition={{ duration: 0.9, ease: [0.2, 1, 0.22, 1] }}
            />

            {/* vehicle */}
            <motion.div
              style={{
                position: "absolute",
                top: -22,
                left: padding,
                width: vehicleW,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
                willChange: "transform",
              }}
              animate={{ x: targetX }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* subtle shadow */}
              <motion.div
                initial={{ scale: 0.9, opacity: 0.18 }}
                animate={{ scale: 1, opacity: 0.26 }}
                transition={{ duration: 0.9 }}
                style={{
                  position: "absolute",
                  bottom: 4,
                  width: vehicleW * 0.9,
                  height: 6,
                  borderRadius: 999,
                  background: "rgba(2,6,23,0.06)",
                  filter: "blur(6px)",
                }}
              />

              <div
                style={{
                  width: vehicleW,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <VanSVG
                  color={
                    status === "Completed"
                      ? "#10b981"
                      : status === "Processing"
                      ? "#4f46e5"
                      : "#9CA3AF"
                  }
                />
                {/* wheels placeholder - visual spin courtesy of tiny circle rotation for visual cue */}
                <motion.div
                  style={{
                    position: "absolute",
                    left: Math.round(vehicleW * 0.15),
                    bottom: 4,
                    width: 10,
                    height: 10,
                    borderRadius: 10,
                    background: "transparent",
                  }}
                  animate={{ rotate: 360 }}
                  transition={{
                    repeat: Infinity,
                    ease: "linear",
                    duration: 0.55,
                  }}
                />
              </div>

              <SmokePuffs />
            </motion.div>

            {/* confetti */}
            <AnimatePresence>
              {status === "Completed" ? (
                <ConfettiBurst keyProp={burstKey} keyProp2={burstKey} />
              ) : null}
            </AnimatePresence>
          </div>

          {/* walker */}
          <motion.div
            animate={
              status === "Processing"
                ? {
                    y: [0, -4, 0],
                    transition: { duration: 0.9, repeat: Infinity },
                  }
                : {}
            }
            style={{
              width: 48,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginLeft: 8,
            }}
          >
            <WalkerSVG color={status === "Completed" ? "#059669" : "#111827"} />
          </motion.div>

          {/* badge */}
          <div>
            <div
              className={`acs-badge ${
                status === "Pending"
                  ? "acs-pending"
                  : status === "Processing"
                  ? "acs-processing"
                  : status === "Completed"
                  ? "acs-completed"
                  : status === "Cancelled"
                  ? "acs-cancelled"
                  : ""
              }`}
            >
              {status || "Unknown"}
            </div>
            <div
              className="acs-hidden-xs"
              style={{
                fontSize: 12,
                color: "#6b7280",
                marginTop: 6,
                textAlign: "center",
              }}
            >
              {/* placeholder for timestamp or small note */}
            </div>
          </div>
        </div>

        {/* markers */}
        <div
          style={{
            display: "flex",
            gap: Math.max(36, Math.round(trackWidth / 3.6)),
            paddingLeft: 16,
          }}
        >
          {STEPS.map((s) => (
            <div
              key={s}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                color: "#374151",
                fontSize: 11,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 8,
                  background: "#fff",
                  border: "2px solid #e6e7eb",
                  marginBottom: 6,
                }}
              />
              <div>{s}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
