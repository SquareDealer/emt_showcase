---
version: 1
slug: "video-src-kit-chaptertitle-tsx"
primary_target: "video/src/kit/ChapterTitle.tsx"
related_targets: ["video/src/kit/CameraWipe.tsx","video/src/kit/Callout.tsx"]
---

# Showcase video — chapter titles and continuous-camera transitions

Scope: the Remotion showcase (hero 1920×1080, social 1080×1350, feature loops 1600×1000) — the title
system that replaces the caption pills, and the scene-to-scene transitions. Mode: **Persuade**
(developer-portfolio showcase: a viewer decides the product is real and well made). Extension of the
established CRM world (PRODUCT.md, DESIGN.md): no new identity, DESIGN.md unchanged.

Audience and job: a hiring manager / client skimming a 49-s film (or a 40-s 4:5 cut at 50 % preview in
a feed). They must read seven claims, each proved by the UI behind it, without hunting for the text.
Constraints: frame-driven only (useCurrentFrame), no CSS transitions, no blur anywhere in transitions
(user), no ghosted double exposure, titles never cover the thing they describe, ≥ 2.5 s readable,
entries on the 120-BPM beat. Brand «Гараж CRM» only.

## Direction contract

THESIS: A film in chapters, not a UI with tooltips. One fixed lower-left chapter slate (wide) / the
bottom band (social) names what the shot proves; the camera never cuts — it pushes on and a crisp mask
hands over to the next room. Refused: floating dark pills with pointer dots, glow, crossfades of two
dense UIs, blur-zoom transitions.

OWN-WORLD: The CRM's dark ink (rgb 16 20 26) as a square slab flush to the frame corner; Inter 600
white title, Inter 400 muted second line (dark-theme muted, ≥ 6:1), brass (oklch 0.72 0.13 72) only
for the mono tabular index and its hairline, and for the 2-px leading edge of every wipe. No radius at
the frame edge, no shadow, no gradient.

STORY: Each chapter: the slate reads «NN / total — claim» and one factual line, the UI proves it, the
camera pushes into the detail and the next chapter's room slides in under a brass edge. Booking →
estimate opens the landed order card into its own work order.

FIRST VIEWPORT: Intro mark + tagline on dark; at 2 s the week calendar is revealed by the wipe; at 3.5 s
the slate «01 / 07 — Свободное окно → запись в 2 клика» sits lower-left (≈ 1000×170), the free
Thursday slot and its menu upper-right/centre, clear of it.

FORM: chapter slate + continuous camera, the only form (extension, no tournament); seed: none (unavailable)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
