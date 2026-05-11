"use client";

import { useEffect, useMemo, useState } from "react";
import { createTenantSupabase } from "../lib/supabase";
import { sanitizeHtml } from "../lib/sanitize";
import PolicySkeleton from "../components/skeletons/PolicySkeleton";
import { useTheme } from "../components/ThemeProvider";

export default function TermsPage() {
  const theme = useTheme();
  const tenantSupabase = useMemo(() => createTenantSupabase(theme.id), [theme.id]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!theme.id) return;
    (async () => {
      const { data } = await tenantSupabase.from("businesses").select("terms_conditions").eq("id", theme.id).single();
      if (data?.terms_conditions) setContent(data.terms_conditions);
      setLoading(false);
    })();
  }, [tenantSupabase, theme.id]);

  if (loading) return <PolicySkeleton />;

  return (
    <div className="app-container page-wrap">
      <h1 className="headline-lg mb-8">Terms &amp; Conditions</h1>
      {content ? (
        <div className="prose" dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }} />
      ) : (
        <p className="text-[color:var(--textMuted)]">No terms and conditions have been published yet.</p>
      )}
    </div>
  );
}
