# 3D model spec for Kestrel HQ

Every answered case adds one floor to Kestrel's headquarters. These are the models
that replace the placeholder shapes in `web/hq.js`. Whoever builds them (SketchUp,
an AI generator or an artist) should follow this spec so the pieces stack and glow.

## File format
- **.glb** (binary glTF). From SketchUp desktop: File > Export > 3D Model > GLTF Binary File (*.glb).
- Low-poly. Aim for under 2 MB per file and under 20,000 triangles.
- Save finished files in this folder with the names below.

## Orientation and origin
- **Origin at the base center** of the model, on the ground plane.
- **Up is +Y** (SketchUp's blue axis up is converted on export).
- **Front faces +Z** (toward the street and camera start).
- Real-world meters. The game rescales each floor to its footprint, so exact size
  matters less than consistent proportions.

## Material names (required)
SketchUp's glTF export drops emissive light, so the game adds window glow itself.
It finds the glass by material name:

| Material name | Use | What the game does |
|---|---|---|
| `Window` | Every window pane | Lights it warm (correct), dim (second try) or red (missed) |
| `Trim` | Floor slabs, cornices, frames | Leaves as is |
| anything else | Walls, roof, details | Leaves as is |

## Floor modules (one story each, must stack)

| File | Round | Footprint (W x D) | Story height | Look |
|---|---|---|---|---|
| `floor-garage.glb` | Seed | 14.4 m x 11.2 m | 3.6 m | Suburban wood-sided garage: roll-up door open on the front, 3 windows per side, flat top so the next floor can sit on it |
| `floor-loft.glb` | Series A | 12.8 m x 10.8 m | 3.1 m | Red-brick industrial loft: 5 tall divided windows per long side, stone sill band, thin cornice slab on top |
| `floor-tower.glb` | IPO | 10 m x 10 m | 2.7 m | Glass curtain wall: 8 full-height panes per side with slim mullions, dark spandrel slab on top |

Each module should be a single story with a flat top at exactly its story height, so
the next floor sits flush. Footprints shrink as rounds advance: garage, then loft,
then tower, stacked in that order.

## Roof and set pieces

| File | Placed | Size guide | Look |
|---|---|---|---|
| `sign-kestrel.glb` | On the top floor, front edge | 9 m wide | Rooftop sign frame on two posts. The game adds the glowing "KESTREL AI" text |
| `water-tower.glb` | Loft roof, Series A | 3 m wide, 6 m tall | Classic New York wooden water tank on steel legs |
| `spire.glb` | Tower top, at the IPO | 1 m wide, 9 m tall | Slim steel mast. Name the tip material `Beacon` and the game will blink it |

## Not for SketchUp
Characters (Maya, Dev, Priya, Sam) and vehicles need a character-capable tool or an
artist. Keep their files separate: `char-maya.glb` and so on.
