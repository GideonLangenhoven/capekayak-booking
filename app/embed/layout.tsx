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
        ".fixed.inset-x-0.bottom-4{display:none!important}" +
        // The widget floats on the partner page's hero — the document itself
        // must never paint the storefront background behind the glass card.
        "html,body{background:transparent!important}" +
        "@keyframes btFadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}" +
        "@keyframes btScaleIn{from{opacity:0;transform:scale(.98) translateY(6px)}to{opacity:1;transform:none}}" +
        ".bt-scroll-x{scrollbar-width:none;-ms-overflow-style:none}" +
        ".bt-scroll-x::-webkit-scrollbar{display:none}" +
        "@media (prefers-reduced-motion:reduce){*{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important}}"
      }} />
      {children}
    </>
  );
}
