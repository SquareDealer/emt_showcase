# kit

- **Coordinates:** Camera keys are AppWindow stage coordinates (1440x900 UI px; the key point lands at
  frame centre — in the social layout at the centre of the stage between the bands, `cameraCentre()`). Overlays (Cursor, Highlight, Callout, FakeSelect) are placed inside the AppWindow/Camera
  in content coordinates; identical while the window has no chrome.
- **z-index** only orders within one stacking context: Highlight 50 < FakeSelect 60 < Callout 90 < Cursor 100.
- Highlight's dim is clipped by AppWindow (intended).
- **Social (1080×1350, `SOCIAL_FRAME`):** top 120 px — `BrandBand` (drawn by the composition, over every
  scene); bottom 260 px — `Callout`'s social form, a full-width plaque pinned to the frame through the camera
  (`useCameraState` + `frameToUi`; `anchor`/`side` unused), type `PLAQUE_FONT` 54, `plaqueText()` line
  breaks. Scenes frame one zone at a time inside `stageView()` (the stage between the bands), zoom ≥ 1.7.
- PhoneFrame `scale` uses `transformOrigin: 'center'` (set explicitly).
- FakeSelect: the hover row shows on frames openAt+9 <= f < pickAt, so a hover frame needs `pickAt >= openAt + 10`.
- LoopCrossfade: child clip must be >= D + overlap frames; see its doc comment and `loopLayers`.
- Everything is a pure function of the frame; time in key paths is seconds, click frames are absolute.
