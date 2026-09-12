"use client";
import { useState } from "react";
import type { CalendarDate } from "../lib/types";

type CalendarProps = {
  availableDates: CalendarDate[];
  onSelectDate: (date: string) => void;
};

interface CalendarCell {
  day: number;
  date: string;
  isPast: boolean;
  hasSlots: boolean;
}

export default function ChatCalendar({ availableDates, onSelectDate }: CalendarProps) {
  const now = new Date();
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [viewYear, setViewYear] = useState(now.getFullYear());

  // Jump the view to the first available month whenever availableDates
  // changes — tracked during render (React's documented pattern for
  // "adjust state when a prop changes") instead of an effect.
  const [prevAvailableDates, setPrevAvailableDates] = useState(availableDates);
  if (availableDates !== prevAvailableDates) {
    setPrevAvailableDates(availableDates);
    if (availableDates.length > 0) {
      const parts = availableDates[0].date.split("-");
      setViewYear(parseInt(parts[0], 10));
      setViewMonth(parseInt(parts[1], 10) - 1);
    }
  }

  const availSet = new Set(availableDates.map(d => d.date));

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const monthName = new Date(viewYear, viewMonth).toLocaleDateString("en-ZA", { month: "long", year: "numeric" });

  const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  }

  const canPrev = viewYear > now.getFullYear() || (viewYear === now.getFullYear() && viewMonth > now.getMonth());
  const maxDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const canNext = new Date(viewYear, viewMonth + 1, 1) < maxDate;

  const cells: (CalendarCell | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = viewYear + "-" + String(viewMonth + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
    const isPast = new Date(dateStr) < new Date(now.toISOString().split("T")[0]);
    const hasSlots = availSet.has(dateStr);
    cells.push({ day: d, date: dateStr, isPast: isPast, hasSlots: hasSlots });
  }

  return (
    <div className="ml-9 mt-2 border rounded-xl shadow-sm p-3" style={{ width: "260px", backgroundColor: "var(--glass-tint-card)", borderColor: "var(--glass-border)", color: "var(--ink)" }}>
      <div className="flex items-center justify-between mb-2">
        <button onClick={prevMonth} disabled={!canPrev} className="w-7 h-7 flex items-center justify-center rounded-lg disabled:opacity-20 text-sm hover:bg-[color:var(--hover-overlay)]" style={{ color: "var(--ink)" }}>◀</button>
        <span className="text-xs font-semibold" style={{ color: "var(--ink)" }}>{monthName}</span>
        <button onClick={nextMonth} disabled={!canNext} className="w-7 h-7 flex items-center justify-center rounded-lg disabled:opacity-20 text-sm hover:bg-[color:var(--hover-overlay)]" style={{ color: "var(--ink)" }}>▶</button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {dayNames.map(dn => <div key={dn} className="text-center text-[10px] font-medium py-0.5" style={{ color: "var(--ink-muted)" }}>{dn}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((c, i) => {
          if (!c) return <div key={"e" + i} />;
          if (c.isPast || !c.hasSlots) {
            return <div key={c.date} className="text-center py-1.5 text-[11px] rounded-lg" style={{ color: "var(--ink-faint)" }}>{c.day}</div>;
          }
          return (
            <button key={c.date} onClick={() => onSelectDate(c.date)}
              className="text-center py-1.5 text-[11px] font-semibold rounded-lg transition-colors relative hover:bg-[color:var(--hover-overlay)]"
              style={{ color: "var(--ink)" }}>
              {c.day}
              <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--accent)" }}></span>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-center mt-2" style={{ color: "var(--ink-muted)" }}>Accent dots = available dates</p>
    </div>
  );
}
