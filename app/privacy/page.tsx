"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function PrivacyPage() {
  var [content, setContent] = useState("");
  var [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      var { data } = await supabase.from("businesses").select("privacy_policy").limit(1).single();
      if (data?.privacy_policy) setContent(data.privacy_policy);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="app-loader"><div className="spinner" /></div>;

  return (
    <div className="app-container page-wrap">
      <h1 className="headline-lg mb-8">Privacy Policy</h1>
      {content ? (
        <div className="prose" dangerouslySetInnerHTML={{ __html: content }} />
      ) : (
        <p className="text-[color:var(--textMuted)]">No privacy policy has been published yet.</p>
      )}
    </div>
  );
}
