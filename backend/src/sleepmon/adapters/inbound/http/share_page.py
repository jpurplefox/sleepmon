"""The page a shared comparison's link opens (PRD 0020).

Link previews (WhatsApp, Telegram, Discord, X…) read Open Graph tags from the HTML
the link returns and never run JavaScript, so a single-page app can't give each
share its own preview. This page carries the share's title and image for them, and
sends a person on to the comparison in the app.
"""

from __future__ import annotations

from html import escape
from typing import Final

from sleepmon.domain.comparison_share import SharedComparison, ShareLanguage

_TEXTS: Final[dict[ShareLanguage, dict[str, str]]] = {
    ShareLanguage.ES: {
        "title": "Comparación: {names}",
        "description": "Mirá la producción estimada de {count} lado a lado en sleepmon.",
        "one": "1 Pokémon",
        "many": "{n} Pokémon",
        "open": "Abrir la comparación",
    },
    ShareLanguage.EN: {
        "title": "Comparison: {names}",
        "description": "See the estimated production of {count} side by side on sleepmon.",
        "one": "1 Pokémon",
        "many": "{n} Pokémon",
        "open": "Open the comparison",
    },
}


_BODY_STYLE: Final = (
    "background:#0e1220;color:#e8ecf6;font-family:system-ui,sans-serif;"
    "text-align:center;padding:2rem 1rem"
)


def share_title(share: SharedComparison) -> str:
    names = " vs ".join(m.species for m in share.members)
    return _TEXTS[share.language]["title"].format(names=names)


def render_share_page(
    share: SharedComparison, *, share_url: str, image_url: str, app_url: str
) -> str:
    texts = _TEXTS[share.language]
    count = len(share.members)
    title = share_title(share)
    description = texts["description"].format(
        count=texts["one"] if count == 1 else texts["many"].format(n=count)
    )
    # Every interpolated value is escaped: species names come from the catalog, but
    # the URLs come from configuration and the request.
    t, d = escape(title), escape(description)
    share_u, image_u, app_u = escape(share_url), escape(image_url), escape(app_url)
    lang = share.language.value
    return f"""<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{t} · sleepmon</title>
<meta name="description" content="{d}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="sleepmon">
<meta property="og:url" content="{share_u}">
<meta property="og:title" content="{t}">
<meta property="og:description" content="{d}">
<meta property="og:image" content="{image_u}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{t}">
<meta name="twitter:description" content="{d}">
<meta name="twitter:image" content="{image_u}">
<meta name="theme-color" content="#0e1220">
<script>location.replace({_js_string(app_url)});</script>
</head>
<body style="{_BODY_STYLE}">
<p><a href="{app_u}" style="color:#8f95ff">{escape(texts["open"])}</a></p>
</body>
</html>
"""


def render_missing_share_page(app_url: str) -> str:
    """The page for an unknown or expired link: the app explains it (and says so in
    the person's language), so this only sends them on. No preview image."""
    app_u = escape(app_url)
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>sleepmon</title>
<meta name="robots" content="noindex">
<meta name="theme-color" content="#0e1220">
<script>location.replace({_js_string(app_url)});</script>
</head>
<body style="{_BODY_STYLE}">
<p><a href="{app_u}" style="color:#8f95ff">sleepmon</a></p>
</body>
</html>
"""


def _js_string(value: str) -> str:
    """A JavaScript string literal that can't close the surrounding <script>."""
    escaped = (
        value.replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("<", "\\u003c")
        .replace(">", "\\u003e")
        .replace("\n", "\\n")
    )
    return f'"{escaped}"'
