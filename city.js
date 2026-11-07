// Bot City world (README round 36): a living 3D city of AI citizens, loaded by index.html when the City tab opens.
// Streets, offices, houses, a gas station, a café, shops and a park; AI people walk between home, work and errands;
// cars drive the grid and stop for gas; each paper bot has its company building; HQ's glass penthouse holds the boss,
// whose monitors mirror the real meme bot (paper/meme.json). Everything is procedural (no model files) and the layout
// is the same on every visit (seeded random).
export function createCity(T, {stage, canvas, reduceMotion, isActive, onPick, onFrame, bots}){   // bots: [{id, name, css}], one building each
  const rand = (() => { let a = 20261107; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();
  const pick = arr => arr[Math.floor(rand() * arr.length)];
  const R = new T.WebGLRenderer({canvas, antialias:true, powerPreference:"low-power"});
  R.setPixelRatio(Math.min(1.5, devicePixelRatio || 1)); R.outputColorSpace = T.SRGBColorSpace; R.setClearColor(0x0e0838);
  const scene = new T.Scene(); scene.fog = new T.Fog(0x160d52, 30, 75);
  const cam = new T.PerspectiveCamera(45, 1, .1, 220);
  scene.add(new T.HemisphereLight(0xa596ff, 0x120a40, 1.15));
  const moon = new T.DirectionalLight(0xc8d0ff, .55); moon.position.set(-12, 25, 10); scene.add(moon);

  // ── textures ──
  const canvasTex = (w, h, draw) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d");
    draw(g, w, h); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.userData = {c, g}; return t; };
  const windows = (lit, tints) => canvasTex(64, 128, g => { g.fillStyle = "#0b0a2a"; g.fillRect(0, 0, 64, 128);
    for(let y = 4; y < 124; y += 8) for(let x = 4; x < 60; x += 8) if(rand() < lit){ g.globalAlpha = .5 + rand() * .5; g.fillStyle = pick(tints); g.fillRect(x, y, 4, 4); } });
  const winOffice = windows(.55, ["#ffe9a8", "#ffffff", "#8fd8ff"]), winHome = windows(.35, ["#ffcf7a", "#ffb35c"]), winHQ = windows(.75, ["#9fe8ff", "#ffffff"]);
  for(const t of [winOffice, winHome, winHQ]) t.magFilter = T.NearestFilter;
  const glowTex = canvasTex(64, 64, g => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(.3, "rgba(255,255,255,.4)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
  const sign = (text, color, w = 256, h = 64) => canvasTex(w, h, g => { g.fillStyle = "rgba(10,6,40,.85)"; g.fillRect(0, 0, w, h);
    g.strokeStyle = color; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6); g.fillStyle = color; g.font = `bold ${h * .55}px sans-serif`;
    g.textAlign = "center"; g.textBaseline = "middle"; g.shadowColor = color; g.shadowBlur = 12; g.fillText(text, w / 2, h / 2 + 2); });
  const signMesh = (tex, w, h) => new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({map:tex, transparent:true, side:T.DoubleSide}));
  const glow = (hex, s) => { const m = new T.Sprite(new T.SpriteMaterial({map:glowTex, color:hex, blending:T.AdditiveBlending, transparent:true, depthWrite:false})); m.scale.set(s, s, 1); return m; };

  // ── layout: a 7×7 grid of blocks with roads between them ──
  const P = 5.2, B = 4, N = 3;
  const lines = []; for(let i = -N - 1; i <= N; i++) lines.push(+((i + .5) * P).toFixed(2));   // road centre lines (x and z)
  const EXT = (N + .5) * P;
  const ground = new T.Mesh(new T.PlaneGeometry(EXT * 2 + 30, EXT * 2 + 30), new T.MeshStandardMaterial({color:0x17113f, roughness:1}));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  const unit = new T.BoxGeometry(1, 1, 1); unit.translate(0, .5, 0);
  const M4 = new T.Matrix4(), Q = new T.Quaternion(), V = new T.Vector3(), S = new T.Vector3(), E = new T.Euler();
  const place = (inst, i, x, y, z, sx, sy, sz, ry = 0) => { Q.setFromEuler(E.set(0, ry, 0)); inst.setMatrixAt(i, M4.compose(V.set(x, y, z), Q, S.set(sx, sy, sz))); };
  const instanced = (geo, mat, list) => { const m = new T.InstancedMesh(geo, mat, Math.max(1, list.length));
    list.forEach((a, i) => { place(m, i, ...a.slice(0, 8)); if(a[8] !== undefined){ m.setColorAt(i, new T.Color(a[8])); } });
    m.count = list.length; if(m.instanceColor) m.instanceColor.needsUpdate = true; scene.add(m); return m; };
  const blocks = []; for(let i = -N; i <= N; i++) for(let j = -N; j <= N; j++) blocks.push([i, j]);
  instanced(unit, new T.MeshStandardMaterial({color:0x2c2468, roughness:.9}), blocks.map(([i, j]) => [i * P, 0, j * P, B, .12, B]));
  // lane dashes and streetlights
  const dashes = [];
  for(const L of lines) for(let k = -EXT; k <= EXT; k += 1.1){ dashes.push([L, .01, k, .06, .02, .5]); dashes.push([k, .01, L, .5, .02, .06]); }
  instanced(unit, new T.MeshBasicMaterial({color:0x8a7a3a}), dashes);
  const lamps = [];
  for(const x of lines) for(const z of lines){ lamps.push([x + .8, 0, z + .8, .05, 1.1, .05]); const g = glow(0xffd88a, .9); g.position.set(x + .8, 1.15, z + .8); scene.add(g); }
  instanced(unit, new T.MeshStandardMaterial({color:0x3a3560}), lamps);

  // ── zones ──
  // every bot gets a company building: first the ring around HQ, then the next ring out (not the gas station, café,
  // park or shop blocks)
  const BOTS = {};
  { const ring = r => blocks.filter(([i, j]) => Math.max(Math.abs(i), Math.abs(j)) === r).sort((a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
    const spots = [...ring(1), ...ring(2).filter(([i, j]) => !["2,-2", "-2,2", "-2,-2", "2,2"].includes(`${i},${j}`))];
    (bots || []).forEach((b, k) => { if(spots[k]) BOTS[`${spots[k][0]},${spots[k][1]}`] = b; }); }
  const zone = (i, j) => { const r = Math.max(Math.abs(i), Math.abs(j));
    if(!i && !j) return "hq"; if(BOTS[`${i},${j}`]) return "bot"; if(r === 1) return "office";
    if(i === 2 && j === -2) return "gas"; if(i === -2 && j === 2) return "park"; if(i === -2 && j === -2) return "cafe"; if(i === 2 && j === 2) return "shop";
    return r === 2 ? (rand() < .6 ? "office" : "shop") : "houses"; };
  const offices = [], shops = [], awnings = [], houses = [], roofs = [], trees = [], trunks = [];
  const places = {home:[], office:[], shop:[], cafe:[], gas:[], park:[], bot:{}};   // doors that citizens walk to
  const door = (x, z) => { let best = null, d = 1e9; for(const lx of lines) for(const lz of lines){ const dd = Math.hypot(lx - x, lz - z); if(dd < d){ d = dd; best = [lx, lz]; } } return best; };
  const pickable = [];   // {obj, kind, id}
  const towers = {};
  for(const [i, j] of blocks){
    const cx = i * P, cz = j * P, z = zone(i, j);
    if(z === "office"){ const n = 1 + Math.floor(rand() * 3);
      for(let k = 0; k < n; k++){ const w = 1.2 + rand() * .9, h = 2 + rand() * 4.5, ox = (rand() - .5) * (B - w - .4), oz = (rand() - .5) * (B - w - .4);
        offices.push([cx + ox, .12, cz + oz, w, h, w]); }
      places.office.push(door(cx, cz)); }
    else if(z === "shop"){ for(const [ox, oz] of [[-1, -1], [1, 1], [1, -1]]){ const w = 1.4, h = .9 + rand() * .5;
        shops.push([cx + ox, .12, cz + oz, w, h, w * .9]); awnings.push([cx + ox, .12 + h * .55, cz + oz + w * .47, w * .9, .12, .25, 0, 0, pick([0xff4fa3, 0x45d4ff, 0xffc44d, 0x7dffc2])]); }
      places.shop.push(door(cx, cz)); }
    else if(z === "houses"){ for(const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]){ const w = 1.1 + rand() * .3, h = .7 + rand() * .3, ry = pick([0, Math.PI / 2]);
        houses.push([cx + ox, .12, cz + oz, w, h, w, ry, 0, pick([0x6b5bd6, 0x8a6bd0, 0x5a7bd6, 0x9a6b9a])]);
        roofs.push([cx + ox, .12 + h, cz + oz, w * .82, .55, w * .82, Math.PI / 4]); }
      places.home.push(door(cx, cz)); }
    else if(z === "park"){ const lawn = new T.Mesh(new T.BoxGeometry(B - .3, .14, B - .3), new T.MeshStandardMaterial({color:0x1f6b4a})); lawn.position.set(cx, .07, cz); scene.add(lawn);
      for(let k = 0; k < 9; k++){ const x = cx + (rand() - .5) * 3, zz = cz + (rand() - .5) * 3, s = .7 + rand() * .5;
        trees.push([x, .55 * s, zz, s, s, s]); trunks.push([x, .14, zz, .1, .45 * s, .1]); }
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
      places.gas.push(door(cx, cz)); places.pumps = [[cx - .6, cz + .6 + .5], [cx + .6, cz + .6 + .5]]; places.gasNode = door(cx + 2, cz + 2); }
    else if(z === "bot"){ const bot = BOTS[`${i},${j}`], id = bot.id, col = new T.Color(bot.css).getHex(), H = (Math.max(Math.abs(i), Math.abs(j)) === 1 ? 4.8 : 3.6) + rand() * 2.2;
      const g = new T.Group(); g.position.set(cx, .12, cz); scene.add(g);
      const mat = new T.MeshStandardMaterial({map:winOffice, emissiveMap:winOffice, emissive:col, emissiveIntensity:1.4, color:0x1c1850, roughness:.6});
      let y = 0; const parts = [];
      for(const [w, f] of [[2, .55], [1.45, .3], [.9, .15]]){ const m = new T.Mesh(unit, mat); m.scale.set(w, H * f, w); m.position.y = y; g.add(m); parts.push(m); y += H * f; }
      const tip = glow(col, 1.4); tip.position.y = y + .2; g.add(tip);
      const ring = new T.Mesh(new T.TorusGeometry(1.6, .05, 8, 56), new T.MeshBasicMaterial({color:col, transparent:true, opacity:.9})); ring.rotation.x = Math.PI / 2; ring.position.y = .05; g.add(ring);
      const beam = new T.Mesh(new T.CylinderGeometry(.14, .14, 40, 12, 1, true), new T.MeshBasicMaterial({color:0xffd56b, transparent:true, opacity:0, blending:T.AdditiveBlending, depthWrite:false})); beam.position.y = 20; g.add(beam);
      towers[id] = {id, mat, tip, ring, beam, top:new T.Vector3(cx, y + .9, cz), state:{}};
      for(const m of parts) pickable.push({obj:m, kind:"tower", id});
      places.bot[id] = door(cx, cz); }
  }
  const offMat = new T.MeshStandardMaterial({map:winOffice, emissiveMap:winOffice, emissive:0xffffff, emissiveIntensity:.85, color:0x2a2470, roughness:.8});
  instanced(unit, offMat, offices);
  instanced(unit, new T.MeshStandardMaterial({map:winHome, emissiveMap:winHome, emissive:0xffffff, emissiveIntensity:.8, color:0x3d3570}), shops);
  instanced(unit, new T.MeshBasicMaterial({color:0xffffff}), awnings);
  instanced(unit, new T.MeshStandardMaterial({map:winHome, emissiveMap:winHome, emissive:0xffffff, emissiveIntensity:.7, color:0xffffff}), houses);
  { const roofGeo = new T.ConeGeometry(.75, 1, 4); roofGeo.translate(0, .5, 0); instanced(roofGeo, new T.MeshStandardMaterial({color:0x2a1f55, roughness:.9}), roofs); }
  instanced(new T.ConeGeometry(.45, 1.1, 7), new T.MeshStandardMaterial({color:0x2fa86a, emissive:0x0f3a24}), trees);
  instanced(unit, new T.MeshStandardMaterial({color:0x5a4030}), trunks);

  // ── HQ tower with the boss's glass penthouse ──
  const HQ_H = 13, HQ = new T.Group(); scene.add(HQ);
  const hqMat = new T.MeshStandardMaterial({map:winHQ, emissiveMap:winHQ, emissive:0xbfefff, emissiveIntensity:1.1, color:0x1a2a5a, roughness:.4});
  const hqBody = new T.Mesh(unit, hqMat); hqBody.scale.set(3.2, HQ_H, 3.2); hqBody.position.y = .12; HQ.add(hqBody);
  const OY = HQ_H + .12;   // office floor
  const glass = new T.Mesh(new T.BoxGeometry(3.6, 2.1, 3.6), new T.MeshStandardMaterial({color:0x7fd8ff, transparent:true, opacity:.12, roughness:.1, depthWrite:false}));
  glass.position.y = OY + 1.05; HQ.add(glass);
  const frame = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(3.6, 2.1, 3.6)), new T.LineBasicMaterial({color:0x45d4ff})); frame.position.y = OY + 1.05; HQ.add(frame);
  const floor = new T.Mesh(new T.BoxGeometry(3.6, .1, 3.6), new T.MeshStandardMaterial({color:0x2a2340})); floor.position.y = OY; HQ.add(floor);
  const roof = new T.Mesh(new T.BoxGeometry(3.8, .18, 3.8), new T.MeshStandardMaterial({color:0x221b44, emissive:0x45d4ff, emissiveIntensity:.05, roughness:1})); roof.position.y = OY + 2.18; HQ.add(roof);
  const antenna = new T.Mesh(new T.CylinderGeometry(.04, .06, 2.4), new T.MeshStandardMaterial({color:0xccd2ff})); antenna.position.y = OY + 3.4; HQ.add(antenna);
  const beacon = glow(0xff4f7d, 1.2); beacon.position.y = OY + 4.7; HQ.add(beacon);
  const hqSign = signMesh(sign("HQ", "#45d4ff", 128, 64), 1.3, .65); hqSign.position.set(0, OY + 2.75, 1.91); HQ.add(hqSign);
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

  // ── AI citizens ──
  const NODES = lines;   // walk and drive on the same grid of intersections
  const idx = v => NODES.indexOf(v);
  const routeTo = (from, to) => {   // Manhattan path between intersections: along x first, then z
    const path = []; let [x, z] = from; const [tx, tz] = to;
    while(x !== tx){ x = NODES[idx(x) + Math.sign(idx(tx) - idx(x))]; path.push([x, z]); }
    while(z !== tz){ z = NODES[idx(z) + Math.sign(idx(tz) - idx(z))]; path.push([x, z]); }
    return path; };
  const JOBS = [...(bots || []).flatMap(b => [[b.id, `${b.name} rug-checker`], [b.id, `${b.name} trader`]]),
    ["office", "office worker"], ["cafe", "barista"], ["shop", "shopkeeper"], ["gas", "gas station clerk"], ["hq", "HQ assistant"]];
  const NAMES = ["Nova", "Echo", "Pixel", "Byte", "Juno", "Atlas", "Iris", "Kai", "Luma", "Orion", "Vega", "Zed", "Rio", "Sky", "Neo", "Ada"];
  const doorOf = k => k === "hq" ? places.hq : places.bot[k] || pick(places[k]);
  const NP = 110, people = [];
  for(let k = 0; k < NP; k++){ const [jobKey, jobName] = pick(JOBS), home = pick(places.home);
    people.push({name:`${pick(NAMES)}-${10 + k}`, job:jobName, jobDoor:doorOf(jobKey), home, at:home.slice(), path:[], goal:"work", wait:rand() * 6,
      speed:.9 + rand() * .5, side:rand() < .5 ? -1 : 1, x:home[0], z:home[1], doing:"at home" }); }
  const bodyGeo = new T.CylinderGeometry(.09, .12, .42, 8); bodyGeo.translate(0, .33, 0);
  const headGeo = new T.SphereGeometry(.085, 10, 8); headGeo.translate(0, .64, 0);
  const pBody = new T.InstancedMesh(bodyGeo, new T.MeshStandardMaterial({color:0xffffff, roughness:.6}), NP);
  const pHead = new T.InstancedMesh(headGeo, new T.MeshBasicMaterial({color:0xffffff}), NP);
  people.forEach((p, i) => { pBody.setColorAt(i, new T.Color(pick([0x45d4ff, 0xff4fa3, 0xffc44d, 0x7dffc2, 0xb07bff]))); pHead.setColorAt(i, new T.Color(pick([0x9fe8ff, 0xffffff, 0xffd0f0]))); });
  scene.add(pBody, pHead); pickable.push({obj:pBody, kind:"person"});
  const nextGoal = p => {
    const plan = {work:["errand", () => pick([pick(places.gas), pick(places.cafe), pick(places.shop), pick(places.park)])], errand:["home", () => p.home], home:["work", () => p.jobDoor]};
    const [g, dest] = plan[p.goal]; p.goal = g; p.path = routeTo(p.at, dest());
    p.doing = g === "work" ? `walking to work (${p.job})` : g === "errand" ? "heading out on an errand" : "walking home"; };
  const stepPeople = dt => {
    for(let i = 0; i < NP; i++){ const p = people[i]; let hidden = false;
      if(p.wait > 0){ p.wait -= dt; hidden = true;
        if(p.wait <= 0) nextGoal(p); }
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
  const NC = 32, cars = [];
  const carBody = new T.BoxGeometry(.8, .26, .42); carBody.translate(0, .25, 0);
  const carTop = new T.BoxGeometry(.42, .2, .38); carTop.translate(-.05, .48, 0);
  const lightGeo = new T.BoxGeometry(.04, .07, .32); lightGeo.translate(.41, .26, 0);
  const cBody = new T.InstancedMesh(carBody, new T.MeshStandardMaterial({color:0xffffff, metalness:.4, roughness:.4}), NC);
  const cTop = new T.InstancedMesh(carTop, new T.MeshStandardMaterial({color:0x111428, roughness:.2}), NC);
  const cLight = new T.InstancedMesh(lightGeo, new T.MeshBasicMaterial({color:0xfff2c0}), NC);
  scene.add(cBody, cTop, cLight); pickable.push({obj:cBody, kind:"car"});
  const neighbours = ([x, z]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [NODES[idx(x) + a], NODES[idx(z) + b]]).filter(([a, b]) => a !== undefined && b !== undefined);
  for(let k = 0; k < NC; k++){ const at = [pick(NODES), pick(NODES)];
    cars.push({at, to:pick(neighbours(at)), x:at[0], z:at[1], speed:2.2 + rand() * 1.4, mode:"drive", owner:`${pick(NAMES)}-${100 + k}`});
    cBody.setColorAt(k, new T.Color(pick([0xff4f7d, 0x45d4ff, 0xffc44d, 0xeef0ff, 0x7dffc2, 0xb07bff]))); }
  const stepCars = dt => {
    for(let i = 0; i < NC; i++){ const c = cars[i];
      if(c.mode === "drive"){ const [tx, tz] = c.to, dx = tx - c.x, dz = tz - c.z, d = Math.hypot(dx, dz), s = c.speed * dt;
        c.dir = Math.atan2(dx, dz);
        if(d <= s){ c.x = tx; c.z = tz; const prev = c.at; c.at = c.to;
          const gn = places.gasNode;
          if(gn && c.at[0] === gn[0] && c.at[1] === gn[1] && rand() < .35 && !cars.some(o => o.mode !== "drive" && o !== c)){
            c.mode = "toPump"; c.pump = pick(places.pumps); c.t0 = 0; }
          else { const opts = neighbours(c.at).filter(n => n[0] !== prev[0] || n[1] !== prev[1]); c.to = pick(opts.length ? opts : neighbours(c.at)); } }
        else { c.x += dx / d * s; c.z += dz / d * s; } }
      else if(c.mode === "toPump" || c.mode === "fromPump"){ c.t0 += dt / 1.6; const k = Math.min(1, c.t0);
        const [ax, az] = c.mode === "toPump" ? c.at : c.pump, [bx, bz] = c.mode === "toPump" ? c.pump : c.at;
        c.x = ax + (bx - ax) * k; c.z = az + (bz - az) * k; c.dir = Math.atan2(bx - ax, bz - az);
        if(k >= 1){ if(c.mode === "toPump"){ c.mode = "fuel"; c.t0 = 0; } else { c.mode = "drive"; c.to = pick(neighbours(c.at)); } } }
      else if(c.mode === "fuel"){ c.t0 += dt; if(c.t0 > 4){ c.mode = "fromPump"; c.t0 = 0; } }
      // drive on the right: offset from the centre line
      const ox = c.mode === "drive" ? -Math.cos(c.dir) * .33 : 0, oz = c.mode === "drive" ? Math.sin(c.dir) * .33 : 0, ry = c.dir - Math.PI / 2;
      for(const m of [cBody, cTop, cLight]) place(m, i, c.x + ox, .02, c.z + oz, 1, 1, 1, ry);
      c.px = c.x + ox; c.pz = c.z + oz;
    }
    cBody.instanceMatrix.needsUpdate = cTop.instanceMatrix.needsUpdate = cLight.instanceMatrix.needsUpdate = true; };

  // ── the boss's monitors: a live mirror of the meme bot ──
  let MDATA = null;
  const money = v => (v >= 0 ? "+$" : "−$") + Math.abs(v).toFixed(2);
  const screenHead = (g, title, color) => { g.fillStyle = "#06101e"; g.fillRect(0, 0, SW, SH); g.fillStyle = color; g.fillRect(0, 0, SW, 26);
    g.fillStyle = "#06101e"; g.font = "bold 15px monospace"; g.textBaseline = "middle"; g.fillText(title, 10, 14); g.font = "13px monospace"; };
  const drawScreens = (tick = 0) => {
    const M = MDATA; if(!M || !M.bots) return;
    const team = Object.values(M.bots), total = team.reduce((a, b) => a + (b.value ?? b.cash), 0), start = team.reduce((a, b) => a + b.start, 0), up = total >= start;
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
      const ev = (M.tape || []).slice(0, 8);
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
    { const t = screens[4], g = t.userData.g, today = team.reduce((a, b) => a + (b.day ? b.day.pnl || 0 : 0), 0);
      const n = k => team.filter(b => b.shift === k).length;
      screenHead(g, "TODAY", "#ffc44d");
      g.font = "bold 26px monospace"; g.fillStyle = today >= 0 ? "#3ee6a2" : "#ff4f7d"; g.fillText(money(today), 14, 62);
      g.font = "14px monospace";
      [[`on shift`, n("on"), "#ffc44d"], [`profit locked`, n("locked"), "#3ee6a2"], [`profit brake`, n("brake"), "#ff4f7d"], [`asleep / off`, n("asleep") + n("off"), "#8b95bd"]]
        .forEach(([label, v, c], k) => { g.fillStyle = c; g.fillText(`${String(v).padStart(2)}  ${label}`, 14, 100 + k * 22); });
      t.needsUpdate = true; } };

  // ── camera: drag to spin, pinch/scroll to zoom, tap to inspect; can fly into the HQ office ──
  const orbit = {yaw:.75, pitch:.78, dist:34, tx:0, ty:2, tz:0}, goal = {...orbit};
  const HOME = {yaw:goal.yaw, pitch:.78, dist:34, tx:0, ty:2, tz:0}, OFFICE = {yaw:.7, pitch:.13, dist:5, tx:0, ty:OY + 1, tz:-.85};   // eye level, over his shoulder   // looking in over his shoulder at the screens
  let inOffice = false;
  const resize = () => { const w = stage.clientWidth, h = stage.clientHeight; if(!w) return; R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
  new ResizeObserver(resize).observe(stage); resize();
  const pts = new Map(); let drag = null, pinch = null;
  canvas.addEventListener("pointerdown", e => { canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    if(pts.size === 1) drag = {x:e.clientX, y:e.clientY, yaw:goal.yaw, pitch:goal.pitch, moved:false};
    if(pts.size === 2){ const [a, b] = [...pts.values()]; pinch = {d:Math.hypot(a[0] - b[0], a[1] - b[1]), dist:goal.dist}; drag = null; } });
  canvas.addEventListener("pointermove", e => { if(!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
    if(pinch && pts.size === 2){ const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); goal.dist = Math.max(4, Math.min(60, pinch.dist * pinch.d / d)); return; }
    if(!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if(Math.hypot(dx, dy) > 6) drag.moved = true;
    if(drag.moved){ goal.yaw = drag.yaw - dx * .006; goal.pitch = Math.max(.08, Math.min(1.35, drag.pitch + dy * .004)); } });
  const up = e => { const was = drag; pts.delete(e.pointerId); if(pts.size < 2) pinch = null;
    if(was && !was.moved && pts.size === 0) tap(e); if(pts.size === 0) drag = null; };
  canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("wheel", e => { e.preventDefault(); goal.dist = Math.max(4, Math.min(60, goal.dist * (1 + Math.sign(e.deltaY) * .1))); }, {passive:false});
  const ray = new T.Raycaster(), v2 = new T.Vector2();
  function tap(e){ const r = canvas.getBoundingClientRect(); v2.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    // people and cars are a few pixels wide from up here: anyone within a fingertip of the tap counts
    const sx = e.clientX - r.left, sy = e.clientY - r.top, near = (x, y, z) => { tmp.set(x, y, z).project(cam);
      return tmp.z > 1 ? 1e9 : Math.hypot((tmp.x * .5 + .5) * r.width - sx, (-tmp.y * .5 + .5) * r.height - sy); };
    let best = null, bd = 26;
    people.forEach(p => { if(!p.vis) return; const d = near(p.px, .45, p.pz); if(d < bd){ bd = d; best = {kind:"person", text:`<b>${p.name}</b> · AI ${p.job} · ${p.doing}`}; } });
    cars.forEach(c => { const d = near(c.px, .3, c.pz); if(d < bd){ bd = d; best = {kind:"car", text:`<b>${c.owner}'s car</b> · ${c.mode === "drive" ? "driving across town" : "filling up at the gas station"}`}; } });
    if(best) return onPick(best);
    ray.setFromCamera(v2, cam); const hit = ray.intersectObjects(pickable.map(p => p.obj), false)[0]; if(!hit) return;
    const info = pickable.find(p => p.obj === hit.object);
    if(info.kind === "tower") onPick({kind:"tower", id:info.id});
    else if(info.kind === "hq") flyTo(inOffice ? "city" : "office");
    else if(info.kind === "person"){ const p = people[hit.instanceId]; onPick({kind:"person", text:`<b>${p.name}</b> · AI ${p.job} · ${p.doing}`}); }
    else if(info.kind === "car"){ const c = cars[hit.instanceId]; onPick({kind:"car", text:`<b>${c.owner}'s car</b> · ${c.mode === "drive" ? "driving across town" : "filling up at the gas station"}`}); } }
  function flyTo(where){ inOffice = where === "office"; Object.assign(goal, inOffice ? OFFICE : {...HOME, yaw:goal.yaw}); onPick({kind:"view", office:inOffice}); }

  // ── loop ──
  let last = 0, t = 0, tick = 0, lastScreens = 0;
  const tmp = new T.Vector3();
  (function loop(ts){
    requestAnimationFrame(loop);
    if(!isActive() || document.hidden || !stage.clientWidth) return;
    if(ts - last < (reduceMotion ? 200 : 33)) return;
    const dt = last ? Math.min(.1, (ts - last) / 1000) : .033; last = ts; t += dt;
    if(!drag && !pinch && !inOffice && !reduceMotion) goal.yaw += dt * .05;
    for(const k of ["yaw", "pitch", "dist", "tx", "ty", "tz"]) orbit[k] += (goal[k] - orbit[k]) * Math.min(1, dt * 3);
    cam.position.set(orbit.tx + Math.sin(orbit.yaw) * Math.cos(orbit.pitch) * orbit.dist, orbit.ty + Math.sin(orbit.pitch) * orbit.dist,
      orbit.tz + Math.cos(orbit.yaw) * Math.cos(orbit.pitch) * orbit.dist);
    cam.lookAt(orbit.tx, orbit.ty, orbit.tz);
    if(!reduceMotion){ stepPeople(dt); stepCars(dt); }
    head.rotation.y = Math.sin(t * .5) * .45; head.rotation.x = Math.sin(t * .8) * .05;   // the boss glances from screen to screen
    armL.position.y = .38 + Math.max(0, Math.sin(t * 14)) * .02; armR.position.y = .38 + Math.max(0, Math.sin(t * 14 + 1.5)) * .02;   // typing
    beacon.material.opacity = .5 + .5 * Math.sin(t * 3);
    for(const tw of Object.values(towers)){ const st = tw.state, fresh = st.beamUntil && Date.now() < st.beamUntil;
      tw.ring.material.opacity = st.on ? .55 + .4 * Math.sin(t * 3) : .12; tw.ring.scale.setScalar(st.on ? 1 + .06 * Math.sin(t * 3) : 1);
      tw.mat.emissiveIntensity = st.on ? 1.4 : .45; tw.tip.material.opacity = st.on ? .7 + .3 * Math.sin(t * 2) : .2;
      tw.beam.material.color.setHex(st.beamGood === false ? 0xff3d6e : 0xffd56b);
      tw.beam.material.opacity = fresh ? .3 + .18 * Math.sin(t * 6) : Math.max(0, tw.beam.material.opacity - dt); }
    if(t - lastScreens > .5){ lastScreens = t; tick++; drawScreens(tick); }
    R.render(scene, cam);
    onFrame(id => { const v = id === "hq" ? tmp.set(0, OY + 5.2, 0) : towers[id] ? tmp.copy(towers[id].top) : null; if(!v) return null;
      v.project(cam); return {x:(v.x * .5 + .5) * stage.clientWidth, y:(-v.y * .5 + .5) * stage.clientHeight, behind:v.z > 1}; }, inOffice);
  })(0);

  return {
    setStates(st){ for(const [id, s] of Object.entries(st)) if(towers[id]) towers[id].state = s; },
    setMeme(M){ MDATA = M; drawScreens(tick); },
    flyTo, get inOffice(){ return inOffice; },
    stats:{people:NP, cars:NC},
  };
}
