# Hematoma Lab

Browser-only CT/MR segmentation workspace with marker-guided adaptive fill, shape-aware grow/shrink, mask opening/closing, three orthogonal views, and Undo/Redo. The interface defaults to English; add `?lang=ru` or use the EN/RU switch for Russian.

## Run and test

```sh
npm test
npm start
```

Open `http://127.0.0.1:8765/` locally. DICOM processing and segmentation run in the browser; no application upload endpoint is used. Never add patient DICOM, masks, scans, or screenshots to this repository or its web host.

The segmentation method is experimental and **not validated for diagnosis or clinical measurement**. In particular, a local grow may refuse to commit when no trustworthy boundary is found within its sampling radius. Preview proposals require explicit acceptance; Undo restores accepted edits. Volume measurement is blocked on invalid geometry, and CT requires calibrated HU.
