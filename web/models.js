// Kestrel HQ building models, rebuilt from the SketchUp designs (assets/models/SPEC.md).
// Dimensions are the SketchUp ones, in meters: x = width, y = depth (front is -y), z = up.
// Everything is scaled by S into game units and converted to three.js axes (front = +Z).
// Parts that share a material are merged into one mesh so a floor costs a handful of draw calls.
// Exposes window.HQModels = { floor(style, grade), roof(style), site(style) }.
window.HQModels = (() => {
  if (!window.THREE) return null;
  const S = 0.5;

  // ---------- Merged geometry builder ----------
  class Batch {
    constructor(tu = 1, tv = 1) { this.p = []; this.uv = []; this.i = []; this.tu = tu; this.tv = tv; }
    v(x, y, z) { return [x * S, z * S, -y * S]; }            // SketchUp meters -> three.js units
    face(pts) {                                              // planar convex polygon, any winding
      const a = pts[0], b = pts[1], c = pts[2];
      const n = [(b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]),
                 (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]),
                 (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])].map(Math.abs);
      const base = this.p.length / 3;
      pts.forEach((q) => {
        this.p.push(q[0], q[1], q[2]);
        let u, w;
        if (n[0] >= n[1] && n[0] >= n[2]) { u = q[2]; w = q[1]; }
        else if (n[1] >= n[2]) { u = q[0]; w = q[2]; }
        else { u = q[0]; w = q[1]; }
        this.uv.push(u / this.tu, w / this.tv);
      });
      for (let k = 1; k < pts.length - 1; k++) this.i.push(base, base + k, base + k + 1);
    }
    box(x0, x1, y0, y1, z0, z1) {
      const P = (x, y, z) => this.v(x, y, z);
      const c = [P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0), P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)];
      [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]].forEach((f) => this.face(f.map((k) => c[k])));
    }
    prismY(xz, y0, y1) {                                     // polygon in the x-z plane, extruded along depth
      const A = xz.map(([x, z]) => this.v(x, y0, z)), B = xz.map(([x, z]) => this.v(x, y1, z));
      this.face(A); this.face(B);
      for (let k = 0; k < xz.length; k++) { const j = (k + 1) % xz.length; this.face([A[k], A[j], B[j], B[k]]); }
    }
    prismZ(xy, z0, z1) {                                     // polygon in plan, extruded up
      const A = xy.map(([x, y]) => this.v(x, y, z0)), B = xy.map(([x, y]) => this.v(x, y, z1));
      this.face(A); this.face(B);
      for (let k = 0; k < xy.length; k++) { const j = (k + 1) % xy.length; this.face([A[k], A[j], B[j], B[k]]); }
    }
    hex(pts8) { [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]].forEach((f) => this.face(f.map((k) => pts8[k]))); }
    geometry() {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(this.p, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
      g.setIndex(this.i);
      g.computeVertexNormals();
      g.computeBoundingSphere();
      return g;
    }
  }
  class Kit {
    constructor(tiles) { this.b = {}; this.tiles = tiles || {}; }
    get(k) { if (!this.b[k]) { const t = this.tiles[k] || [1, 1]; this.b[k] = new Batch(t[0], t[1]); } return this.b[k]; }
    box(k, x0, x1, y0, y1, z0, z1) { this.get(k).box(x0, x1, y0, y1, z0, z1); }
    geometries() { const out = {}; Object.keys(this.b).forEach((k) => (out[k] = this.b[k].geometry())); return out; }
  }
  const toGroup = (geos, mats, shadows = true) => {
    const g = new THREE.Group();
    Object.keys(geos).forEach((k) => {
      const m = new THREE.Mesh(geos[k], mats[k]);
      m.castShadow = shadows && k !== "glass" && k !== "glow"; m.receiveShadow = true;
      g.add(m);
    });
    return g;
  };

  // ---------- Textures, drawn in code ----------
  const tex = (w, h, draw) => {
    const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
  };
  const rng = (seed) => { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
  const sidingTex = tex(128, 128, (c, w, h) => {
    const r = rng(5);
    for (let x = 0; x < w; x++) { const v = 40 + (r() - 0.5) * 8; c.fillStyle = `rgb(${v},${v + 2},${v + 5})`; c.fillRect(x, 0, 1, h); }
    for (let x = 0; x < w; x += 64) { c.fillStyle = "rgba(255,255,255,.08)"; c.fillRect(x, 0, 6, h); c.fillStyle = "rgba(0,0,0,.35)"; c.fillRect(x + 6, 0, 2, h); }
  });
  const cedarTex = tex(256, 128, (c, w, h) => {
    const r = rng(9);
    for (let b = 0; b < 4; b++) {
      const t = (r() - 0.5) * 34;
      for (let y = b * 32; y < b * 32 + 32; y++) {
        const row = (r() - 0.5) * 10;
        for (let x = 0; x < w; x += 4) {
          const k = t + row + Math.sin(x * 0.07 + b * 2.3) * 7;
          c.fillStyle = `rgb(${178 + k | 0},${112 + k * 0.8 | 0},${66 + k * 0.6 | 0})`; c.fillRect(x, y, 4, 1);
        }
      }
      c.fillStyle = "rgba(0,0,0,.45)"; c.fillRect(0, b * 32 + 30, w, 2);
    }
  });
  const brickTex = tex(180, 60, (c, w, h) => {
    const r = rng(7);
    c.fillStyle = "rgb(186,176,160)"; c.fillRect(0, 0, w, h);
    for (let course = 0; course < 4; course++) {
      const off = course % 2 ? 22 : 0;
      for (let b = -1; b < 5; b++) {
        const t = (r() - 0.5) * 36;
        c.fillStyle = `rgb(${156 + t | 0},${64 + t * 0.5 | 0},${48 + t * 0.4 | 0})`;
        c.fillRect(b * 45 - off, course * 15, 43, 13);
      }
    }
  });
  const seamTex = tex(32, 32, (c, w, h) => {
    c.fillStyle = "rgb(40,43,48)"; c.fillRect(0, 0, w, h);
    c.fillStyle = "rgb(72,76,84)"; c.fillRect(0, 0, w, 2); c.fillStyle = "rgb(24,26,30)"; c.fillRect(0, 2, w, 1);
  });

  const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.75, metalness: 0.05, side: THREE.DoubleSide }, o));
  const MAT = {
    siding: std({ map: sidingTex, roughness: 0.85 }),
    cedar: std({ map: cedarTex, roughness: 0.8 }),
    brick: std({ map: brickTex, roughness: 0.92 }),
    roofMetal: std({ map: seamTex, roughness: 0.45, metalness: 0.45 }),
    black: std({ color: 0x18191c, roughness: 0.5, metalness: 0.3 }),
    concrete: std({ color: 0x84827d, roughness: 0.95 }),
    paving: std({ color: 0x96948e, roughness: 0.95 }),
    limestone: std({ color: 0xd6ccb8, roughness: 0.85 }),
    timber: std({ color: 0x92683f, roughness: 0.8 }),
    desk: std({ color: 0xa0704a }),
    deskLight: std({ color: 0xc4aa84 }),
    fabric: std({ color: 0x465460, roughness: 0.95 }),
    greens: std({ color: 0x345c3a, roughness: 0.95 }),
    planter: std({ color: 0x464a4e }),
    pingpong: std({ color: 0x265c4a }),
    hvac: std({ color: 0xb0b6bc, metalness: 0.4, roughness: 0.5 }),
    membrane: std({ color: 0x5c6066, roughness: 1 }),
    gravel: std({ color: 0xc4aa7c, roughness: 1 }),
    dryGrass: std({ color: 0xb2a062, roughness: 1 }),
    agave: std({ color: 0x70928a, roughness: 0.8 }),
    stone: std({ color: 0x968e82, roughness: 0.95 }),
    palmTrunk: std({ color: 0x8c7656, roughness: 1 }),
    palmSkirt: std({ color: 0x7a6240, roughness: 1 }),
    palmGreen: std({ color: 0x4a703c, roughness: 0.9 }),
    screen: new THREE.MeshBasicMaterial({ color: 0xbfe6ff, side: THREE.DoubleSide }),
    bulb: new THREE.MeshBasicMaterial({ color: 0xffe2a8, side: THREE.DoubleSide }),
    neon: new THREE.MeshBasicMaterial({ color: 0xff7a59, side: THREE.DoubleSide }),
    skylight: std({ color: 0x9ccbe8, emissive: 0x406080, emissiveIntensity: 0.4, roughness: 0.2 })
  };
  const TILES = { siding: [0.3, 0.3], cedar: [0.6, 0.28], brick: [0.45, 0.15], roofMetal: [1, 0.2] };

  // Window glass lights up by result: 2 = right first time, 1 = second try, 0 = missed (red)
  const glassCache = {};
  const glass = (style, grade) => {
    const key = style + ":" + grade;
    if (!glassCache[key]) {
      const warm = style === 0 ? 0xffc98a : 0xffd58a;
      glassCache[key] = new THREE.MeshStandardMaterial({
        color: 0x1d222c, emissive: grade ? warm : 0xff5a6e,
        emissiveIntensity: grade === 2 ? 0.95 : grade === 1 ? 0.45 : 0.6,
        transparent: true, opacity: 0.6, roughness: 0.15, metalness: 0.3, side: THREE.DoubleSide, depthWrite: false
      });
    }
    return glassCache[key];
  };

  // Wall with rectangular openings, built as solid pieces around each hole. Local x runs along the wall.
  // place(lx0, lx1, ly0, ly1, z0, z1) maps local coordinates to a world box.
  const holedWall = (kit, mat, L, T, H, holes, place) => {
    const hs = holes.slice().sort((a, b) => a[0] - b[0]);
    let x = 0;
    hs.forEach(([a, b, z0, z1]) => {
      if (a > x) place(kit, mat, x, a, 0, T, 0, H);
      place(kit, mat, a, b, 0, T, 0, z0);
      place(kit, mat, a, b, 0, T, z1, H);
      x = b;
    });
    if (x < L) place(kit, mat, x, L, 0, T, 0, H);
  };
  const placer = (ox, oy, rot) => (kit, mat, lx0, lx1, ly0, ly1, z0, z1) => {
    if (rot) kit.box(mat, ox - ly1, ox - ly0, oy + lx0, oy + lx1, z0, z1);
    else kit.box(mat, ox + lx0, ox + lx1, oy + ly0, oy + ly1, z0, z1);
  };

  // =====================================================================
  // GARAGE (Seed): 14.4 x 11.2 m, 3.6 m story
  // =====================================================================
  const garageGeo = (() => {
    const kit = new Kit(TILES), T = 0.2, WH = 3.3;
    const panes = (P, holes, pane) => holes.forEach(([x0, x1, z0, z1]) => {
      const n = Math.max(1, Math.round((x1 - x0) / pane)), mw = 0.05, cell = (x1 - x0 - (n - 1) * mw) / n;
      let x = x0;
      for (let k = 0; k < n; k++) {
        P(kit, "glass", x, x + cell, 0.08, 0.12, z0, z1); x += cell;
        if (k < n - 1) { P(kit, "black", x, x + mw, 0.07, 0.13, z0, z1); x += mw; }
      }
    });
    // Front
    kit.box("siding", -7.2, -6.6, -5.6, -5.4, 0, WH);
    kit.box("siding", -6.6, -0.6, -5.6, -5.4, 2.7, WH);
    kit.box("cedar", -0.6, 0.0, -5.6, -5.4, 0, WH);
    kit.box("cedar", 0.0, 1.1, -5.6, -5.4, 2.6, WH);
    const fP = placer(1.1, -5.6, false), fH = [[1.7, 5.7, 0.5, 2.9]];
    holedWall(kit, "cedar", 6.1, T, WH, fH, fP); panes(fP, fH, 2.0);
    // Full-view glass garage door, 4 x 4 panels
    const gx0 = -6.6, gx1 = -0.6, gz1 = 2.7, fr = 0.08, mu = 0.05, d0 = -5.53, d1 = -5.47;
    const cw = (gx1 - gx0 - 2 * fr - 3 * mu) / 4, rh = (gz1 - 2 * fr - 3 * mu) / 4;
    kit.box("black", gx0, gx0 + fr, d0, d1, 0, gz1); kit.box("black", gx1 - fr, gx1, d0, d1, 0, gz1);
    for (let c = 0; c < 4; c++) {
      const x = gx0 + fr + c * (cw + mu);
      if (c < 3) kit.box("black", x + cw, x + cw + mu, d0, d1, fr, gz1 - fr);
      kit.box("black", x, x + cw, d0, d1, 0, fr); kit.box("black", x, x + cw, d0, d1, gz1 - fr, gz1);
      for (let r = 0; r < 4; r++) {
        const z = fr + r * (rh + mu);
        kit.box("glass", x, x + cw, d0 + 0.01, d1 - 0.01, z, z + rh);
        if (r < 3) kit.box("black", x, x + cw, d0, d1, z + rh, z + rh + mu);
      }
    }
    kit.box("cedar", 0.0, 1.1, -5.53, -5.47, 0, 2.6);
    kit.box("black", 0.88, 0.92, -5.6, -5.53, 0.7, 1.9);
    // Sides: ribbon windows
    const sH = [[1.0, 9.8, 1.9, 2.9]];
    const lP = placer(-7.0, -5.4, true), rP = placer(7.2, -5.4, true);
    holedWall(kit, "siding", 10.8, T, WH, sH, lP); panes(lP, sH, 1.25);
    holedWall(kit, "siding", 10.8, T, WH, sH, rP); panes(rP, sH, 1.25);
    // Back: two tall windows
    const bH = [[2.0, 4.6, 0.9, 2.9], [9.8, 12.4, 0.9, 2.9]], bP = placer(-7.2, 5.4, false);
    holedWall(kit, "siding", 14.4, T, WH, bH, bP); panes(bP, bH, 1.3);
    // Fascia band (flat top at 3.6 m) and floor
    kit.box("black", -7.2, 7.2, -5.6, 5.6, WH, 3.6);
    kit.box("concrete", -7.0, 7.0, -5.4, 5.4, 0, 0.1);
    // Interior: founders' desk, monitors, bulb, server rack, sofa
    kit.box("desk", -5.5, -1.5, -1.2, -0.4, 0.82, 0.86);
    [[-5.45, -1.15], [-1.6, -1.15], [-5.45, -0.5], [-1.6, -0.5]].forEach(([x, y]) => kit.box("black", x, x + 0.05, y, y + 0.05, 0.1, 0.82));
    [-5.0, -4.0, -3.0, -2.0].forEach((cx) => { kit.box("black", cx - 0.02, cx + 0.02, -0.9, -0.86, 0.86, 0.96); kit.box("screen", cx - 0.28, cx + 0.28, -0.93, -0.9, 0.96, 1.3); });
    kit.box("bulb", -3.56, -3.44, -0.86, -0.74, 2.9, 3.02);
    kit.box("black", 5.8, 6.6, 4.2, 5.2, 0.1, 2.1); kit.box("screen", 5.9, 6.0, 4.17, 4.2, 0.4, 1.9);
    kit.box("fabric", 2.0, 4.2, 3.6, 4.2, 0.1, 0.55); kit.box("fabric", 2.0, 4.2, 4.2, 4.4, 0.1, 0.95);
    return kit.geometries();
  })();

  const garageRoofGeo = (() => {
    const kit = new Kit(TILES), pitch = Math.tan(18 * Math.PI / 180), half = 7.2, t = 0.2;
    const zu = (x) => (half - Math.abs(x)) * pitch;
    const slab = (xa, xb) => {
      const b = kit.get("roofMetal"), y0 = -6.0, y1 = 6.0;
      const q = [[xa, y0, zu(xa)], [xb, y0, zu(xb)], [xb, y1, zu(xb)], [xa, y1, zu(xa)]];
      b.hex(q.map(([x, y, z]) => b.v(x, y, z)).concat(q.map(([x, y, z]) => b.v(x, y, z + t))));
    };
    slab(-7.6, 0); slab(0, 7.6);
    const mull = [-4.8, -2.4, 0, 2.4, 4.8], edges = [-half];
    mull.forEach((c) => edges.push(c - 0.03, c + 0.03)); edges.push(half);
    for (let k = 0; k < edges.length; k += 2) {
      const xl = edges[k], xr = edges[k + 1];
      const pts = zu(xl) < 1e-6 ? [[xl, 0], [xr, 0], [xr, zu(xr)]] : zu(xr) < 1e-6 ? [[xl, 0], [xr, 0], [xl, zu(xl)]] : [[xl, 0], [xr, 0], [xr, zu(xr)], [xl, zu(xl)]];
      kit.get("glass").prismY(pts, -5.52, -5.48);
    }
    mull.forEach((c) => kit.box("black", c - 0.03, c + 0.03, -5.54, -5.46, 0, zu(Math.abs(c) + 0.03)));
    kit.get("siding").prismY([[-half, 0], [half, 0], [0, zu(0)]], 5.4, 5.6);
    return kit.geometries();
  })();

  const garageSiteGeo = (() => {
    const kit = new Kit(TILES);
    kit.box("concrete", -6.8, -0.4, -10.0, -5.6, 0, 0.04);
    kit.box("paving", 0.0, 1.1, -10.0, -5.6, 0, 0.04);
    kit.box("black", -0.2, 1.4, -6.4, -5.6, 2.75, 2.85);
    kit.box("neon", -0.1, 1.3, -6.32, -6.27, 2.73, 2.75);
    kit.box("black", 2.6, 7.0, -6.6, -5.6, 0, 0.5); kit.box("greens", 2.7, 6.9, -6.5, -5.7, 0.5, 0.85);
    [-9.2, -8.0, -6.8].forEach((y) => { kit.box("black", 1.4, 1.52, y, y + 0.12, 0.04, 0.7); kit.box("bulb", 1.4, 1.52, y, y + 0.12, 0.7, 0.76); });
    kit.box("paving", -9.5, 9.5, -11.6, -10.0, 0, 0.08);
    kit.box("concrete", -9.5, 9.5, -11.8, -11.6, 0, 0.15);
    kit.box("gravel", 1.52, 9.5, -10.0, -6.6, 0, 0.03); kit.box("gravel", 7.0, 9.5, -6.6, -5.6, 0, 0.03);
    kit.box("dryGrass", -9.5, -6.8, -10.0, -5.6, 0, 0.03);
    const star = (cx, cy, ro, ri) => { const p = []; for (let i = 0; i < 16; i++) { const r = i % 2 ? ri : ro, a = Math.PI * i / 8; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return p; };
    [[3.4, -8.4, 0.55], [5.6, -9.1, 0.45], [7.9, -7.9, 0.6], [8.6, -9.4, 0.4]].forEach(([x, y, r]) => {
      const pts = star(x, y, r, r * 0.35), b = kit.get("agave");
      for (let i = 0; i < 16; i += 2) b.prismZ([[x, y], pts[i], pts[(i + 1) % 16], pts[(i + 2) % 16]], 0.03, 0.35);   // star as wedges
    });
    [[4.6, -7.6, 0.5], [6.7, -9.3, 0.35]].forEach(([x, y, s]) => kit.get("stone").prismZ([[x - s, y - s * 0.6], [x + s * 0.7, y - s * 0.8], [x + s, y + s * 0.3], [x - s * 0.2, y + s * 0.7], [x - s * 0.9, y + s * 0.2]], 0.03, 0.03 + s * 0.7));
    // California fan palms
    const ring = (x, y, z, r, n = 8) => Array.from({ length: n }, (_, k) => [x + r * Math.cos(2 * Math.PI * k / n), y + r * Math.sin(2 * Math.PI * k / n), z]);
    const loft = (key, x, y, prof) => {
      const b = kit.get(key);
      for (let k = 0; k < prof.length - 1; k++) {
        const A = ring(x, y, prof[k][0], prof[k][1]), B = ring(x, y, prof[k + 1][0], prof[k + 1][1]);
        for (let i = 0; i < 8; i++) { const j = (i + 1) % 8; b.face([A[i], A[j], B[j], B[i]].map(([px, py, pz]) => b.v(px, py, pz))); }
      }
    };
    const blade = [[0, 0], [1.1, 0.35], [2.1, 0.2], [2.6, -0.35], [2.0, -0.05], [1.0, 0.05], [0, -0.18]];
    [[-8.4, -8.8, 8.5], [8.7, -10.6, 7.2]].forEach(([x, y, h]) => {
      loft("palmTrunk", x, y, [[0, 0.3], [0.6, 0.23], [h - 1.0, 0.18], [h - 0.2, 0.2]]);
      loft("palmSkirt", x, y, [[h - 1.2, 0.24], [h - 0.5, 0.55], [h - 0.2, 0.5]]);
      const top = h - 0.2, b = kit.get("palmGreen");
      for (let i = 0; i < 12; i++) {
        const a = (i * 30 + (i % 2 ? 7 : 0)) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
        const pt = (bx, bz, off) => b.v(x + bx * ca - off * sa, y + bx * sa + off * ca, top + bz);
        const A = blade.map(([bx, bz]) => pt(bx, bz, -0.22)), B = blade.map(([bx, bz]) => pt(bx, bz, 0.22));
        b.face(A); b.face(B);
        for (let k = 0; k < blade.length; k++) { const j = (k + 1) % blade.length; b.face([A[k], A[j], B[j], B[k]]); }
      }
    });
    // Horizontal-slat cedar fences
    [[-9.5, -1], [9.5, 1]].forEach(([xf, sd]) => {
      const x0 = sd < 0 ? xf - 0.03 : xf, x1 = sd < 0 ? xf : xf + 0.03;
      for (let k = 0; k < 6; k++) kit.box("cedar", x0, x1, -6.0, 5.6, 0.06 + k * 0.18, 0.2 + k * 0.18);
      const p0 = sd < 0 ? xf - 0.12 : xf + 0.03, p1 = sd < 0 ? xf - 0.03 : xf + 0.12;
      [-6.0, -3.6, -1.2, 1.2, 3.6, 5.51].forEach((py) => kit.box("black", p0, p1, py, py + 0.09, 0, 1.2));
    });
    return kit.geometries();
  })();

  // =====================================================================
  // LOFT (Series A): 12.8 x 10.8 m, 3.1 m story
  // =====================================================================
  const loftGeo = (() => {
    const kit = new Kit(TILES), HW = 6.4, HD = 5.4, T = 0.3, WH = 2.85, Z0 = 0.55, Z1 = 2.55;
    const spaced = (L, n, w) => { const pad = (L - n * w) / (n + 1); return Array.from({ length: n }, (_, i) => [pad + i * (w + pad), pad + i * (w + pad) + w, Z0, Z1]); };
    const factory = (P, holes, outerAtZero) => holes.forEach(([x0, x1, z0, z1]) => {
      const fr = 0.06, bar = 0.035, a0 = 0.12, a1 = 0.18, cols = 3, rows = 4;
      P(kit, "black", x0, x0 + fr, a0, a1, z0, z1); P(kit, "black", x1 - fr, x1, a0, a1, z0, z1);
      const cw = (x1 - x0 - 2 * fr - (cols - 1) * bar) / cols, rh = (z1 - z0 - 2 * fr - (rows - 1) * bar) / rows;
      for (let c = 0; c < cols; c++) {
        const cx = x0 + fr + c * (cw + bar);
        P(kit, "black", cx, cx + cw, a0, a1, z0, z0 + fr); P(kit, "black", cx, cx + cw, a0, a1, z1 - fr, z1);
        if (c < cols - 1) P(kit, "black", cx + cw, cx + cw + bar, a0, a1, z0 + fr, z1 - fr);
        for (let r = 0; r < rows; r++) {
          const rz = z0 + fr + r * (rh + bar);
          P(kit, "glass", cx, cx + cw, a0 + 0.01, a1 - 0.01, rz, rz + rh);
          if (r < rows - 1) P(kit, "black", cx, cx + cw, a0, a1, rz + rh, rz + rh + bar);
        }
      }
      const s0 = outerAtZero ? -0.06 : T, s1 = outerAtZero ? 0 : T + 0.06;
      P(kit, "limestone", x0 - 0.08, x1 + 0.08, s0, s1, z0 - 0.1, z0);
      P(kit, "limestone", x0 - 0.12, x1 + 0.12, s0, s1, z1, z1 + 0.18);
    });
    const fb = spaced(12.8, 5, 1.6), sd = spaced(10.2, 4, 1.6);
    [[placer(-HW, -HD, false), 12.8, fb, true], [placer(-HW, HD - T, false), 12.8, fb, false],
     [placer(-HW + T, -HD + T, true), 10.2, sd, false], [placer(HW, -HD + T, true), 10.2, sd, true]].forEach(([P, L, holes, outer0]) => {
      holedWall(kit, "brick", L, T, WH, holes, P); factory(P, holes, outer0);
    });
    kit.box("limestone", -HW - 0.12, HW + 0.12, -HD - 0.12, HD + 0.12, WH, 3.1);
    kit.box("concrete", -HW + T, HW - T, -HD + T, HD - T, 0, 0.1);
    [-4.2, -1.4, 1.4, 4.2].forEach((x) => kit.box("timber", x - 0.12, x + 0.12, -HD + T, HD - T, 2.6, WH));
    [-2.6, -0.6].forEach((y) => {
      kit.box("deskLight", -4.6, 0.4, y - 0.4, y + 0.4, 0.82, 0.86);
      [-4.55, 0.3].forEach((lx) => kit.box("black", lx, lx + 0.05, y - 0.35, y + 0.35, 0.1, 0.82));
      for (let k = 0; k < 5; k++) { const mx = -4.1 + k; kit.box("screen", mx - 0.27, mx + 0.27, y - 0.04, y, 0.96, 1.28); kit.box("black", mx - 0.02, mx + 0.02, y - 0.04, y, 0.86, 0.96); }
    });
    kit.box("pingpong", 1.8, 4.54, 1.2, 2.72, 0.72, 0.76); kit.box("black", 3.0, 3.34, 1.8, 2.12, 0.1, 0.72);
    [[5.4, -4.4], [-5.4, 4.4], [5.4, 4.4]].forEach(([x, y]) => { kit.box("planter", x - 0.3, x + 0.3, y - 0.3, y + 0.3, 0.1, 0.6); kit.box("greens", x - 0.35, x + 0.35, y - 0.35, y + 0.35, 0.6, 1.5); });
    [-3.6, -1.6, 2.8].forEach((x) => kit.box("bulb", x - 0.15, x + 0.15, -1.75, -1.45, 2.0, 2.15));
    return kit.geometries();
  })();

  const loftRoofGeo = (() => {
    const kit = new Kit(TILES), HW = 6.4, HD = 5.4, T = 0.3, PH = 0.9;
    [[-HW, HW, -HD, -HD + T], [-HW, HW, HD - T, HD], [-HW, -HW + T, -HD + T, HD - T], [HW - T, HW, -HD + T, HD - T]].forEach(([x0, x1, y0, y1]) => {
      kit.box("brick", x0, x1, y0, y1, 0, PH); kit.box("limestone", x0, x1, y0, y1, PH, PH + 0.08);
    });
    kit.box("membrane", -HW + T, HW - T, -HD + T, HD - T, 0, 0.05);
    const DX0 = -5.7, DX1 = -0.6, DY0 = -4.7, DY1 = 0.8;
    kit.box("timber", DX0, DX1, DY0, DY1, 0.05, 0.2);
    kit.box("timber", -4.0, -2.2, -2.4, -1.6, 0.92, 0.97);
    kit.box("black", -3.9, -3.8, -2.2, -1.8, 0.2, 0.92); kit.box("black", -2.4, -2.3, -2.2, -1.8, 0.2, 0.92);
    kit.box("timber", -4.0, -2.2, -2.95, -2.65, 0.6, 0.65); kit.box("timber", -4.0, -2.2, -1.35, -1.05, 0.6, 0.65);
    [[-3.9, -2.8], [-2.3, -2.8], [-3.9, -1.2], [-2.3, -1.2]].forEach(([x, y]) => kit.box("black", x - 0.03, x + 0.03, y - 0.03, y + 0.03, 0.2, 0.6));
    [-5.3, -1.0].forEach((x) => { kit.box("planter", x - 0.3, x + 0.3, 0.1, 0.7, 0.2, 0.7); kit.box("greens", x - 0.35, x + 0.35, 0.05, 0.75, 0.7, 1.4); });
    const poles = [[DX0 + 0.1, DY0 + 0.1], [DX1 - 0.1, DY0 + 0.1], [DX1 - 0.1, DY1 - 0.1], [DX0 + 0.1, DY1 - 0.1]];
    poles.forEach(([x, y]) => kit.box("black", x - 0.03, x + 0.03, y - 0.03, y + 0.03, 0.2, 2.4));
    for (let k = 0; k < 4; k++) {
      const [xa, ya] = poles[k], [xb, yb] = poles[(k + 1) % 4];
      for (let j = 1; j < 9; j++) { const u = j / 9, x = xa + (xb - xa) * u, y = ya + (yb - ya) * u, sag = 0.25 * Math.sin(Math.PI * u); kit.box("bulb", x - 0.05, x + 0.05, y - 0.05, y + 0.05, 2.28 - sag, 2.38 - sag); }
    }
    [[0.6, 1.6], [2.8, 1.6], [0.6, 3.0], [2.8, 3.0]].forEach(([x, y]) => { kit.box("black", x, x + 1.6, y, y + 0.9, 0.05, 0.35); kit.box("skylight", x + 0.05, x + 1.55, y + 0.05, y + 0.85, 0.35, 0.42); });
    kit.box("hvac", 2.2, 4.0, -4.4, -2.9, 0.05, 1.15); kit.box("black", 2.7, 3.5, -4.05, -3.25, 1.15, 1.25);
    return kit.geometries();
  })();

  // ---------- Public API ----------
  const withGlass = (geos, style, grade) => {
    const mats = Object.assign({}, MAT, { glass: glass(style, grade) });
    return toGroup(geos, mats);
  };
  const FLOOR = { 0: garageGeo, 1: loftGeo };
  const ROOF = { 0: garageRoofGeo, 1: loftRoofGeo };
  return {
    has: (style) => !!FLOOR[style],
    floor: (style, grade) => withGlass(FLOOR[style], style, grade),
    roof: (style) => withGlass(ROOF[style], style, 2),
    site: () => toGroup(garageSiteGeo, MAT),
    scale: S
  };
})();
