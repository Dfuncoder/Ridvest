"use client";

/**
 * A table row you can click anywhere on.
 *
 * Wide tables push the "View" button off the right edge, so the obvious
 * target becomes the one nobody can reach. The row itself is a much bigger
 * target and is where people aim anyway.
 *
 * ── WHY NOT JUST WRAP THE ROW IN A LINK ──────────────────────────────────
 * An <a> cannot contain <td>s — a table row has to stay a <tr>. So the click
 * is handled here instead, and the ACCESSIBLE path is kept separate: the row's
 * first cell still holds a real <Link>, which is what a screen reader and a
 * middle-click both use. This is an enhancement on top of that, not a
 * replacement for it.
 *
 * Clicks that land on something interactive — the name link, a Remove button,
 * a form — are left alone, or every nested control would navigate away
 * instead of doing its job.
 */
import { useRouter } from "next/navigation";

export default function ClickableRow({
  href,
  className = "",
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  function interactive(target: EventTarget | null): boolean {
    return target instanceof Element
      ? Boolean(target.closest("a, button, input, select, textarea, label, form"))
      : false;
  }

  return (
    <tr
      onClick={(e) => {
        if (interactive(e.target)) return;
        router.push(href);
      }}
      onKeyDown={(e) => {
        // Enter follows the row, matching how a link behaves. Space is left to
        // the browser so it still scrolls.
        if (e.key !== "Enter" || interactive(e.target)) return;
        e.preventDefault();
        router.push(href);
      }}
      // Not tabbable: the name link in the first cell is already in the tab
      // order and goes to the same place. A second stop would mean tabbing
      // through every row twice.
      className={`cursor-pointer ${className}`}
    >
      {children}
    </tr>
  );
}
