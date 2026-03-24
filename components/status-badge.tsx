import type { OverallState, ProbeState } from "@/lib/types";

type Tone = OverallState | ProbeState;

const toneClassName: Record<Tone, string> = {
  up: "border-emerald-700/20 bg-emerald-600/12 text-emerald-900",
  warn: "border-amber-700/20 bg-amber-500/12 text-amber-900",
  down: "border-rose-700/20 bg-rose-600/12 text-rose-900",
  unknown: "border-stone-700/20 bg-stone-500/10 text-stone-800",
  na: "border-slate-700/10 bg-slate-500/8 text-slate-700",
};

interface StatusBadgeProps {
  label: string;
  tone: Tone;
  compact?: boolean;
}

export function StatusBadge({
  label,
  tone,
  compact = false,
}: StatusBadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border font-medium uppercase tracking-[0.18em]",
        compact ? "px-2.5 py-1 text-[10px]" : "px-3 py-1.5 text-[11px]",
        toneClassName[tone],
      ].join(" ")}
    >
      {label}
    </span>
  );
}
