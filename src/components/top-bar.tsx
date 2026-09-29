import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/logo";

/** Minimal header: just the logo. Everything else lives in the tabs or the Settings sheet. */
export function TopBar() {
  return (
    <header className="safe-top sticky top-0 z-40 border-b border-border bg-background/95 text-foreground backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-lg items-center justify-center px-4">
        <Link to="/" className="flex items-center">
          <Logo className="h-9 w-auto" />
        </Link>
      </div>
    </header>
  );
}
