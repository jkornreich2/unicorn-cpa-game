// Kestrel HQ: a 3D building that gains one floor per answered case.
// Floors: Seed = wooden garage, Series A = brick loft, IPO = glass tower.
// Window light shows the result: warm/blue = correct, dimmer = second try, red = missed.
// Needs THREE (r128 UMD) loaded before this script. Exposes window.HQ.update(state).
window.HQ = (() => {
  const host = document.getElementById("hq");
  const cv = document.getElementById("hqc");
  const cap = document.getElementById("hqcap");
  const off = { update() {} };
  if (!window.THREE || !host || !cv) { if (host) host.hidden = true; return off; }

  let R;
  try { R = new THREE.WebGLRenderer({ canvas: cv, antialias: true }); }
  catch (e) { host.hidden = true; return off; }

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  R.shadowMap.enabled = true;
  R.shadowMap.type = THREE.PCFSoftShadowMap;
  R.outputEncoding = THREE.sRGBEncoding;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070a13);
  scene.fog = new THREE.Fog(0x070a13, 45, 110);
  const cam = new THREE.PerspectiveCamera(38, 1, 0.1, 300);

  const hemi = new THREE.HemisphereLight(0x9db8ff, 0x0a0e18, 0.6);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0xc8d6ff, 0.8);
  moon.position.set(-16, 30, 14);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  Object.assign(moon.shadow.camera, { left: -24, right: 24, top: 36, bottom: -12, near: 1, far: 100 });
  scene.add(moon);
  const warm = new THREE.PointLight(0xff7a59, 0.9, 34);
  warm.position.set(5, 3, 9);
  scene.add(warm);

  const rng = (seed) => { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
  const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

  // ---------- Ground, street, stars ----------
  const flat = (w, d, color, y, x = 0, z = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color, roughness: 1 }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; scene.add(m); return m;
  };
  const groundMesh = flat(240, 240, 0x0b111e, 0);
  flat(14, 11, 0x141b2b, 0.005);
  flat(240, 4, 0x121827, 0.01, 0, 8);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0x3a4258 });
  for (let x = -60; x <= 60; x += 3) {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.12), dashMat);
    d.rotation.x = -Math.PI / 2; d.position.set(x, 0.02, 8); scene.add(d);
  }
  let starMat;
  {
    const r = rng(17), n = 500, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const th = r() * Math.PI * 2, ph = r() * 0.45 * Math.PI, rad = 120;
      pos[i * 3] = rad * Math.cos(th) * Math.sin(ph + 0.6);
      pos[i * 3 + 1] = 18 + rad * Math.cos(ph + 0.6) * 0.9 + r() * 20;
      pos[i * 3 + 2] = rad * Math.sin(th) * Math.sin(ph + 0.6);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    starMat = new THREE.PointsMaterial({ color: 0xdfe6ff, size: 0.6, sizeAttenuation: true, fog: false, transparent: true, opacity: 1 });
    scene.add(new THREE.Points(g, starMat));
  }

  // ---------- Sky dome and per-round settings ----------
  // Seed: Palo Alto at golden hour. Series A: dusk. IPO: night.
  const SETTINGS = [
    { top: 0x1f2d58, mid: 0x8a5a78, hor: 0xf3a65c, fog: 0xc98d62, groundC: 0x3a3226, sun: 0xffc48a, sunI: 1.15, sunPos: [-30, 14, 22], hs: 0xffd8ab, hg: 0x3a2f22, hI: 0.75, stars: 0 },
    { top: 0x0d1430, mid: 0x3a2a5c, hor: 0x8a4f6e, fog: 0x2c2240, groundC: 0x121522, sun: 0xc3b2ff, sunI: 0.7, sunPos: [-20, 22, 16], hs: 0xa99cf0, hg: 0x0e0e1a, hI: 0.6, stars: 0.5 },
    { top: 0x05070f, mid: 0x0b1226, hor: 0x1a2238, fog: 0x0b0f1c, groundC: 0x0b111e, sun: 0xc8d6ff, sunI: 0.8, sunPos: [-16, 30, 14], hs: 0x9db8ff, hg: 0x0a0e18, hI: 0.6, stars: 1 }
  ];
  const skyGeo = new THREE.SphereGeometry(150, 32, 16);
  const skyCol = new Float32Array(skyGeo.attributes.position.count * 3);
  skyGeo.setAttribute("color", new THREE.BufferAttribute(skyCol, 3));
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  scene.add(sky);
  const cur = { top: new THREE.Color(), mid: new THREE.Color(), hor: new THREE.Color(), fog: new THREE.Color(), groundC: new THREE.Color(),
                sun: new THREE.Color(), hs: new THREE.Color(), hg: new THREE.Color(), sunI: 0, hI: 0, stars: 1, sunPos: new THREE.Vector3() };
  let setFrom = null, setTo = SETTINGS[2], setStart = -1e9;
  const tmpA = new THREE.Color(), tmpB = new THREE.Color();
  const applySetting = (k) => {
    const A = setFrom || setTo, B = setTo;
    ["top", "mid", "hor", "fog", "groundC", "sun", "hs", "hg"].forEach((key) => cur[key].copy(tmpA.set(A[key])).lerp(tmpB.set(B[key]), k));
    cur.sunI = A.sunI + (B.sunI - A.sunI) * k; cur.hI = A.hI + (B.hI - A.hI) * k; cur.stars = A.stars + (B.stars - A.stars) * k;
    cur.sunPos.set(...A.sunPos).lerp(new THREE.Vector3(...B.sunPos), k);
    const pos = skyGeo.attributes.position, c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 150;
      if (y < 0.12) c.copy(cur.hor).lerp(cur.mid, Math.max(0, y) / 0.12 * 0.5);
      else c.copy(cur.mid).lerp(cur.top, Math.min(1, (y - 0.12) / 0.6));
      skyCol[i * 3] = c.r; skyCol[i * 3 + 1] = c.g; skyCol[i * 3 + 2] = c.b;
    }
    skyGeo.attributes.color.needsUpdate = true;
    scene.background = cur.fog; scene.fog.color.copy(cur.fog);
    groundMesh.material.color.copy(cur.groundC);
    moon.color.copy(cur.sun); moon.intensity = cur.sunI; moon.position.copy(cur.sunPos);
    hemi.color.copy(cur.hs); hemi.groundColor.copy(cur.hg); hemi.intensity = cur.hI;
    starMat.opacity = cur.stars; starMat.visible = cur.stars > 0.02;
  };

  // ---------- Facade textures ----------
  const canvasTex = (draw, w = 256, h = 128) => {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  };
  const STY = [
    { name: "The garage · Palo Alto", w: 7.2, d: 5.6, h: 1.8, wall: "#2a2c30", frame: "#17181b", cols: 3, win: 0xffc98a, seed: 3, batten: true },
    { name: "The loft · San Francisco", w: 6.4, d: 5.4, h: 1.55, wall: "#7a3528", frame: "#1b1c1f", cols: 5, brick: true, win: 0xffd58a, seed: 5 },
    { name: "The tower", w: 5, d: 5, h: 1.35, wall: "#1b2c47", frame: "#2c4166", cols: 8, glass: true, win: 0xaee0ff, seed: 9 }
  ];
  const facade = (ctx, w, h, st, mode) => {
    ctx.fillStyle = mode === "map" ? st.wall : "#000"; ctx.fillRect(0, 0, w, h);
    if (mode === "map" && st.brick) { ctx.fillStyle = "rgba(0,0,0,.2)"; for (let y = 4; y < h; y += 8) ctx.fillRect(0, y, w, 1); }
    if (mode === "map" && st.batten) { for (let x = 4; x < w; x += 12) { ctx.fillStyle = "rgba(255,255,255,.07)"; ctx.fillRect(x, 0, 2, h); ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(x + 2, 0, 1, h); } }
    const r = rng(st.seed), pad = w * 0.04, gw = (w - pad * 2) / st.cols, wy = h * (st.glass ? 0.12 : 0.22), wh = h * (st.glass ? 0.76 : 0.56);
    for (let i = 0; i < st.cols; i++) {
      const x = pad + i * gw + gw * (st.glass ? 0.06 : 0.14), ww = gw * (st.glass ? 0.88 : 0.72);
      const on = mode === "full" || (mode === "sparse" && r() < 0.4);
      ctx.fillStyle = mode === "map" ? (st.glass ? "#0d1830" : "#141a28") : on ? "#fff" : "#000";
      ctx.fillRect(x, wy, ww, wh);
      if (mode === "map" && st.brick) {
        ctx.fillStyle = st.frame;
        for (let k = 1; k < 3; k++) ctx.fillRect(x + (ww * k) / 3 - 1, wy, 2, wh);
        for (let k = 1; k < 4; k++) ctx.fillRect(x, wy + (wh * k) / 4 - 1, ww, 2);
        ctx.fillStyle = "#d6ccb8"; ctx.fillRect(x - 3, wy - 5, ww + 6, 4); ctx.fillRect(x - 2, wy + wh, ww + 4, 3);
      } else if (mode === "map") { ctx.fillStyle = st.frame; ctx.fillRect(x + ww / 2 - 1, wy, 2, wh); ctx.fillRect(x, wy + wh / 2 - 1, ww, 2); }
    }
  };
  STY.forEach((s) => {
    s.tex = { map: canvasTex((c, w, h) => facade(c, w, h, s, "map")),
              full: canvasTex((c, w, h) => facade(c, w, h, s, "full")),
              sparse: canvasTex((c, w, h) => facade(c, w, h, s, "sparse")) };
    s.topMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(s.frame), roughness: 0.9 });
  });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x0f1422, roughness: 0.8 });

  // grade: 2 = right first time, 1 = right on second try, 0 = missed
  const makeFloor = (st, grade) => {
    const side = new THREE.MeshStandardMaterial({
      map: st.tex.map, emissiveMap: grade ? st.tex.full : st.tex.sparse,
      emissive: new THREE.Color(grade ? st.win : 0xff5a6e),
      emissiveIntensity: grade === 2 ? 1.05 : grade === 1 ? 0.55 : 0.6,
      roughness: st.glass ? 0.3 : 0.85, metalness: st.glass ? 0.45 : 0.05
    });
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(st.w, st.h * 0.86, st.d), [side, side, st.topMat, st.topMat, side, side]);
    body.position.y = st.h * 0.43; body.castShadow = body.receiveShadow = true; g.add(body);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(st.w + 0.25, st.h * 0.14, st.d + 0.25), trimMat);
    slab.position.y = st.h * 0.93; slab.castShadow = true; g.add(slab);
    return g;
  };

  // ---------- Kestrel building ----------
  const building = new THREE.Group(); scene.add(building);
  let floors = [];            // { grp, r, g, y, start }
  let topY = 0;

  const ghosts = STY.map((st) => {
    const geo = new THREE.BoxGeometry(st.w, st.h, st.d);
    const grp = new THREE.Group();
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0xff7a59, transparent: true }));
    const fill = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xff7a59, transparent: true, opacity: 0.06, depthWrite: false }));
    edges.position.y = fill.position.y = st.h / 2;
    grp.add(edges, fill); grp.visible = false; scene.add(grp);
    return { grp, edges, fill };
  });
  let ghostOn = -1;

  const sign = (() => {
    const tex = canvasTex((c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.font = "800 78px 'Bricolage Grotesque', 'Avenir Next', sans-serif";
      c.textAlign = "center"; c.textBaseline = "middle";
      c.shadowColor = "#ff7a59"; c.shadowBlur = 24; c.fillStyle = "#ff8a6a";
      c.fillText("KESTREL AI", w / 2, h / 2);
    }, 512, 128);
    const grp = new THREE.Group();
    const board = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    board.position.y = 0.95; grp.add(board);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x2b3550 });
    [-1.6, 1.6].forEach((x) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6), postMat); p.position.set(x, 0.3, -0.05); grp.add(p); });
    grp.visible = false; scene.add(grp); return grp;
  })();

  const roofCap = (() => {
    const st = STY[0], pitch = Math.tan(18 * Math.PI / 180), half = st.w / 2, over = 0.25, rise = half * pitch;
    const grp = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(-half - over, -over * pitch); shape.lineTo(0, rise); shape.lineTo(half + over, -over * pitch);
    shape.lineTo(half + over, -over * pitch + 0.14); shape.lineTo(0, rise + 0.14); shape.lineTo(-half - over, -over * pitch + 0.14);
    const roofGeo = new THREE.ExtrudeGeometry(shape, { depth: st.d + 0.5, bevelEnabled: false });
    roofGeo.translate(0, 0, -(st.d + 0.5) / 2);
    const roof = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ color: 0x1d1f24, roughness: 0.55, metalness: 0.35 }));
    roof.castShadow = true; grp.add(roof);
    const tri = (z, mat) => {
      const sh = new THREE.Shape(); sh.moveTo(-half, 0); sh.lineTo(half, 0); sh.lineTo(0, rise); sh.lineTo(-half, 0);
      const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), mat); m.position.z = z; return m;
    };
    const glass = tri(st.d / 2 - 0.05, new THREE.MeshStandardMaterial({ color: 0x2a2620, emissive: 0xffc98a, emissiveIntensity: 0.9, side: THREE.DoubleSide }));
    const back = tri(-st.d / 2 + 0.05, new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.9, side: THREE.DoubleSide }));
    grp.add(glass, back);
    const mullMat = new THREE.MeshStandardMaterial({ color: 0x111214 });
    [-2.4, -1.2, 0, 1.2, 2.4].forEach((x) => {
      const h = (half - Math.abs(x)) * pitch;
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, h, 0.06), mullMat);
      m.position.set(x, h / 2, st.d / 2 - 0.02); grp.add(m);
    });
    grp.userData.glass = glass; grp.userData.rise = rise;
    grp.visible = false; scene.add(grp); return grp;
  })();

  const loftCap = (() => {
    const st = STY[1], grp = new THREE.Group(), t = 0.15, ph = 0.45;
    const brickM = new THREE.MeshStandardMaterial({ color: 0x7a3528, roughness: 0.9 });
    const stone = new THREE.MeshStandardMaterial({ color: 0xd6ccb8, roughness: 0.8 });
    const put = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; grp.add(m); return m; };
    [[0, st.d / 2 - t / 2, st.w, t], [0, -st.d / 2 + t / 2, st.w, t]].forEach(([x, z, w, d]) => {
      put(new THREE.BoxGeometry(w, ph, d), brickM, x, ph / 2, z); put(new THREE.BoxGeometry(w + 0.04, 0.05, d + 0.04), stone, x, ph + 0.025, z);
    });
    [-1, 1].forEach((sx) => {
      put(new THREE.BoxGeometry(t, ph, st.d - 2 * t), brickM, sx * (st.w / 2 - t / 2), ph / 2, 0);
      put(new THREE.BoxGeometry(t + 0.04, 0.05, st.d - 2 * t), stone, sx * (st.w / 2 - t / 2), ph + 0.025, 0);
    });
    put(new THREE.BoxGeometry(st.w - 2 * t, 0.02, st.d - 2 * t), new THREE.MeshStandardMaterial({ color: 0x5c6066, roughness: 1 }), 0, 0.01, 0);
    const deck = { x0: -2.85, x1: -0.3, z0: -0.4, z1: 2.35 };
    put(new THREE.BoxGeometry(deck.x1 - deck.x0, 0.08, deck.z1 - deck.z0), new THREE.MeshStandardMaterial({ color: 0x92683f, roughness: 0.8 }), (deck.x0 + deck.x1) / 2, 0.06, (deck.z0 + deck.z1) / 2);
    put(new THREE.BoxGeometry(0.9, 0.55, 0.75), new THREE.MeshStandardMaterial({ color: 0xb0b6bc, metalness: 0.4, roughness: 0.5 }), 1.6, 0.3, 1.8);
    [[0.3, -1.2], [1.4, -1.2], [0.3, -2.0], [1.4, -2.0]].forEach(([x, z]) => put(new THREE.BoxGeometry(0.8, 0.2, 0.45), new THREE.MeshStandardMaterial({ color: 0x9ccbe8, emissive: 0x406080, emissiveIntensity: 0.4 }), x, 0.12, z));
    const poleM = new THREE.MeshStandardMaterial({ color: 0x1b1c1f });
    const corners = [[deck.x0 + 0.05, deck.z0 + 0.05], [deck.x1 - 0.05, deck.z0 + 0.05], [deck.x1 - 0.05, deck.z1 - 0.05], [deck.x0 + 0.05, deck.z1 - 0.05]];
    corners.forEach(([x, z]) => put(new THREE.BoxGeometry(0.03, 1.2, 0.03), poleM, x, 0.7, z));
    const bulbM = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
    for (let k = 0; k < 4; k++) {
      const [xa, za] = corners[k], [xb, zb] = corners[(k + 1) % 4];
      for (let j = 1; j < 9; j++) {
        const u = j / 9, b = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), bulbM);
        b.position.set(xa + (xb - xa) * u, 1.25 - 0.14 * Math.sin(Math.PI * u), za + (zb - za) * u); grp.add(b);
      }
    }
    grp.visible = false; scene.add(grp); return grp;
  })();
  const caps = [roofCap, loftCap];
  if (window.HQModels) {
    [0, 1].forEach((i) => {
      const detailed = window.HQModels.roof(i);
      detailed.visible = false; scene.add(detailed);
      scene.remove(caps[i]); caps[i] = detailed;
    });
  }

  const spire = (() => {
    const grp = new THREE.Group();
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.18, 4.5, 8), new THREE.MeshStandardMaterial({ color: 0x9fb4d8, metalness: 0.7, roughness: 0.3 }));
    mast.position.y = 2.25; grp.add(mast);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), new THREE.MeshBasicMaterial({ color: 0xff5a5a }));
    tip.position.y = 4.6; grp.add(tip); grp.userData.tip = tip;
    grp.visible = false; scene.add(grp); return grp;
  })();

  const rings = [];
  const ring = (y, w, good) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(1, 1.12, 64),
      new THREE.MeshBasicMaterial({ color: good ? 0x58d6a0 : 0xff6b7d, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = y; scene.add(m);
    rings.push({ m, start: performance.now(), w });
  };

  const placeFloor = (r, g, animate) => {
    const st = STY[r], grp = window.HQModels && window.HQModels.has(r) ? window.HQModels.floor(r, g) : makeFloor(st, g), y = topY;
    building.add(grp);
    const f = { grp, r, g, y, h: st.h, w: st.w, start: animate && !reduce ? performance.now() : -1e9, landed: !animate || reduce };
    grp.position.y = f.landed ? y : y + 6;
    floors.push(f); topY += st.h;
    if (f.landed && animate) ring(y + st.h / 2, st.w, g > 0);
  };
  const clearFloors = () => { floors.forEach((f) => building.remove(f.grp)); floors = []; topY = 0; };

  // ---------- Neighborhood ----------
  const hood = [];   // { grp, minRound, maxRound, s }
  const addHood = (grp, minRound, maxRound) => { grp.scale.y = 0.001; grp.visible = false; scene.add(grp); hood.push({ grp, minRound, maxRound, s: 0 }); };
  // The garage yard from the SketchUp design: driveway, path, canopy, planter, gravel garden, palms, fences (Seed only)
  if (window.HQModels) addHood(window.HQModels.site(), 0, 0);
  const spots = (() => {
    const r = rng(23), out = [];
    while (out.length < 26) {
      const x = (r() - 0.5) * 70, z = -6 - r() * 38 + (r() < 0.25 ? 26 : 0);
      if (Math.abs(x) < 9 && z > -9) continue;
      if ((x > 14 && x < 34 && z > -9 && z < 7) || (x < -14 && x > -34 && z > -9 && z < 7) || (x > 8 && x < 20 && z > 9 && z < 19)) continue;
      if (z > 4 && z < 12) continue;
      if (out.some((p) => Math.hypot(p.x - x, p.z - z) < 6.5)) continue;
      out.push({ x, z, v: r() });
    }
    return out;
  })();
  const leaf = new THREE.MeshStandardMaterial({ color: 0x16301f, roughness: 1 });
  const bark = new THREE.MeshStandardMaterial({ color: 0x2a1d16, roughness: 1 });
  const colliders = [];   // walking blockers: rects and circles, each active only while its object is shown
  const always = () => true;
  const addRect = (x0, x1, z0, z1, when = always) => colliders.push({ t: 0, x0, x1, z0, z1, when });
  const addCircle = (x, z, r, when = always) => colliders.push({ t: 1, x, z, r, when });
  const tree = (x, z, s) => {
    const g = new THREE.Group();
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.2), bark); t.position.y = 0.6;
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 * s, 0), leaf); c.position.y = 1.5 * s + 0.4;
    t.castShadow = c.castShadow = true; g.add(t, c); g.position.set(x, 0, z); return g;
  };
  [[-8, 3], [8.5, 2], [-9, -4], [9.5, -5], [-12, 6], [13, 5], [-6, 12.5], [6, 12.5]].forEach(([x, z], i) => { const g = tree(x, z, 1 + (i % 3) * 0.2); addHood(g, 0, 9); addCircle(x, z, 0.45, () => g.visible); });

  const tallTex = (st, reps) => {
    const m = st.tex.map.clone(), e = st.tex.sparse.clone();
    [m, e].forEach((t) => { t.needsUpdate = true; t.repeat.set(1, reps); });
    return { m, e };
  };
  spots.forEach((p, i) => {
    const kind = i % 3;   // 0 house, 1 low-rise, 2 skyscraper
    const g = new THREE.Group();
    if (kind === 0) {
      const stucco = [0xd9cbb3, 0xe6dfd2, 0xc9b99c, 0xbfc6c3][i % 4];
      const body = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.6, 3.4), new THREE.MeshStandardMaterial({ color: stucco, roughness: 0.95 }));
      body.position.y = 0.8;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(3.4, 0.9, 4), new THREE.MeshStandardMaterial({ color: 0x5b5148, roughness: 0.9 }));
      roof.position.y = 2.05; roof.rotation.y = Math.PI / 4; roof.scale.set(1.25, 1, 0.9);
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.6), new THREE.MeshBasicMaterial({ color: p.v > 0.4 ? 0xffd58a : 0x1a2030 }));
      win.position.set(0.9, 0.9, 1.71);
      body.castShadow = roof.castShadow = true; g.add(body, roof, win);
      g.position.set(p.x, 0, p.z); g.rotation.y = (p.v - 0.5) * 0.6; addHood(g, 0, 0); addCircle(p.x, p.z, 2.7, () => g.visible);
    } else {
      const st = STY[kind === 1 ? 1 : 2];
      const h = kind === 1 ? 3 + p.v * 4 : 12 + p.v * 16, w = kind === 1 ? 4 + p.v * 2 : 3.6 + p.v * 1.6;
      const t = tallTex(st, Math.max(1, Math.round(h / st.h)));
      const mat = new THREE.MeshStandardMaterial({ map: t.m, emissiveMap: t.e, emissive: new THREE.Color(st.win), emissiveIntensity: 0.35,
        roughness: st.glass ? 0.35 : 0.9, metalness: st.glass ? 0.4 : 0.05 });
      const top = new THREE.MeshStandardMaterial({ color: 0x0e1424 });
      const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.9), [mat, mat, top, top, mat, mat]);
      box.position.y = h / 2; box.castShadow = box.receiveShadow = true; g.add(box);
      g.position.set(p.x, 0, p.z); addHood(g, kind === 1 ? 1 : 2, 9); addCircle(p.x, p.z, w * 0.72, () => g.visible);
    }
  });

  // Golden foothills on the horizon
  {
    const hillMat = new THREE.MeshStandardMaterial({ color: 0xb88f4e, roughness: 1 });
    const oakMat = new THREE.MeshStandardMaterial({ color: 0x3b4a26, roughness: 1 });
    const r = rng(31);
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI * 0.95 + (i / 8) * Math.PI * 0.9 - Math.PI * 0.03, rad = 78 + r() * 18;
      const g = new THREE.Group();
      const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), hillMat);
      const sx = 22 + r() * 18, sy = 6 + r() * 9, sz = 12 + r() * 8;
      hill.scale.set(sx, sy, sz); g.add(hill);
      for (let k = 0; k < 6; k++) {
        const u = (r() - 0.5) * 1.4, v = (r() - 0.5) * 1.2, y = sy * Math.sqrt(Math.max(0, 1 - u * u / 1.0 - v * v / 1.0)) * 0.9;
        const oak = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 + r() * 0.8, 0), oakMat);
        oak.position.set(u * sx * 0.7, Math.max(0.5, y), v * sz * 0.7); g.add(oak);
      }
      g.position.set(Math.cos(a) * rad, 0, Math.sin(a) * rad);
      addHood(g, 0, 0);
    }
  }
  // California fan palms
  const palmTrunk = new THREE.MeshStandardMaterial({ color: 0x8c7356, roughness: 1 });
  const palmLeaf = new THREE.MeshStandardMaterial({ color: 0x4f6f3a, roughness: 0.9, side: THREE.DoubleSide });
  const palm = (x, z, h) => {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, h, 7), palmTrunk);
    trunk.position.y = h / 2; trunk.castShadow = true; g.add(trunk);
    for (let i = 0; i < 11; i++) {
      const pivot = new THREE.Object3D(); pivot.position.y = h; pivot.rotation.y = (i / 11) * Math.PI * 2;
      const frond = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.04, 0.42), palmLeaf);
      frond.position.x = 0.85; frond.rotation.z = -0.32 - (i % 3) * 0.12; frond.castShadow = true;
      pivot.add(frond); g.add(pivot);
    }
    g.position.set(x, 0, z); return g;
  };
  [[-20, 10.6, 8.5], [-11, 10.6, 9.5], [-2, 10.8, 8], [7, 10.6, 9], [16, 10.6, 8.5], [25, 10.7, 9.5],
   [-10.5, 3.5, 7.5], [10.5, 4.5, 8.5], [-22, -12, 9], [20, -16, 8]].forEach(([x, z, h]) => { const g = palm(x, z, h); addHood(g, 0, 0); addCircle(x, z, 0.35, () => g.visible); });

  // ---------- San Francisco (Series A and IPO) ----------
  {
    const bay = new THREE.Mesh(new THREE.PlaneGeometry(320, 110),
      new THREE.MeshStandardMaterial({ color: 0x1b2747, roughness: 0.2, metalness: 0.6, emissive: 0x0c1226, emissiveIntensity: 0.6 }));
    bay.rotation.x = -Math.PI / 2; bay.position.set(0, 0.04, -100);
    const bayG = new THREE.Group(); bayG.add(bay); addHood(bayG, 1, 9);

    // Generic suspension bridge across the bay, lit deck
    const br = new THREE.Group(), steel = new THREE.MeshStandardMaterial({ color: 0x8f98a6, metalness: 0.6, roughness: 0.4 });
    const deckM = new THREE.Mesh(new THREE.BoxGeometry(200, 0.6, 2.2), steel); deckM.position.y = 6; br.add(deckM);
    [-32, 32].forEach((x) => {
      [-0.9, 0.9].forEach((z) => { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.9, 30, 0.9), steel); leg.position.set(x, 15, z); br.add(leg); });
      [12, 22, 29].forEach((y) => { const beam = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 2.6), steel); beam.position.set(x, y, 0); br.add(beam); });
    });
    const cableM = new THREE.LineBasicMaterial({ color: 0xb8c2d0 });
    [-0.9, 0.9].forEach((z) => {
      const pts = [];
      for (let x = -100; x <= 100; x += 2) {
        let y;
        if (x < -32) y = 30 - (x + 32) / -68 * 23;
        else if (x > 32) y = 30 - (x - 32) / 68 * 23;
        else y = 9 + 21 * Math.pow(x / 32, 2);
        pts.push(new THREE.Vector3(x, y, z));
        if (x % 6 === 0 && y > 7) br.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 6.3, z), new THREE.Vector3(x, y, z)]), cableM));
      }
      br.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), cableM));
    });
    const lp = []; for (let x = -98; x <= 98; x += 3) lp.push(x, 6.6, 1.2, x, 6.6, -1.2);
    const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(lp), 3));
    br.add(new THREE.Points(lg, new THREE.PointsMaterial({ color: 0xffd38a, size: 0.5, sizeAttenuation: true, fog: false })));
    [-32, 32].forEach((x) => { const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff4a4a })); beacon.position.set(x, 30.6, 0); br.add(beacon); });
    br.position.set(-20, 0, -78); br.rotation.y = 0.18;
    addHood(br, 1, 9);

    // Hills across the bay
    const farHill = new THREE.MeshStandardMaterial({ color: 0x1c2233, roughness: 1 });
    const r = rng(41);
    for (let i = 0; i < 7; i++) {
      const g = new THREE.Group(), h = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), farHill);
      h.scale.set(30 + r() * 25, 10 + r() * 12, 14); g.add(h);
      g.position.set(-130 + i * 44 + r() * 10, 0, -140 - r() * 12); addHood(g, 1, 9);
    }

    // Painted Victorian row houses across the street (Series A only)
    const pastel = [0xe9b8c4, 0xb9d7e8, 0xf1dca7, 0xc7e3c5, 0xd8c6ea, 0xf3c9a5, 0xa9d3d0];
    const trimM = new THREE.MeshStandardMaterial({ color: 0xf6f1e7, roughness: 0.8 });
    const litM = new THREE.MeshBasicMaterial({ color: 0xffd28f });
    for (let i = 0; i < 12; i++) {
      const g = new THREE.Group(), w = 2.3, h = 4.4 + (i % 3) * 0.4;
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, 3), new THREE.MeshStandardMaterial({ color: pastel[i % pastel.length], roughness: 0.85 }));
      body.position.y = h / 2; body.castShadow = true; g.add(body);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.75, 1.3, 4), new THREE.MeshStandardMaterial({ color: 0x4a4550, roughness: 0.9 }));
      roof.rotation.y = Math.PI / 4; roof.scale.set(0.95, 1, 1.2); roof.position.y = h + 0.6; g.add(roof);
      const bayW = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.4, 0.5), trimM); bayW.position.set(-0.3, h - 1.9, -1.7); g.add(bayW);
      [[-0.3, h - 1.6], [-0.3, h - 2.5], [0.75, 1.2]].forEach(([x, y], k) => {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(k < 2 ? 1.0 : 0.5, 0.6), (i + k) % 3 ? litM : new THREE.MeshBasicMaterial({ color: 0x2a3040 }));
        win.position.set(x, y, k < 2 ? -1.96 : -1.51); win.rotation.y = Math.PI; g.add(win);
      });
      g.position.set(-27.6 + i * w, 0, 13.6);
      addHood(g, 1, 1); addRect(-28.75 + i * w, -26.45 + i * w, 12.0, 15.2, () => g.visible);
    }

    // A bank of fog rolling over the bay
    const fogM = new THREE.MeshBasicMaterial({ color: 0xe9e4f2, transparent: true, opacity: 0.16, depthWrite: false, fog: false });
    for (let i = 0; i < 5; i++) {
      const g = new THREE.Group(), f = new THREE.Mesh(new THREE.PlaneGeometry(90, 14), fogM);
      f.position.set(-60 + i * 32, 4 + (i % 2) * 2, -60 - i * 6); g.add(f); g.userData.fog = f; addHood(g, 1, 1);
    }
  }

  // Retro-modern electric pickup (original design) parked in the Seed driveway, nose to the garage
  {
    const T = new THREE.Group();
    const std = (c, extra) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.5, metalness: 0.15 }, extra || {}));
    const orange = std(0xe86e34), cream = std(0xf0e8d6), chrome = std(0xc4c8ce, { metalness: 0.8, roughness: 0.25 });
    const glass = std(0x1c2632, { roughness: 0.15, metalness: 0.4 }), tire = std(0x161618, { roughness: 0.9 });
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; T.add(m); return m; };
    add(new THREE.BoxGeometry(0.98, 0.3, 2.5), orange, 0, 0.37, 0);                       // lower body
    add(new THREE.BoxGeometry(0.95, 0.06, 0.8), orange, 0, 0.55, -0.83);                 // hood
    const prof = new THREE.Shape();
    [[0.3, 0.52], [-0.4, 0.52], [-0.4, 0.585], [-0.265, 0.9], [0.24, 0.93], [0.3, 0.9]].forEach(([z, y], i) => (i ? prof.lineTo(z, y) : prof.moveTo(z, y)));
    const cabGeo = new THREE.ExtrudeGeometry(prof, { depth: 0.95, bevelEnabled: false });
    cabGeo.rotateY(-Math.PI / 2); cabGeo.translate(0.475, 0, 0);
    add(cabGeo, cream, 0, 0, 0);                                                          // cream two-tone cab
    const ws = add(new THREE.BoxGeometry(0.82, 0.32, 0.012), glass, 0, 0.745, -0.345); ws.rotation.x = 0.407;
    [-0.481, 0.481].forEach((x) => add(new THREE.BoxGeometry(0.01, 0.2, 0.46), glass, x, 0.77, -0.03));
    add(new THREE.BoxGeometry(0.68, 0.19, 0.01), glass, 0, 0.775, 0.306);                  // rear window
    [-0.45, 0.45].forEach((x) => { add(new THREE.BoxGeometry(0.04, 0.2, 0.88), orange, x, 0.62, 0.79); add(new THREE.BoxGeometry(0.04, 0.02, 0.88), cream, x, 0.73, 0.79); });
    add(new THREE.BoxGeometry(0.98, 0.2, 0.04), orange, 0, 0.62, 1.23); add(new THREE.BoxGeometry(0.98, 0.02, 0.04), cream, 0, 0.73, 1.23);
    add(new THREE.BoxGeometry(0.86, 0.01, 0.88), std(0x96643c, { roughness: 0.8 }), 0, 0.525, 0.79);       // teak bed
    [-0.495, 0.495].forEach((x) => add(new THREE.BoxGeometry(0.01, 0.035, 2.25), cream, x, 0.45, 0));      // side stripes
    add(new THREE.BoxGeometry(1.0, 0.075, 0.06), chrome, 0, 0.26, -1.28); add(new THREE.BoxGeometry(1.0, 0.075, 0.06), chrome, 0, 0.26, 1.28);
    add(new THREE.BoxGeometry(0.42, 0.16, 0.01), std(0x18191c), 0, 0.41, -1.255);                          // grille
    const lamp = new THREE.MeshBasicMaterial({ color: 0xfff3d6 }), tail = new THREE.MeshBasicMaterial({ color: 0xff3a3a });
    [-0.34, 0.34].forEach((x) => {
      const ring = add(new THREE.CylinderGeometry(0.075, 0.075, 0.01, 18), chrome, x, 0.41, -1.256); ring.rotation.x = Math.PI / 2;
      const l = add(new THREE.CylinderGeometry(0.055, 0.055, 0.012, 18), lamp, x, 0.41, -1.262); l.rotation.x = Math.PI / 2;
      add(new THREE.BoxGeometry(0.1, 0.12, 0.01), tail, x * 1.25, 0.62, 1.256);
    });
    [[-0.52, 0.8], [0.52, 0.8], [-0.52, -0.775], [0.52, -0.775]].forEach(([x, z]) => {
      const w = add(new THREE.CylinderGeometry(0.21, 0.21, 0.12, 18), tire, x, 0.21, z); w.rotation.z = Math.PI / 2;
      const h = add(new THREE.CylinderGeometry(0.1, 0.1, 0.012, 16), cream, x + Math.sign(x) * 0.066, 0.21, z); h.rotation.z = Math.PI / 2;
    });
    T.position.set(-1.8, 0, 4.2);
    addHood(T, 0, 0); addRect(-2.35, -1.25, 2.9, 5.5, () => T.visible);
  }

  const cars = [0, 1].map((i) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.42, 0.55), new THREE.MeshStandardMaterial({ color: i ? 0x3a2a4a : 0x24324f, roughness: 0.6 }));
    body.position.y = 0.32;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.5), new THREE.MeshStandardMaterial({ color: 0x0d1220 }));
    cab.position.set(-0.05, 0.62, 0);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff1c8 });
    [-0.18, 0.18].forEach((z) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.1), lampMat); l.position.set(0.56, 0.36, z); g.add(l); });
    g.add(body, cab); g.position.set(0, 0, i ? 8.9 : 7.1); g.rotation.y = i ? Math.PI : 0;
    g.visible = false; scene.add(g); return g;
  });

  // ---------- Fireworks ----------
  const bursts = [];
  const COLORS = [0xff7a59, 0x5cc8ff, 0xffc857, 0xc58bff, 0x58d6a0];
  let lastBurst = 0;
  const burst = (now) => {
    const r = Math.random, n = 70, pos = new Float32Array(n * 3), vel = [];
    const o = new THREE.Vector3((r() - 0.5) * 14, topY + 6 + r() * 6, (r() - 0.5) * 8);
    for (let i = 0; i < n; i++) {
      const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1), s = 4 + r() * 2.5;
      vel.push(new THREE.Vector3(Math.sin(ph) * Math.cos(th) * s, Math.cos(ph) * s, Math.sin(ph) * Math.sin(th) * s));
      pos.set([o.x, o.y, o.z], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: COLORS[(r() * COLORS.length) | 0], size: 0.35, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    scene.add(pts); bursts.push({ pts, o, vel, start: now });
  };

  // ---------- First-person world: places and characters ----------
  addRect(-3.7, 3.7, -3.0, 3.0);                                   // Kestrel HQ
  addRect(-4.85, -4.7, -2.8, 3.0, () => round === 0); addRect(4.7, 4.85, -2.8, 3.0, () => round === 0);   // yard fences
  const label = (text, sub, w, h, bg, fg) => {
    const t = canvasTex((c, cw, ch) => {
      c.fillStyle = bg; c.fillRect(0, 0, cw, ch);
      c.fillStyle = fg; c.textAlign = "center"; c.textBaseline = "middle";
      c.font = "800 54px 'Bricolage Grotesque', 'Avenir Next', sans-serif"; c.fillText(text, cw / 2, sub ? ch * 0.4 : ch / 2);
      if (sub) { c.font = "500 26px 'Hanken Grotesk', sans-serif"; c.globalAlpha = 0.75; c.fillText(sub, cw / 2, ch * 0.78); c.globalAlpha = 1; }
    }, 512, 128);
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: bg === "rgba(0,0,0,0)" }));
  };
  const M = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.8 }, o || {}));
  const piece = (grp, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; grp.add(m); return m; };

  // Northlight Ventures: low glass-and-timber office on a Sand Hill-style road (fictional firm)
  {
    const g = new THREE.Group(), cx = 24, cz = -1;
    piece(g, new THREE.BoxGeometry(12.4, 0.15, 7.4), M(0x9a968f), cx, 0.075, cz);
    piece(g, new THREE.BoxGeometry(11, 1.9, 6), M(0x1c2430, { emissive: 0xffd9a0, emissiveIntensity: 0.35, roughness: 0.2, metalness: 0.4 }), cx, 1.1, cz);
    for (let x = -5.2; x <= 5.2; x += 0.8) piece(g, new THREE.BoxGeometry(0.08, 1.9, 0.14), M(0x8a5a36), cx + x, 1.1, cz + 3.04);
    piece(g, new THREE.BoxGeometry(13, 0.18, 7.6), M(0xe8e4dc), cx, 2.14, cz);
    piece(g, new THREE.BoxGeometry(4.4, 0.9, 0.3), M(0xb8b0a2), cx, 0.45, 3.6);
    const sg = label("NORTHLIGHT", "VENTURES", 3.8, 0.75, "#1b1d22", "#f1ece2"); sg.position.set(cx, 0.48, 3.76); g.add(sg);
    [[18, 3.8], [30.5, 3.5], [31, -5.5]].forEach(([x, z]) => { piece(g, new THREE.CylinderGeometry(0.12, 0.16, 1.2), M(0x3a2a20), x, 0.6, z); piece(g, new THREE.IcosahedronGeometry(1.2, 0), M(0x3b4a26), x, 1.9, z); addCircle(x, z, 0.5); });
    scene.add(g); addRect(17.7, 30.3, -4.8, 2.8); addRect(21.7, 26.3, 3.4, 3.8);
  }
  // Ledgerline & Co.: limestone audit firm with a columned porch (fictional firm)
  {
    const g = new THREE.Group(), cx = -24, cz = -1, stone = M(0xd9d0bf);
    piece(g, new THREE.BoxGeometry(10, 3.4, 6), stone, cx, 1.7, cz);
    const lit = new THREE.MeshBasicMaterial({ color: 0xffd28f }), dark = new THREE.MeshBasicMaterial({ color: 0x2a3040 });
    for (let r = 0; r < 2; r++) for (let k = 0; k < 6; k++) {
      if (r === 0 && (k === 2 || k === 3)) continue;
      const w = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.9), (k + r) % 3 ? lit : dark); w.position.set(cx - 3.75 + k * 1.5, 1.0 + r * 1.5, cz + 3.01); g.add(w);
    }
    piece(g, new THREE.BoxGeometry(4.4, 0.12, 1.6), stone, cx, 0.06, 2.8); piece(g, new THREE.BoxGeometry(4.0, 0.12, 1.3), stone, cx, 0.18, 2.75);
    [-1.5, -0.5, 0.5, 1.5].forEach((x) => { piece(g, new THREE.CylinderGeometry(0.16, 0.18, 2.4, 14), stone, cx + x, 1.44, 3.1); addCircle(cx + x, 3.1, 0.25); });
    piece(g, new THREE.BoxGeometry(4.2, 0.3, 1.0), stone, cx, 2.79, 2.95);
    const ped = new THREE.Shape(); ped.moveTo(-2.2, 0); ped.lineTo(2.2, 0); ped.lineTo(0, 0.7); ped.lineTo(-2.2, 0);
    const pm = piece(g, new THREE.ExtrudeGeometry(ped, { depth: 1.0, bevelEnabled: false }), stone, cx, 2.94, 2.45);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.6), new THREE.MeshBasicMaterial({ color: 0x3a2a22 })); door.position.set(cx, 1.04, cz + 3.01); g.add(door);
    const sg = label("LEDGERLINE & CO.", "Certified Public Accountants", 3.6, 0.6, "#d9d0bf", "#2a2620"); sg.position.set(cx, 3.2, 3.46); g.add(sg);
    scene.add(g); addRect(-29.2, -18.8, -4.2, 2.2); addRect(-26.3, -21.7, 2.2, 3.6, () => false);
  }
  // Second Shot Coffee, across the street (fictional cafe)
  {
    const g = new THREE.Group(), cx = 14, cz = 14;
    piece(g, new THREE.BoxGeometry(6, 2.3, 4), M(0xf2ead8), cx, 1.15, cz);
    const front = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.5), M(0x2a2620, { emissive: 0xffc98a, emissiveIntensity: 0.7 })); front.position.set(cx - 0.3, 0.95, cz - 2.01); front.rotation.y = Math.PI; g.add(front);
    const awn = piece(g, new THREE.BoxGeometry(6.2, 0.06, 1.2), M(0xff7a59), cx, 2.0, cz - 2.5); awn.rotation.x = -0.35;
    const sg = label("SECOND SHOT", "COFFEE", 3.2, 0.6, "#2a2620", "#f2ead8"); sg.position.set(cx, 2.45, cz - 2.02); sg.rotation.y = Math.PI; g.add(sg);
    [[12.2, 10.9], [15.8, 10.9]].forEach(([x, z]) => { piece(g, new THREE.CylinderGeometry(0.3, 0.3, 0.04, 16), M(0x1b1c1f), x, 0.5, z); piece(g, new THREE.CylinderGeometry(0.04, 0.04, 0.5), M(0x1b1c1f), x, 0.25, z); addCircle(x, z, 0.35); });
    scene.add(g); addRect(10.9, 17.1, 11.9, 16.1);
  }

  // Characters who bring you cases. Keyed by the first name in each case's "from" field.
  const CHARS = {
    Maya: { x: 2.4, z: 4.0, color: 0xff7a59, role: "CEO", place: "Kestrel HQ" },
    Dev: { x: -0.2, z: 5.9, color: 0x5cc8ff, role: "CTO", place: "the driveway at Kestrel HQ" },
    Priya: { x: 24, z: 4.5, color: 0xc58bff, role: "Northlight partner", place: "Northlight Ventures" },
    Sam: { x: -24, z: 4.4, color: 0xffc857, role: "Audit senior", place: "Ledgerline & Co., the audit firm" },
    Lena: { x: 14, z: 11.2, color: 0x58d6a0, role: "Staff engineer", place: "Second Shot Coffee", fromStreet: true }
  };
  const skin = [0xe8c4a0, 0xc68a5e, 0xf0d2b6, 0x8d5a3b, 0xd9a882];
  Object.keys(CHARS).forEach((name, i) => {
    const c = CHARS[name], g = new THREE.Group();
    piece(g, new THREE.CylinderGeometry(0.13, 0.16, 0.6, 12), M(c.color, { roughness: 0.6 }), 0, 0.3, 0);
    piece(g, new THREE.SphereGeometry(0.12, 14, 12), M(skin[i % skin.length], { roughness: 0.7 }), 0, 0.73, 0);
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex((cx, w, h) => {
      cx.fillStyle = "rgba(9,12,21,.82)"; cx.fillRect(0, 18, w, h - 36);
      cx.fillStyle = "#" + c.color.toString(16).padStart(6, "0"); cx.fillRect(0, 18, 10, h - 36);
      cx.fillStyle = "#eef0f6"; cx.font = "700 46px 'Hanken Grotesk', sans-serif"; cx.textBaseline = "middle"; cx.fillText(name + " · " + c.role, 30, h / 2);
    }, 512, 128), depthTest: false }));
    tag.scale.set(1.5, 0.375, 1); tag.position.y = 1.08; g.add(tag);
    g.position.set(c.x, 0, c.z); scene.add(g); c.grp = g;
    addCircle(c.x, c.z, 0.3);
  });
  const beacon = new THREE.Group();
  beacon.add(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 16, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xff7a59, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })));
  beacon.children[0].position.y = 8;
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), new THREE.MeshBasicMaterial({ color: 0xff7a59 }));
  beacon.add(gem); beacon.visible = false; scene.add(beacon);

  // On-screen controls for walking (created here so the scene owns them)
  const mkEl = (tag, cls, html) => { const e = document.createElement(tag); e.className = cls; if (html) e.innerHTML = html; host.appendChild(e); return e; };
  const modeBtn = mkEl("button", "hqbtn", "Walk Silicon Valley");
  modeBtn.type = "button";
  modeBtn.addEventListener("click", () => window.onHQMode && window.onHQMode());
  const guide = mkEl("div", "hqguide"); guide.setAttribute("aria-live", "polite");
  const joy = mkEl("div", "hqjoy", "<i></i>"); joy.setAttribute("aria-hidden", "true");

  let worldMode = false, target = null, targetKey = null, arrivedKey = null;
  const player = { x: 0, z: 10.5, yaw: 0, pitch: -0.04 };
  const keys = {};
  const joyVec = { x: 0, y: 0 };
  let joyId = null;
  const joyMove = (e) => {
    const b = joy.getBoundingClientRect(), r = b.width / 2;
    let dx = e.clientX - (b.left + r), dy = e.clientY - (b.top + r);
    const d = Math.hypot(dx, dy); if (d > r) { dx *= r / d; dy *= r / d; }
    joyVec.x = dx / r; joyVec.y = dy / r; joy.firstChild.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  joy.addEventListener("pointerdown", (e) => { joyId = e.pointerId; joy.setPointerCapture(e.pointerId); joyMove(e); e.preventDefault(); });
  joy.addEventListener("pointermove", (e) => { if (e.pointerId === joyId) joyMove(e); });
  const joyEnd = (e) => { if (e.pointerId !== joyId) return; joyId = null; joyVec.x = joyVec.y = 0; joy.firstChild.style.transform = ""; };
  joy.addEventListener("pointerup", joyEnd); joy.addEventListener("pointercancel", joyEnd);
  const blocked = (x, z, r) => {
    for (const c of colliders) {
      if (!c.when()) continue;
      if (c.t === 0) { if (x > c.x0 - r && x < c.x1 + r && z > c.z0 - r && z < c.z1 + r) return true; }
      else if (Math.hypot(x - c.x, z - c.z) < c.r + r) return true;
    }
    return false;
  };
  const walk = (dx, dz) => {                         // slide along walls: try x then z separately
    const r = 0.3;
    if (!blocked(player.x + dx, player.z, r)) player.x += dx;
    if (!blocked(player.x, player.z + dz, r)) player.z += dz;
    player.x = Math.max(-45, Math.min(45, player.x)); player.z = Math.max(-40, Math.min(32, player.z));
  };
  function teleport() {
    const c = target && CHARS[target];
    if (!c) return;
    player.x = c.x; player.z = c.z + (c.fromStreet ? -1.3 : 1.3); player.yaw = c.fromStreet ? Math.PI : 0; player.pitch = -0.08;
  }
  const whereIs = (name) => (CHARS[name] ? CHARS[name].place : "Kestrel HQ");

  // ---------- Camera and input ----------
  let theta = 0.6, thetaGoal = 0.6, lastInput = -1e9;
  const look = { y: 2, d: 22 };
  let dragging = false, lastX = 0;
  cv.addEventListener("pointerdown", (e) => { dragging = true; lastX = e.clientX; lastInput = performance.now(); cv.style.cursor = "grabbing"; });
  window.addEventListener("pointerup", () => { dragging = false; cv.style.cursor = ""; });
  let lastY = 0;
  cv.addEventListener("pointerdown", (e) => { lastY = e.clientY; });
  cv.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    if (worldMode) {
      player.yaw -= (e.clientX - lastX) * 0.006;
      player.pitch = Math.max(-0.9, Math.min(0.7, player.pitch - (e.clientY - lastY) * 0.004));
    } else thetaGoal -= (e.clientX - lastX) * 0.01;
    lastX = e.clientX; lastY = e.clientY; lastInput = performance.now();
  });
  const WALK_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "W", "A", "S", "D", "Shift"];
  window.addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (worldMode) {
      if (!WALK_KEYS.includes(e.key)) return;
      keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = true; e.preventDefault(); return;
    }
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    thetaGoal += e.key === "ArrowLeft" ? 0.45 : -0.45; lastInput = performance.now();
  });
  window.addEventListener("keyup", (e) => { keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = false; });
  window.addEventListener("blur", () => { Object.keys(keys).forEach((k) => (keys[k] = false)); });

  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
  };
  if (window.ResizeObserver) new ResizeObserver(resize).observe(host); else window.addEventListener("resize", resize);
  resize();

  // ---------- State from the game ----------
  let round = 0, done = false, ready = false, settingReady = false;
  function update(st) {
    // Once Series A starts the company has moved into the loft: earlier garage floors are
    // shown as loft floors too, so the building reads as one design. Each keeps its glow.
    if (st.round >= 1) st = Object.assign({}, st, { floors: st.floors.map((f) => (f.r === 0 ? { r: 1, g: f.g } : f)) });
    const same = st.floors.length >= floors.length && floors.every((f, i) => f.r === st.floors[i].r && f.g === st.floors[i].g);
    if (!same) clearFloors();
    const animate = ready && same;
    for (let i = floors.length; i < st.floors.length; i++) placeFloor(st.floors[i].r, st.floors[i].g, animate);
    ready = true;

    if (st.round !== round || !settingReady) {
      setFrom = settingReady && !reduce ? {
        top: cur.top.clone(), mid: cur.mid.clone(), hor: cur.hor.clone(), fog: cur.fog.clone(), groundC: cur.groundC.clone(),
        sun: cur.sun.clone(), hs: cur.hs.clone(), hg: cur.hg.clone(), sunI: cur.sunI, hI: cur.hI, stars: cur.stars, sunPos: cur.sunPos.toArray()
      } : null;
      setTo = SETTINGS[Math.min(st.round, 2)];
      setStart = settingReady && !reduce ? performance.now() : -1e9;
      settingReady = true;
      applySetting(setFrom ? 0 : 1);
    }
    round = st.round; done = st.done;
    if (!!st.world !== worldMode) {
      worldMode = !!st.world;
      host.classList.toggle("walking", worldMode);
      modeBtn.textContent = worldMode ? "Back to overview" : "Walk Silicon Valley";
      cam.fov = worldMode ? 68 : 38; cam.updateProjectionMatrix();
      if (worldMode) cv.focus({ preventScroll: true });
    }
    target = st.target || null; targetKey = st.targetKey;
    if (target === null) arrivedKey = null;
    Object.keys(CHARS).forEach((n) => (CHARS[n].grp.visible = worldMode || n === target));
    ghostOn = st.next === null ? -1 : st.next;
    ghosts.forEach((g, i) => { g.grp.visible = i === ghostOn; g.grp.position.y = topY; });

    const topSt = floors.length ? STY[floors[floors.length - 1].r] : null;
    sign.visible = !!topSt;
    let capOn = false;
    caps.forEach((cap, i) => {
      const on = topSt === STY[i] && (ghostOn === i || ghostOn === -1);
      cap.visible = on;
      cap.userData.targetY = topY + (ghostOn === i ? STY[i].h + 0.15 : 0);
      if (!cap.userData.placed || reduce) { cap.position.y = cap.userData.targetY; cap.userData.placed = on; }
      if (on && i === 0) capOn = true;
    });
    if (topSt) {
      if (capOn) sign.position.set(0, topY - 0.55, topSt.d / 2 + 0.75);
      else sign.position.set(0, topY, topSt.d / 2 - 0.35);
    }
    spire.visible = done; spire.position.y = topY;
    cars.forEach((c) => (c.visible = round >= 1));

    const n = floors.length, label = STY[Math.min(round, 2)].name;
    cap.textContent = `HQ · ${label} · ${n} ${n === 1 ? "floor" : "floors"}`;
    cv.setAttribute("aria-label", `3D view of Kestrel's headquarters: ${label.toLowerCase()}, ${n} ${n === 1 ? "floor" : "floors"}. One floor is added for every case you answer.`);
  }

  // ---------- Loop ----------
  let prev = performance.now();
  function tick(now) {
    const dt = Math.min(0.05, (now - prev) / 1000); prev = now;

    floors.forEach((f) => {
      if (f.landed) return;
      const k = ease((now - f.start) / 700);
      f.grp.position.y = f.y + 6 * (1 - k);
      if (k >= 1) { f.landed = true; f.grp.position.y = f.y; ring(f.y + f.h / 2, f.w, f.g > 0); }
    });
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i], k = (now - r.start) / 900;
      if (k >= 1) { scene.remove(r.m); rings.splice(i, 1); continue; }
      const s = r.w * (0.6 + ease(k) * 0.9); r.m.scale.set(s, s, s); r.m.material.opacity = 1 - k;
    }
    if (ghostOn >= 0) {
      const a = reduce ? 0.8 : 0.45 + 0.4 * Math.sin(now / 320);
      ghosts[ghostOn].edges.material.opacity = a;
    }
    if (setFrom && now - setStart < 1900) applySetting(ease((now - setStart) / 1800));
    else if (setFrom) { applySetting(1); setFrom = null; }
    caps.forEach((cap) => { if (cap.visible) cap.position.y += (cap.userData.targetY - cap.position.y) * Math.min(1, dt * 5); });
    hood.forEach((h) => {
      const want = round >= h.minRound && round <= h.maxRound ? 1 : 0;
      h.s += (want - h.s) * (reduce ? 1 : Math.min(1, dt * 3));
      h.grp.visible = h.s > 0.01; h.grp.scale.y = Math.max(0.001, h.s);
    });
    cars.forEach((c, i) => { if (!c.visible) return; const sp = (i ? -1 : 1) * 7; c.position.x = (((c.position.x + sp * dt) + 60) % 120 + 120) % 120 - 60; });
    if (spire.visible) spire.userData.tip.visible = reduce || Math.floor(now / 600) % 2 === 0;

    if (done && !reduce && now - lastBurst > 900) { burst(now); lastBurst = now; }
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i], t = (now - b.start) / 1000;
      if (t > 1.8) { scene.remove(b.pts); b.pts.geometry.dispose(); b.pts.material.dispose(); bursts.splice(i, 1); continue; }
      const a = b.pts.geometry.attributes.position;
      b.vel.forEach((v, j) => a.setXYZ(j, b.o.x + v.x * t, b.o.y + v.y * t - 4.9 * t * t * 0.6, b.o.z + v.z * t));
      a.needsUpdate = true; b.pts.material.opacity = 1 - t / 1.8;
    }

    const tc = target && CHARS[target];
    beacon.visible = !!tc;
    if (tc) {
      beacon.position.set(tc.x, 0, tc.z);
      gem.position.y = 1.45 + (reduce ? 0 : Math.sin(now / 300) * 0.08); gem.rotation.y = reduce ? 0 : now / 600;
    }
    Object.keys(CHARS).forEach((n) => {
      const c = CHARS[n]; if (!c.grp.visible) return;
      const d = Math.hypot(player.x - c.x, player.z - c.z);
      if (worldMode && d < 7) c.grp.rotation.y = Math.atan2(player.x - c.x, player.z - c.z);
      else c.grp.rotation.y = 0;
    });
    if (worldMode) {
      const fwd = (keys.ArrowUp || keys.w ? 1 : 0) - (keys.ArrowDown || keys.s ? 1 : 0) - joyVec.y;
      const turn = (keys.ArrowLeft ? 1 : 0) - (keys.ArrowRight ? 1 : 0) - joyVec.x * 0.9;
      const strafe = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
      player.yaw += turn * 2.0 * dt;
      const sp = (keys.Shift ? 7 : 4.2) * dt, sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
      const f = Math.max(-1, Math.min(1, fwd));
      if (f || strafe) walk((-sy * f + cy * strafe) * sp, (-cy * f - sy * strafe) * sp);
      cam.position.set(player.x, 0.82 + (f && !reduce ? Math.sin(now / 110) * 0.015 : 0), player.z);
      cam.rotation.set(player.pitch, player.yaw, 0, "YXZ");
      if (tc) {
        const dist = Math.hypot(tc.x - player.x, tc.z - player.z);
        const ang = Math.atan2(-(tc.x - player.x), -(tc.z - player.z));
        let rel = ang - player.yaw; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
        guide.innerHTML = `<b style="transform:rotate(${(-rel * 180 / Math.PI).toFixed(0)}deg)">▲</b>${target} · ${Math.round(dist * 2)} m`;
        guide.hidden = false;
        if (dist < 1.7 && arrivedKey !== targetKey) { arrivedKey = targetKey; window.onHQArrive && window.onHQArrive(targetKey); }
      } else guide.hidden = true;
      R.render(scene, cam);
      requestAnimationFrame(tick);
      return;
    }
    guide.hidden = true;
    if (!reduce && !dragging && now - lastInput > 3500) thetaGoal += dt * 0.12;
    theta += (thetaGoal - theta) * Math.min(1, dt * 6);
    const H = topY + (spire.visible ? 4.5 : 0);
    const wantY = Math.max(2, H * 0.5), wantD = Math.max(21, H * 1.35 + 13);
    const blend = reduce ? 1 : Math.min(1, dt * 2.5);
    look.y += (wantY - look.y) * blend; look.d += (wantD - look.d) * blend;
    cam.position.set(Math.sin(theta) * look.d, look.y + look.d * 0.32, Math.cos(theta) * look.d);
    cam.rotation.order = "XYZ";
    cam.lookAt(0, look.y, 0);

    R.render(scene, cam);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  return { update, teleport, whereIs };
})();
