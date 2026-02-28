import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/app/lib/cn";

type InputProps = InputHTMLAttributes<HTMLInputElement>;
type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Input({ className, ...props }: InputProps) {
  return <input className={cn("field", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaProps) {
  return <textarea className={cn("field", className)} {...props} />;
}
