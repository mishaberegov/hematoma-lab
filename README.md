# Hematoma Lab

Standalone, static, browser-local **CT research prototype**. No server upload, no patient data in repository. Not validated for diagnosis or clinical use.

## Run

Published page: https://mri.moscow/hematoma-lab/ . To run locally:

```sh
npm test
npm start
```
Open `http://localhost:8765/` (or serve `dist/` from another localhost static HTTP server). Click **Synthetic demo** to try without patient images. Drag DICOM files, a directory tree, or ZIP onto the page; alternatively choose local files/folder. Select a series then load. No build or npm install needed.

For large source grids (>60 million voxels), the loader automatically averages finite pixels in-plane by the smallest integer factor that fits memory, **keeping every original Z position**. It visibly reports source and reduced dimensions and labels segmentation/volumes as **approximate**: thin blood and edges can change under averaging. No manual slice-range choice is required. There is no missing-slice interpolation or Float16 conversion. Odd-sized images use the actual number of source pixels represented by each partial edge block when converting mask voxels to mL. Original DICOMs are unchanged.

## Editing

Three orthogonal views share a crosshair. Shift-click/right-click moves it without editing. The **CT-connected seed** floods a 6-connected 30–100 HU component (choose a location inside blood); select a compartment first. **Local 3D grow** starts on unlabelled, HU-qualified blood near the chosen label; it connects through qualifying voxels to the accepted mask within a physical-mm radius. **Local 3D shrink** starts inside the chosen label and removes a radius-limited connected patch only when it reaches the existing surface (no closed internal cavity). Hold the pointer to enlarge the physical radius; all three planes preview before release commits. Undo/redo operate on changed voxels. Labels: intraparenchymal, intraventricular, subarachnoid, subdural, epidural. Volumes derive from the physical voxel transform in mm³ / 1000, with partial-edge weights when reduced. Adjust CT window independently of decoded pixels.

## Measurement and safety limits

Loader components adapted from the local registration project (`dicom.mjs`, `core.mjs`, `zip-index.mjs`, `io-worker.js`, `vendor/`; see vendor/LICENSES.txt). The worker scans headers, groups by series/echo/time/ImageType and decodes only the chosen series. Indexed ZIP handling and compressed DICOM codecs are reused. **The original registration `buildVolume` is not used**: the measurement builder rejects non-CT, single slices, mixed orientation/spacing, ambiguous duplicate/irregular slice gaps, in-plane drift, lossy JPEG variants and invalid HU calibration. A single shared endpoint between two otherwise contiguous acquisitions with matching study and frame of reference is handled as in registration: keep the longer acquisition's original boundary slice and explicitly warn about the seam. The builder now adopts registration's bounded in-plane averaging for oversized volumes, preserving all Z positions and physical geometry, but **not** its missing-slice interpolation or CT Float16 conversion. Pixels and 3D mask live on the reduced grid, so quantitative labels are approximate whenever averaging occurs. Pixel values are decoded to Float32 with DICOM rescale/padding handling. Rejected studies do not display volume figures. Source CT acquisition may itself contain partial-volume effects; adequate reconstruction quality and expert verification remain necessary.

This is **not AI**, not an automatic multicompartment classifier, and HU alone cannot distinguish all blood from vessels, calcification, contrast, or artifact. Manual seeds assign compartments; edits are intensity-constrained, not anatomically aware. A seed on a large connected 30–100 HU tissue region may select it all (the UI refuses >200,000 voxels only); review every preview and label. No DICOM SEG export, persistence, deformable processing, oblique world-plane reformatting, or controlled clinical validation. Native acquisition planes are shown; oblique acquisitions remain voxel-axis views, not reoriented anatomical orthogonal MPR. ZIP and DICOM header parsing retain the inherited limits and unsupported transfer syntaxes.

## Tests

`npm test` covers coordinate axes/world transform, physical local editing/volumes, disconnected island rejection, undo/redo, CT seed connectivity, Float32 construction, accepted one-slice acquisition seams, other duplicate/missing/drifting slice gates, automatic in-plane averaging and edge-area weights, cache-version consistency and the non-CT gate. Synthetic demo is procedurally generated and contains no patient information.
