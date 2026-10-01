import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Somebody's face, or their initials.
 *
 * The picture is the one on their Google account -- it arrives with the
 * sign-in, so nobody uploads anything, there is no bucket to pay for or
 * moderate, and it is already the face their colleagues recognise from Meet.
 * Changing it is done where they would expect to change it: in their Google
 * account, not in a settings page here that would have to be built, explained
 * and kept.
 *
 * Initials are the fallback and not a lesser one. A photo that 404s, an
 * account with none, a blocked third-party image: all land on the same two
 * letters the app showed before there were pictures at all.
 *
 * `no-referrer` because Google's CDN refuses the request otherwise -- and
 * because the page somebody is on is not Google's business.
 */
export function Avatar({
  name,
  src,
  className,
}: {
  name: string;
  src?: string | null | undefined;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  const shell = cn(
    "grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary text-[11px] font-bold text-primary-foreground",
    className,
  );

  if (!src || failed) {
    return (
      <span className={shell} aria-hidden="true">
        {initials}
      </span>
    );
  }

  return (
    <span className={shell}>
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        loading="lazy"
        onError={() => setFailed(true)}
        className="size-full object-cover"
      />
    </span>
  );
}
