"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function TermsPage() {
  var [content, setContent] = useState("");
  var [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      var { data } = await supabase.from("businesses").select("terms_conditions").limit(1).single();
      if (data?.terms_conditions) setContent(data.terms_conditions);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="app-loader"><div className="spinner" /></div>;

  return (
    <div className="app-container page-wrap">
      <h1 className="headline-lg mb-8">Terms &amp; Conditions</h1>
      {content ? (
        <div className="prose" dangerouslySetInnerHTML={{ __html: content }} />
      ) : (
        <p className="text-[color:var(--textMuted)]">No terms and conditions have been published yet.</p>
      )}
    </div>
  );
}
