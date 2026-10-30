/**
 * One description per page, in all three places that read one.
 *
 * Next merges metadata from the layout down, but only key by key: a page that
 * sets `description` alone keeps the LAYOUT's openGraph block, so Google shows
 * the page's text while WhatsApp shows the site's. The two then drift apart
 * quietly, because nothing errors and nobody looks at a share preview twice.
 *
 * pageMeta() writes the same title and description into the meta description,
 * the Open Graph tags and the Twitter card, so there is one thing to edit and
 * one answer everywhere.
 */
import type { Metadata } from "next";

export function pageMeta({
  title,
  description,
}: {
  /** Shown in the browser tab and as the share headline. */
  title: string;
  /** One or two sentences. Search engines cut around 155 characters. */
  description: string;
}): Metadata {
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { title, description },
  };
}
