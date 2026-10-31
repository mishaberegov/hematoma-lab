# Hematoma Lab · adaptive seed experiment

Independent research comparison at https://mri.moscow/hematoma-lab-adaptive/ . The [original HU-seed variant](https://mri.moscow/hematoma-lab/) and [graph-cut experiment](https://mri.moscow/hematoma-lab-graphcut/) are separate, unchanged pages.

This static application decodes DICOM CT or MR locally in the browser; it does not upload patient images. **It is not validated for diagnosis or clinical measurement.** No patient data is stored in this repository or on the website. Run `npm test`, then `npm start` and open `http://localhost:8765/` for local use.

## Adaptive seed

Open a single regular 3D series, or either synthetic demo. Select **Segment**, keep **Adaptive seed**, and click *inside* a homogeneous lesion. A small central intensity core estimates a robust median and spread; a physically bounded 3D flood selects only connected pixels similar to that core. **Radius is a search limit, not a forced solid sphere.** Sensitivity varies the intensity tolerance; changing it recomputes the proposal. Mint voxels are an unaccepted preview: the accepted mask and volume remain unchanged until **Accept proposal**. **Discard** leaves them unchanged; **Undo** reverses an accepted mask. The accepted and proposed total mL appear separately. The linked cursor and slice positions do not move when a Segment click proposes a mask. Both demos are synthetic.

A same-intensity normal structure can be included. Heterogeneous or thin disease can be missed. The core can straddle tissue and yield a bad estimate; the app warns on low local contrast, but cannot recognize pathology. Inspect all planes and adjacent slices. MR voxel values are arbitrary and sequence-dependent; unlike CT, they are not HU. No MR sequence has been clinically validated for this method.

The older **Local CT seed**, **grow/shrink**, and **marker-guided fill** remain for comparison on CT. Their HU rules do not apply to MR, so they are disabled for MR. Blue exclusion markers constrain only legacy CT fill, **not** adaptive seeds. The default adaptive workflow measures a single target and total volume; legacy compartments remain in the CT selector for comparison.

## Image and measurement gates

The DICOM loader requires a regular physical grid and at least two slices, rejects drift, duplicate or missing slices and lossy pixel sources, and requires actual HU rescale metadata for CT. MR accepts regular frames with valid intensity scaling without calling their values HU. Large images are reduced in-plane by finite-pixel averaging while preserving every original slice location; the UI labels reduced-grid measurements approximate. Volume is computed from the physical voxel matrix and partial edge-block weights. Geometry is required even for an image that looks plausible. Acquisitions displayed in their native voxel planes can be oblique; they are not resliced to canonical anatomy. Results remain in memory in the current tab and are cleared on reload.

`npm test` covers the synthetic intensity boundary, outliers, MR-like values, physical geometry, reduced-grid measurement, proposal UI contracts and the inherited editing/loading regressions. Demo or unit-test performance does not establish overlap with expert clinical contours.
