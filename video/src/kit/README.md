# kit

- **Coordinates:** Camera keys are AppWindow stage coordinates (1440x900 UI px; the key point lands at
  frame centre). Overlays (Cursor, Highlight, Callout, FakeSelect) are placed inside the AppWindow/Camera
  in content coordinates; identical while the window has no chrome.
- **z-index** only orders within one stacking context: Highlight 50 < FakeSelect 60 < Callout 90 < Cursor 100.
- Highlight's dim is clipped by AppWindow (intended).
- PhoneFrame `scale` uses `transformOrigin: 'center'` (set explicitly).
- FakeSelect: use `pickAt >= openAt + 9` (the hover row appears at openAt + 9; an earlier pickAt skips the hover highlight).
- LoopCrossfade: child clip must be >= D + overlap frames; see its doc comment and `loopLayers`.
- Everything is a pure function of the frame; time in key paths is seconds, click frames are absolute.
