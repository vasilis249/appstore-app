import { Fragment } from "react";
import { Link } from "@tanstack/react-router";

const MENTION = /(@[a-z0-9._]{3,30})/g;
const IS_MENTION = /^@[a-z0-9._]{3,30}$/;

/** Plain text with @username mentions turned into profile links. */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(MENTION).map((part, i) =>
        IS_MENTION.test(part) ? (
          <Link
            key={i}
            to="/u/$username"
            params={{ username: part.slice(1) }}
            className="font-semibold text-primary"
          >
            {part}
          </Link>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
