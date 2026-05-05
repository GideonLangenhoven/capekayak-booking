"use client";
import { useState, useEffect } from "react";
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

  useEffect(() => {
    if (availableDates.length > 0) {
      const parts = availableDates[0].date.split("-");
      setViewYear(parseInt(parts[0], 10));
      setViewMonth(parseInt(parts[1], 10) - 1);
    }
  }, [availableDates]);

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
    <div className="ml-9 mt-2 bg-white border border-gray-200 rounded-xl shadow-sm p-3" style={{ width: "260px" }}>
      <div className="flex items-center justify-between mb-2">
        <button onClick={prevMonth} disabled={!canPrev} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 disabled:opacity-20 text-gray-600 text-sm">◀</button>
        <span className="text-xs font-semibold text-gray-800">{monthName}</span>
        <button onClick={nextMonth} disabled={!canNext} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 disabled:opacity-20 text-gray-600 text-sm">▶</button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {dayNames.map(dn => <div key={dn} className="text-center text-[10px] font-medium text-gray-400 py-0.5">{dn}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((c, i) => {
          if (!c) return <div key={"e" + i} />;
          if (c.isPast || !c.hasSlots) {
            return <div key={c.date} className="text-center py-1.5 text-[11px] text-gray-300 rounded-lg">{c.day}</div>;
          }
          return (
            <button key={c.date} onClick={() => onSelectDate(c.date)}
              className="text-center py-1.5 text-[11px] font-semibold text-gray-900 rounded-lg hover:bg-emerald-100 hover:text-emerald-700 transition-colors relative">
              {c.day}
              <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-500"></span>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-gray-400 text-center mt-2">Green dots = available dates</p>
    </div>
  );
}
