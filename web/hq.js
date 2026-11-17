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

  scene.add(new THREE.HemisphereLight(0x9db8ff, 0x0a0e18, 0.6));
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
  flat(240, 240, 0x0b111e, 0);
  flat(14, 11, 0x141b2b, 0.005);
  flat(240, 4, 0x121827, 0.01, 0, 8);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0x3a4258 });
  for (let x = -60; x <= 60; x += 3) {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.12), dashMat);
    d.rotation.x = -Math.PI / 2; d.position.set(x, 0.02, 8); scene.add(d);
  }
  {
    const r = rng(17), n = 500, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const th = r() * Math.PI * 2, ph = r() * 0.45 * Math.PI, rad = 120;
      pos[i * 3] = rad * Math.cos(th) * Math.sin(ph + 0.6);
      pos[i * 3 + 1] = 18 + rad * Math.cos(ph + 0.6) * 0.9 + r() * 20;
      pos[i * 3 + 2] = rad * Math.sin(th) * Math.sin(ph + 0.6);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xdfe6ff, size: 0.6, sizeAttenuation: true, fog: false })));
  }

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
    { name: "The garage", w: 7.2, d: 5.6, h: 1.8, wall: "#5c4636", frame: "#3a2a20", cols: 3, win: 0xffc98a, seed: 3 },
    { name: "The loft", w: 6.4, d: 5.4, h: 1.55, wall: "#6b3328", frame: "#3a1e17", cols: 5, brick: true, win: 0xffd58a, seed: 5 },
    { name: "The tower", w: 5, d: 5, h: 1.35, wall: "#1b2c47", frame: "#2c4166", cols: 8, glass: true, win: 0xaee0ff, seed: 9 }
  ];
  const facade = (ctx, w, h, st, mode) => {
    ctx.fillStyle = mode === "map" ? st.wall : "#000"; ctx.fillRect(0, 0, w, h);
    if (mode === "map" && st.brick) { ctx.fillStyle = "rgba(0,0,0,.2)"; for (let y = 4; y < h; y += 8) ctx.fillRect(0, y, w, 1); }
    if (mode === "map" && !st.glass && !st.brick) { ctx.fillStyle = "rgba(0,0,0,.18)"; for (let x = 6; x < w; x += 12) ctx.fillRect(x, 0, 1, h); }
    const r = rng(st.seed), pad = w * 0.04, gw = (w - pad * 2) / st.cols, wy = h * (st.glass ? 0.12 : 0.22), wh = h * (st.glass ? 0.76 : 0.56);
    for (let i = 0; i < st.cols; i++) {
      const x = pad + i * gw + gw * (st.glass ? 0.06 : 0.14), ww = gw * (st.glass ? 0.88 : 0.72);
      const on = mode === "full" || (mode === "sparse" && r() < 0.4);
      ctx.fillStyle = mode === "map" ? (st.glass ? "#0d1830" : "#141a28") : on ? "#fff" : "#000";
      ctx.fillRect(x, wy, ww, wh);
      if (mode === "map") { ctx.fillStyle = st.frame; ctx.fillRect(x + ww / 2 - 1, wy, 2, wh); ctx.fillRect(x, wy + wh / 2 - 1, ww, 2); }
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
    const st = STY[r], grp = makeFloor(st, g), y = topY;
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
  const spots = (() => {
    const r = rng(23), out = [];
    while (out.length < 26) {
      const x = (r() - 0.5) * 70, z = -6 - r() * 38 + (r() < 0.25 ? 26 : 0);
      if (Math.abs(x) < 9 && z > -9) continue;
      if (z > 4 && z < 12) continue;
      if (out.some((p) => Math.hypot(p.x - x, p.z - z) < 6.5)) continue;
      out.push({ x, z, v: r() });
    }
    return out;
  })();
  const leaf = new THREE.MeshStandardMaterial({ color: 0x16301f, roughness: 1 });
  const bark = new THREE.MeshStandardMaterial({ color: 0x2a1d16, roughness: 1 });
  const tree = (x, z, s) => {
    const g = new THREE.Group();
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.2), bark); t.position.y = 0.6;
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 * s, 0), leaf); c.position.y = 1.5 * s + 0.4;
    t.castShadow = c.castShadow = true; g.add(t, c); g.position.set(x, 0, z); return g;
  };
  [[-8, 3], [8.5, 2], [-9, -4], [9.5, -5], [-12, 6], [13, 5], [-6, 12.5], [6, 12.5]].forEach(([x, z], i) => addHood(tree(x, z, 1 + (i % 3) * 0.2), 0, 9));

  const tallTex = (st, reps) => {
    const m = st.tex.map.clone(), e = st.tex.sparse.clone();
    [m, e].forEach((t) => { t.needsUpdate = true; t.repeat.set(1, reps); });
    return { m, e };
  };
  spots.forEach((p, i) => {
    const kind = i % 3;   // 0 house, 1 low-rise, 2 skyscraper
    const g = new THREE.Group();
    if (kind === 0) {
      const body = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 3), new THREE.MeshStandardMaterial({ color: 0x2a2f42, roughness: 0.9 }));
      body.position.y = 1;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.4, 4), new THREE.MeshStandardMaterial({ color: 0x1a1f2e, roughness: 0.9 }));
      roof.position.y = 2.7; roof.rotation.y = Math.PI / 4;
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.6), new THREE.MeshBasicMaterial({ color: p.v > 0.4 ? 0xffd58a : 0x1a2030 }));
      win.position.set(0.6, 1.2, 1.51);
      body.castShadow = roof.castShadow = true; g.add(body, roof, win);
      g.position.set(p.x, 0, p.z); g.rotation.y = (p.v - 0.5) * 0.6; addHood(g, 0, 0);
    } else {
      const st = STY[kind === 1 ? 1 : 2];
      const h = kind === 1 ? 3 + p.v * 4 : 12 + p.v * 16, w = kind === 1 ? 4 + p.v * 2 : 3.6 + p.v * 1.6;
      const t = tallTex(st, Math.max(1, Math.round(h / st.h)));
      const mat = new THREE.MeshStandardMaterial({ map: t.m, emissiveMap: t.e, emissive: new THREE.Color(st.win), emissiveIntensity: 0.35,
        roughness: st.glass ? 0.35 : 0.9, metalness: st.glass ? 0.4 : 0.05 });
      const top = new THREE.MeshStandardMaterial({ color: 0x0e1424 });
      const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.9), [mat, mat, top, top, mat, mat]);
      box.position.y = h / 2; box.castShadow = box.receiveShadow = true; g.add(box);
      g.position.set(p.x, 0, p.z); addHood(g, kind === 1 ? 1 : 2, 9);
    }
  });

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

  // ---------- Camera and input ----------
  let theta = 0.6, thetaGoal = 0.6, lastInput = -1e9;
  const look = { y: 2, d: 22 };
  let dragging = false, lastX = 0;
  cv.addEventListener("pointerdown", (e) => { dragging = true; lastX = e.clientX; lastInput = performance.now(); cv.style.cursor = "grabbing"; });
  window.addEventListener("pointerup", () => { dragging = false; cv.style.cursor = ""; });
  cv.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    thetaGoal -= (e.clientX - lastX) * 0.01; lastX = e.clientX; lastInput = performance.now();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    e.preventDefault();
    thetaGoal += e.key === "ArrowLeft" ? 0.45 : -0.45; lastInput = performance.now();
  });

  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
  };
  if (window.ResizeObserver) new ResizeObserver(resize).observe(host); else window.addEventListener("resize", resize);
  resize();

  // ---------- State from the game ----------
  let round = 0, done = false, ready = false;
  function update(st) {
    const same = st.floors.length >= floors.length && floors.every((f, i) => f.r === st.floors[i].r && f.g === st.floors[i].g);
    if (!same) clearFloors();
    const animate = ready && same;
    for (let i = floors.length; i < st.floors.length; i++) placeFloor(st.floors[i].r, st.floors[i].g, animate);
    ready = true;

    round = st.round; done = st.done;
    ghostOn = st.next === null ? -1 : st.next;
    ghosts.forEach((g, i) => { g.grp.visible = i === ghostOn; g.grp.position.y = topY; });

    const topSt = floors.length ? STY[floors[floors.length - 1].r] : null;
    sign.visible = !!topSt;
    if (topSt) sign.position.set(0, topY, topSt.d / 2 - 0.35);
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

    if (!reduce && !dragging && now - lastInput > 3500) thetaGoal += dt * 0.12;
    theta += (thetaGoal - theta) * Math.min(1, dt * 6);
    const H = topY + (spire.visible ? 4.5 : 0);
    const wantY = Math.max(2, H * 0.5), wantD = Math.max(21, H * 1.35 + 13);
    const blend = reduce ? 1 : Math.min(1, dt * 2.5);
    look.y += (wantY - look.y) * blend; look.d += (wantD - look.d) * blend;
    cam.position.set(Math.sin(theta) * look.d, look.y + look.d * 0.32, Math.cos(theta) * look.d);
    cam.lookAt(0, look.y, 0);

    R.render(scene, cam);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  return { update };
})();
