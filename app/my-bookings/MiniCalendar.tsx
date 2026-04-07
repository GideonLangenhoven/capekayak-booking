"use client";
import { useState } from "react";
import { fmtFull, fmtTime, dateKey } from "../lib/format";
import type { Slot } from "../lib/types";

export default function MiniCalendar({ slots, onSelect }: { slots: Slot[]; onSelect: (slot: Slot) => void }) {
  var now = new Date();
  var [vMonth, setVMonth] = useState(now.getMonth());
  var [vYear, setVYear] = useState(now.getFullYear());
  var [selectedDate, setSelectedDate] = useState<string | null>(null);

  var slotsByDate: Record<string, Slot[]> = {};
  for (var s of slots) { var dk = dateKey(s.start_time); if (!slotsByDate[dk]) slotsByDate[dk] = []; slotsByDate[dk].push(s); }

  var firstDay = new Date(vYear, vMonth, 1).getDay();
  var daysInMonth = new Date(vYear, vMonth + 1, 0).getDate();
  var monthName = new Date(vYear, vMonth).toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
  var dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  var canPrev = vYear > now.getFullYear() || (vYear === now.getFullYear() && vMonth > now.getMonth());
  var maxDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  var canNext = new Date(vYear, vMonth + 1, 1) < maxDate;

  var cells: ({ day: number; date: string; isPast: boolean; hasSlots: boolean } | null)[] = [];
  for (var i = 0; i < firstDay; i++) cells.push(null);
  for (var d = 1; d <= daysInMonth; d++) {
    var ds = vYear + "-" + String(vMonth + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
    cells.push({ day: d, date: ds, isPast: new Date(ds) < new Date(now.toISOString().split("T")[0]), hasSlots: !!slotsByDate[ds] });
  }

  return (
    <div>
      <div className="bg-[color:var(--surface)] rounded-2xl border border-[color:var(--border)] p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => { if (vMonth === 0) { setVMonth(11); setVYear(vYear - 1); } else setVMonth(vMonth - 1); }} disabled={!canPrev}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[color:var(--surface2)] disabled:opacity-20 text-[color:var(--textMuted)] transition-colors">&lsaquo;</button>
          <span className="text-sm font-semibold text-[color:var(--text)]">{monthName}</span>
          <button onClick={() => { if (vMonth === 11) { setVMonth(0); setVYear(vYear + 1); } else setVMonth(vMonth + 1); }} disabled={!canNext}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[color:var(--surface2)] disabled:opacity-20 text-[color:var(--textMuted)] transition-colors">&rsaquo;</button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {dayNames.map(dn => <div key={dn} className="text-center text-[11px] font-medium text-[color:var(--textMuted)] py-1">{dn}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((c, i) => {
            if (!c) return <div key={"e" + i} />;
            if (c.isPast || !c.hasSlots) return <div key={c.date} className="text-center py-2 text-sm text-[color:var(--textMuted)]/30 rounded-lg">{c.day}</div>;
            var isSelected = selectedDate === c.date;
            return (
              <button key={c.date} onClick={() => setSelectedDate(c.date)}
                className={"text-center py-2 text-sm font-semibold rounded-lg transition-all relative " + (isSelected ? "bg-[color:var(--accent)] text-white shadow-sm" : "text-[color:var(--text)] hover:bg-[color:var(--accentSoft)]")}>
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
            var avail = sl.capacity_total - sl.booked - (sl.held || 0);
            return (
              <button key={sl.id} onClick={() => onSelect(sl)}
                className="w-full text-left border border-[color:var(--border)] rounded-xl p-4 hover:border-[color:var(--accent)] hover:shadow-sm transition-all bg-[color:var(--surface)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-[color:var(--text)]">{sl.tours?.name}</p>
                    <p className="text-sm text-[color:var(--textMuted)] mt-0.5">{fmtTime(sl.start_time)} &middot; {avail} spots left &middot; R{sl.price_per_person_override ?? sl.tours?.base_price_per_person}/pp</p>
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
