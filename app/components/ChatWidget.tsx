"use client";
import { useState, useRef, useEffect, lazy, Suspense } from "react";
import { supabase } from "../lib/supabase";
import ChatCalendar from "./ChatCalendar";
type Msg = { role: "user" | "bot"; text: string; buttons?: any[]; paymentUrl?: string; calendar?: any[] };
export default function ChatWidget() {
  var [open, setOpen] = useState(false);
  var [msgs, setMsgs] = useState<Msg[]>([]);
  var [input, setInput] = useState("");
  var [typing, setTyping] = useState(false);
  var [st, setSt] = useState<any>({ step: "IDLE" });
  var endRef = useRef<HTMLDivElement>(null);
  var inRef = useRef<HTMLInputElement>(null);
  var greeted = useRef(false);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, typing]);
  useEffect(() => {
    if (open && !greeted.current) {
      greeted.current = true;
      setTimeout(() => { setTyping(true); setTimeout(() => { setTyping(false); setMsgs([{ role: "bot", text: "Hi there! 🛶 How can I help?" }]); }, 900 + Math.random() * 500); }, 400);
    }
    if (open) setTimeout(() => inRef.current?.focus(), 100);
  }, [open]);
  async function send(ovr?: string) {
    var msg = ovr || input.trim();
    if (!msg || typing) return;
    var isBtn = msg.startsWith("btn:");
    var displayMsg = msg;
    if (isBtn) {
      var lastBot = [...msgs].reverse().find(m => m.buttons || m.calendar);
      if (lastBot?.buttons) { var bm = lastBot.buttons.find((b: any) => "btn:" + b.value === msg); if (bm) displayMsg = bm.label; }
      if (lastBot?.calendar && msg.startsWith("btn:2")) {
        var cd = lastBot.calendar.find((d: any) => "btn:" + d.date === msg);
        if (cd) displayMsg = cd.label;
      }
    }
    var newM: Msg[] = [...msgs, { role: "user", text: displayMsg }];
    setMsgs(newM);
    setInput("");
    setTyping(true);
    try {
      var hist = newM.slice(-12).map(m => ({ role: m.role, text: m.text }));
      var res = await supabase.functions.invoke("web-chat", { body: { messages: hist.slice(0, -1), message: msg, state: st } });
      var d = res.data || {};
      setSt(d.state || st);
      var delay = 800 + Math.min((d.reply || "").length * 6, 1500) + Math.random() * 500;
      setTimeout(() => { setTyping(false); setMsgs(prev => [...prev, { role: "bot", text: d.reply || "Try again?", buttons: d.buttons || null, paymentUrl: d.paymentUrl || null, calendar: d.calendar || null }]); }, delay);
    } catch (e) {
      setTimeout(() => { setTyping(false); setMsgs(prev => [...prev, { role: "bot", text: "Sorry, try that again?" }]); }, 800);
    }
  }
  return (
    <>
      {!open && <button onClick={() => setOpen(true)} className="fixed bottom-6 right-6 w-14 h-14 bg-gray-900 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-800 hover:scale-105 transition-all z-50"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></button>}
      {open && (
        <div className="fixed bottom-6 right-6 w-[22rem] h-[32rem] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden z-50" style={{animation:"su .2s ease-out"}}>
          <style>{`@keyframes su{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}@keyframes bl{0%,80%,100%{opacity:0}40%{opacity:1}}`}</style>
          <div className="bg-gray-900 text-white p-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3"><div className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center text-lg">🛶</div><div><p className="text-sm font-semibold">Cape Kayak</p><div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400"></span><p className="text-xs text-gray-400">Online</p></div></div></div>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10">✕</button>
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-3 bg-gray-50">
            {msgs.map((m, i) => (
              <div key={i}>
                <div className={"flex " + (m.role === "user" ? "justify-end" : "justify-start")} style={{animation:"su .15s ease-out"}}>
                  {m.role === "bot" && <div className="w-7 h-7 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs mr-2 shrink-0 mt-1">🛶</div>}
                  <div className={"max-w-[80%] px-3.5 py-2.5 text-sm leading-relaxed " + (m.role === "user" ? "bg-gray-900 text-white rounded-2xl rounded-br-md" : "bg-white border border-gray-200 text-gray-800 rounded-2xl rounded-bl-md shadow-sm")}><p className="whitespace-pre-wrap">{m.text}</p></div>
                </div>
                {m.paymentUrl && (
                  <div className="ml-9 mt-2">
                    <a href={m.paymentUrl} target="_blank" rel="noopener noreferrer" className="inline-block bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 no-underline shadow-md">💳 Complete Payment →</a>
                    <p className="text-xs text-gray-400 mt-1">Spots held for 15 min</p>
                  </div>
                )}
                {m.calendar && m.calendar.length > 0 && (
                  <ChatCalendar availableDates={m.calendar} onSelectDate={(date) => send("btn:" + date)} />
                )}
                {m.buttons && m.buttons.length > 0 && (
                  <div className="ml-9 mt-2 flex flex-col gap-1.5">
                    {m.buttons.map((b: any, j: number) => (
                      <button key={j} onClick={() => send("btn:" + b.value)} className="text-left text-xs bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-700 hover:bg-gray-100 hover:border-gray-400 transition-colors font-medium shadow-sm">{b.label}</button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {typing && <div className="flex justify-start" style={{animation:"su .15s ease-out"}}><div className="w-7 h-7 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs mr-2 shrink-0">🛶</div><div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm"><div className="flex gap-1"><span className="w-2 h-2 rounded-full bg-gray-400" style={{animation:"bl 1.4s infinite 0s"}}/><span className="w-2 h-2 rounded-full bg-gray-400" style={{animation:"bl 1.4s infinite .2s"}}/><span className="w-2 h-2 rounded-full bg-gray-400" style={{animation:"bl 1.4s infinite .4s"}}/></div></div></div>}
            <div ref={endRef}/>
          </div>
          <div className="p-3 border-t border-gray-200 bg-white shrink-0">
            <div className="flex gap-2">
              <input ref={inRef} type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Type a message..." disabled={typing} className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:opacity-50"/>
              <button onClick={() => send()} disabled={!input.trim() || typing} className="bg-gray-900 text-white w-10 h-10 rounded-xl flex items-center justify-center hover:bg-gray-800 disabled:opacity-30 shrink-0"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
