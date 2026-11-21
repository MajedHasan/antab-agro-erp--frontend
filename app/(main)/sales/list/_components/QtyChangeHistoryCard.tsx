"use client";

import React from "react";
import {
  History, ArrowRight, User as UserIcon, TrendingDown, TrendingUp, Minus, Inbox,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  QtyChangeLog, formatDateTime, refName, roleLabel,
} from "./order-detail-types";

type Props = { logs?: QtyChangeLog[] | null };

function SectionHeader({
  icon: Icon, title, subtitle, right,
}: {
  icon: React.ElementType; title: string; subtitle?: string; right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3aa838]/10 text-[#3aa838] dark:bg-[#3aa838]/15 dark:text-[#9bdd91]">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-bold text-slate-900 dark:text-white">{title}</div>
          {subtitle && (
            <div className="text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</div>
          )}
        </div>
      </div>
      {right}
    </div>
  );
}

function DeltaPill({ delta }: { delta: number }) {
  const positive = delta > 0;
  const zero = delta === 0;
  const tone = zero
    ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
    : positive
      ? "bg-[#3aa838]/10 text-[#2f8a2f] dark:bg-[#3aa838]/15 dark:text-[#9bdd91]"
      : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300";
  const Icon = zero ? Minus : positive ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${tone}`}>
      <Icon className="h-3 w-3" />
      {positive ? "+" : ""}
      {delta}
    </span>
  );
}

function RolePill({ role }: { role: QtyChangeLog["role"] }) {
  const tone =
    role === "A.M"
      ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
      : role === "R.M"
        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
        : role === "N.S.M"
          ? "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300"
          : role === "FULFILLMENT"
            ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tone}`}>
      {roleLabel[role]}
    </span>
  );
}

export default function QtyChangeHistoryCard({ logs }: Props) {
  const safeLogs = Array.isArray(logs) ? logs : [];
  const sorted = [...safeLogs].sort((a, b) => {
    const da = a.actionDate ? new Date(a.actionDate).getTime() : 0;
    const db = b.actionDate ? new Date(b.actionDate).getTime() : 0;
    return db - da;
  });

  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <SectionHeader
        icon={History}
        title="Quantity Change History"
        subtitle={
          safeLogs.length
            ? `${safeLogs.length} change${safeLogs.length > 1 ? "s" : ""} recorded`
            : "No quantity edits yet"
        }
        right={
          safeLogs.length ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {safeLogs.length}
            </span>
          ) : null
        }
      />
      <CardContent className="p-0">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
            <div className="rounded-2xl bg-slate-100 p-3 dark:bg-slate-800">
              <Inbox className="h-5 w-5 text-slate-400" />
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              No quantity changes yet
            </div>
            <div className="max-w-sm text-[11px] text-slate-500 dark:text-slate-400">
              When anyone at A.M / R.M / N.S.M or Fulfillment changes a product
              quantity, the diff will appear here.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-slate-50/80 dark:bg-slate-950/50">
                <tr>
                  {["Product", "Change", "Δ", "Stage", "By", "When", "Remarks"].map((h) => (
                    <th
                      key={h}
                      className="border-b border-slate-200 px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((log, idx) => {
                  const productName = refName(log.productId as any);
                  const userName = refName(log.userId as any);
                  const bonusChanged = log.previousBonusQty !== log.newBonusQty;
                  return (
                    <tr
                      key={log._id || `${idx}-${log.actionDate}`}
                      className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/30"
                    >
                      <td className="px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white">
                        {productName}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1 text-xs tabular-nums">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {log.previousQty}
                          </span>
                          <ArrowRight className="h-3 w-3 text-slate-400" />
                          <span className="rounded bg-slate-900 px-1.5 py-0.5 font-semibold text-white dark:bg-slate-700">
                            {log.newQty}
                          </span>
                        </div>
                        {bonusChanged ? (
                          <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                            Bonus {log.previousBonusQty} → {log.newBonusQty}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <DeltaPill delta={log.deltaTotal} />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-0.5">
                          <RolePill role={log.role} />
                          <span className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            {log.stage.replaceAll("_", " ")}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1 text-xs text-slate-700 dark:text-slate-300">
                          <UserIcon className="h-3 w-3 text-slate-400" />
                          <span className="truncate">{userName}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-[11px] tabular-nums text-slate-600 dark:text-slate-400">
                        {formatDateTime(log.actionDate)}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-slate-600 dark:text-slate-400">
                        {log.remarks ? (
                          <span className="line-clamp-2">{log.remarks}</span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}