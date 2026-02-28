import type { HTMLAttributes } from "react";
import { cn } from "@/app/lib/cn";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  muted?: boolean;
};

export default function Card({ className, muted = false, ...props }: CardProps) {
  return <div className={cn(muted ? "surface-muted" : "surface", className)} {...props} />;
}
