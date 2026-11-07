// Bot City (README rounds 36–38): an open-world 3D city of AI citizens, loaded by index.html when the City tab opens.
// A 15×15-block city: Bot Row downtown (a tower per paper bot around HQ, the Rug Desk and two neon plazas), Midtown
// skyscrapers, the Neon River with bridges and boats, the Waterfront and its Ferris wheel, the Shipyard, the Arena
// District (the Arena bot is the stadium), Central Park and the suburbs, mountains on the horizon and a blimp overhead.
// AI people walk between home, work and errands; cars drive the grid and stop at four gas stations. You can pan, spin
// and zoom around, follow any person or car, or take your own car for a drive. HQ's glass penthouse holds the boss,
// whose monitors mirror the real meme bot team (paper/meme.json). Everything is procedural (no model files) and the
// layout is the same on every visit (seeded random).
export function createCity(T, {stage, canvas, minimap, reduceMotion, isActive, onPick, onFrame, onToast, bots}){   // bots: [{id, name, css}]
  const rand = (() => { let a = 20261107; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();
  const pick = arr => arr[Math.floor(rand() * arr.length)];
  const toast = onToast || (() => {});
  const R = new T.WebGLRenderer({canvas, antialias:true, powerPreference:"low-power"});
  R.setPixelRatio(Math.min(1.5, devicePixelRatio || 1)); R.outputColorSpace = T.SRGBColorSpace; R.setClearColor(0x0e0838);
  const scene = new T.Scene(); scene.fog = new T.Fog(0x160d52, 45, 170);
  const cam = new T.PerspectiveCamera(45, 1, .1, 420);
  scene.add(new T.HemisphereLight(0xa596ff, 0x120a40, 1.15));
  const moonLight = new T.DirectionalLight(0xc8d0ff, .55); moonLight.position.set(-12, 25, 10); scene.add(moonLight);

  // ── textures ──
  const canvasTex = (w, h, draw) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d");
    draw(g, w, h); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.userData = {c, g}; return t; };
  const windows = (lit, tints) => canvasTex(64, 128, g => { g.fillStyle = "#0b0a2a"; g.fillRect(0, 0, 64, 128);
    for(let y = 4; y < 124; y += 8) for(let x = 4; x < 60; x += 8) if(rand() < lit){ g.globalAlpha = .5 + rand() * .5; g.fillStyle = pick(tints); g.fillRect(x, y, 4, 4); } });
  const winOffice = windows(.55, ["#ffe9a8", "#ffffff", "#8fd8ff"]), winHome = windows(.35, ["#ffcf7a", "#ffb35c"]), winHQ = windows(.75, ["#9fe8ff", "#ffffff"]);
  const winDesk = windows(.6, ["#7dffc2", "#c8ffe8"]);
  for(const t of [winOffice, winHome, winHQ, winDesk]) t.magFilter = T.NearestFilter;
  const glowTex = canvasTex(64, 64, g => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(.3, "rgba(255,255,255,.4)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
  const waterTex = canvasTex(64, 64, g => { g.fillStyle = "#14307a"; g.fillRect(0, 0, 64, 64);
    for(let k = 0; k < 46; k++){ g.fillStyle = `rgba(140,210,255,${.12 + rand() * .4})`; g.fillRect(rand() * 64, rand() * 64, 5 + rand() * 12, 1); } });
  waterTex.wrapS = waterTex.wrapT = T.RepeatWrapping; waterTex.repeat.set(36, 1.5);
  const sign = (text, color, w = 256, h = 64) => canvasTex(w, h, g => { g.fillStyle = "rgba(10,6,40,.85)"; g.fillRect(0, 0, w, h);
    g.strokeStyle = color; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6); g.fillStyle = color; g.font = `bold ${h * .5}px sans-serif`;
    g.textAlign = "center"; g.textBaseline = "middle"; g.shadowColor = color; g.shadowBlur = 12; g.fillText(text, w / 2, h / 2 + 2); });
  const signMesh = (tex, w, h) => new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({map:tex, transparent:true, side:T.DoubleSide}));
  const glow = (hex, s) => { const m = new T.Sprite(new T.SpriteMaterial({map:glowTex, color:hex, blending:T.AdditiveBlending, transparent:true, depthWrite:false})); m.scale.set(s, s, 1); return m; };
  const points = (list, color, size, attenuate = true, extra = {}) => { const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(list.flat(), 3));
    const m = new T.Points(g, new T.PointsMaterial({map:glowTex, color, size, sizeAttenuation:attenuate, transparent:true, blending:T.AdditiveBlending, depthWrite:false, ...extra}));
    scene.add(m); return m; };

  // ── layout: 15×15 blocks with roads between them ──
  const P = 5.2, B = 4, N = 7, RIVER = 4;
  const lines = []; for(let i = -N - 1; i <= N; i++) lines.push(+((i + .5) * P).toFixed(2));   // road centre lines (x and z)
  const EXT = (N + .5) * P;
  const ground = new T.Mesh(new T.PlaneGeometry(EXT * 2 + 300, EXT * 2 + 300), new T.MeshStandardMaterial({color:0x150f3a, roughness:1}));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  const roads = new T.Mesh(new T.PlaneGeometry(EXT * 2 + 1.2, EXT * 2 + 1.2), new T.MeshStandardMaterial({color:0x1d1648, roughness:1}));
  roads.rotation.x = -Math.PI / 2; roads.position.y = .004; scene.add(roads);
  const unit = new T.BoxGeometry(1, 1, 1); unit.translate(0, .5, 0);
  const M4 = new T.Matrix4(), Q = new T.Quaternion(), V = new T.Vector3(), S = new T.Vector3(), E = new T.Euler();
  const place = (inst, i, x, y, z, sx, sy, sz, ry = 0) => { Q.setFromEuler(E.set(0, ry, 0)); inst.setMatrixAt(i, M4.compose(V.set(x, y, z), Q, S.set(sx, sy, sz))); };
  const instanced = (geo, mat, list) => { const m = new T.InstancedMesh(geo, mat, Math.max(1, list.length));
    list.forEach((a, i) => { place(m, i, ...a.slice(0, 7)); if(a[8] !== undefined) m.setColorAt(i, new T.Color(a[8])); });
    m.count = list.length; if(m.instanceColor) m.instanceColor.needsUpdate = true; scene.add(m); return m; };
  const blocks = []; for(let i = -N; i <= N; i++) for(let j = -N; j <= N; j++) blocks.push([i, j]);
  const key = (i, j) => `${i},${j}`, Z = {}, BOTS = {}, RR = (i, j) => Math.max(Math.abs(i), Math.abs(j));
  const ring = r => blocks.filter(([i, j]) => RR(i, j) === r).sort((a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
  const setZ = (list, z) => list.forEach(([i, j]) => { if(!Z[key(i, j)]) Z[key(i, j)] = z; });

  // ── zoning ──
  Z["0,0"] = "hq";
  for(let i = -N; i <= N; i++) Z[key(i, RIVER)] = "river";
  Z[key(5, -5)] = "stadium";
  // Bot Row: every bot's company building, first the ring around HQ, then the next ring out, where the Rug Desk
  // and two neon plazas sit among them
  const team = (bots || []).filter(b => b.id !== "arena"), arenaBot = (bots || []).find(b => b.id === "arena");
  const r2 = ring(2), special = {2:"rugdesk", 6:"plaza", 12:"plaza"};
  r2.forEach((s, k) => { if(special[k]) Z[key(...s)] = special[k]; });
  const spots = [...ring(1), ...r2.filter((_, k) => !special[k])];
  team.forEach((b, k) => { if(spots[k]){ Z[key(...spots[k])] = "bot"; BOTS[key(...spots[k])] = b; } });
  setZ([[3, -2], [-5, 1], [2, 6], [6, 2]], "gas");
  setZ([[-2, -3], [3, 3], [-1, 5], [5, 6]], "cafe");
  const CENTRAL = [[-4, 1], [-3, 1], [-4, 2], [-3, 2]];
  setZ([...CENTRAL, [6, -1], [-6, 3]], "park");
  setZ([[-3, 5]], "ferris");
  for(const [i, j] of blocks){ const k = key(i, j); if(Z[k]) continue; const r = RR(i, j);
    Z[k] = j === 5 ? "pier" : i <= -5 && j <= -5 ? "yard" : i >= 4 && j <= -4 ? (Math.abs(i - 5) + Math.abs(j + 5) === 1 ? "lot" : "shop")
      : r <= 2 ? "tower" : r === 3 ? (rand() < .72 ? "tower" : "shop") : r === 4 ? (rand() < .45 ? "office" : rand() < .5 ? "shop" : "houses")
      : rand() < .86 ? "houses" : rand() < .6 ? "shop" : "park"; }
  const zoneAt = (i, j) => Z[key(i, j)];
  const DISTRICT = (x, z) => { const i = Math.round(x / P), j = Math.round(z / P);
    if(Math.abs(i) > N || Math.abs(j) > N) return "the city limits";
    const zz = zoneAt(i, j), r = RR(i, j);
    if(zz === "river") return "the Neon River"; if(j >= 5) return zz === "pier" || zz === "ferris" ? "the Waterfront" : "South Shore";
    if(i <= -5 && j <= -5) return "the Shipyard"; if(i >= 4 && j <= -4) return "the Arena District";
    if(CENTRAL.some(([a, b]) => a === i && b === j)) return "Central Park";
    if(r <= 2) return "Bot Row (downtown)"; if(r === 3) return "Midtown";
    return i >= 4 ? "Eastside" : i <= -4 ? "Westside" : "Northside"; };

  // block plates (the river row has water instead)
  instanced(unit, new T.MeshStandardMaterial({color:0xffffff, roughness:.9}), blocks.filter(([i, j]) => zoneAt(i, j) !== "river").map(([i, j]) => {
    const z = zoneAt(i, j); return [i * P, 0, j * P, B, .12, B, 0, 0, z === "lot" ? 0x1a1636 : z === "pier" || z === "ferris" ? 0x5a3c2a : z === "yard" ? 0x2a2440 : z === "plaza" ? 0x4a2a6a : 0x2c2468]; }));
  // lane dashes (not over the river), lamp posts and their glow
  const dashes = [], RZ = RIVER * P, onRiver = (x, z) => Math.abs(z - RZ) < B / 2 + .3 && Math.abs(x) <= EXT;
  for(const L of lines) for(let k = -EXT; k <= EXT; k += 1.1){ if(!onRiver(L, k)) dashes.push([L, .01, k, .06, .02, .5]); dashes.push([k, .01, L, .5, .02, .06]); }
  instanced(unit, new T.MeshBasicMaterial({color:0x8a7a3a}), dashes);
  const lamps = [], lampGlow = [];
  for(const x of lines) for(const z of lines){ if(onRiver(x + .8, z + .8)) continue; lamps.push([x + .8, 0, z + .8, .05, 1.1, .05]); lampGlow.push([x + .8, 1.15, z + .8]); }
  instanced(unit, new T.MeshStandardMaterial({color:0x3a3560}), lamps);
  points(lampGlow, 0xffd88a, 1.3);

  // ── the Neon River, its bridges and boats ──
  const water = new T.Mesh(new T.PlaneGeometry(EXT * 2 + 300, B + .1), new T.MeshBasicMaterial({map:waterTex, color:0x6f8cff}));
  water.rotation.x = -Math.PI / 2; water.position.set(0, .015, RZ); scene.add(water);
  const bridges = [], rails = [];
  for(const x of lines){ bridges.push([x, .015, RZ, P - B + .2, .03, B + .4]); rails.push([x - .66, .03, RZ, .05, .16, B + .4], [x + .66, .03, RZ, .05, .16, B + .4]); }
  instanced(unit, new T.MeshStandardMaterial({color:0x3a3366, roughness:.8}), bridges);
  instanced(unit, new T.MeshStandardMaterial({color:0x8fa0ff, emissive:0x45d4ff, emissiveIntensity:.6}), rails);
  points(lines.flatMap(x => [[x - .66, .3, RZ - B / 2], [x + .66, .3, RZ - B / 2], [x - .66, .3, RZ + B / 2], [x + .66, .3, RZ + B / 2]]), 0x45d4ff, .6);
  const boats = [];
  for(let k = 0; k < 4; k++){ const g = new T.Group(), col = pick([0xffc44d, 0xff4fa3, 0x7dffc2, 0xeef0ff]);
    const hull = new T.Mesh(new T.BoxGeometry(1.4, .22, .5), new T.MeshStandardMaterial({color:0xeef0ff, roughness:.5})); hull.position.y = .1; g.add(hull);
    const cabin = new T.Mesh(new T.BoxGeometry(.6, .26, .36), new T.MeshStandardMaterial({color:col, emissive:col, emissiveIntensity:.5})); cabin.position.set(-.1, .34, 0); g.add(cabin);
    const l = glow(col, .9); l.position.set(.55, .35, 0); g.add(l);
    const dir = k % 2 ? 1 : -1; g.position.set(-EXT + rand() * EXT * 2, 0, RZ + dir * .9); g.rotation.y = dir > 0 ? 0 : Math.PI; scene.add(g);
    boats.push({g, dir, speed:.8 + rand() * .7}); }

  // ── zones ──
  const offices = [], shops = [], awnings = [], houses = [], roofs = [], trees = [], trunks = [], trims = [], redLights = [], warmLights = [];
  const containers = [], sheds = [], parked = [];
  const places = {home:[], office:[], shop:[], cafe:[], gas:[], gasSt:[], park:[], pier:[], yard:[], stadium:[], bot:{}};   // doors citizens walk to
  const door = (x, z) => { let best = null, d = 1e9; for(const lx of lines) for(const lz of lines){ const dd = Math.hypot(lx - x, lz - z); if(dd < d){ d = dd; best = [lx, lz]; } } return best; };
  const pickable = [];   // {obj, kind, id, text}
  const towers = {};
  const NEON = [0xff4fa3, 0x45d4ff, 0xffc44d, 0x7dffc2, 0xb07bff];
  const trim = (x, y, z, w, c) => { for(const d of [-1, 1]){ trims.push([x, y, z + d * w / 2, w + .06, .07, .06, 0, 0, c], [x + d * w / 2, y, z, .06, .07, w + .06, 0, 0, c]); } };   // neon roof outline
  const tree = (x, z, s) => { trees.push([x, .55 * s + .12, z, s, s, s]); trunks.push([x, .12, z, .1, .45 * s, .1]); };
  const registerTower = (id, obj) => { towers[id] = {...obj, state:{}}; };
  for(const [i, j] of blocks){
    const cx = i * P, cz = j * P, z = zoneAt(i, j), r = RR(i, j);
    if(z === "tower" || z === "office"){ const tall = z === "tower", n = tall ? 1 + (rand() < .5) : 1 + Math.floor(rand() * 3);
      for(let k = 0; k < n; k++){ const w = tall ? 1.5 + rand() * .8 : 1.2 + rand() * .9, h = tall ? (r <= 2 ? 6 : 4.5) + rand() * (r <= 2 ? 6.5 : 6) : 2 + rand() * 3.5;
        const ox = n === 1 ? 0 : (k ? 1 : -1) * (B / 2 - w / 2 - .2) * (.6 + rand() * .4), oz = n === 1 ? 0 : (rand() - .5) * (B - w - .4), x = cx + ox, zz = cz + oz;
        offices.push([x, .12, zz, w, h, w, 0, 0, pick([0xffffff, 0xc8d4ff, 0xffe0f0, 0xd0fff0])]);
        let top = .12 + h;
        if(tall && h > 7){ const w2 = w * .62, h2 = h * .3; offices.push([x, top, zz, w2, h2, w2, 0, 0, 0xffffff]); top += h2; trim(x, top, zz, w2, pick(NEON)); }
        else trim(x, top, zz, w, pick(NEON));
        if(tall && rand() < .6) redLights.push([x, top + .35, zz]); }
      places.office.push(door(cx, cz)); }
    else if(z === "shop"){ for(const [ox, oz] of [[-1, -1], [1, 1], [1, -1], [-1, 1]].slice(0, 3 + (rand() < .5))){ const w = 1.4, h = .9 + rand() * .5;
        shops.push([cx + ox, .12, cz + oz, w, h, w * .9]); awnings.push([cx + ox, .12 + h * .55, cz + oz + w * .47, w * .9, .12, .25, 0, 0, pick(NEON)]); }
      places.shop.push(door(cx, cz)); }
    else if(z === "houses"){ for(const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]){ const w = 1.1 + rand() * .3, h = .7 + rand() * .3, ry = pick([0, Math.PI / 2]);
        houses.push([cx + ox, .12, cz + oz, w, h, w, ry, 0, pick([0x6b5bd6, 0x8a6bd0, 0x5a7bd6, 0x9a6b9a])]);
        roofs.push([cx + ox, .12 + h, cz + oz, w * .82, .55, w * .82, Math.PI / 4]); }
      if(r >= 5) for(const [ox, oz] of [[-1.85, -1.85], [1.85, 1.85], [-1.85, 1.85], [1.85, -1.85]]) if(rand() < .55) tree(cx + ox, cz + oz, .5 + rand() * .3);
      places.home.push(door(cx, cz)); }
    else if(z === "park"){ const lawn = new T.Mesh(new T.BoxGeometry(B - .3, .14, B - .3), new T.MeshStandardMaterial({color:0x1f6b4a})); lawn.position.set(cx, .07, cz); scene.add(lawn);
      for(let k = 0; k < 9; k++) tree(cx + (rand() - .5) * 3, cz + (rand() - .5) * 3, .7 + rand() * .5);
      if(i === -3 && j === 1){ const pond = new T.Mesh(new T.CylinderGeometry(1.1, 1.1, .05, 24), new T.MeshBasicMaterial({map:waterTex, color:0x6f8cff}));
        pond.position.set(cx, .16, cz); scene.add(pond); const f = glow(0x9fe8ff, 1.6); f.position.set(cx, .6, cz); scene.add(f); }
      places.park.push(door(cx, cz)); }
    else if(z === "cafe"){ const b = new T.Mesh(unit, new T.MeshStandardMaterial({map:winHome, emissiveMap:winHome, emissive:0xffffff, emissiveIntensity:.8, color:0x5a3a70}));
      b.position.set(cx, .12, cz); b.scale.set(2.6, 1.3, 2); scene.add(b);
      const s = signMesh(sign("CAFÉ", "#ff8fc8"), 1.6, .4); s.position.set(cx, 1.7, cz + 1.02); scene.add(s);
      places.cafe.push(door(cx, cz)); }
    else if(z === "gas"){ const g = new T.Group(); g.position.set(cx, .12, cz); scene.add(g);
      const canopy = new T.Mesh(new T.BoxGeometry(3, .14, 1.8), new T.MeshStandardMaterial({color:0xeef0ff, emissive:0x8899ff, emissiveIntensity:.5})); canopy.position.set(0, 1.25, .6); g.add(canopy);
      const under = new T.Mesh(new T.PlaneGeometry(2.8, 1.6), new T.MeshBasicMaterial({color:0xfff2c0, transparent:true, opacity:.25})); under.rotation.x = -Math.PI / 2; under.position.set(0, .02, .6); g.add(under);
      for(const [x, z2] of [[-1.3, -.1], [1.3, -.1], [-1.3, 1.3], [1.3, 1.3]]){ const p = new T.Mesh(new T.BoxGeometry(.08, 1.25, .08), new T.MeshStandardMaterial({color:0xbfc4e8})); p.position.set(x, .62, z2); g.add(p); }
      for(const x of [-.6, .6]){ const pump = new T.Mesh(new T.BoxGeometry(.25, .5, .2), new T.MeshStandardMaterial({color:0xff4f7d, emissive:0xff4f7d, emissiveIntensity:.5})); pump.position.set(x, .25, .6); g.add(pump); }
      const store = new T.Mesh(unit, new T.MeshStandardMaterial({map:winHome, emissiveMap:winHome, emissive:0xffffff, emissiveIntensity:.7, color:0x44406a})); store.position.set(0, 0, -1.2); store.scale.set(2.4, 1, 1.1); g.add(store);
      const s = signMesh(sign("GAS ⛽", "#7dffc2"), 1.4, .38); s.position.set(-1.6, 2.1, 1.6); g.add(s);
      const pole = new T.Mesh(new T.BoxGeometry(.06, 1.9, .06), new T.MeshStandardMaterial({color:0x8a85b0})); pole.position.set(-1.6, .95, 1.6); g.add(pole);
      places.gas.push(door(cx, cz)); places.gasSt.push({node:door(cx + 2, cz + 2), pumps:[[cx - .6, cz + 1.1], [cx + .6, cz + 1.1]]}); }
    else if(z === "pier" || z === "ferris"){
      for(let k = -1.6; k <= 1.6; k += .8) warmLights.push([cx + k, .5, cz - B / 2 + .1], [cx + k, .5, cz + B / 2 - .1]);
      if(z === "pier") for(const ox of [-1, 1]){ shops.push([cx + ox, .12, cz + .4, 1.2, .8, 1]); awnings.push([cx + ox, .62, cz - .12, 1.1, .1, .25, 0, 0, pick(NEON)]); }
      places.pier.push(door(cx, cz)); }
    else if(z === "yard"){
      for(let k = 0; k < 2; k++) sheds.push([cx + (k ? 1 : -1) * .95, .12, cz - .9, 1.6, .9 + rand() * .4, 1.8, 0, 0, pick([0x6b5a8a, 0x5a6b8a, 0x8a5a6b])]);
      for(let a = 0; a < 4; a++) for(let b = 0; b < 2; b++) for(let h = 0; h < 1 + Math.floor(rand() * 3); h++)
        containers.push([cx - 1.5 + a * .85, .12 + h * .34, cz + .7 + b * .55, .78, .32, .45, 0, 0, pick([0xff4f7d, 0x45d4ff, 0xffc44d, 0x7dffc2, 0xff8a3d, 0xb07bff])]);
      if((i + j) % 2 === 0){ const g = new T.Group(); g.position.set(cx + 1.6, .12, cz + 1.4); scene.add(g);
        const mat = new T.MeshStandardMaterial({color:0xffc44d, emissive:0x553300, emissiveIntensity:.5});
        const mast = new T.Mesh(new T.BoxGeometry(.18, 4.2, .18), mat); mast.position.y = 2.1; g.add(mast);
        const boom = new T.Mesh(new T.BoxGeometry(3.4, .14, .14), mat); boom.position.set(-1.2, 4.1, 0); g.add(boom);
        const cable = new T.Mesh(new T.BoxGeometry(.02, 2.2, .02), new T.MeshBasicMaterial({color:0xccccdd})); cable.position.set(-2.4, 3, 0); g.add(cable);
        redLights.push([cx + 1.6, 4.5, cz + 1.4]); }
      places.yard.push(door(cx, cz)); }
    else if(z === "lot"){ for(let a = 0; a < 5; a++) for(let b = 0; b < 3; b++) if(rand() < .7)
        parked.push([cx - 1.6 + a * .8, .12, cz - 1.2 + b * 1.2, 1, 1, 1, Math.PI / 2, 0, pick([0xff4f7d, 0x45d4ff, 0xffc44d, 0xeef0ff, 0x7dffc2, 0xb07bff])]);
      warmLights.push([cx, 2.2, cz]); }
    else if(z === "plaza"){
      for(const [ox, oz] of [[-1.4, -1.4], [1.4, 1.4], [-1.4, 1.4], [1.4, -1.4]]) tree(cx + ox, cz + oz, .55);
      places.shop.push(door(cx, cz)); }
  }
  const offMat = new T.MeshStandardMaterial({map:winOffice, emissiveMap:winOffice, emissive:0xffffff, emissiveIntensity:.85, color:0x2a2470, roughness:.8});
  instanced(unit, offMat, offices);
  instanced(unit, new T.MeshBasicMaterial({color:0xffffff}), trims);
  instanced(unit, new T.MeshStandardMaterial({map:winHome, emissiveMap:winHome, emissive:0xffffff, emissiveIntensity:.8, color:0x3d3570}), shops);
  instanced(unit, new T.MeshBasicMaterial({color:0xffffff}), awnings);
  instanced(unit, new T.MeshStandardMaterial({map:winHome, emissiveMap:winHome, emissive:0xffffff, emissiveIntensity:.7, color:0xffffff}), houses);
  { const roofGeo = new T.ConeGeometry(.75, 1, 4); roofGeo.translate(0, .5, 0); instanced(roofGeo, new T.MeshStandardMaterial({color:0x2a1f55, roughness:.9}), roofs); }
  instanced(new T.ConeGeometry(.45, 1.1, 7), new T.MeshStandardMaterial({color:0x2fa86a, emissive:0x0f3a24}), trees);
  instanced(unit, new T.MeshStandardMaterial({color:0x5a4030}), trunks);
  instanced(unit, new T.MeshStandardMaterial({color:0xffffff, roughness:.7}), containers);
  instanced(unit, new T.MeshStandardMaterial({color:0xffffff, roughness:.9}), sheds);
  const red = points(redLights, 0xff3d6e, .9), warm = points(warmLights, 0xffd88a, .55);
  { const pb = new T.BoxGeometry(.7, .22, .38); pb.translate(0, .2, 0); instanced(pb, new T.MeshStandardMaterial({color:0xffffff, metalness:.4, roughness:.4}), parked); }

  // ── bot company buildings ──
  for(const [k, bot] of Object.entries(BOTS)){ const [i, j] = k.split(",").map(Number), cx = i * P, cz = j * P;
    const id = bot.id, col = new T.Color(bot.css).getHex(), H = (RR(i, j) === 1 ? 6.2 : 4.6) + rand() * 2.6;
    const g = new T.Group(); g.position.set(cx, .12, cz); scene.add(g);
    const mat = new T.MeshStandardMaterial({map:winOffice, emissiveMap:winOffice, emissive:col, emissiveIntensity:1.4, color:0x1c1850, roughness:.6});
    let y = 0; const parts = [];
    for(const [w, f] of [[2, .55], [1.45, .3], [.9, .15]]){ const m = new T.Mesh(unit, mat); m.scale.set(w, H * f, w); m.position.y = y; g.add(m); parts.push(m); y += H * f; }
    const tip = glow(col, 1.4); tip.position.y = y + .2; g.add(tip);
    const rg = new T.Mesh(new T.TorusGeometry(1.6, .05, 8, 56), new T.MeshBasicMaterial({color:col, transparent:true, opacity:.9})); rg.rotation.x = Math.PI / 2; rg.position.y = .05; g.add(rg);
    const beam = new T.Mesh(new T.CylinderGeometry(.14, .14, 40, 12, 1, true), new T.MeshBasicMaterial({color:0xffd56b, transparent:true, opacity:0, blending:T.AdditiveBlending, depthWrite:false})); beam.position.y = 20; g.add(beam);
    registerTower(id, {id, mat, tip, ring:rg, beam, top:new T.Vector3(cx, y + 1, cz), x:cx, z:cz, col:bot.css});
    for(const m of parts) pickable.push({obj:m, kind:"tower", id});
    places.bot[id] = door(cx, cz); }

  // ── the Rug Desk: the security office every coin has to get past; its searchlight turns red when it rejects one ──
  let searchlight = null;
  for(const [k, z] of Object.entries(Z)) if(z === "rugdesk"){ const [i, j] = k.split(",").map(Number), cx = i * P, cz = j * P;
    const g = new T.Group(); g.position.set(cx, .12, cz); scene.add(g);
    const mat = new T.MeshStandardMaterial({map:winDesk, emissiveMap:winDesk, emissive:0x3ee6a2, emissiveIntensity:1.2, color:0x14302a, roughness:.6});
    const body = new T.Mesh(unit, mat); body.scale.set(2.8, 2.6, 2.4); g.add(body);
    const top = new T.Mesh(unit, mat); top.scale.set(1.2, .9, 1.2); top.position.y = 2.6; g.add(top);
    const s = signMesh(sign("RUG DESK 🛡", "#7dffc2", 320, 64), 2.4, .48); s.position.set(0, 2, 1.22); g.add(s);
    const s2 = s.clone(); s2.position.set(0, 2, -1.22); g.add(s2);
    searchlight = new T.Mesh(new T.ConeGeometry(1.4, 9, 20, 1, true), new T.MeshBasicMaterial({color:0x7dffc2, transparent:true, opacity:.16, blending:T.AdditiveBlending, depthWrite:false, side:T.DoubleSide}));
    searchlight.geometry.translate(0, -4.5, 0); searchlight.position.y = 3.6; searchlight.rotation.z = 2.3; const pivot = new T.Group(); pivot.add(searchlight); g.add(pivot); searchlight.userData.pivot = pivot;
    const tip = glow(0x7dffc2, 1.3); tip.position.y = 3.8; g.add(tip);
    const rg = new T.Mesh(new T.TorusGeometry(1.9, .05, 8, 56), new T.MeshBasicMaterial({color:0x7dffc2, transparent:true, opacity:.9})); rg.rotation.x = Math.PI / 2; rg.position.y = .05; g.add(rg);
    const beam = new T.Mesh(new T.CylinderGeometry(.14, .14, 40, 12, 1, true), new T.MeshBasicMaterial({color:0xffd56b, transparent:true, opacity:0, blending:T.AdditiveBlending, depthWrite:false})); beam.position.y = 20; g.add(beam);
    registerTower("rugdesk", {id:"rugdesk", mat, tip, ring:rg, beam, top:new T.Vector3(cx, 4.4, cz), x:cx, z:cz, col:"#7dffc2"});
    for(const m of [body, top]) pickable.push({obj:m, kind:"tower", id:"rugdesk"});
    places.bot.rugdesk = door(cx, cz); }

  // ── the stadium: the Arena bot's home ──
  { const cx = 5 * P, cz = -5 * P, col = new T.Color(arenaBot ? arenaBot.css : "#b07bff").getHex();
    const g = new T.Group(); g.position.set(cx, .12, cz); scene.add(g);
    const mat = new T.MeshStandardMaterial({color:0x2a2160, emissive:col, emissiveIntensity:1.2, roughness:.6, side:T.DoubleSide});
    const bowl = new T.Mesh(new T.CylinderGeometry(1.95, 1.6, 1.2, 36, 1, true), mat); bowl.position.y = .6; bowl.scale.z = .8; g.add(bowl);
    const field = new T.Mesh(new T.CircleGeometry(1.55, 36), new T.MeshStandardMaterial({color:0x1f8a54, emissive:0x0f3a24})); field.rotation.x = -Math.PI / 2; field.scale.y = .8; field.position.y = .05; g.add(field);
    const rim = new T.Mesh(new T.TorusGeometry(1.95, .07, 8, 48), new T.MeshBasicMaterial({color:col})); rim.rotation.x = Math.PI / 2; rim.scale.y = .8; rim.position.y = 1.2; g.add(rim);
    for(const [x, z] of [[-1.9, -1.5], [1.9, -1.5], [-1.9, 1.5], [1.9, 1.5]]){ const m = new T.Mesh(new T.BoxGeometry(.08, 2.6, .08), new T.MeshStandardMaterial({color:0x8a85b0})); m.position.set(x, 1.3, z); g.add(m);
      const l = glow(0xffffff, 1.2); l.position.set(x, 2.65, z); g.add(l); }
    const s = signMesh(sign("BOT ARENA", "#d0a8ff"), 1.8, .45); s.position.set(0, 1.55, 1.7); g.add(s);
    const tip = glow(col, 1.6); tip.position.y = 3.3; g.add(tip);
    const rg = new T.Mesh(new T.TorusGeometry(2.3, .05, 8, 56), new T.MeshBasicMaterial({color:col, transparent:true, opacity:.9})); rg.rotation.x = Math.PI / 2; rg.position.y = .05; g.add(rg);
    const beam = new T.Mesh(new T.CylinderGeometry(.14, .14, 40, 12, 1, true), new T.MeshBasicMaterial({color:0xffd56b, transparent:true, opacity:0, blending:T.AdditiveBlending, depthWrite:false})); beam.position.y = 20; g.add(beam);
    registerTower("arena", {id:"arena", mat, tip, ring:rg, beam, top:new T.Vector3(cx, 3.6, cz), x:cx, z:cz, col:arenaBot ? arenaBot.css : "#b07bff"});
    for(const m of [bowl, field]) pickable.push({obj:m, kind:"tower", id:"arena"});
    places.stadium.push(door(cx, cz)); places.bot.arena = door(cx, cz); }

  // ── the Ferris wheel on the Waterfront ──
  const wheel = new T.Group();
  { const cx = -3 * P, cz = 5 * P, g = new T.Group(); g.position.set(cx, .12, cz); scene.add(g);
    for(const z of [-.45, .45]) for(const x of [-1, 1]){ const leg = new T.Mesh(new T.BoxGeometry(.1, 3.4, .1), new T.MeshStandardMaterial({color:0xbfc4e8})); leg.position.set(x * .7, 1.6, z); leg.rotation.z = x * .2; g.add(leg); }
    wheel.position.y = 3.1; g.add(wheel);
    for(const [r2_, c] of [[2.5, 0xff4fa3], [2.3, 0x45d4ff]]){ const t = new T.Mesh(new T.TorusGeometry(r2_, .05, 8, 64), new T.MeshBasicMaterial({color:c})); wheel.add(t); }
    for(let k = 0; k < 12; k++){ const a = k / 12 * Math.PI * 2;
      const sp = new T.Mesh(new T.BoxGeometry(.03, 2.5, .03), new T.MeshBasicMaterial({color:0xffc44d})); sp.rotation.z = a; sp.position.set(Math.sin(-a) * 1.25, Math.cos(-a) * 1.25, 0); wheel.add(sp);
      const cab = new T.Mesh(new T.BoxGeometry(.32, .3, .32), new T.MeshStandardMaterial({color:pick(NEON), emissive:pick(NEON), emissiveIntensity:.6})); cab.position.set(Math.cos(a) * 2.5, Math.sin(a) * 2.5 - .2, 0); wheel.add(cab); cab.userData.cab = true; }
    const hub = glow(0xffffff, 1); wheel.add(hub);
    pickable.push({obj:wheel.children[0], kind:"landmark", text:"<b>The Neon Wheel</b> on the Waterfront · where the bots go on their day off"}); }

  // ── neon plazas: giant billboards with the team's live numbers ──
  const board = canvasTex(512, 256, g => { g.fillStyle = "#07051c"; g.fillRect(0, 0, 512, 256); });
  for(const [k, z] of Object.entries(Z)) if(z === "plaza"){ const [i, j] = k.split(",").map(Number), cx = i * P, cz = j * P, ry = Math.atan2(-cx, -cz);
    const g = new T.Group(); g.position.set(cx, .12, cz); g.rotation.y = ry; scene.add(g);
    const scr = new T.Mesh(new T.PlaneGeometry(3.4, 1.7), new T.MeshBasicMaterial({map:board, side:T.DoubleSide})); scr.position.y = 2.9; g.add(scr);
    const frame = new T.Mesh(new T.BoxGeometry(3.6, 1.9, .08), new T.MeshStandardMaterial({color:0x101026})); frame.position.set(0, 2.9, -.06); g.add(frame);
    for(const x of [-1.2, 1.2]){ const p = new T.Mesh(new T.BoxGeometry(.12, 2, .12), new T.MeshStandardMaterial({color:0x5a5580})); p.position.set(x, 1, -.06); g.add(p); }
    const l = glow(0xff4fa3, 4); l.position.set(0, 2.9, .3); l.material.opacity = .25; g.add(l);
    pickable.push({obj:scr, kind:"landmark", text:"<b>Neon Square</b> · the big screen shows the bot team live"}); }

  // ── HQ tower with the boss's glass penthouse ──
  const HQ_H = 16, HQ = new T.Group(); scene.add(HQ);
  const hqMat = new T.MeshStandardMaterial({map:winHQ, emissiveMap:winHQ, emissive:0xbfefff, emissiveIntensity:1.1, color:0x1a2a5a, roughness:.4});
  const hqBody = new T.Mesh(unit, hqMat); hqBody.scale.set(3.2, HQ_H, 3.2); hqBody.position.y = .12; HQ.add(hqBody);
  const OY = HQ_H + .12;   // office floor
  const glass = new T.Mesh(new T.BoxGeometry(3.6, 2.1, 3.6), new T.MeshStandardMaterial({color:0x7fd8ff, transparent:true, opacity:.12, roughness:.1, depthWrite:false}));
  glass.position.y = OY + 1.05; HQ.add(glass);
  const hqFrame = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(3.6, 2.1, 3.6)), new T.LineBasicMaterial({color:0x45d4ff})); hqFrame.position.y = OY + 1.05; HQ.add(hqFrame);
  const floor = new T.Mesh(new T.BoxGeometry(3.6, .1, 3.6), new T.MeshStandardMaterial({color:0x2a2340})); floor.position.y = OY; HQ.add(floor);
  const roof = new T.Mesh(new T.BoxGeometry(3.8, .18, 3.8), new T.MeshStandardMaterial({color:0x221b44, emissive:0x45d4ff, emissiveIntensity:.05, roughness:1})); roof.position.y = OY + 2.18; HQ.add(roof);
  const antenna = new T.Mesh(new T.CylinderGeometry(.04, .06, 2.4), new T.MeshStandardMaterial({color:0xccd2ff})); antenna.position.y = OY + 3.4; HQ.add(antenna);
  const beacon = glow(0xff4f7d, 1.2); beacon.position.y = OY + 4.7; HQ.add(beacon);
  for(const [x, z, ry] of [[0, 1.91, 0], [0, -1.91, Math.PI], [1.91, 0, Math.PI / 2], [-1.91, 0, -Math.PI / 2]]){
    const s = signMesh(sign("HQ", "#45d4ff", 128, 64), 1.3, .65); s.position.set(x, OY + 2.75, z); s.rotation.y = ry; HQ.add(s); }
  const officeLight = new T.PointLight(0xffe2b0, 6, 6, 1.5); officeLight.position.set(0, OY + 1.8, .2); HQ.add(officeLight);
  // back wall of monitors (they face +z, toward the boss and the camera)
  const screens = [];
  const backWall = new T.Mesh(new T.BoxGeometry(3.5, 2, .08), new T.MeshStandardMaterial({color:0x14112e})); backWall.position.set(0, OY + 1.05, -1.72); HQ.add(backWall);
  const SW = 320, SH = 200, layout = [[-1.08, 1.45], [0, 1.45], [1.08, 1.45], [-.54, .82], [.54, .82]];
  for(const [x, y] of layout){ const tex = canvasTex(SW, SH, g => { g.fillStyle = "#06101e"; g.fillRect(0, 0, SW, SH); });
    const m = new T.Mesh(new T.PlaneGeometry(1, .62), new T.MeshBasicMaterial({map:tex})); m.position.set(x, OY + y, -1.66); HQ.add(m);
    const bezel = new T.Mesh(new T.BoxGeometry(1.06, .68, .04), new T.MeshStandardMaterial({color:0x0a0a14})); bezel.position.set(x, OY + y, -1.69); HQ.add(bezel);
    screens.push(tex); }
  // desk, chair and the boss (a robot in a suit), seated with his back to us, watching the screens
  const desk = new T.Mesh(new T.BoxGeometry(2.4, .08, .7), new T.MeshStandardMaterial({color:0x3a2a1a, roughness:.5})); desk.position.set(0, OY + .72, -1.05); HQ.add(desk);
  for(const x of [-1.1, 1.1]){ const leg = new T.Mesh(new T.BoxGeometry(.06, .72, .6), new T.MeshStandardMaterial({color:0x2a1f12})); leg.position.set(x, OY + .36, -1.05); HQ.add(leg); }
  const kb = new T.Mesh(new T.BoxGeometry(.5, .02, .16), new T.MeshStandardMaterial({color:0x222233, emissive:0x45d4ff, emissiveIntensity:.3})); kb.position.set(0, OY + .77, -.92); HQ.add(kb);
  const chair = new T.Mesh(new T.BoxGeometry(.56, .42, .08), new T.MeshStandardMaterial({color:0x1a1a2a})); chair.position.set(0, OY + .74, -.12); HQ.add(chair);
  const seat = new T.Mesh(new T.BoxGeometry(.6, .08, .55), new T.MeshStandardMaterial({color:0x1a1a2a})); seat.position.set(0, OY + .5, -.4); HQ.add(seat);
  const boss = new T.Group(); boss.position.set(0, OY + .54, -.42); HQ.add(boss);
  const suit = new T.MeshStandardMaterial({color:0x1d2233, roughness:.5});
  const torso = new T.Mesh(new T.BoxGeometry(.5, .6, .28), suit); torso.position.y = .42; boss.add(torso);
  const tie = new T.Mesh(new T.BoxGeometry(.06, .3, .02), new T.MeshStandardMaterial({color:0xff4f7d, emissive:0x661020})); tie.position.set(0, .45, -.15); boss.add(tie);
  const head = new T.Group(); head.position.y = .9; boss.add(head);
  const skull = new T.Mesh(new T.BoxGeometry(.32, .32, .32), new T.MeshStandardMaterial({color:0xb8bfd8, metalness:.6, roughness:.3})); head.add(skull);
  const visor = new T.Mesh(new T.BoxGeometry(.26, .08, .02), new T.MeshBasicMaterial({color:0x45d4ff})); visor.position.set(0, .03, -.17); head.add(visor);
  const armL = new T.Mesh(new T.BoxGeometry(.12, .12, .5), suit), armR = armL.clone();
  armL.position.set(-.3, .38, -.3); armR.position.set(.3, .38, -.3); boss.add(armL, armR);
  pickable.push({obj:hqBody, kind:"hq"}, {obj:glass, kind:"hq"}, {obj:torso, kind:"hq"});
  places.hq = door(0, 0);

  // ── sky: stars, the moon, mountains on the horizon and the blimp ──
  { const st = []; for(let k = 0; k < 700; k++){ const a = rand() * Math.PI * 2, e = .12 + rand() * 1.2, r = 200; st.push([Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r]); }
    points(st, 0xffffff, 1.6, false, {fog:false, blending:T.NormalBlending, opacity:.8});
    const moon = glow(0xe8ecff, 26); moon.material.fog = false; moon.position.set(-110, 80, -140); scene.add(moon);
    const peaks = []; for(let k = 0; k < 46; k++){ const a = k / 46 * Math.PI * 2 + rand() * .1, r = 85 + rand() * 30, h = 12 + rand() * 22;
      peaks.push([Math.cos(a) * r, 0, Math.sin(a) * r, 10 + rand() * 14, h, 10 + rand() * 14, rand() * 3]); }
    const cone = new T.ConeGeometry(1, 1, 5); cone.translate(0, .5, 0);
    instanced(cone, new T.MeshStandardMaterial({color:0x22195e, roughness:1, flatShading:true}), peaks); }
  const blimp = new T.Group(); scene.add(blimp);
  { const body = new T.Mesh(new T.SphereGeometry(1, 20, 14), new T.MeshStandardMaterial({color:0xc8ccf0, emissive:0x3a3870, roughness:.4})); body.scale.set(3.4, 1.05, 1.05); blimp.add(body);
    for(const z of [1.07, -1.07]){ const s = signMesh(sign("TURN SPOTTER", "#ffc44d", 384, 64), 4, .66); s.position.set(0, 0, z); if(z < 0) s.rotation.y = Math.PI; blimp.add(s); }
    const gond = new T.Mesh(new T.BoxGeometry(1, .3, .4), new T.MeshStandardMaterial({color:0x222244, emissive:0x45d4ff, emissiveIntensity:.4})); gond.position.y = -1.1; blimp.add(gond);
    for(const [y, z] of [[.8, 0], [0, .8], [0, -.8]]){ const fin = new T.Mesh(new T.BoxGeometry(.8, y ? .8 : .05, z ? .8 : .05), new T.MeshStandardMaterial({color:0xff4fa3})); fin.position.set(-3.1, y * .6, z * .6); blimp.add(fin); }
    const l = glow(0xff3d6e, 1); l.position.set(-3.5, 0, 0); blimp.add(l); blimp.userData.light = l;
    pickable.push({obj:body, kind:"landmark", text:"<b>The Turn Spotter blimp</b> · circling the city day and night"}); }

  // ── AI citizens ──
  const NODES = lines;   // walk and drive on the same grid of intersections
  const idx = v => NODES.indexOf(v);
  const routeTo = (from, to) => {   // Manhattan path between intersections: along x first, then z
    const path = []; let [x, z] = from; const [tx, tz] = to;
    while(x !== tx){ x = NODES[idx(x) + Math.sign(idx(tx) - idx(x))]; path.push([x, z]); }
    while(z !== tz){ z = NODES[idx(z) + Math.sign(idx(tz) - idx(z))]; path.push([x, z]); }
    return path; };
  const JOBS = [...team.flatMap(b => [[b.id, `${b.name} rug-checker`], [b.id, `${b.name} trader`]]),
    ["rugdesk", "Rug Desk inspector"], ["rugdesk", "Rug Desk inspector"], ["arena", "Arena referee"],
    ["office", "office worker"], ["office", "office worker"], ["cafe", "barista"], ["shop", "shopkeeper"], ["gas", "gas station clerk"], ["hq", "HQ assistant"],
    ["yard", "dock worker"], ["pier", "Ferris wheel operator"], ["park", "park ranger"]];
  const NAMES = ["Nova", "Echo", "Pixel", "Byte", "Juno", "Atlas", "Iris", "Kai", "Luma", "Orion", "Vega", "Zed", "Rio", "Sky", "Neo", "Ada", "Cyra", "Dex", "Halo", "Mako"];
  const doorOf = k => k === "hq" ? places.hq : places.bot[k] || pick(places[k].length ? places[k] : places.office);
  const NP = 260, people = [];
  for(let k = 0; k < NP; k++){ const [jobKey, jobName] = pick(JOBS), home = pick(places.home);
    people.push({name:`${pick(NAMES)}-${10 + k}`, job:jobName, jobDoor:doorOf(jobKey), home, at:home.slice(), path:[], goal:"work", wait:rand() * 6,
      speed:.9 + rand() * .5, side:rand() < .5 ? -1 : 1, x:home[0], z:home[1], doing:"at home"}); }
  const bodyGeo = new T.CylinderGeometry(.09, .12, .42, 8); bodyGeo.translate(0, .33, 0);
  const headGeo = new T.SphereGeometry(.085, 10, 8); headGeo.translate(0, .64, 0);
  const pBody = new T.InstancedMesh(bodyGeo, new T.MeshStandardMaterial({color:0xffffff, roughness:.6}), NP);
  const pHead = new T.InstancedMesh(headGeo, new T.MeshBasicMaterial({color:0xffffff}), NP);
  people.forEach((p, i) => { pBody.setColorAt(i, new T.Color(pick([0x45d4ff, 0xff4fa3, 0xffc44d, 0x7dffc2, 0xb07bff]))); pHead.setColorAt(i, new T.Color(pick([0x9fe8ff, 0xffffff, 0xffd0f0]))); });
  scene.add(pBody, pHead); pickable.push({obj:pBody, kind:"person"});
  const ERRANDS = ["gas", "cafe", "shop", "park", "pier", "stadium"];
  const nextGoal = p => {
    const plan = {work:["errand", () => pick(places[pick(ERRANDS)])], errand:["home", () => p.home], home:["work", () => p.jobDoor]};
    const [g, dest] = plan[p.goal]; p.goal = g; p.path = routeTo(p.at, dest());
    p.doing = g === "work" ? `walking to work (${p.job})` : g === "errand" ? "heading out on an errand" : "walking home"; };
  const stepPeople = dt => {
    for(let i = 0; i < NP; i++){ const p = people[i]; let hidden = false;
      if(p.wait > 0){ p.wait -= dt; hidden = true; if(p.wait <= 0) nextGoal(p); }
      else if(p.path.length){ const [tx, tz] = p.path[0], dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz), s = p.speed * dt;
        if(d <= s){ p.x = tx; p.z = tz; p.at = [tx, tz]; p.path.shift(); }
        else { p.x += dx / d * s; p.z += dz / d * s; p.dir = Math.atan2(dx, dz); } }
      else { p.wait = 5 + rand() * 9; p.doing = p.goal === "work" ? `at work: ${p.job}` : p.goal === "errand" ? "running an errand" : "at home"; hidden = true; }
      // walk on the sidewalk: offset to one side of the road, perpendicular to the way they're heading
      const ox = Math.cos(p.dir || 0) * .78 * p.side, oz = -Math.sin(p.dir || 0) * .78 * p.side, bob = hidden ? 0 : Math.abs(Math.sin(t * 8 + i)) * .04;
      const sc = hidden ? .0001 : 1;
      place(pBody, i, p.x + ox, .12 + bob, p.z + oz, sc, sc, sc, p.dir || 0); place(pHead, i, p.x + ox, .12 + bob, p.z + oz, sc, sc, sc);
      p.px = p.x + ox; p.pz = p.z + oz; p.vis = !hidden;
    }
    pBody.instanceMatrix.needsUpdate = pHead.instanceMatrix.needsUpdate = true; };
  people.forEach(p => { p.wait = rand() * 4; });

  // ── traffic ──
  const NC = 72, cars = [];
  const carBody = new T.BoxGeometry(.8, .26, .42); carBody.translate(0, .25, 0);
  const carTop = new T.BoxGeometry(.42, .2, .38); carTop.translate(-.05, .48, 0);
  const lightGeo = new T.BoxGeometry(.04, .07, .32); lightGeo.translate(.41, .26, 0);
  const cBody = new T.InstancedMesh(carBody, new T.MeshStandardMaterial({color:0xffffff, metalness:.4, roughness:.4}), NC);
  const cTop = new T.InstancedMesh(carTop, new T.MeshStandardMaterial({color:0x111428, roughness:.2}), NC);
  const cLight = new T.InstancedMesh(lightGeo, new T.MeshBasicMaterial({color:0xfff2c0}), NC);
  scene.add(cBody, cTop, cLight); pickable.push({obj:cBody, kind:"car"});
  const neighbours = ([x, z]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [NODES[idx(x) + a], NODES[idx(z) + b]]).filter(([a, b]) => a !== undefined && b !== undefined);
  const MODELS = ["hatchback", "coupe", "taxi", "van", "sports car", "pickup"];
  for(let k = 0; k < NC; k++){ const at = [pick(NODES), pick(NODES)];
    cars.push({at, to:pick(neighbours(at)), x:at[0], z:at[1], speed:2.2 + rand() * 1.6, mode:"drive", owner:`${pick(NAMES)}-${100 + k}`, model:pick(MODELS)});
    cBody.setColorAt(k, new T.Color(pick([0xff4f7d, 0x45d4ff, 0xffc44d, 0xeef0ff, 0x7dffc2, 0xb07bff]))); }
  const stepCars = dt => {
    for(let i = 0; i < NC; i++){ const c = cars[i];
      if(c.mode === "drive"){ const [tx, tz] = c.to, dx = tx - c.x, dz = tz - c.z, d = Math.hypot(dx, dz), s = c.speed * dt;
        c.dir = Math.atan2(dx, dz);
        if(d <= s){ c.x = tx; c.z = tz; const prev = c.at; c.at = c.to;
          const st = places.gasSt.find(g => g.node[0] === c.at[0] && g.node[1] === c.at[1]);
          if(st && rand() < .35 && !cars.some(o => o !== c && o.mode !== "drive" && o.st === st)){ c.mode = "toPump"; c.st = st; c.pump = pick(st.pumps); c.t0 = 0; }
          else { const opts = neighbours(c.at).filter(n => n[0] !== prev[0] || n[1] !== prev[1]); c.to = pick(opts.length ? opts : neighbours(c.at)); } }
        else { c.x += dx / d * s; c.z += dz / d * s; } }
      else if(c.mode === "toPump" || c.mode === "fromPump"){ c.t0 += dt / 1.6; const k = Math.min(1, c.t0);
        const [ax, az] = c.mode === "toPump" ? c.at : c.pump, [bx, bz] = c.mode === "toPump" ? c.pump : c.at;
        c.x = ax + (bx - ax) * k; c.z = az + (bz - az) * k; c.dir = Math.atan2(bx - ax, bz - az);
        if(k >= 1){ if(c.mode === "toPump"){ c.mode = "fuel"; c.t0 = 0; } else { c.mode = "drive"; c.st = null; c.to = pick(neighbours(c.at)); } } }
      else if(c.mode === "fuel"){ c.t0 += dt; if(c.t0 > 4){ c.mode = "fromPump"; c.t0 = 0; } }
      // drive on the right: offset from the centre line
      const ox = c.mode === "drive" ? -Math.cos(c.dir) * .33 : 0, oz = c.mode === "drive" ? Math.sin(c.dir) * .33 : 0, ry = c.dir - Math.PI / 2;
      for(const m of [cBody, cTop, cLight]) place(m, i, c.x + ox, .02, c.z + oz, 1, 1, 1, ry);
      c.px = c.x + ox; c.pz = c.z + oz;
    }
    cBody.instanceMatrix.needsUpdate = cTop.instanceMatrix.needsUpdate = cLight.instanceMatrix.needsUpdate = true; };
  const personText = p => `<b>${p.name}</b> · AI ${p.job} · ${p.doing}`;
  const carText = c => `<b>${c.owner}'s ${c.model}</b> · ${c.mode === "drive" ? `driving through ${DISTRICT(c.x, c.z)}` : "filling up at the gas station"}`;

  // ── your car: drive anywhere on the roads (arrow keys / WASD, or the on-screen pedals) ──
  const me = new T.Group(); me.visible = false; scene.add(me);
  { const body = new T.Mesh(new T.BoxGeometry(.95, .3, .5), new T.MeshStandardMaterial({color:0xffc44d, metalness:.5, roughness:.3, emissive:0xffa000, emissiveIntensity:.45})); body.position.y = .28; me.add(body);
    const top = new T.Mesh(new T.BoxGeometry(.5, .22, .44), new T.MeshStandardMaterial({color:0x111428, roughness:.2})); top.position.set(-.06, .54, 0); me.add(top);
    const hl = new T.Mesh(new T.BoxGeometry(.04, .08, .42), new T.MeshBasicMaterial({color:0xffffff})); hl.position.set(.48, .3, 0); me.add(hl);
    const tl = new T.Mesh(new T.BoxGeometry(.04, .08, .42), new T.MeshBasicMaterial({color:0xff2a55})); tl.position.set(-.48, .3, 0); me.add(tl);
    const under = glow(0x45d4ff, 1.3); under.material.opacity = .55; under.position.y = .04; me.add(under); }
  const drv = {x:0, z:0, h:0, v:0, input:{}, lastFuel:0};
  const keys = new Set();
  const blocked = (x, z) => {
    if(Math.abs(x) > EXT + .45 || Math.abs(z) > EXT + .45) return true;
    const i = Math.round(x / P), j = Math.round(z / P); if(Math.abs(i) > N || Math.abs(j) > N) return false;
    const lx = x - i * P, lz = z - j * P, zz = zoneAt(i, j);
    if(Math.abs(lx) >= B / 2 + .25 || Math.abs(lz) >= B / 2 + .25) return false;   // on a road (bridges included)
    if(zz === "gas") return lz < -.5;   // drive in under the canopy, not into the store
    if(zz === "lot" || zz === "plaza") return Math.abs(lx) > B / 2 - .3 && Math.abs(lz) > B / 2 - .3;   // parking lots and plazas: drive around
    return true; };
  const stepDrive = dt => {
    const k = drv.input, up = k.up || keys.has("ArrowUp") || keys.has("KeyW"), down = k.down || keys.has("ArrowDown") || keys.has("KeyS");
    const left = k.left || keys.has("ArrowLeft") || keys.has("KeyA"), right = k.right || keys.has("ArrowRight") || keys.has("KeyD");
    if(up) drv.v = Math.min(11, drv.v + (drv.v < 0 ? 16 : 7) * dt);
    else if(down) drv.v = Math.max(-4, drv.v - (drv.v > 0 ? 16 : 6) * dt);
    else drv.v *= Math.max(0, 1 - 1.4 * dt);
    const steer = (left ? 1 : 0) - (right ? 1 : 0);
    drv.h += steer * 2.1 * dt * Math.max(-1, Math.min(1, drv.v / 3));
    const nx = drv.x + Math.sin(drv.h) * drv.v * dt, nz = drv.z + Math.cos(drv.h) * drv.v * dt;
    if(!blocked(nx, nz)){ drv.x = nx; drv.z = nz; }
    else if(!blocked(nx, drv.z)){ drv.x = nx; drv.v *= .92; }
    else if(!blocked(drv.x, nz)){ drv.z = nz; drv.v *= .92; }
    else drv.v *= -.25;   // bonk
    me.position.set(drv.x, .02, drv.z); me.rotation.y = drv.h - Math.PI / 2;
    for(const g of places.gasSt) for(const [px, pz] of g.pumps) if(Math.hypot(drv.x - px, drv.z - pz) < .7 && Math.abs(drv.v) < 1.5 && t - drv.lastFuel > 20){
      drv.lastFuel = t; toast("⛽ Filled up · the bots are paying"); } };

  // ── the boss's monitors and the plaza billboards: a live mirror of the meme bot team ──
  let MDATA = null;
  const money = v => (v >= 0 ? "+$" : "−$") + Math.abs(v).toFixed(2);
  const screenHead = (g, title, color) => { g.fillStyle = "#06101e"; g.fillRect(0, 0, SW, SH); g.fillStyle = color; g.fillRect(0, 0, SW, 26);
    g.fillStyle = "#06101e"; g.font = "bold 15px monospace"; g.textBaseline = "middle"; g.fillText(title, 10, 14); g.font = "13px monospace"; };
  const drawScreens = (tick = 0) => {
    const M = MDATA; if(!M || !M.bots) return;
    const team = Object.values(M.bots), total = team.reduce((a, b) => a + (b.value ?? b.cash), 0), start = team.reduce((a, b) => a + b.start, 0), up = total >= start;
    const today = team.reduce((a, b) => a + (b.day ? b.day.pnl || 0 : 0), 0), n = k => team.filter(b => b.shift === k).length;
    const trades = (M.tape || []).filter(e => e.bot !== "rugdesk");
    { const t = screens[0], g = t.userData.g; screenHead(g, `BOT TEAM · ${team.length} BOTS · PAPER`, "#ffc44d");
      g.fillStyle = up ? "#3ee6a2" : "#ff4f7d"; g.font = "bold 32px monospace"; g.fillText("$" + total.toFixed(2), 12, 56);
      g.font = "14px monospace"; g.fillText(money(total - start) + " since start", 12, 84);
      // team equity: sum of every bot's history, by time
      const pts = new Map(); for(const b of team) for(const [tt, v] of b.equity.slice(-160)) pts.set(Math.round(tt / 3e5), (pts.get(Math.round(tt / 3e5)) || 0) + v);
      const eq = [...pts.entries()].sort((a, b) => a[0] - b[0]).map(e => e[1]).slice(-160);
      if(eq.length > 1){ const lo = Math.min(...eq), hi = Math.max(...eq); g.strokeStyle = up ? "#3ee6a2" : "#ff4f7d"; g.lineWidth = 2; g.beginPath();
        eq.forEach((v, k) => { const x = 10 + k / (eq.length - 1) * (SW - 20), y = SH - 12 - (v - lo) / ((hi - lo) || 1) * 80; k ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); }
      t.needsUpdate = true; }
    { const t = screens[1], g = t.userData.g; screenHead(g, "LEADERBOARD", "#45d4ff");
      [...team].sort((a, b) => (b.value ?? b.cash) - (a.value ?? a.cash)).slice(0, 7).forEach((b, k) => { const v = b.value ?? b.cash, r = v / b.start - 1;
        g.fillStyle = "#eaf0ff"; g.fillText(`${k + 1}. ${b.name}`.slice(0, 18), 10, 46 + k * 21);
        g.fillStyle = r >= 0 ? "#3ee6a2" : "#ff4f7d"; g.fillText(`${r >= 0 ? "+" : ""}${(r * 100).toFixed(1)}%`, 250, 46 + k * 21); });
      t.needsUpdate = true; }
    { const t = screens[2], g = t.userData.g; screenHead(g, "TRADE TAPE", "#ff4fa3");
      const ev = trades.slice(0, 8);
      if(!ev.length){ g.fillStyle = "#8b95bd"; g.fillText("no trades yet", 12, 52); }
      g.font = "11px monospace";
      ev.forEach((e, k) => { g.fillStyle = / sold /.test(e.txt) ? (/ \+\$/.test(e.txt) ? "#3ee6a2" : "#ff4f7d") : "#ffc44d"; g.fillText(e.txt.slice(0, 44), 8, 44 + k * 19); });
      if(tick % 2) { g.fillStyle = "#ff4fa3"; g.fillRect(SW - 18, 9, 8, 8); }
      t.needsUpdate = true; }
    { const t = screens[3], g = t.userData.g, rs = M.rugStats || {checked:0, passed:0, rejected:0};
      screenHead(g, `RUG CHECKS · ${rs.passed} OK · ${rs.rejected} REJECTED`, "#7dffc2");
      (M.scan || []).filter(c => c.checked).slice(0, 7).forEach((c, k) => { g.fillStyle = "#eaf0ff"; g.fillText(c.sym.slice(0, 10), 12, 46 + k * 21);
        g.fillStyle = c.passed && !c.warnings ? "#3ee6a2" : c.passed ? "#ffc44d" : "#ff4f7d";
        g.fillText(c.passed && !c.warnings ? "PASS" : c.passed ? "WARN" : (c.fails[0] || "FAIL").slice(0, 20), 120, 46 + k * 21); });
      t.needsUpdate = true; }
    { const t = screens[4], g = t.userData.g;
      screenHead(g, "TODAY", "#ffc44d");
      g.font = "bold 26px monospace"; g.fillStyle = today >= 0 ? "#3ee6a2" : "#ff4f7d"; g.fillText(money(today), 14, 62);
      g.font = "14px monospace";
      [[`on shift`, n("on"), "#ffc44d"], [`profit locked`, n("locked"), "#3ee6a2"], [`profit brake`, n("brake"), "#ff4f7d"], [`asleep / off`, n("asleep") + n("off"), "#8b95bd"]]
        .forEach(([label, v, c], k) => { g.fillStyle = c; g.fillText(`${String(v).padStart(2)}  ${label}`, 14, 100 + k * 22); });
      t.needsUpdate = true; }
    // Neon Square billboard
    { const g = board.userData.g, W = 512, H = 256, f = M.funnel;
      g.fillStyle = "#07051c"; g.fillRect(0, 0, W, H);
      const grad = g.createLinearGradient(0, 0, W, 0); grad.addColorStop(0, "#ffc44d"); grad.addColorStop(.5, "#ff4fa3"); grad.addColorStop(1, "#7b6bff");
      g.fillStyle = grad; g.fillRect(0, 0, W, 46); g.fillStyle = "#07051c"; g.font = "bold 28px sans-serif"; g.textBaseline = "middle"; g.fillText("BOT CITY LIVE", 16, 24);
      g.fillStyle = today >= 0 ? "#3ee6a2" : "#ff4f7d"; g.font = "bold 54px sans-serif"; g.fillText(`TODAY ${money(today)}`, 16, 96);
      g.fillStyle = "#eaf0ff"; g.font = "bold 22px sans-serif"; g.fillText(`${team.length} bots · ${n("on")} on shift · $${total.toFixed(2)} paper`, 16, 146);
      if(f){ g.fillStyle = "#7dffc2"; g.fillText(`${f.found} coins found → ${f.checked} rug-checked → ${f.passed} passed`, 16, 180); }
      const last = (M.tape || [])[tick % Math.max(1, Math.min(6, (M.tape || []).length))];
      if(last){ g.fillStyle = "#ffc44d"; g.font = "20px sans-serif"; g.fillText(`▶ ${last.txt}`.slice(0, 44), 16, 222); }
      board.needsUpdate = true; } };

  // ── camera: drag to move around, two fingers (or right-drag) to spin and tilt, pinch/scroll to zoom ──
  const view = {yaw:.75, pitch:.9, dist:48, tx:0, ty:1.5, tz:0}, goal = {...view};
  const OFFICE = {yaw:.7, pitch:.13, dist:5, tx:0, ty:OY + 1, tz:-.85};   // eye level, looking in over the boss's shoulder at his screens
  let mode = "free", saved = null, followRef = null, tilt = 0;
  const tiltFor = d => Math.max(.2, Math.min(1.3, .24 + (d - 5) / 55 * .95 + tilt));
  const clampT = () => { goal.tx = Math.max(-EXT - 4, Math.min(EXT + 4, goal.tx)); goal.tz = Math.max(-EXT - 4, Math.min(EXT + 4, goal.tz)); };
  const resize = () => { const w = stage.clientWidth, h = stage.clientHeight; if(!w) return; R.setSize(w, h, false); cam.aspect = w / h; cam.fov = w < h ? 58 : 45; cam.updateProjectionMatrix(); };   // phones: a wider lens
  new ResizeObserver(resize).observe(stage); resize();
  const setMode = m => { if(m === mode) return; const was = mode; mode = m; onPick({kind:"mode", mode:m, was}); };
  const ptrs = new Map(); let gest = null;
  const pan = (dx, dy) => { const k = .83 * goal.dist / (canvas.clientHeight || 400), s = Math.sin(goal.yaw), c = Math.cos(goal.yaw), f = 1 / Math.max(.45, Math.sin(view.pitch));
    goal.tx -= (c * dx + s * dy * f) * k; goal.tz -= (-s * dx + c * dy * f) * k; clampT(); };
  const twoInfo = () => { const [a, b] = [...ptrs.values()]; return {d:Math.hypot(a.x - b.x, a.y - b.y), a:Math.atan2(b.y - a.y, b.x - a.x), mx:(a.x + b.x) / 2, my:(a.y + b.y) / 2}; };
  canvas.addEventListener("contextmenu", e => e.preventDefault());
  canvas.addEventListener("pointerdown", e => { canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, {x:e.clientX, y:e.clientY});
    if(ptrs.size === 1) gest = {type:e.button === 2 || e.shiftKey || e.ctrlKey ? "spin" : "pan", x:e.clientX, y:e.clientY, lx:e.clientX, ly:e.clientY, moved:false, yaw:goal.yaw, tilt};
    if(ptrs.size === 2){ const i = twoInfo(); gest = {type:"two", ...i, dist:goal.dist, yaw:goal.yaw, tilt, moved:true}; } });
  canvas.addEventListener("pointermove", e => { if(!ptrs.has(e.pointerId) || !gest) return; ptrs.set(e.pointerId, {x:e.clientX, y:e.clientY});
    if(mode === "office") return;
    if(gest.type === "two" && ptrs.size === 2){ const i = twoInfo();
      goal.dist = Math.max(3, Math.min(95, gest.dist * gest.d / Math.max(10, i.d)));
      if(mode !== "drive"){ goal.yaw = gest.yaw - (i.a - gest.a); tilt = Math.max(-.45, Math.min(.45, gest.tilt + (i.my - gest.my) * .003)); }
      return; }
    const dx = e.clientX - gest.x, dy = e.clientY - gest.y; if(Math.hypot(dx, dy) > 6) gest.moved = true; if(!gest.moved) return;
    if(gest.type === "spin" || mode === "drive"){ goal.yaw = gest.yaw - dx * .006; tilt = Math.max(-.45, Math.min(.45, gest.tilt + dy * .003)); }
    else { if(mode === "follow"){ followRef = null; setMode("free"); } pan(e.clientX - gest.lx, e.clientY - gest.ly); }
    gest.lx = e.clientX; gest.ly = e.clientY; });
  const up = e => { const g = gest; ptrs.delete(e.pointerId);
    if(g && g.type !== "two" && !g.moved && ptrs.size === 0) tap(e);
    if(ptrs.size === 0) gest = null; else if(ptrs.size === 1){ const [p] = [...ptrs.values()]; gest = {type:"pan", x:p.x, y:p.y, lx:p.x, ly:p.y, moved:true, yaw:goal.yaw, tilt}; } };
  canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("wheel", e => { e.preventDefault(); if(mode === "office") return; goal.dist = Math.max(3, Math.min(95, goal.dist * (1 + Math.sign(e.deltaY) * .1))); }, {passive:false});
  const typing = () => /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || "");
  addEventListener("keydown", e => { if(!isActive() || typing()) return; keys.add(e.code); if(mode === "drive" && /^Arrow/.test(e.code)) e.preventDefault(); });
  addEventListener("keyup", e => keys.delete(e.code));
  addEventListener("blur", () => keys.clear());
  const ray = new T.Raycaster(), v2 = new T.Vector2(), tmp = new T.Vector3();
  function tap(e){ const r = canvas.getBoundingClientRect(); v2.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    // people and cars are a few pixels wide from up here: anyone within a fingertip of the tap counts
    const sx = e.clientX - r.left, sy = e.clientY - r.top, near = (x, y, z) => { tmp.set(x, y, z).project(cam);
      return tmp.z > 1 ? 1e9 : Math.hypot((tmp.x * .5 + .5) * r.width - sx, (-tmp.y * .5 + .5) * r.height - sy); };
    let best = null, bd = 26;
    people.forEach((p, i) => { if(!p.vis) return; const d = near(p.px, .45, p.pz); if(d < bd){ bd = d; best = {kind:"person", text:personText(p), ref:{kind:"person", i}}; } });
    cars.forEach((c, i) => { const d = near(c.px, .3, c.pz); if(d < bd){ bd = d; best = {kind:"car", text:carText(c), ref:{kind:"car", i}}; } });
    if(best) return onPick(best);
    ray.setFromCamera(v2, cam); const hit = ray.intersectObjects(pickable.map(p => p.obj), false)[0]; if(!hit) return;
    const info = pickable.find(p => p.obj === hit.object);
    if(info.kind === "tower") onPick({kind:"tower", id:info.id});
    else if(info.kind === "hq") flyTo(mode === "office" ? "city" : "office");
    else if(info.kind === "landmark") onPick({kind:"landmark", text:info.text});
    else if(info.kind === "person"){ const p = people[hit.instanceId]; onPick({kind:"person", text:personText(p), ref:{kind:"person", i:hit.instanceId}}); }
    else if(info.kind === "car"){ const c = cars[hit.instanceId]; onPick({kind:"car", text:carText(c), ref:{kind:"car", i:hit.instanceId}}); } }
  function flyTo(where){
    if(where === "office"){ if(mode === "drive") drive(false); if(mode !== "office") saved = {...goal}; Object.assign(goal, OFFICE); setMode("office"); onPick({kind:"view", office:true}); }
    else { Object.assign(goal, saved || {yaw:goal.yaw, pitch:.9, dist:48, tx:0, ty:1.5, tz:0}); saved = null; setMode("free"); onPick({kind:"view", office:false}); } }
  function focus(id){ const tw = towers[id]; if(!tw) return; if(mode === "office") flyTo("city"); if(mode === "drive") drive(false);
    followRef = null; setMode("free"); Object.assign(goal, {tx:tw.x, tz:tw.z, ty:1.5, dist:Math.min(goal.dist, 20)}); }
  function follow(ref){ if(!ref) return; if(mode === "drive") drive(false); if(mode === "office") flyTo("city");
    followRef = ref; setMode("follow"); goal.dist = 8; tilt = 0; }
  function drive(on){
    if(on){ if(mode === "office") flyTo("city"); followRef = null;
      const [nx, nz] = door(goal.tx, goal.tz); drv.x = nx; drv.z = nz; drv.v = 0;
      drv.h = Math.round((goal.yaw + Math.PI) / (Math.PI / 2)) * Math.PI / 2; me.visible = true; tilt = 0; goal.dist = 5.5; setMode("drive");
      toast(`🚗 You're driving in ${DISTRICT(drv.x, drv.z)}`); lastDistrict = DISTRICT(drv.x, drv.z); }
    else if(mode === "drive"){ me.visible = false; drv.v = 0; Object.assign(goal, {tx:drv.x, tz:drv.z, ty:1.5, dist:22}); setMode("free"); } }

  // ── minimap ──
  const MS = minimap ? minimap.width : 0, mapK = MS / (2 * EXT + 4), mx = x => (x + EXT + 2) * mapK;
  const mapBase = minimap ? document.createElement("canvas") : null;
  if(minimap){ mapBase.width = mapBase.height = MS; const g = mapBase.getContext("2d");
    g.fillStyle = "#0b0826"; g.fillRect(0, 0, MS, MS); g.fillStyle = "#2a2358"; g.fillRect(mx(-EXT - .6), mx(-EXT - .6), (2 * EXT + 1.2) * mapK, (2 * EXT + 1.2) * mapK);
    const COL = {hq:"#45d4ff", tower:"#3e3590", office:"#352d78", shop:"#5a3473", houses:"#262150", park:"#1f6b4a", gas:"#3ee6a2", cafe:"#ff8fc8", pier:"#6b4a2a",
      ferris:"#ff4fa3", yard:"#4a3a2a", lot:"#18142e", stadium:"#b07bff", plaza:"#ffc44d", rugdesk:"#3ee6a2"};
    for(const [i, j] of blocks){ const z = zoneAt(i, j); if(z === "river") continue; g.fillStyle = z === "bot" ? BOTS[key(i, j)].css : COL[z] || "#352d78";
      g.fillRect(mx(i * P - B / 2), mx(j * P - B / 2), B * mapK, B * mapK); }
    g.fillStyle = "#2d63d8"; g.fillRect(0, mx(RZ - B / 2 - .1), MS, (B + .2) * mapK);
    g.fillStyle = "#2a2358"; for(const x of lines) g.fillRect(mx(x - .6), mx(RZ - B / 2 - .1), 1.2 * mapK, (B + .2) * mapK);
    minimap.addEventListener("pointerdown", e => { const r = minimap.getBoundingClientRect(), wx = (e.clientX - r.left) / r.width * MS / mapK - EXT - 2, wz = (e.clientY - r.top) / r.height * MS / mapK - EXT - 2;
      if(mode === "drive") return; if(mode === "office") flyTo("city"); followRef = null; setMode("free"); goal.tx = wx; goal.tz = wz; clampT(); }); }
  const drawMap = () => { if(!minimap) return; const g = minimap.getContext("2d"); g.drawImage(mapBase, 0, 0);
    g.fillStyle = "rgba(255,255,255,.75)"; for(const c of cars) g.fillRect(mx(c.px) - 1, mx(c.pz) - 1, 2, 2);
    const s = Math.sin(view.yaw), c = Math.cos(view.yaw), x = mx(view.tx), y = mx(view.tz), rr = Math.max(4, view.dist * .45 * mapK);
    g.strokeStyle = "rgba(255,255,255,.9)"; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(x, y); g.lineTo(x - s * rr * 1.6, y - c * rr * 1.6); g.stroke();
    if(mode === "drive"){ const hx = mx(drv.x), hy = mx(drv.z), a = drv.h; g.fillStyle = "#ffc44d"; g.beginPath();
      g.moveTo(hx + Math.sin(a) * 7, hy + Math.cos(a) * 7); g.lineTo(hx + Math.sin(a + 2.5) * 5, hy + Math.cos(a + 2.5) * 5); g.lineTo(hx + Math.sin(a - 2.5) * 5, hy + Math.cos(a - 2.5) * 5); g.fill(); }
    if(followRef){ const o = followRef.kind === "car" ? cars[followRef.i] : people[followRef.i]; g.fillStyle = "#ff4fa3"; g.beginPath(); g.arc(mx(o.px), mx(o.pz), 4, 0, Math.PI * 2); g.fill(); } };

  // ── loop ──
  let last = 0, t = 0, tick = 0, lastScreens = 0, frame = 0, lastDistrict = "", districtAt = 0;
  (function loop(ts){
    requestAnimationFrame(loop);
    if(!isActive() || document.hidden || !stage.clientWidth) return;
    if(ts - last < (reduceMotion ? 200 : 33)) return;
    const dt = last ? Math.min(.1, (ts - last) / 1000) : .033; last = ts; t += dt; frame++;
    if(!reduceMotion){ stepPeople(dt); stepCars(dt); }
    if(mode === "drive"){ stepDrive(dt); Object.assign(goal, {tx:drv.x + Math.sin(drv.h) * 1.2, tz:drv.z + Math.cos(drv.h) * 1.2, ty:.55, pitch:.36 + tilt * .5});
      if(!ptrs.size) goal.yaw = drv.h + Math.PI; goal.dist = Math.max(3.5, Math.min(goal.dist, 10)); }
    else if(mode === "follow" && followRef){ const o = followRef.kind === "car" ? cars[followRef.i] : people[followRef.i];
      goal.tx = o.px; goal.tz = o.pz; goal.ty = .5; goal.pitch = tiltFor(goal.dist); if(!ptrs.size && !reduceMotion) goal.yaw += dt * .12; }
    else if(mode === "free"){
      const s = goal.dist * .9 * dt, sy = Math.sin(goal.yaw), cy = Math.cos(goal.yaw);
      const fw = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0), sd = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
      if(fw || sd){ goal.tx += (-sy * fw + cy * sd) * s; goal.tz += (-cy * fw - sy * sd) * s; clampT(); }
      if(keys.has("KeyQ")) goal.yaw += dt * 1.2; if(keys.has("KeyE")) goal.yaw -= dt * 1.2;
      if(!ptrs.size && !reduceMotion && !keys.size) goal.yaw += dt * .03;
      goal.pitch = tiltFor(goal.dist); goal.ty = 1.5; }
    const kk = Math.min(1, dt * (mode === "drive" ? 7 : 3));
    view.yaw += ((goal.yaw - view.yaw + Math.PI * 3) % (Math.PI * 2) - Math.PI) * kk;
    for(const k of ["pitch", "dist", "tx", "ty", "tz"]) view[k] += (goal[k] - view[k]) * kk;
    let cd = view.dist;   // chase cam: pull in in front of any building between the camera and what it's following
    if(mode === "drive" || mode === "follow"){ const ex = Math.sin(view.yaw) * Math.cos(view.pitch), ez = Math.cos(view.yaw) * Math.cos(view.pitch), ey = Math.sin(view.pitch);
      for(let k = .9; k < cd; k += .25) if(view.ty + ey * k < 5 && blocked(view.tx + ex * k, view.tz + ez * k)){ cd = Math.max(2.6, k - .35); break; } }
    cam.position.set(view.tx + Math.sin(view.yaw) * Math.cos(view.pitch) * cd, view.ty + Math.sin(view.pitch) * cd,
      view.tz + Math.cos(view.yaw) * Math.cos(view.pitch) * cd);
    cam.lookAt(view.tx, view.ty, view.tz);
    // the world keeps moving
    head.rotation.y = Math.sin(t * .5) * .45; head.rotation.x = Math.sin(t * .8) * .05;   // the boss glances from screen to screen
    armL.position.y = .38 + Math.max(0, Math.sin(t * 14)) * .02; armR.position.y = .38 + Math.max(0, Math.sin(t * 14 + 1.5)) * .02;   // typing
    beacon.material.opacity = .5 + .5 * Math.sin(t * 3); red.material.opacity = .45 + .55 * Math.max(0, Math.sin(t * 2.4));
    if(!reduceMotion){ wheel.rotation.z = t * .15; for(const c of wheel.children) if(c.userData.cab) c.rotation.z = -wheel.rotation.z;
      const a = t * .045; blimp.position.set(Math.cos(a) * 34, 21 + Math.sin(t * .4) * .6, Math.sin(a) * 34); blimp.rotation.y = -a - Math.PI / 2;
      blimp.userData.light.material.opacity = .3 + .7 * Math.max(0, Math.sin(t * 4));
      for(const b of boats){ b.g.position.x += b.dir * b.speed * dt; if(Math.abs(b.g.position.x) > EXT + 14) b.g.position.x = -b.dir * (EXT + 14); }
      waterTex.offset.x = (t * .02) % 1;
      if(searchlight) searchlight.userData.pivot.rotation.y = t * .6; }
    for(const tw of Object.values(towers)){ const st = tw.state, fresh = st.beamUntil && Date.now() < st.beamUntil;
      tw.ring.material.opacity = st.on ? .55 + .4 * Math.sin(t * 3) : .12; tw.ring.scale.setScalar(st.on ? 1 + .06 * Math.sin(t * 3) : 1);
      tw.mat.emissiveIntensity = st.on ? 1.4 : .45; tw.tip.material.opacity = st.on ? .7 + .3 * Math.sin(t * 2) : .2;
      tw.beam.material.color.setHex(st.beamGood === false ? 0xff3d6e : 0xffd56b);
      tw.beam.material.opacity = fresh ? .3 + .18 * Math.sin(t * 6) : Math.max(0, tw.beam.material.opacity - dt); }
    if(searchlight){ const alarm = towers.rugdesk && towers.rugdesk.state.alarm; searchlight.material.color.setHex(alarm ? 0xff3d6e : 0x7dffc2); searchlight.material.opacity = alarm ? .22 : .14; }
    if(t - lastScreens > .5){ lastScreens = t; tick++; drawScreens(tick); }
    if((mode === "drive" || mode === "follow") && t - districtAt > .5){ districtAt = t; const d = DISTRICT(view.tx, view.tz); if(d !== lastDistrict){ if(lastDistrict) toast(`Now entering ${d}`); lastDistrict = d; } }
    R.render(scene, cam);
    if(frame % 3 === 0) drawMap();
    onFrame(id => { const v = id === "hq" ? tmp.set(0, OY + 5.2, 0) : towers[id] ? tmp.copy(towers[id].top) : null; if(!v) return null;
      const d = cam.position.distanceTo(v); v.project(cam);
      return {x:(v.x * .5 + .5) * stage.clientWidth, y:(-v.y * .5 + .5) * stage.clientHeight, behind:v.z > 1, d}; },
      mode === "office", {mode, speed:Math.round(Math.abs(drv.v) * 9), district:DISTRICT(view.tx, view.tz), follow:followRef ? (followRef.kind === "car" ? carText(cars[followRef.i]) : personText(people[followRef.i])) : ""});
  })(0);

  return {
    setStates(st){ for(const [id, s] of Object.entries(st)) if(towers[id]) towers[id].state = s; },
    setMeme(M){ MDATA = M; drawScreens(tick); },
    setInput(o){ Object.assign(drv.input, o); },
    unfollow(){ if(mode === "follow"){ followRef = null; setMode("free"); } },
    flyTo, focus, follow, drive, get mode(){ return mode; }, get inOffice(){ return mode === "office"; },
    stats:{people:NP, cars:NC, blocks:blocks.length},
  };
}
