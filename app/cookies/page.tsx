"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { sanitizeHtml } from "../lib/sanitize";
import PolicySkeleton from "../components/skeletons/PolicySkeleton";

export default function CookiesPage() {
  var [content, setContent] = useState("");
  var [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      var { data } = await supabase.from("businesses").select("cookies_policy").limit(1).single();
      if (data?.cookies_policy) setContent(data.cookies_policy);
      setLoading(false);
    })();
  }, []);

  if (loading) return <PolicySkeleton />;

  return (
    <div className="app-container page-wrap">
      <h1 className="headline-lg mb-8">Cookies Policy</h1>
      {content ? (
        <div className="prose" dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }} />
      ) : (
        <p className="text-[color:var(--textMuted)]">No cookies policy has been published yet.</p>
      )}
    </div>
  );
}
