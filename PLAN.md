# Vase Configurator — PLAN

## 1. Goal

A browser-based parametric designer for 3D-printable vases. You shape a vase with
sliders, presets and a 2D profile editor, see it live in 3D, get warned about
print problems, and export a print-ready **STL** and a Rhino-ready **.3dm**.

## 2. Users

| Priority | User | Needs |
|---|---|---|
| Primary | **You** — personal design tool | Fast iteration, save/reopen designs, full control |
| Secondary | Hobbyist makers | Sensible printer/material defaults, STL that slices cleanly |
| Secondary | Rhino designers | Clean .3dm with editable NURBS and construction curves |

No shop, ordering, accounts or payments.

## 3. Inputs → Process → Outputs

**Inputs**
- Shape parameters (dimensions, profile, cross-section, twist, pattern, lip)
- Print mode (vase mode / solid wall)
- Printer profile (preset or custom) and material
- Export quality (preset or manual segment counts)
- Optional: a saved design (browser gallery, JSON file, or share URL)

**Process**
1. Build the **profile curve** (radius vs. height) from control points.
2. For each height step, build the **cross-section** (circle / polygon / star / rounded polygon),
   scale it to the profile radius, apply **twist**, apply **surface pattern** displacement.
3. Add **lip/rim** geometry at the top and a **bottom** (closed base).
4. Generate a watertight mesh (preview resolution or export resolution).
5. Run **checks** against printer + material: build volume (hard clamp), overhang angle,
   wall thickness, material warnings.
6. On export: write STL; write .3dm with mesh + NURBS loft + curves on layers.

**Outputs**
- **STL** (binary, millimetres)
- **.3dm** with layers:
  - `Mesh` — same mesh as the STL
  - `Surface` — NURBS surface lofted through the section curves
  - `Curves` — profile curve + section curves
- **Design JSON** (parameters only) and a **share URL**
- Live 3D preview with warning overlays

## 4. Parameters

All lengths in **mm**, angles in **degrees**. Ranges are proposals — adjust freely.
Size ranges are further clamped by the selected printer's build volume.

### 4.1 Basic dimensions
| Name | Unit | Range | Default |
|---|---|---|---|
| `height` | mm | 20 – 400 (≤ printer Z) | 150 |
| `bottomRadius` | mm | 10 – 150 | 40 |
| `topRadius` | mm | 5 – 150 | 35 |

Max diameter (incl. pattern amplitude and lip) must fit printer X/Y.

### 4.2 Profile curve
One shared set of control points; all three editors modify it.

| Name | Unit | Range | Default |
|---|---|---|---|
| `profilePreset` | enum | cylinder, bulb, hourglass, cone, bottle | bulb |
| `controlPoints` | list of (t, r) | 4 – 8 points; t ∈ 0–1 (height fraction), r ∈ 0.2–2.5 (× base radius interpolation) | from preset |
| `bellyPosition` | fraction of height | 0.1 – 0.7 | 0.35 |
| `bellyWidth` | × radius | 0.8 – 2.0 | 1.3 |
| `neckPosition` | fraction of height | 0.5 – 0.95 | 0.8 |
| `neckWidth` | × radius | 0.3 – 1.2 | 0.7 |

Curve type: smooth spline (Catmull-Rom or cubic B-spline) through/around the points.

### 4.3 Cross-section
| Name | Unit | Range | Default |
|---|---|---|---|
| `sectionShape` | enum | circle, polygon, star, roundedPolygon | circle |
| `sides` | count | 3 – 24 | 6 |
| `starDepth` | fraction of radius | 0.05 – 0.5 | 0.2 |
| `cornerRounding` | fraction | 0 – 1 | 0.3 |

### 4.4 Twist
| Name | Unit | Range | Default |
|---|---|---|---|
| `twist` | deg (bottom → top) | -360 – 360 | 0 |
| `twistEasing` | enum | linear, easeIn, easeOut, easeInOut | linear |

### 4.5 Surface pattern
| Name | Unit | Range | Default |
|---|---|---|---|
| `patternType` | enum | none, waves, ribs, spiral | none |
| `patternAmplitude` | mm | 0 – 8 | 2 |
| `patternCountAround` | count | 2 – 64 | 12 |
| `patternCountVertical` | count | 0 – 20 (waves only) | 4 |
| `spiralTurns` | turns over height | 0.25 – 5 (spiral only) | 1 |
| `patternFadeBottom` | mm | 0 – 50 | 5 |

### 4.6 Lip / rim
| Name | Unit | Range | Default |
|---|---|---|---|
| `lipType` | enum | none, flared, rolled | none |
| `lipHeight` | mm | 2 – 30 | 8 |
| `lipFlareAngle` | deg | 0 – 45 | 15 |
| `lipRollRadius` | mm | 1 – 6 | 2 |

### 4.7 Print mode
| Name | Unit | Range | Default |
|---|---|---|---|
| `printMode` | enum | vaseMode, solidWall | vaseMode |
| `wallThickness` | mm | 0.4 – 6 (solidWall only) | 2 |
| `bottomThickness` | mm | 0.6 – 6 | 1.2 |

Vase mode exports a **closed solid body**; the slicer's "spiralize" setting turns it into a
single wall. Solid-wall mode exports an outer + inner shell (offset by `wallThickness`), open top.

### 4.8 Printer
| Name | Unit | Range | Default |
|---|---|---|---|
| `printerPreset` | enum | Bambu P1S, Bambu X1C, Prusa MK4, Creality Ender 3 V3, Elegoo Saturn 4, Anycubic Photon Mono M7, Custom FDM, Custom Resin | Bambu P1S |
| `buildX` / `buildY` / `buildZ` | mm | 50 – 1000 | from preset |
| `nozzleDiameter` | mm | 0.2 – 1.2 (FDM) | 0.4 |
| `xyResolution` | µm | 10 – 100 (resin) | from preset |

Preset build volumes and resolutions are verified against manufacturer specs during step 9.

### 4.9 Material
| Name | Unit | Values | Default |
|---|---|---|---|
| `material` | enum | PLA, PETG, TPU, Resin | PLA |
| `materialColor` | hex | any | per material |

Material rule defaults (editable in code, one table):

| Material | Min wall | Max overhang | Preview finish | Warnings |
|---|---|---|---|---|
| PLA | 2 × nozzle | 45° | matte | Not water/food safe without coating |
| PETG | 2 × nozzle | 40° | satin | — |
| TPU | 3 × nozzle | 35° | matte, soft | Thin walls may sag; vase mode recommended |
| Resin | 0.8 mm | 30° (unsupported) | glossy / translucent | Hollow solid-wall parts need drain holes; wash & cure |

### 4.10 Export quality
| Name | Unit | Range | Default |
|---|---|---|---|
| `qualityPreset` | enum | draft, normal, fine, custom | normal |
| `segmentsVertical` | count | 16 – 1024 | draft 64 / normal 200 / fine 500 |
| `segmentsRadial` | count | 16 – 1024 | draft 64 / normal 180 / fine 400 |
| `previewAtExportQuality` | bool | — | false |

Preview uses a lighter mesh (about ¼ of export counts) unless the checkbox is on.

## 5. Constraints

- **Build volume is a hard limit**: sliders clamp so the bounding box (incl. pattern + lip) never exceeds the printer.
- **Everything else warns, never blocks**: overhang zones painted red in 3D, thin walls flagged, material notes listed. Export always allowed.
- **Watertight, manifold mesh** in both print modes; normals outward; units mm.
- **Profile radius never ≤ 0**; self-intersection prevented by clamping pattern amplitude vs. radius and wall thickness.
- **Real-time**: preview regenerates < ~50 ms at preview resolution on a laptop; export allowed to take a few seconds (run in a Web Worker if needed).
- **Client-only**: no server; everything runs in the browser. rhino3dm loaded lazily (WASM).
- **Responsive**: desktop primary; tablet and phone supported (panel → bottom sheet, touch orbit).
- **Theme**: dark "studio" by default, light toggle.

## 6. Tech stack (fixed — change only with approval)

- **Vite + React + TypeScript**
- **Tailwind CSS** + **shadcn/ui** (Slider, Select, Tabs, Accordion, Switch, Dialog, Sheet, Tooltip, Sonner)
- **React Three Fiber + drei** (OrbitControls, Environment, Grid, Bounds, ContactShadows)
- **rhino3dm** for .3dm export
- STL writer: three.js `STLExporter` (ships with three)
- Small helpers allowed without asking: a state store (Zustand), URL compression (lz-string), schema validation (zod). *(Flag if you'd rather avoid these.)*

## 7. Pages / screens

Single-page app, one main screen plus dialogs:

1. **Designer (main)**
   - Large 3D viewport: orbit/zoom, ground grid, printer build volume box (toggle), red overhang overlay, dimension readout.
   - Side panel (bottom sheet on mobile) with accordion sections:
     Shape · Profile · Cross-section · Twist · Pattern · Lip · Print mode · Printer & material · Export.
   - Warnings strip / badge listing current issues.
   - Top bar: design name, Save, Gallery, Share, Import/Export JSON, Export STL, Export .3dm, theme toggle.
2. **Profile editor** (panel tab or dialog): 2D view of the silhouette with draggable control points.
3. **Gallery dialog**: saved designs (name, thumbnail, date) — open, rename, duplicate, delete.
4. **Export dialog**: quality preset / custom segments, file name, triangle count + estimated file size.

## 8. Out of scope (v1)

- Accounts, cloud storage, shop/ordering/payments
- Slicing, G-code generation, print-time / filament estimates
- Automatically adding drain holes or supports for resin
- Handles, spouts, text/logo embossing, image-based textures
- Multi-material / multi-colour export (3MF), OBJ, STEP
- Undo/redo history beyond simple reset *(could be added later)*
- Collaboration / multi-user

## 9. Build order (small steps)

Each step ends with something visible and working.

1. **Scaffold**: Vite + React + TS, Tailwind, shadcn/ui init, dark theme tokens + light toggle, empty layout (viewport + side panel).
2. **3D viewport**: R3F canvas, orbit controls, grid, lighting/environment, placeholder cylinder.
3. **Parameter store**: typed parameter model + defaults + ranges in one file (zod schema); Zustand store.
4. **Core geometry — revolve**: generate mesh from height + bottom/top radius (straight profile, circle section), closed bottom, watertight. Unit test vertex/face counts and closure.
5. **Profile curve**: spline from control points; profile presets (cylinder, bulb, hourglass, cone, bottle).
6. **Zone sliders**: belly/neck position & width mapped onto the control points.
7. **Cross-sections**: polygon, star, rounded polygon.
8. **Twist** (+ easing).
9. **Printer presets + build-volume clamp**: preset table, custom entry, bounding-box clamp of sliders, build volume box in viewport.
10. **Surface patterns**: waves, ribs, spiral (+ bottom fade), with amplitude clamp.
11. **Lip/rim**: flared and rolled.
12. **Print mode toggle**: vase mode (solid body) vs. solid wall (inner offset shell, wall + bottom thickness).
13. **Materials**: material table, preview materials/colours, rule values.
14. **Checks & warnings**: overhang detection + red vertex-colour overlay, thin-wall check, material notes, warnings strip.
15. **Quality settings**: preview vs. export resolution, presets + custom segments, triangle count readout.
16. **STL export** (binary, mm) + export dialog.
17. **.3dm export — mesh layer**: lazy-load rhino3dm, write mesh to `Mesh` layer.
18. **.3dm export — curves layer**: profile curve + section curves as NURBS curves on `Curves` layer.
19. **.3dm export — surface layer**: NURBS loft through section curves on `Surface` layer. Verify in Rhino.
20. **Persistence**: save/load in localStorage, gallery dialog with thumbnails.
21. **JSON import/export** with schema validation + version field.
22. **Share URL**: compressed parameters in the URL hash; load on open.
23. **2D profile drag editor**: draggable control points, synced with presets and zone sliders.
24. **Responsive pass**: bottom sheet on mobile, touch controls, tablet layout.
25. **Polish**: tooltips with units/ranges, keyboard nudge for sliders, performance check (Web Worker for export if needed), final test prints of a few presets.

## 10. Status (October 2026)

Steps 1–25 are built in `vase-configurator/`, with 307 automated tests (`npm test`).
Each step was also checked in the in-app browser.

**Still to do (needs you):**
- Test prints of a few presets (vase mode and solid wall, PLA and resin).
- Open an exported `.3dm` in Rhino 7 or 8: three layers, smooth surfaces, and Cap on the
  outer wall gives a closed solid. (Checked only by reading files back with rhino3dm.)
- Try the app on a real phone (the bottom sheet and touch were tested with simulated events).

**Deviations from this plan, and why:**
| Area | Plan said | Built | Why |
|---|---|---|---|
| Default top radius | 35 mm | 30 mm | Matches the default Bulb preset (0.75 × bottom radius) |
| Default flared lip | 8 mm, 15° | 15 mm, 30° | The planned defaults flared outward by only ~1 mm |
| Wall thickness | (unspecified) | Measured horizontally, per layer | That is what the slicer fills with perimeters |
| Overhang (vase mode) | Outward lean | Lean either way | Vase mode prints a single wall, so inward lean overhangs too |
| `.3dm` file version | (unspecified) | Rhino 7 format | Opens in both Rhino 7 and 8 |
| Section radius | (unspecified) | Radius = corner / star-tip distance | Keeps the build-volume check exact |
| Radial segments | As set | Rounded up to a multiple of the sides | Keeps polygon and star corners sharp |
| Extra libraries | Zustand, zod, lz-string | Also vitest (dev only) | Automated tests |

**Additions beyond the plan:** collapsible panel sections with summaries, a Fit view
button (F), typed exact slider values, session restore on reload, and print warnings
listed inside the export dialog.
