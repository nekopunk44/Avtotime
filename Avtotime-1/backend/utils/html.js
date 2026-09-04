/**
 * Escapes a value for interpolation into an HTML document.
 *
 * Everything that reaches an outgoing email passes through here: notification
 * titles and bodies carry user-supplied text (usernames, comment excerpts,
 * listing titles), and an unescaped `<` there lets one user inject markup into
 * a mail rendered in somebody else's inbox.
 */
export const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
