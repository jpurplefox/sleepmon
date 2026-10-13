# 11. Shareable links with link previews

Date: 2026-10-13

## Status

Accepted (amended 2026-10-13: anonymous shares behind ADR 0012's human check; expiry on read)

## Context

Comparison is getting share links ([PRD 0020](../prd/0020-share-comparison.md)), and a
link pasted in a chat should preview as an image of what it shares. Other things
(a Team Analysis line-up, a saved team) are likely to be shared the same way later.

Forces at play:

- **Link previews never run JavaScript.** WhatsApp, Telegram, Discord, X… read the
  Open Graph tags of the HTML a URL returns. The frontend is a static single-page app
  on S3 + CloudFront ([ADR 0009](0009-aws-deployment-and-ci-cd.md)): every path serves
  the same `index.html`, so it cannot give each share its own title and image.
- **The image is the UI.** The preview should look exactly like the cards on screen.
  Drawing them on the server would mean a headless browser in the Lambda (a heavy image,
  slow cold starts) or re-implementing the cards' layout in a server-side image library
  (two renderings that drift apart).
- The browser already has the cards rendered, with their real CSS, icons and sprites.

## Decision

We will serve share links from the **API**, and draw the preview image on the **client**.

- **The image is drawn in the browser** from an off-screen DOM layout of the thing being
  shared, rasterized with [html-to-image](https://github.com/bubkoo/html-to-image). The
  same picture is what the user shares as a file; a lighter JPEG of it (≤ 1200 px wide,
  ≤ 1 MB, checked by signature on the server) is uploaded with the share.
- **A share is a frozen copy** of what it shares, stored in Postgres with its image
  (`BYTEA`), owned by the user who made it (`ON DELETE CASCADE` from the account) and
  addressed by a random 12-character URL-safe id. Creating one needs a session; reading
  one needs only the id.
- **`GET /s/{id}`** returns a tiny HTML page with the Open Graph / Twitter tags (title,
  description, `og:image` → `GET /s/{id}/image`) and a script that sends a person on to
  the app (`{APP_URL}/compare?share={id}`); the app then reads the share as JSON.
- **Where links point is configuration**: `SHARE_BASE_URL` (empty = the API's own
  address) and `APP_URL` (the frontend). In production CloudFront routes `/s/*` on the
  app's domain to the API origin, so links read `https://sleepmon.app/s/<id>`.

## Consequences

- Previews work in every chat app with no server-side rendering stack, and the image is
  pixel-for-pixel the UI the user saw.
- The image reflects the sharer's device: a rendering quirk of their browser (fonts,
  WebKit's first-draw image bug, worked around by drawing twice) ends up in the preview.
  The uploaded file is validated as a JPEG/PNG and size-capped, but its content is the
  client's; it is only ever served back as an image.
- Images live in the shared RDS instance; at ~100–250 KB per share this is fine at the
  current scale. If it grows, the image moves to S3 behind the same `/s/{id}/image` URL
  without changing the links.
- One-time infrastructure: a CloudFront behavior for `/s/*` pointing at the API origin
  (forwarding the path, short TTL), and the Lambda's `APP_URL` / `SHARE_BASE_URL`
  environment variables. Without the behavior, links still work from the API's own
  address, just less legibly.
- A future shareable thing reuses the pattern: its own table and `/s/…` page, the same
  client-side drawing.

## Amendment (2026-10-13)

- A share may be created **signed out**, after the human check of
  [ADR 0012](0012-human-check-for-anonymous-writes.md); such a share has no owner
  (`user_id` NULL) and is not deleted with any account.
- Every share **expires 90 days after it was last opened**. `last_opened_at` is renewed
  only when the app reads the share (`GET /comparison-shares/{id}`); the `/s/{id}` page
  and image don't renew it, so link-preview crawlers can't keep a share alive. Expiry is
  checked on read and expired rows are deleted when a new share is created — no
  scheduler.
- The share also stores the sharer's **sleep schedule**, shown on the picture and
  compared with the recipient's when it is opened.
