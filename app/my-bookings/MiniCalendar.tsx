"use client";
import { useState } from "react";
import { fmtFull, fmtTime, dateKey } from "../lib/format";
import { rescheduleUnitPrice } from "../lib/pricing";
import type { Slot } from "../lib/types";

export default function MiniCalendar({ slots, onSelect }: { slots: Slot[]; onSelect: (slot: Slot) => void }) {
  const now = new Date();
  const [vMonth, setVMonth] = useState(now.getMonth());
  const [vYear, setVYear] = useState(now.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const slotsByDate: Record<string, Slot[]> = {};
  for (const s of slots) { const dk = dateKey(s.start_time); if (!slotsByDate[dk]) slotsByDate[dk] = []; slotsByDate[dk].push(s); }

  const firstDay = new Date(vYear, vMonth, 1).getDay();
  const daysInMonth = new Date(vYear, vMonth + 1, 0).getDate();
  const monthName = new Date(vYear, vMonth).toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
  const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const canPrev = vYear > now.getFullYear() || (vYear === now.getFullYear() && vMonth > now.getMonth());
  const maxDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const canNext = new Date(vYear, vMonth + 1, 1) < maxDate;

  const cells: ({ day: number; date: string; isPast: boolean; hasSlots: boolean } | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = vYear + "-" + String(vMonth + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
    cells.push({ day: d, date: ds, isPast: new Date(ds) < new Date(now.toISOString().split("T")[0]), hasSlots: !!slotsByDate[ds] });
  }

  return (
    <div>
      <div className="glass p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => { if (vMonth === 0) { setVMonth(11); setVYear(vYear - 1); } else setVMonth(vMonth - 1); }} disabled={!canPrev} aria-label="Previous month"
            className="w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center rounded-full text-lg hover:bg-[color:var(--hover-overlay)] disabled:opacity-20 text-[color:var(--textMuted)] transition-colors">&lsaquo;</button>
          <span className="text-sm font-semibold text-[color:var(--text)]">{monthName}</span>
          <button onClick={() => { if (vMonth === 11) { setVMonth(0); setVYear(vYear + 1); } else setVMonth(vMonth + 1); }} disabled={!canNext} aria-label="Next month"
            className="w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center rounded-full text-lg hover:bg-[color:var(--hover-overlay)] disabled:opacity-20 text-[color:var(--textMuted)] transition-colors">&rsaquo;</button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {dayNames.map(dn => <div key={dn} className="text-center text-[12px] font-medium text-[color:var(--textMuted)] py-1">{dn}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((c, i) => {
            if (!c) return <div key={"e" + i} />;
            if (c.isPast || !c.hasSlots) return <div key={c.date} className="text-center py-2.5 text-sm text-[color:var(--ink-faint)] rounded-lg">{c.day}</div>;
            const isSelected = selectedDate === c.date;
            return (
              <button key={c.date} onClick={() => setSelectedDate(c.date)}
                className={"text-center min-h-11 sm:min-h-0 py-2.5 text-sm font-semibold rounded-lg transition-all relative " + (isSelected ? "bg-[color:var(--accent)] text-[color:var(--ink-on-main)] shadow-sm" : "text-[color:var(--text)] bg-[color:color-mix(in_srgb,var(--glass-solid-card)_60%,transparent)] hover:bg-[color:var(--accentSoft)]")}>
                {c.day}
                {!isSelected && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[color:var(--cta)]"></span>}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate && (slotsByDate[selectedDate] || []).length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[color:var(--text)] px-1">{fmtFull((slotsByDate[selectedDate] || [])[0].start_time)}</p>
          {(slotsByDate[selectedDate] || []).map((sl: Slot) => {
            const avail = sl.capacity_total - sl.booked - (sl.held || 0);
            return (
              <button key={sl.id} onClick={() => onSelect(sl)}
                className="glass !rounded-xl w-full text-left p-4 hover:border-[color:var(--accent)] hover:shadow-sm transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-[color:var(--text)]">{sl.tours?.name}</p>
                    <p className="text-sm text-[color:var(--textMuted)] mt-0.5">{fmtTime(sl.start_time)} &middot; {avail} spots left &middot; R{rescheduleUnitPrice(sl, sl.tours?.base_price_per_person)}/pp</p>
                  </div>
                  <svg className="w-5 h-5 text-[color:var(--textMuted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
