import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Book a Tour",
  robots: { index: false, follow: false },
};

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html:
        "header{display:none!important}" +
        "footer{display:none!important}" +
        "main{min-height:0!important}" +
        ".fixed.bottom-6.right-6{display:none!important}" +
        ".fixed.inset-x-0.bottom-4{display:none!important}"
      }} />
      {children}
    </>
  );
}
