# kit

- **Coordinates:** Camera keys are AppWindow stage coordinates (1440x900 UI px; the key point lands at
  frame centre — in the social layout at the centre of the stage between the bands, `cameraCentre()`). Overlays (Cursor, Highlight, FakeSelect) are placed inside the AppWindow/Camera
  in content coordinates; identical while the window has no chrome.
- **z-index** only orders within one stacking context: Highlight 50 < FakeSelect 60 < Cursor 100. Chapter titles (`ChapterTitle`, z 90) are frame-fixed, drawn
  outside the Camera by `SceneTitles`.
- Highlight's dim is clipped by AppWindow (intended).
- **Social (1080×1350, `SOCIAL_FRAME`):** top 120 px — `BrandBand` (drawn by the composition, over every
  scene); bottom 260 px — the chapter band (`SceneTitles` draws it over the UI in every scene, the titles
  in it: `SOCIAL_TYPE` 54 / 30, `titleText()` line breaks).
- **Transitions:** `CameraWipe` (`cameraTransition`) — `wipe` (diagonal mask, brass edge, outgoing push +
  incoming parallax) and `card` (the incoming shot opens out of a rect of the outgoing one); pure geometry
  (`wipePolygon`, `cardOpen`, …) unit-tested in `camera-wipe.spec.ts`. Scenes frame one zone at a time inside `stageView()` (the stage between the bands), zoom ≥ 1.7.
- PhoneFrame `scale` uses `transformOrigin: 'center'` (set explicitly).
- FakeSelect: the hover row shows on frames openAt+9 <= f < pickAt, so a hover frame needs `pickAt >= openAt + 10`.
- LoopCrossfade: child clip must be >= D + overlap frames; see its doc comment and `loopLayers`.
- Everything is a pure function of the frame; time in key paths is seconds, click frames are absolute.
