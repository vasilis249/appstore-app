import type { ReactNode } from "react";
import { UserAvatar } from "@/components/user-avatar";
import type { Person } from "@/lib/friends";

/** Avatar, name, @username and a right-hand slot for actions (BeReal-style list row). */
export function PersonRow({
  person,
  subtitle,
  onOpen,
  children,
}: {
  person: Pick<Person, "full_name" | "username" | "avatar_path">;
  subtitle?: string;
  onOpen?: () => void;
  children?: ReactNode;
}) {
  const body = (
    <>
      <UserAvatar name={person.full_name || person.username} path={person.avatar_path} size={56} />
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-base font-semibold">{person.full_name || person.username}</span>
        <span className="block truncate text-sm text-muted-foreground">{person.username}</span>
        {subtitle && <span className="block truncate text-sm text-muted-foreground">{subtitle}</span>}
      </span>
    </>
  );
  return (
    <li className="flex items-center gap-3 py-2.5">
      {onOpen ? (
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3">
          {body}
        </button>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-3">{body}</span>
      )}
      {children && <span className="flex shrink-0 items-center gap-2">{children}</span>}
    </li>
  );
}

/** Dark grey pill used for Add / Accept (BeReal style). */
export function PillButton({
  children,
  onClick,
  disabled,
  variant = "secondary",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "secondary" | "primary";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "h-10 rounded-full px-5 text-sm font-semibold disabled:opacity-50 " +
        (variant === "primary" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground")
      }
    >
      {children}
    </button>
  );
}
