import DOMPurify from "dompurify";

/**
 * Sanitize HTML from database to prevent XSS.
 * Allows standard formatting tags used in CMS content
 * but strips scripts, event handlers, and dangerous attributes.
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      "h1", "h2", "h3", "h4", "h5", "h6",
      "p", "br", "hr",
      "ul", "ol", "li",
      "a", "strong", "b", "em", "i", "u", "s",
      "blockquote", "pre", "code",
      "table", "thead", "tbody", "tr", "th", "td",
      "div", "span", "img",
    ],
    ALLOWED_ATTR: [
      "href", "target", "rel", "src", "alt", "width", "height",
      "class", "style", "id",
    ],
    ALLOW_DATA_ATTR: false,
  });
}
