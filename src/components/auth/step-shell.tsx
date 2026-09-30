import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { cn } from "@/lib/utils";

/**
 * One question per screen (X-style sign-in): back arrow + optional link, big title, big input, and the
 * primary button pinned to the bottom, right above the keyboard. The form submits from the keyboard too.
 */
export function StepShell({
  onBack,
  right,
  title,
  subtitle,
  children,
  action,
  onSubmit,
  disabled,
  loading,
  above,
}: {
  onBack?: () => void;
  right?: ReactNode;
  title: string;
  subtitle?: ReactNode;
  children?: ReactNode;
  action: string;
  onSubmit: () => void;
  disabled?: boolean;
  loading?: boolean;
  above?: ReactNode;
}) {
  const { t } = useTranslation();
  const keyboard = useKeyboardInset();
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!disabled && !loading) onSubmit();
      }}
      className="safe-top mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-40"
    >
      <div className="flex h-14 items-center justify-between">
        {onBack ? (
          <button type="button" onClick={onBack} aria-label={t("auth.back")} className="-ml-2 grid h-11 w-11 place-items-center">
            <ArrowLeft className="h-6 w-6" />
          </button>
        ) : (
          <span />
        )}
        {right}
      </div>
      <h1 className="mt-5 text-[32px] font-extrabold leading-[1.15] tracking-tight">{title}</h1>
      {subtitle && <div className="mt-2 text-[15px] leading-snug text-muted-foreground">{subtitle}</div>}
      <div className="mt-7 animate-fade-in-up">{children}</div>

      <div
        className="fixed inset-x-0 z-20 mx-auto max-w-md bg-background px-5 pt-2"
        style={{ bottom: keyboard, paddingBottom: keyboard ? 12 : "max(16px, env(safe-area-inset-bottom))" }}
      >
        {above}
        <button
          type="submit"
          disabled={disabled || loading}
          className={cn(
            "h-14 w-full rounded-full text-lg font-semibold transition",
            disabled ? "bg-secondary text-muted-foreground" : "bg-primary text-primary-foreground active:opacity-80",
            loading && "opacity-60",
          )}
        >
          {loading ? "…" : action}
        </button>
      </div>
    </form>
  );
}

/** The large borderless field from the reference (e.g. "@ username"). */
export const BigInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { prefix?: string }>(
  function BigInput({ prefix, className, ...props }, ref) {
    return (
      <label className="flex items-center gap-2">
        {prefix && <span className="text-[30px] leading-tight">{prefix}</span>}
        <input
          ref={ref}
          {...props}
          className={cn(
            "w-full min-w-0 appearance-none rounded-none border-0 bg-transparent p-0 text-[30px] leading-tight shadow-none outline-none ring-0 caret-[#0a84ff] placeholder:text-muted-foreground focus:outline-none focus:ring-0",
            className,
          )}
        />
      </label>
    );
  },
);

/** Small grey/red line under the input. */
export function FieldNote({ children, error }: { children: ReactNode; error?: boolean }) {
  return <p className={cn("mt-4 text-[15px] leading-snug", error ? "text-destructive" : "text-muted-foreground")}>{children}</p>;
}
