# Hematoma Lab · adaptive seed experiment

Independent research comparison at https://mri.moscow/hematoma-lab-adaptive/ . The [original HU-seed variant](https://mri.moscow/hematoma-lab/) and [graph-cut experiment](https://mri.moscow/hematoma-lab-graphcut/) are separate, unchanged pages.

This static application decodes DICOM CT or MR locally in the browser; it does not upload patient images. **It is not validated for diagnosis or clinical measurement.** No patient data is stored in this repository or on the website. Run `npm test`, then `npm start` and open `http://localhost:8765/` for local use.

## Marker-guided adaptive fill

Open a regular CT or MR 3D series (or a synthetic demo). Switch to **Segment**, choose **Target point**, and place several teal points inside the target without editing the accepted mask. Optionally choose **Background point** and place orange anti-seeds in adjacent non-target tissue. Each point samples a small physically defined neighborhood: the inner portion of its intensity distribution is pooled across target points to learn a range robust to a minority of calcium, air, fluid, or normal-tissue voxels. Background points shift a distinguishable intensity boundary and block a local 3 mm neighborhood. If foreground and background values overlap, a warning says that intensity alone cannot separate them. No predetermined CT HU corridor is imposed; MR values are arbitrary and sequence-dependent.

Click **Propose fill** only after placing the points. The connected 3D proposal is restricted to their spatial bounding region plus the radius margin; the radius does not paint solid spheres. Review the mint mask and proposed mL in all planes, then **Accept mask** once or **Discard proposal** while retaining the points. Changing sensitivity or radius invalidates the preview; click Propose fill again. **Clear points** resets both point sets. Accepted mask changes can be undone. Points do not change the 3D cursor or accepted mask; they are cleared after accepting or loading a different series. Both demos are synthetic.

Same-intensity healthy tissue may be included and some bleeding missed; a background point is not a guarantee of a correct boundary. The proposed mask can be clipped by the spatial limit, and the app warns if it touches that limit. Inspect adjacent slices; this method is not clinically validated. MR sequences in particular have no shared quantitative intensity scale.

The older **Local CT seed**, **grow/shrink**, and **mask-guided fill** remain for comparison on CT, with their HU restrictions. Legacy blue exclusion markers are separate from adaptive orange background points. The default adaptive workflow measures one target and total volume; legacy compartments remain available for CT comparison.

## Image and measurement gates

The DICOM loader requires a regular physical grid and at least two slices, rejects drift, duplicate or missing slices and lossy pixel sources, and requires actual HU rescale metadata for CT. MR accepts regular frames with valid intensity scaling without calling their values HU. Large images are reduced in-plane by finite-pixel averaging while preserving every original slice location; the UI labels reduced-grid measurements approximate. Volume is computed from the physical voxel matrix and partial edge-block weights. Geometry is required even for an image that looks plausible. Acquisitions displayed in their native voxel planes can be oblique; they are not resliced to canonical anatomy. Results remain in memory in the current tab and are cleared on reload.

`npm test` covers the synthetic intensity boundary, outliers, MR-like values, physical geometry, reduced-grid measurement, proposal UI contracts and the inherited editing/loading regressions. Demo or unit-test performance does not establish overlap with expert clinical contours.
