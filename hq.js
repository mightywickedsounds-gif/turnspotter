// The HQ penthouse (README round 40), imported by city.js. A glass box on top of the HQ tower, at roughly human scale
// (1 unit ≈ 1 metre): you sit in the boss's chair at an executive desk facing the south window, with three monitors in front
// of you. The middle one is the PC (tap it to use it: index.html opens the BossOS desktop); the left one charts the bot
// team, the right one is a live terminal. Behind you: a lounge with a sofa, a holographic market globe, a bar and the
// house robot, who looks out of the window. The screens are canvases redrawn with live data.
// Round 41: real furniture, wood and concrete textures and a night-city light probe (HDRI) from Poly Haven (CC0, in
// assets/hq), loaded the first time you visit (loadAssets); a ceiling spotlight casts real shadows. Until they arrive
// (or if they can't load) the hand-built stand-ins below are shown.
export function buildPenthouse(T, {parent, OY, glowTex, canvasTex, R, mobile = false, lite = false}){
  const g = new T.Group(); g.position.y = OY; parent.add(g);
  const W = 5.6, D = 5.6, H = 2.7, hw = W / 2, hd = D / 2;
  const add = (geo, mat, x, y, z, ry = 0, rx = 0, rz = 0) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m; };
  const std = (o) => new T.MeshStandardMaterial(o), phys = o => new T.MeshPhysicalMaterial(o);
  const glow = (hex, s, op = 1) => { const m = new T.Sprite(new T.SpriteMaterial({map:glowTex, color:hex, blending:T.AdditiveBlending, transparent:true, depthWrite:false, opacity:op})); m.scale.set(s, s, 1); return m; };
  const aniso = R.capabilities.getMaxAnisotropy();
  const rnd = (() => { let a = 77; return () => (a = (a * 16807) % 2147483647) / 2147483647; })();
  const FB = {sofa:[], table:[], plant:[], lamp:[]};   // stand-ins, hidden when the real models load
  const fb = (k, m) => { FB[k].push(m); return m; };

  // ── surfaces ──
  const marble = canvasTex(1024, 1024, (c, w, h) => { c.fillStyle = "#16141c"; c.fillRect(0, 0, w, h);
    for(let k = 0; k < 90; k++){ c.strokeStyle = `rgba(${150 + rnd() * 80},${150 + rnd() * 70},${170 + rnd() * 60},${.04 + rnd() * .12})`; c.lineWidth = .6 + rnd() * 2.2;
      c.beginPath(); let x = rnd() * w, y = rnd() * h; c.moveTo(x, y); for(let s = 0; s < 14; s++){ x += (rnd() - .5) * 120; y += (rnd() - .3) * 90; c.lineTo(x, y); } c.stroke(); }
    c.strokeStyle = "rgba(0,0,0,.55)"; c.lineWidth = 3; for(let k = 0; k <= 4; k++){ c.beginPath(); c.moveTo(k * w / 4, 0); c.lineTo(k * w / 4, h); c.stroke(); c.beginPath(); c.moveTo(0, k * h / 4); c.lineTo(w, k * h / 4); c.stroke(); } });
  marble.wrapS = marble.wrapT = T.RepeatWrapping; marble.repeat.set(1.4, 1.4); marble.anisotropy = aniso;
  const wood = canvasTex(1024, 256, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#3b2416"); gr.addColorStop(1, "#2a170d"); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    for(let k = 0; k < 160; k++){ c.strokeStyle = `rgba(${90 + rnd() * 60},${50 + rnd() * 30},${25 + rnd() * 15},${.15 + rnd() * .3})`; c.lineWidth = .5 + rnd() * 1.6;
      const y = rnd() * h; c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(w * .3, y + (rnd() - .5) * 18, w * .7, y + (rnd() - .5) * 18, w, y + (rnd() - .5) * 10); c.stroke(); } });
  wood.anisotropy = aniso;
  const leather = std({color:0x141218, roughness:.55, metalness:.05});
  const steel = std({color:0x9aa0b4, roughness:.25, metalness:.9}), darkMetal = std({color:0x1b1c24, roughness:.35, metalness:.8});
  const floorMat = std({map:marble, roughness:.3, metalness:.1, envMapIntensity:.25});
  add(new T.BoxGeometry(W, .08, D), floorMat, 0, -.04, 0).receiveShadow = true;
  // the slab the penthouse sits on, with an LED edge you can see from the street
  add(new T.BoxGeometry(W + .3, .35, D + .3), std({color:0x101018, roughness:.6, metalness:.5}), 0, -.26, 0);
  for(const [x, z, w, d] of [[0, hd + .16, W + .3, .03], [0, -hd - .16, W + .3, .03], [hw + .16, 0, .03, D + .3], [-hw - .16, 0, .03, D + .3]])
    add(new T.BoxGeometry(w, .04, d), new T.MeshBasicMaterial({color:0x45d4ff}), x, -.18, z);
  // ceiling with light strips
  const ceilMat = std({color:0x1a1a20, roughness:.95});
  add(new T.BoxGeometry(W, .1, D), ceilMat, 0, H + .05, 0);
  for(const x of [-1.6, 0, 1.6]) for(const z of [-1.5, .2, 1.8]){ const d = add(new T.CircleGeometry(.07, 20), new T.MeshBasicMaterial({color:0xfff4e0}), x, H - .005, z, 0, Math.PI / 2);
    const rim = add(new T.RingGeometry(.07, .095, 24), std({color:0x3a3a42, metalness:.8, roughness:.3, side:T.DoubleSide}), x, H - .004, z, 0, Math.PI / 2); }
  add(new T.BoxGeometry(W - .6, .02, .05), new T.MeshBasicMaterial({color:0xff4fa3}), 0, H - .01, -hd + .3);
  // floor-to-ceiling glass with slim mullions
  const glass = phys({color:0x9fd6ff, transparent:true, opacity:.06, roughness:.04, metalness:0, envMapIntensity:.02, specularIntensity:.15, depthWrite:false, side:T.DoubleSide});
  const panes = [];
  const wallMat = std({color:0x2a2a30, roughness:.85});
  add(new T.BoxGeometry(W, H, .12), wallMat, 0, H / 2, -hd + .02).receiveShadow = true;
  const art = canvasTex(1024, 640, (c, w, h) => { const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, "#12052e"); gr.addColorStop(1, "#05020f"); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    for(let k = 0; k < 26; k++){ const col = ["#ff4fa3", "#45d4ff", "#ffc44d", "#7b6bff"][k % 4]; c.strokeStyle = col; c.globalAlpha = .25 + rnd() * .6; c.lineWidth = 2 + rnd() * 10;
      c.beginPath(); c.arc(w * (.2 + rnd() * .6), h * (.2 + rnd() * .6), 40 + rnd() * 260, rnd() * 6, rnd() * 6 + 1 + rnd() * 3); c.stroke(); } c.globalAlpha = 1; });
  add(new T.BoxGeometry(1.74, 1.1, .04), std({color:0x0b0b0e, roughness:.4, metalness:.6}), -1.1, 1.62, -hd + .1);
  add(new T.PlaneGeometry(1.66, 1.02), new T.MeshBasicMaterial({map:art, toneMapped:false}), -1.1, 1.62, -hd + .125);
  const artLight = new T.SpotLight(0xffe6c8, 12, 3, .5, .6, 2); artLight.position.set(-1.1, H - .1, -hd + .7); artLight.target.position.set(-1.1, 1.5, -hd); g.add(artLight, artLight.target);
  for(const [x, z, ry, len] of [[0, hd, 0, W], [hw, 0, Math.PI / 2, D], [-hw, 0, -Math.PI / 2, D]]){
    const p = add(new T.PlaneGeometry(len, H), glass, x, H / 2, z, ry); panes.push(p);
    for(let k = 0; k <= 4; k++){ const o = -len / 2 + k * len / 4, m = add(new T.BoxGeometry(.05, H, .05), darkMetal, 0, H / 2, 0);
      m.position.set(x + (ry === 0 || ry === Math.PI ? o : 0), H / 2, z + (ry === 0 || ry === Math.PI ? 0 : o)); }
    const sill = add(new T.BoxGeometry(len, .06, .08), darkMetal, x, .03, z, ry); }

  // ── the desk you sit at (facing the south window) ──
  const DZ = 1.55;
  const deskMat = std({map:wood, roughness:.35, metalness:.05});
  const deskTop = add(new T.BoxGeometry(2.6, .06, .9), deskMat, 0, .74, DZ); deskTop.castShadow = deskTop.receiveShadow = true;
  add(new T.BoxGeometry(2.6, .02, .02), new T.MeshBasicMaterial({color:0xffb04d}), 0, .705, DZ - .45);   // amber under-glow strip
  for(const x of [-1.2, 1.2]) add(new T.BoxGeometry(.06, .72, .8), steel, x, .36, DZ);
  add(new T.BoxGeometry(2.3, .45, .03), deskMat, 0, .48, DZ + .4).castShadow = true;
  // three monitors: canvases are drawn by drawMonitors()
  const mon = (w, h, cw, ch, x, z, ry) => { const tex = canvasTex(cw, ch, c => { c.fillStyle = "#05070d"; c.fillRect(0, 0, cw, ch); }); tex.anisotropy = aniso;
    const grp = new T.Group(); grp.position.set(x, 1.12, z); grp.rotation.y = ry; g.add(grp);
    const bez = new T.Mesh(new T.BoxGeometry(w + .03, h + .03, .03), std({color:0x08080c, roughness:.3, metalness:.6})); bez.position.z = .016; grp.add(bez);
    const scr = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({map:tex, toneMapped:false})); scr.rotation.y = Math.PI; grp.add(scr);
    const arm = new T.Mesh(new T.BoxGeometry(.05, .36, .05), steel); arm.position.set(0, -h / 2 - .14, .06); grp.add(arm);
    const foot = new T.Mesh(new T.BoxGeometry(.32, .015, .22), steel); foot.position.set(0, -h / 2 - .32, .06); grp.add(foot);
    const back = new T.PointLight(0x7fb8ff, 1.5, 1.6, 2); back.position.set(0, 0, -.25); grp.add(back);   // screen light on the desk
    return {tex, scr, grp}; };
  const main = mon(1.04, .62, 1600, 960, 0, DZ + .3, 0), left = mon(.7, .42, 1024, 614, -.98, DZ + .12, -.5), right = mon(.7, .42, 1024, 614, .98, DZ + .12, .5);
  // keyboard (RGB), mouse, PC tower with a glass side, a mug, a desk lamp
  add(new T.BoxGeometry(.46, .02, .15), std({color:0x15151c, roughness:.4}), 0, .78, DZ - .2);
  const kbGlow = add(new T.BoxGeometry(.44, .004, .13), new T.MeshBasicMaterial({color:0x45d4ff, transparent:true, opacity:.22}), 0, .792, DZ - .2);
  add(new T.CapsuleGeometry(.025, .04, 4, 8), std({color:0x15151c, roughness:.3}), .34, .785, DZ - .2, 0, Math.PI / 2);
  add(new T.BoxGeometry(.28, .5, .5), darkMetal, 1.05, .25, DZ + .05);
  const rgb = add(new T.BoxGeometry(.005, .42, .42), new T.MeshBasicMaterial({color:0xff4fa3, transparent:true, opacity:.7}), .905, .25, DZ + .05);
  add(new T.CylinderGeometry(.04, .035, .1, 16), std({color:0xe8e4dc, roughness:.3}), -.62, .82, DZ - .15);
  fb("lamp", add(new T.CylinderGeometry(.08, .1, .02, 16), steel, -1.1, .78, DZ + .25));
  fb("lamp", add(new T.CylinderGeometry(.01, .01, .45, 8), steel, -1.1, 1, DZ + .25));
  fb("lamp", add(new T.ConeGeometry(.09, .1, 16, 1, true), std({color:0x22222a, roughness:.4, side:T.DoubleSide}), -1.1, 1.22, DZ + .2));
  const lampL = new T.PointLight(0xffc98a, 6, 4, 2); lampL.position.set(-1.1, 1.15, DZ + .1); g.add(lampL);
  // your chair: you sit in it, so only the arm-rests show at the bottom of the view
  const chair = new T.Group(); chair.position.set(0, 0, .35); g.add(chair);
  for(const x of [-.32, .32]){ const a = new T.Mesh(new T.BoxGeometry(.07, .05, .45), leather); a.position.set(x, .68, .05); chair.add(a); }
  { const s = new T.Mesh(new T.BoxGeometry(.6, .12, .55), leather); s.position.y = .5; chair.add(s);
    const b = new T.Mesh(new T.BoxGeometry(.58, .85, .1), leather); b.position.set(0, 1.0, -.3); b.rotation.x = -.12; chair.add(b);
    const st = new T.Mesh(new T.CylinderGeometry(.04, .04, .4, 12), steel); st.position.y = .25; chair.add(st);
    for(let k = 0; k < 5; k++){ const leg = new T.Mesh(new T.BoxGeometry(.04, .03, .32), steel); leg.position.set(Math.sin(k * 1.257) * .16, .05, Math.cos(k * 1.257) * .16); leg.rotation.y = k * 1.257; chair.add(leg); } }

  // ── the lounge behind you ──
  const fabric = std({color:0x2a2440, roughness:.9});
  fb("sofa", add(new T.BoxGeometry(2.2, .42, .85), fabric, -1.1, .21, -2.05));
  fb("sofa", add(new T.BoxGeometry(2.2, .5, .2), fabric, -1.1, .55, -2.4));
  for(const x of [-2.15, -.05]) fb("sofa", add(new T.BoxGeometry(.18, .55, .85), fabric, x, .28, -2.05));
  fb("table", add(new T.BoxGeometry(1.1, .05, .6), std({color:0x0b0b10, roughness:.05, metalness:.3}), -1.1, .38, -1.1));
  for(const [x, z] of [[-1.6, -1.35], [-.6, -1.35], [-1.6, -.85], [-.6, -.85]]) fb("table", add(new T.CylinderGeometry(.015, .015, .36, 8), steel, x, .18, z));
  add(new T.PlaneGeometry(2.8, 2), std({color:0x2a1836, roughness:1}), -1.1, .005, -1.2, 0, -Math.PI / 2).receiveShadow = true;   // rug
  // a holographic market globe over the coffee table
  const holo = new T.Group(); holo.position.set(-1.1, .8, -1.1); g.add(holo);
  holo.add(new T.Mesh(new T.SphereGeometry(.22, 20, 14), new T.MeshBasicMaterial({color:0x45d4ff, wireframe:true, transparent:true, opacity:.35, blending:T.AdditiveBlending, depthWrite:false})));
  { const pts = []; for(let k = 0; k < 120; k++){ const a = rnd() * Math.PI * 2, e = (rnd() - .5) * Math.PI; pts.push(Math.cos(a) * Math.cos(e) * .23, Math.sin(e) * .23, Math.sin(a) * Math.cos(e) * .23); }
    const pg = new T.BufferGeometry(); pg.setAttribute("position", new T.Float32BufferAttribute(pts, 3));
    holo.add(new T.Points(pg, new T.PointsMaterial({color:0xff4fa3, size:.02, transparent:true, opacity:.9, blending:T.AdditiveBlending, depthWrite:false}))); }
  const holoBeam = add(new T.CylinderGeometry(.2, .05, .38, 20, 1, true), new T.MeshBasicMaterial({color:0x45d4ff, transparent:true, opacity:.12, blending:T.AdditiveBlending, depthWrite:false, side:T.DoubleSide}), -1.1, .58, -1.1);
  // the bar on the north wall: shelves of glowing bottles
  add(new T.BoxGeometry(1.6, 1, .5), std({color:0x121218, roughness:.25, metalness:.4}), 1.6, .5, -2.4);
  add(new T.BoxGeometry(1.6, .04, .55), std({color:0xd8d4e8, roughness:.1, metalness:.2}), 1.6, 1.02, -2.4);
  add(new T.BoxGeometry(1.7, 1.2, .05), std({color:0x0a0a10, roughness:.4}), 1.6, 1.85, -2.76);
  for(const y of [1.45, 1.85, 2.25]){ add(new T.BoxGeometry(1.5, .02, .2), new T.MeshBasicMaterial({color:0xffb04d}), 1.6, y - .02, -2.66);
    for(let k = 0; k < 9; k++){ const c = [0x7dffc2, 0xffc44d, 0xff4fa3, 0x45d4ff, 0xffffff][k % 5];
      add(new T.CylinderGeometry(.03, .035, .2 + rnd() * .1, 10), std({color:c, emissive:c, emissiveIntensity:.35, roughness:.1, transparent:true, opacity:.8}), .95 + k * .16, y + .1, -2.64); } }
  // a tall plant and a floor lamp in the corners
  fb("plant", add(new T.CylinderGeometry(.18, .14, .45, 16), std({color:0xd8d4e0, roughness:.4}), -2.35, .22, 2.3));
  for(let k = 0; k < 9; k++){ const l = fb("plant", add(new T.ConeGeometry(.12, .9, 6), std({color:0x1f6b3a, roughness:.6}), -2.35 + (rnd() - .5) * .3, .85 + rnd() * .3, 2.3 + (rnd() - .5) * .3));
    l.rotation.set((rnd() - .5) * .9, 0, (rnd() - .5) * .9); }
  { const lx = 2.4, lz = -1.4, arc = new T.QuadraticBezierCurve3(new T.Vector3(0, .05, 0), new T.Vector3(0, 2.45, 0), new T.Vector3(-.85, 1.85, 0));
    add(new T.CylinderGeometry(.17, .19, .05, 32), std({color:0x111114, roughness:.15, metalness:.3}), lx, .025, lz);
    const tube = add(new T.TubeGeometry(arc, 40, .014, 8), steel, lx, 0, lz); tube.castShadow = true;
    const shade = add(new T.SphereGeometry(.17, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), std({color:0xd8d8dc, roughness:.25, metalness:.9, side:T.DoubleSide}), lx - .85, 1.82, lz);
    const bulb = add(new T.SphereGeometry(.05, 12, 8), new T.MeshBasicMaterial({color:0xfff0d0}), lx - .85, 1.75, lz); }
  const lampF = new T.PointLight(0xffd8a0, 10, 6, 2); lampF.position.set(1.55, 1.68, -1.4); g.add(lampF);
  for(const [x, z] of [[-1.4, 1.2], [1.4, 1.2], [-1.4, -1.4], [1.4, -1.4]]){ const l = new T.PointLight(0xcfe0ff, 9, 6, 2); l.position.set(x, H - .25, z); g.add(l); }
  const fill = new T.HemisphereLight(0x9fb4ff, 0x2a1830, .9); fill.position.y = 2; g.add(fill);   // soft bounce light inside the glass box
  // a warm ceiling spotlight that casts real shadows (furniture, desk, the robot)
  const key = new T.SpotLight(0xffeedd, 40, 9, 1.05, .6, 1.6); key.position.set(-.3, H - .08, -.2); key.target.position.set(-.4, 0, -.4);
  key.castShadow = !lite; key.shadow.mapSize.set(mobile ? 512 : 1024, mobile ? 512 : 1024); key.shadow.bias = -.0006; key.shadow.normalBias = .02; key.shadow.camera.near = .2; key.shadow.camera.far = 6; g.add(key, key.target);
  // ── the house robot: stands at the east window looking out over the city ──
  const bot = new T.Group(); bot.position.set(2.1, 0, .2); bot.rotation.y = Math.PI / 2; g.add(bot);
  const suit = std({color:0x1c1f2c, roughness:.5, metalness:.15}), chrome = std({color:0xd0d6e8, roughness:.15, metalness:1}), joint = std({color:0x2c2f3a, roughness:.35, metalness:.85});
  const part = (geo, mat, x, y, z, parent2 = bot) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent2.add(m); return m; };
  const hips = part(new T.CapsuleGeometry(.13, .14, 6, 12), suit, 0, .93, 0); hips.rotation.z = Math.PI / 2; hips.scale.z = .8;
  for(const x of [-.1, .1]){ part(new T.CapsuleGeometry(.075, .3, 6, 12), suit, x, .72, 0); part(new T.SphereGeometry(.065, 14, 10), joint, x, .5, 0);
    part(new T.CapsuleGeometry(.062, .3, 6, 12), suit, x, .3, 0); part(new T.BoxGeometry(.11, .07, .27), std({color:0x0c0c0e, roughness:.3}), x, .035, .05); }
  const torso = part(new T.CapsuleGeometry(.19, .3, 8, 16), suit, 0, 1.22, 0); torso.scale.z = .68;
  part(new T.BoxGeometry(.13, .24, .01), std({color:0xeef0f6, roughness:.6}), 0, 1.3, .128);
  const tie = part(new T.BoxGeometry(.045, .22, .012), std({color:0xff3d6e, emissive:0x661020}), 0, 1.27, .136);
  part(new T.CylinderGeometry(.045, .055, .1, 14), chrome, 0, 1.52, 0);
  const head = new T.Group(); head.position.y = 1.67; bot.add(head);
  const skull = part(new T.SphereGeometry(.13, 28, 20), chrome, 0, 0, 0, head); skull.scale.set(.95, 1.05, 1);
  const visor = part(new T.CapsuleGeometry(.03, .13, 4, 12), new T.MeshBasicMaterial({color:0x45d4ff}), 0, .02, .115, head); visor.rotation.z = Math.PI / 2;
  for(const x of [-.13, .13]) part(new T.CylinderGeometry(.03, .03, .03, 12), joint, x, 0, 0, head).rotation.z = Math.PI / 2;   // "ears"
  const arm = side => { const sh = new T.Group(); sh.position.set(side * .245, 1.42, 0); bot.add(sh); part(new T.SphereGeometry(.07, 14, 10), joint, 0, 0, 0, sh);
    part(new T.CapsuleGeometry(.055, .22, 6, 12), suit, 0, -.16, 0, sh);
    const el = new T.Group(); el.position.y = -.32; sh.add(el); part(new T.SphereGeometry(.05, 12, 10), joint, 0, 0, 0, el);
    part(new T.CapsuleGeometry(.048, .2, 6, 12), suit, 0, -.14, 0, el); part(new T.SphereGeometry(.045, 12, 10), chrome, 0, -.29, 0, el);
    return {sh, el}; };
  const armL = arm(-1), armR = arm(1);
  armL.sh.rotation.z = -.08; armL.el.rotation.x = -.15;
  const coffee = part(new T.CylinderGeometry(.035, .03, .1, 14), std({color:0xeae6de, roughness:.4}), 0, -.31, .05, armR.el);

  // ── the monitors' content ──
  const money = v => (v >= 0 ? "+$" : "−$") + Math.abs(v).toFixed(2);
  const ago = ms => { const m = Math.max(0, Math.round(ms / 6e4)); return m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}` : `${Math.floor(m / 1440)}d`; };
  const wall = document.createElement("canvas"); wall.width = 1600; wall.height = 960;
  { const c = wall.getContext("2d"), gr = c.createLinearGradient(0, 0, 0, 960); gr.addColorStop(0, "#160a3a"); gr.addColorStop(.6, "#3a0f5c"); gr.addColorStop(1, "#ff4fa3");
    c.fillStyle = gr; c.fillRect(0, 0, 1600, 960);
    for(let x = 0; x < 1600; x += 18 + rnd() * 40){ const h = 140 + rnd() * 420, w = 20 + rnd() * 60; c.fillStyle = "#0b0620"; c.fillRect(x, 960 - h, w, h);
      for(let y = 960 - h + 8; y < 960; y += 14) for(let xx = x + 4; xx < x + w - 4; xx += 10) if(rnd() < .35){ c.fillStyle = rnd() < .5 ? "#ffb35c" : "#7fd8ff"; c.fillRect(xx, y, 4, 6); } } }
  const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
  const posValue = (p, live) => { const px = live && live[p.mint]; return px ? p.qty * px * .99 : p.last ? p.last.value : p.stake; };
  function drawMain(M, live, tick){
    const c = main.tex.userData.c.getContext("2d"), W2 = 1600, H2 = 960; c.drawImage(wall, 0, 0);
    // window: Live Trades
    const X = 60, Y = 46, WW = 1480, WH = 790; c.fillStyle = "rgba(14,14,24,.94)"; rr(c, X, Y, WW, WH, 16); c.fill();
    c.fillStyle = "#1d1d2c"; rr(c, X, Y, WW, 56, 16); c.fill(); c.fillRect(X, Y + 30, WW, 26);
    c.font = "600 26px system-ui, sans-serif"; c.fillStyle = "#eaf0ff"; c.textBaseline = "middle"; c.fillText("📈  Live Trades · BossOS", X + 24, Y + 29);
    c.fillStyle = "#8b95bd"; c.font = "26px system-ui"; c.fillText("—    ▢    ✕", X + WW - 170, Y + 29);
    if(!M || !M.bots){ c.fillStyle = "#8b95bd"; c.font = "30px system-ui"; c.fillText("Waiting for the bots' first report…", X + 40, Y + 120); }
    else {
      const pos = Object.entries(M.bots).flatMap(([id, b]) => b.positions.map(p => ({...p, bot:b.name, v:posValue(p, live)}))).map(p => ({...p, pnl:p.v - p.stake})).sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));
      const open = pos.reduce((a, p) => a + p.pnl, 0);
      c.font = "700 34px system-ui"; c.fillStyle = open >= 0 ? "#3ee6a2" : "#ff4f7d"; c.fillText(`Open P&L ${money(open)}`, X + 30, Y + 104);
      c.font = "500 24px system-ui"; c.fillStyle = "#b9bfe8"; c.fillText(`${pos.length} open positions · prices ${live && live._t ? "live " + new Date(live._t).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit", second:"2-digit"}) : "from the last bot run"}`, X + 450, Y + 104);
      if(tick % 2){ c.fillStyle = "#ff3d6e"; c.beginPath(); c.arc(X + WW - 50, Y + 104, 9, 0, 7); c.fill(); }
      const cols = [["BOT", 0], ["COIN", 330], ["SIZE", 560], ["NOW", 720], ["P&L", 900], ["%", 1100], ["HELD", 1260]];
      c.font = "600 22px ui-monospace, monospace"; c.fillStyle = "#6f78a8"; for(const [h, x] of cols) c.fillText(h, X + 30 + x, Y + 158);
      c.font = "26px ui-monospace, monospace";
      pos.slice(0, 13).forEach((p, k) => { const y = Y + 204 + k * 44, up = p.pnl >= 0;
        if(k % 2 === 0){ c.fillStyle = "rgba(255,255,255,.03)"; c.fillRect(X + 16, y - 21, WW - 32, 42); }
        c.fillStyle = "#eaf0ff"; c.fillText(p.bot.slice(0, 16), X + 30, y); c.fillStyle = "#ffc44d"; c.fillText(String(p.sym).slice(0, 10), X + 360, y);
        c.fillStyle = "#b9bfe8"; c.fillText(`$${p.stake.toFixed(2)}`, X + 590, y); c.fillText(`$${p.v.toFixed(2)}`, X + 750, y);
        c.fillStyle = up ? "#3ee6a2" : "#ff4f7d"; c.fillText(money(p.pnl), X + 930, y); c.fillText(`${up ? "▲" : "▼"}${Math.abs(p.pnl / p.stake * 100).toFixed(1)}%`, X + 1130, y);
        c.fillStyle = "#8b95bd"; c.fillText(ago(Date.now() - p.openedAt), X + 1290, y); });
      if(!pos.length){ c.fillStyle = "#8b95bd"; c.fillText("No open positions right now.", X + 30, Y + 210); }
    }
    // taskbar
    c.fillStyle = "rgba(10,10,18,.88)"; c.fillRect(0, H2 - 72, W2, 72);
    const icons = ["#45d4ff", "#ffc44d", "#7dffc2", "#ff4fa3", "#b07bff", "#3ee6a2"];
    icons.forEach((col, k) => { const x = W2 / 2 - icons.length * 34 + k * 68; c.fillStyle = k === 0 ? "rgba(255,255,255,.12)" : "transparent"; rr(c, x - 4, H2 - 64, 58, 58, 10); c.fill();
      c.fillStyle = col; rr(c, x + 8, H2 - 52, 34, 34, 8); c.fill(); });
    c.fillStyle = "#eaf0ff"; c.font = "500 24px system-ui"; c.fillText(new Date().toLocaleTimeString([], {hour:"numeric", minute:"2-digit"}), W2 - 140, H2 - 36);
    main.tex.needsUpdate = true;
  }
  function drawLeft(M){
    const c = left.tex.userData.c.getContext("2d"), w = 1024, h = 614; c.fillStyle = "#060812"; c.fillRect(0, 0, w, h);
    if(!M || !M.bots){ left.tex.needsUpdate = true; return; }
    const team = Object.values(M.bots), total = team.reduce((a, b) => a + (b.value ?? b.cash), 0), start = team.reduce((a, b) => a + b.start, 0), up = total >= start;
    c.fillStyle = "#ffc44d"; c.font = "700 30px system-ui"; c.textBaseline = "middle"; c.fillText("BOT TEAM · PAPER", 30, 40);
    c.fillStyle = up ? "#3ee6a2" : "#ff4f7d"; c.font = "800 70px system-ui"; c.fillText(`$${total.toFixed(2)}`, 30, 115);
    c.font = "600 28px system-ui"; c.fillText(`${money(total - start)} since start`, 32, 172);
    const pts = new Map(); for(const b of team) for(const [tt, v] of b.equity.slice(-200)) pts.set(Math.round(tt / 3e5), (pts.get(Math.round(tt / 3e5)) || 0) + v);
    const eq = [...pts.entries()].sort((a, b) => a[0] - b[0]).map(e => e[1]).slice(-200);
    if(eq.length > 1){ const lo = Math.min(...eq), hi = Math.max(...eq), X = i => 30 + i / (eq.length - 1) * (w - 60), Y = v => h - 40 - (v - lo) / ((hi - lo) || 1) * 330;
      const gr = c.createLinearGradient(0, h - 370, 0, h - 40); gr.addColorStop(0, up ? "rgba(62,230,162,.35)" : "rgba(255,79,125,.35)"); gr.addColorStop(1, "rgba(0,0,0,0)");
      c.beginPath(); eq.forEach((v, i) => i ? c.lineTo(X(i), Y(v)) : c.moveTo(X(i), Y(v))); c.lineTo(X(eq.length - 1), h - 40); c.lineTo(30, h - 40); c.fillStyle = gr; c.fill();
      c.beginPath(); eq.forEach((v, i) => i ? c.lineTo(X(i), Y(v)) : c.moveTo(X(i), Y(v))); c.strokeStyle = up ? "#3ee6a2" : "#ff4f7d"; c.lineWidth = 4; c.stroke(); }
    left.tex.needsUpdate = true;
  }
  const termLines = []; let termSeen = 0;
  function drawRight(M, tick){
    const c = right.tex.userData.c.getContext("2d"), w = 1024, h = 614; c.fillStyle = "#020a04"; c.fillRect(0, 0, w, h);
    if(M && M.tape){ const fresh = M.tape.filter(e => e.t > termSeen).slice(0, 12).reverse();
      for(const e of fresh) termLines.push({txt:`[${new Date(e.t).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}] ${e.say || e.txt}`, col:e.kind === "rug" || e.kind === "reject" ? "#ff6b8a" : e.kind === "buy" ? "#ffd56b" : "#7dffc2"});
      if(fresh.length) termSeen = Math.max(...M.tape.map(e => e.t));
      if(M.funnel && tick % 20 === 0) termLines.push({txt:`> scan: ${M.funnel.found} found → ${M.funnel.checked} rug-checked → ${M.funnel.passed} passed → ${M.funnel.bought} bought`, col:"#45d4ff"}); }
    while(termLines.length > 15) termLines.shift();
    c.font = "24px ui-monospace, monospace"; c.textBaseline = "top"; c.fillStyle = "#3ee6a2"; c.fillText("rugdesk@hq:~$ tail -f team.log", 22, 16);
    termLines.forEach((l, k) => { c.fillStyle = l.col; c.fillText(l.txt.slice(0, 74), 22, 56 + k * 36); });
    if(tick % 2) { c.fillStyle = "#3ee6a2"; c.fillRect(22, 56 + termLines.length * 36, 14, 26); }
    right.tex.needsUpdate = true;
  }

  // ── real assets (Poly Haven, CC0): night-city HDRI for reflections, wood/concrete textures, furniture models ──
  let assetsAsked = false;
  async function loadAssets(){
    if(assetsAsked || lite) return; assetsAsked = true;
    const base = new URL("assets/hq/", location.href).href, JSM = "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/";
    let GLTFLoader, RGBELoader;
    try{ [{GLTFLoader}, {RGBELoader}] = await Promise.all([import(JSM + "loaders/GLTFLoader.js"), import(JSM + "loaders/RGBELoader.js")]); }catch(e){ return; }
    let env = null;
    if(!mobile) try{ const hdr = await new RGBELoader().loadAsync(base + "night_city_1k.hdr"); const pm = new T.PMREMGenerator(R); env = pm.fromEquirectangular(hdr).texture; hdr.dispose(); pm.dispose();
      g.traverse(o => { const m = o.material; if(m && m.isMeshStandardMaterial){ m.envMap = env; m.envMapIntensity = m === glass ? .02 : m.metalness > .5 ? 1.1 : .5; m.needsUpdate = true; } }); }catch(e){}
    const tl = new T.TextureLoader(), tex = (f, srgb, rx = 1, ry = 1) => { const t = tl.load(base + "tex/" + f); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = aniso; if(srgb) t.colorSpace = T.SRGBColorSpace; return t; };
    Object.assign(floorMat, {map:tex("dark_wood_diffuse.jpg", true, 3, 3), normalMap:tex("dark_wood_nor_gl.jpg", false, 3, 3), roughnessMap:tex("dark_wood_rough.jpg", false, 3, 3), roughness:.9, metalness:0, envMapIntensity:.6, color:new T.Color(0xffffff)});
    floorMat.normalScale.set(.6, .6); floorMat.needsUpdate = true;
    Object.assign(deskMat, {map:tex("wood_table_001_diffuse.jpg", true, 2, .7), normalMap:tex("wood_table_001_nor_gl.jpg", false, 2, .7), roughnessMap:tex("wood_table_001_rough.jpg", false, 2, .7), roughness:.8, color:new T.Color(0xc8b8a8)}); deskMat.needsUpdate = true;
    Object.assign(ceilMat, {map:tex("concrete_wall_008_diffuse.jpg", true, 3, 3), color:new T.Color(0x55555c)}); ceilMat.needsUpdate = true;
    Object.assign(wallMat, {map:tex("concrete_wall_008_diffuse.jpg", true, 2, 1), normalMap:tex("concrete_wall_008_nor_gl.jpg", false, 2, 1), color:new T.Color(0x77737a), roughness:.95}); wallMat.needsUpdate = true;
    const gl = new GLTFLoader();
    const put = async (name, x, y, z, ry = 0, sc = 1, hide) => { try{ const o = (await gl.loadAsync(`${base}${name}/${name}.gltf`)).scene;
      o.position.set(x, y, z); o.rotation.y = ry; o.scale.setScalar(sc);
      o.traverse(m => { if(m.isMesh){ m.castShadow = m.receiveShadow = true; if(env && m.material){ m.material.envMap = env; m.material.envMapIntensity = .7; } } });
      g.add(o); if(hide) FB[hide].forEach(m => { m.visible = false; }); return o; }catch(e){ return null; } };
    await Promise.all([
      put("sofa_03", -1.1, 0, -2.3, 0, 1, "sofa"),
      put("throw_pillows_01", -1.75, .52, -2.32, 0, 1),
      put("modern_coffee_table_01", -1.1, 0, -1.1, Math.PI / 2, 1, "table"),
      put("mid_century_lounge_chair", -2.15, 0, -.45, 2.2, 1),
      put("potted_plant_02", -2.3, 0, 2.25, .6, 1.9, "plant"),
      put("potted_plant_02", 2.35, 0, -1.75, 2.1, 1.6),
      put("desk_lamp_arm_01", -1.18, .77, DZ + .32, .9, .75, "lamp"),
      put("standing_picture_frame_01", .62, .77, DZ + .12, Math.PI - .4, 1.2),   // the photo faces you
      put("wooden_display_shelves_01", -2.55, 0, .9, 0, 1.15),
      put("modern_ceiling_lamp_01", -1.1, H - 1.17, -1.1, 0, 1),
    ]);
  }

  return {
    loadAssets,
    group:g, OY, eye:new T.Vector3(0, OY + 1.22, .2), panes,
    pickPC:[main.scr], pickBot:[torso],
    setSeated(on){ chair.children.forEach((c, i) => { c.visible = !on || i < 2; }); },   // you're in it: only the arm-rests show
    drawMonitors(M, live, tick){ drawMain(M, live, tick); if(tick % 4 === 0) drawLeft(M); drawRight(M, tick); },
    animate(t){
      holo.rotation.y = t * .5; holoBeam.material.opacity = .1 + .05 * Math.sin(t * 3);
      rgb.material.color.setHSL((t * .08) % 1, 1, .55); kbGlow.material.color.setHSL((t * .08 + .5) % 1, 1, .55);
      head.rotation.y = Math.sin(t * .23) * .9; head.rotation.x = Math.sin(t * .5) * .06;   // looks around, now and then back at you
      const sip = Math.max(0, Math.sin(t * .4)); armR.sh.rotation.x = -.25 - sip * .35; armR.el.rotation.x = -1.35 - sip * .45;   // sips his coffee
      armL.sh.rotation.x = Math.sin(t * .3) * .06; bot.position.y = Math.sin(t * 1.3) * .004;
    },
  };
}
