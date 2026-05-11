"use client";

import { useEffect, useMemo, useState } from "react";
import { createTenantSupabase } from "../lib/supabase";
import { sanitizeHtml } from "../lib/sanitize";
import PolicySkeleton from "../components/skeletons/PolicySkeleton";
import { useTheme } from "../components/ThemeProvider";

export default function PrivacyPage() {
  const theme = useTheme();
  const tenantSupabase = useMemo(() => createTenantSupabase(theme.id), [theme.id]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!theme.id) return;
    (async () => {
      const { data } = await tenantSupabase.from("businesses").select("privacy_policy").eq("id", theme.id).single();
      if (data?.privacy_policy) setContent(data.privacy_policy);
      setLoading(false);
    })();
  }, [tenantSupabase, theme.id]);

  if (loading) return <PolicySkeleton />;

  return (
    <div className="app-container page-wrap">
      <h1 className="headline-lg mb-8">Privacy Policy</h1>
      {content ? (
        <div className="prose" dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }} />
      ) : (
        <p className="text-[color:var(--textMuted)]">No privacy policy has been published yet.</p>
      )}
    </div>
  );
}
