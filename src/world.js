// Builds the castle: geometry, colliders, doors, lights, animated bits.
//
// ── MAP (x east, z south, y up; all sizes in meters) ─────────────────────────
//  COURTYARD   x[-17,17]  z[14,42]   ground y=0, spawn (0,38) facing -z
//  FACADE      wall z[13,14] x[-48,30] h16, gate hole x[-2.4,2.4] h5.4
//  ENTRANCE    x[-10,10]  z[-6,13]   h9.6
//  GREAT HALL  x[-44,-12] z[-12,8]   h13, enchanted ceiling at y13
//  CORRIDOR    x[12,46]   z[0,8]     h6.6, windows north / torches south
//  CLASSROOM   x[34,46]   z[9,21]    h5.2 (locked - Alohomora)
//  VISTA       x[-9,2]    z[-15,-7]  Grand Staircase view behind a railing
//  STAIRWELL   x[5,9]     z[-15,-6]  ramp y0 → y-5
//  DUNGEON     x[-30,9]   z[-24,-16] floor y=-5 (dark! Dementors patrol here)
//  POTIONS     x[-42,-31] z[-24,-16] floor y=-5 (locked - Alohomora)
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  stoneTexture, flagstoneTexture, woodTexture, starsTexture, glowTexture,
  moonTexture, bannerTexture, portraitTexture, blackboardTexture, signTexture,
} from './textures.js';

const DEG = Math.PI / 180;

class Door {
  constructor(opts, mats) {
    const { x, z, width, height, axis, double: dbl, locked, name, baseY = 0, swing = 1 } = opts;
    this.name = name;
    this.id = opts.id;
    this.locked = locked;
    this.axis = axis;
    this.revealed = true; // the Room of Requirement's door starts hidden
    this.openT = 0;
    this.target = 0;
    this.center = new THREE.Vector3(x, baseY + height / 2, z);
    this.baseY = baseY;
    this.height = height;
    this.group = new THREE.Group();
    this.leaves = [];
    this.meshes = [];

    const t = 0.14; // leaf thickness
    const leafW = dbl ? width / 2 : width;
    const makeLeaf = (hingeSign) => {
      const pivot = new THREE.Group();
      const geo = axis === 'x'
        ? new THREE.BoxGeometry(leafW, height, t)
        : new THREE.BoxGeometry(t, height, leafW);
      const mesh = new THREE.Mesh(geo, mats.doorWood);
      if (axis === 'x') mesh.position.set(hingeSign * leafW / 2, height / 2, 0);
      else mesh.position.set(0, height / 2, hingeSign * leafW / 2);
      mesh.userData.door = this;
      pivot.add(mesh);
      // iron bands
      for (const fy of [0.25, 0.75]) {
        const band = new THREE.Mesh(
          axis === 'x' ? new THREE.BoxGeometry(leafW * 0.96, 0.09, t + 0.03)
                       : new THREE.BoxGeometry(t + 0.03, 0.09, leafW * 0.96),
          mats.iron
        );
        band.position.copy(mesh.position);
        band.position.y = baseY ? height * fy : height * fy;
        band.position.y = height * fy;
        band.userData.door = this;
        pivot.add(band);
      }
      // ring handle near the free edge
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 8, 16), mats.iron);
      const edge = hingeSign * (leafW - 0.28);
      if (axis === 'x') { ring.position.set(edge, height * 0.45, t / 2 + 0.03); }
      else { ring.position.set(t / 2 + 0.03, height * 0.45, edge); ring.rotation.y = Math.PI / 2; }
      ring.userData.door = this;
      pivot.add(ring);
      if (axis === 'x') pivot.position.set(x - hingeSign * width / 2, baseY, z);
      else pivot.position.set(x, baseY, z - hingeSign * width / 2);
      this.group.add(pivot);
      this.leaves.push({ pivot, hingeSign });
      this.meshes.push(mesh);
      return pivot;
    };
    makeLeaf(1);
    if (dbl) makeLeaf(-1);
    this.swing = swing;

    const halfW = width / 2 + 0.06;
    this.aabb = axis === 'x'
      ? { minX: x - halfW, maxX: x + halfW, minZ: z - 0.22, maxZ: z + 0.22, minY: baseY, maxY: baseY + height }
      : { minX: x - 0.22, maxX: x + 0.22, minZ: z - halfW, maxZ: z + halfW, minY: baseY, maxY: baseY + height };
  }

  get blocking() { return this.revealed && this.openT < 0.35; }

  unlock() {
    if (!this.locked) return false;
    this.locked = false;
    this.target = 1;
    return true;
  }

  interact() {
    if (this.locked) return 'locked';
    this.target = this.target > 0.5 ? 0 : 1;
    return this.target > 0.5 ? 'open' : 'close';
  }

  update(dt) {
    const speed = this.target > this.openT ? 0.9 : 1.4;
    this.openT += Math.sign(this.target - this.openT) * Math.min(Math.abs(this.target - this.openT), speed * dt);
    for (const { pivot, hingeSign } of this.leaves) {
      // 85° max — past 90° a leaf sweeps back into the wall it hangs in
      pivot.rotation.y = this.swing * hingeSign * this.openT * 1.48;
    }
  }
}

export function buildWorld(scene) {
  const colliders = [];
  const regions = [];   // flat floor rects: {minX,maxX,minZ,maxZ,y}
  const ramps = [];     // sloped rects:     {minX,maxX,minZ,maxZ, z0,y0, z1,y1}
  const surfaces = [];  // non-collider ledges things can rest on: {minX..maxZ, y}
  const doors = [];
  const updatables = [];
  const flickerLights = [];
  const staticG = new THREE.Group();
  const doorsG = new THREE.Group();
  scene.add(staticG, doorsG);

  // ── materials ──────────────────────────────────────────────────────────────
  // Big-area materials (walls, floors, wood, cloth) use cheap Lambert shading —
  // in a dark torch-lit castle the difference from full PBR is negligible, but
  // the per-light per-pixel cost drops a lot. Metals/glass keep PBR for shine.
  const mats = {
    stone: new THREE.MeshLambertMaterial({ map: stoneTexture({ seed: 7 }) }),
    stoneDark: new THREE.MeshLambertMaterial({ map: stoneTexture({ base: [64, 66, 76], seed: 13 }) }),
    // cylinders need their own repeats or the bricks stretch to giants around the curve
    stoneTower: new THREE.MeshLambertMaterial({ map: stoneTexture({ seed: 8, repeatX: 6, repeatY: 5 }) }),
    stoneColumn: new THREE.MeshLambertMaterial({ map: stoneTexture({ seed: 11, repeatX: 2, repeatY: 4 }) }),
    floor: new THREE.MeshLambertMaterial({ map: flagstoneTexture({ seed: 21 }) }),
    floorDark: new THREE.MeshLambertMaterial({ map: flagstoneTexture({ base: [62, 62, 70], seed: 33 }) }),
    doorWood: new THREE.MeshLambertMaterial({ map: woodTexture({ seed: 5 }) }),
    wood: new THREE.MeshLambertMaterial({ map: woodTexture({ base: [96, 66, 40], seed: 9 }) }),
    woodDark: new THREE.MeshLambertMaterial({ map: woodTexture({ base: [58, 40, 26], seed: 15 }) }),
    iron: new THREE.MeshStandardMaterial({ color: 0x2a2c30, metalness: 0.8, roughness: 0.55 }),
    metal: new THREE.MeshStandardMaterial({ color: 0xb8bcc4, metalness: 0.85, roughness: 0.35 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xc9a545, metalness: 0.8, roughness: 0.35 }),
    slate: new THREE.MeshLambertMaterial({ color: 0x1f2733 }),
    carpet: new THREE.MeshLambertMaterial({ color: 0x4a1218, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    candleWax: new THREE.MeshLambertMaterial({ color: 0xe8e2d0 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xbfd4e8, transparent: true, opacity: 0.22, roughness: 0.15, metalness: 0.1 }),
  };
  const glowTex = glowTexture('rgba(255,220,160,1)');
  const coldGlowTex = glowTexture('rgba(190,220,255,1)');
  // wall decals (windows, banners…) hug their walls; polygon offset stops the
  // shimmering z-fight stripes at distance/grazing angles
  const DECAL = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };

  // ── helpers ────────────────────────────────────────────────────────────────
  // Static geometry is accumulated per material and merged into ONE mesh per
  // material at the end of the build — hundreds of draw calls become a dozen.
  const mergeBins = new Map();
  function addMerged(geo, mat) {
    let bin = mergeBins.get(mat);
    if (!bin) { bin = []; mergeBins.set(mat, bin); }
    bin.push(geo);
  }
  function flushMerged() {
    for (const [mat, geos] of mergeBins) {
      const merged = mergeGeometries(geos, false);
      const m = new THREE.Mesh(merged, mat);
      staticG.add(m);
      for (const g of geos) g.dispose();
    }
    mergeBins.clear();
  }

  function box(x1, y1, z1, x2, y2, z2, mat, opt = {}) {
    const w = x2 - x1, h = y2 - y1, d = z2 - z1;
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    addMerged(g, mat);
    if (opt.collide !== false) {
      colliders.push({ minX: x1, maxX: x2, minY: y1, maxY: y2, minZ: z1, maxZ: z2 });
    }
  }

  // wall along X with holes: holes = [{x1,x2,h,sill=0}]
  function wallX(x1, x2, z1, z2, y1, y2, mat, holes = [], opt = {}) {
    let cur = x1;
    const sorted = [...holes].sort((a, b) => a.x1 - b.x1);
    for (const hole of sorted) {
      if (hole.x1 > cur) box(cur, y1, z1, hole.x1, y2, z2, mat, opt);
      box(hole.x1, y1 + hole.h, z1, hole.x2, y2, z2, mat, opt); // lintel
      if (hole.sill) box(hole.x1, y1, z1, hole.x2, y1 + hole.sill, z2, mat, opt);
      cur = hole.x2;
    }
    if (cur < x2) box(cur, y1, z1, x2, y2, z2, mat, opt);
  }

  function wallZ(z1, z2, x1, x2, y1, y2, mat, holes = [], opt = {}) {
    let cur = z1;
    const sorted = [...holes].sort((a, b) => a.z1 - b.z1);
    for (const hole of sorted) {
      if (hole.z1 > cur) box(x1, y1, cur, x2, y2, hole.z1, mat, opt);
      box(x1, y1 + hole.h, hole.z1, x2, y2, hole.z2, mat, opt);
      cur = hole.z2;
    }
    if (cur < z2) box(x1, y1, cur, x2, y2, z2, mat, opt);
  }

  function cylinder(x, y, z, r, h, mat, opt = {}) {
    const g = new THREE.CylinderGeometry(r, r, h, opt.seg || 20);
    g.translate(x, y + h / 2, z);
    addMerged(g, mat);
    if (opt.collide) {
      const cr = r * 0.85;
      colliders.push({ minX: x - cr, maxX: x + cr, minY: y, maxY: y + h, minZ: z - cr, maxZ: z + cr });
    }
  }

  // ── flames (torches, candles, fireplace) as pooled Points ─────────────────
  const flameDefs = []; // {x,y,z,phase,amp,unlit}
  const ignitables = []; // unlit sconces waiting for Incendio
  function addFlame(x, y, z, amp = 0.05, unlit = false) {
    const def = { x, y, z, phase: Math.random() * Math.PI * 2, amp, unlit };
    flameDefs.push(def);
    return def;
  }

  // unlit=true registers an Incendio target; withLight=false keeps it flame-only
  // (point lights are expensive — dark areas get real light, lit areas don't need it)
  function torch(x, y, z, facing, unlit = false, withLight = true) {
    // facing: direction the torch points away from the wall ('n','s','e','w')
    const off = { n: [0, -0.16], s: [0, 0.16], e: [0.16, 0], w: [-0.16, 0] }[facing];
    const stick = new THREE.CylinderGeometry(0.03, 0.035, 0.5, 8);
    if (facing === 'n') stick.rotateX(-0.5);
    else if (facing === 's') stick.rotateX(0.5);
    else if (facing === 'e') stick.rotateZ(-0.5);
    else stick.rotateZ(0.5);
    stick.translate(x + off[0] * 0.6, y, z + off[1] * 0.6);
    addMerged(stick, mats.woodDark);
    const cup = new THREE.CylinderGeometry(0.06, 0.035, 0.1, 8);
    cup.translate(x + off[0] * 1.6, y + 0.22, z + off[1] * 1.6);
    addMerged(cup, mats.iron);
    const fx = x + off[0] * 1.6, fy = y + 0.36, fz = z + off[1] * 1.6;
    const def = addFlame(fx, fy, fz, 0.05, unlit);
    let light = null;
    if (unlit && withLight) {
      light = pointLight(fx, fy + 0.2, fz, 0xffa050, 5.5, 11, 0.35);
      light.on = false; // dark until Incendio
    }
    // every torch joins the ignite/extinguish system, lit ones included;
    // call sites may attach a dedicated room light via `.light = pointLight(...)`
    const ig = { x: fx, y: fy, z: fz, defs: [def], light, lit: !unlit };
    ignitables.push(ig);
    return ig;
  }

  // a cluster of real candles you can light with Incendio
  function candelabra(x, y, z, withLight = false) {
    const stand = new THREE.CylinderGeometry(0.025, 0.1, 0.24, 8);
    stand.translate(x, y + 0.12, z);
    addMerged(stand, mats.iron);
    const tray = new THREE.CylinderGeometry(0.19, 0.19, 0.025, 10);
    tray.translate(x, y + 0.25, z);
    addMerged(tray, mats.iron);
    const defs = [];
    for (const [ox, oz] of [[-0.11, -0.06], [0.11, -0.06], [0, 0.12]]) {
      const c = new THREE.CylinderGeometry(0.026, 0.03, 0.24, 6);
      c.translate(x + ox, y + 0.38, z + oz);
      addMerged(c, mats.candleWax);
      defs.push(addFlame(x + ox, y + 0.55, z + oz, 0.03, true));
    }
    let light = null;
    if (withLight) {
      light = pointLight(x, y + 0.8, z, 0xffb168, 4, 9, 0.35);
      light.on = false;
    }
    ignitables.push({ x, y: y + 0.5, z, defs, light, lit: false });
  }

  function ignite(ig) {
    if (ig.lit) return false;
    ig.lit = true;
    for (const d of ig.defs) d.unlit = false;
    if (ig.light) ig.light.on = true;
    return true;
  }

  // Props Wingardium Leviosa can pick up — individual meshes, never merged
  const liftG = new THREE.Group();
  scene.add(liftG);
  function liftable(mesh, name, restH) {
    mesh.userData.liftable = true;
    mesh.userData.name = name;
    mesh.userData.restH = restH;
    liftG.add(mesh);
  }

  // Aguamenti undoes Incendio: douse anything burning (its light goes with it)
  function extinguish(ig) {
    if (!ig.lit) return false;
    ig.lit = false;
    for (const d of ig.defs) d.unlit = true;
    if (ig.light) ig.light.on = false;
    return true;
  }

  // Ambient lights are DESCRIPTORS, not real GPU lights. A fixed pool of
  // POOL_SIZE PointLights is reassigned each frame to the sources nearest the
  // player — every pixel pays for 8 lights instead of ~26, and the light count
  // never changes so shaders never recompile.
  const lightDescs = [];
  function pointLight(x, y, z, color, intensity, distance, flicker = 0) {
    const d = {
      x, y, z, color, intensity, distance, on: true,
      amp: flicker, phase: Math.random() * 9, speed: 6 + Math.random() * 5,
    };
    lightDescs.push(d);
    return d;
  }
  const POOL_SIZE = 8;
  const lightPool = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const l = new THREE.PointLight(0xffffff, 0, 10, 2);
    scene.add(l);
    lightPool.push(l);
  }

  // ═══ SKY, MOON, GROUND ══════════════════════════════════════════════════
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(240, 32, 16),
    new THREE.MeshBasicMaterial({ map: starsTexture({ seed: 99 }), side: THREE.BackSide, fog: false })
  );
  scene.add(sky);

  const moonDir = new THREE.Vector3(-45, 55, -35).normalize();
  const moonSpr = new THREE.Sprite(new THREE.SpriteMaterial({
    map: moonTexture(), fog: false, transparent: true, depthWrite: false,
  }));
  moonSpr.position.copy(moonDir).multiplyScalar(195);
  moonSpr.scale.set(38, 38, 1);
  scene.add(moonSpr);

  const moon = new THREE.DirectionalLight(0xa9c3ff, 2.1);
  moon.position.copy(moonDir).multiplyScalar(80);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 5, far: 220 });
  moon.shadow.bias = -0.0002;
  moon.shadow.normalBias = 0.8; // kills striped shadow-acne at grazing angles
  scene.add(moon, moon.target);

  const hemi = new THREE.HemisphereLight(0x2c3a5e, 0x0b0c12, 0.65);
  scene.add(hemi);

  // Dark terrain, in four slabs that leave a hole over the dungeon stairwell —
  // a single 600×600 plane capped the shaft at y=-0.05 and hid the staircase
  // from anyone looking in from the Entrance Hall.
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x0c121d });
  for (const [x1, z1, x2, z2] of [
    [-300, -300, 300, -16], // north of the shaft
    [-300, -6, 300, 300],   // south of it
    [-300, -16, 4, -6],     // west strip beside it
    [10, -16, 300, -6],     // east strip beside it
  ]) {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(x2 - x1, z2 - z1), groundMat);
    g.rotation.x = -Math.PI / 2;
    g.position.set((x1 + x2) / 2, -0.05, (z1 + z2) / 2);
    g.receiveShadow = true;
    scene.add(g);
  }

  // ═══ COURTYARD ═════════════════════════════════════════════════════════
  box(-17, -0.2, 14, 17, 0, 42, mats.floor, { collide: false });
  // perimeter walls
  box(-18, 0, 42, 18, 6.5, 43, mats.stone, { castShadow: true });
  box(-18, 0, 14, -17, 6.5, 43, mats.stone, { castShadow: true });
  box(17, 0, 14, 18, 6.5, 43, mats.stone, { castShadow: true });
  // battlements
  const bat = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.7, 0.5), mats.stone, 90);
  {
    const m4 = new THREE.Matrix4();
    let i = 0;
    for (let x = -17.4; x <= 17.4 && i < 90; x += 1.8) m4.setPosition(x, 6.85, 42.5), bat.setMatrixAt(i++, m4);
    for (let z = 15; z <= 42 && i < 90; z += 1.8) {
      m4.setPosition(-17.5, 6.85, z); bat.setMatrixAt(i++, m4);
      m4.setPosition(17.5, 6.85, z); bat.setMatrixAt(i++, m4);
    }
    for (let x = -47; x <= 29 && i < 90; x += 2.2) m4.setPosition(x, 16.35, 13.5), bat.setMatrixAt(i++, m4);
    bat.count = i;
  }
  staticG.add(bat);

  // fountain
  cylinder(0, 0, 28, 2.2, 0.55, mats.stone, { collide: true, castShadow: true });
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(1.9, 1.9, 0.08, 24),
    new THREE.MeshStandardMaterial({ color: 0x2a4a72, emissive: 0x1c3a5f, emissiveIntensity: 0.5, roughness: 0.2 })
  );
  water.position.set(0, 0.52, 28);
  staticG.add(water);
  cylinder(0, 0.55, 28, 0.22, 1.3, mats.stone);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.55, 0.25, 16), mats.stone);
  bowl.position.set(0, 1.95, 28);
  staticG.add(bowl);

  // cypress trees
  const treeMat = new THREE.MeshLambertMaterial({ color: 0x0d1a12 });
  for (const [tx, tz] of [[-14, 17.5], [14, 17.5], [-14, 39], [14, 39]]) {
    cylinder(tx, 0, tz, 0.14, 1.1, mats.woodDark, { collide: true });
    for (let i = 0; i < 3; i++) {
      const cone = new THREE.ConeGeometry(1.15 - i * 0.3, 2.2, 10);
      cone.translate(tx, 1.6 + i * 1.35, tz);
      addMerged(cone, treeMat);
    }
  }

  // benches
  for (const bx of [-6, 6]) {
    box(bx - 1.1, 0.42, 40.2, bx + 1.1, 0.52, 40.8, mats.wood);
    box(bx - 1, 0, 40.3, bx - 0.8, 0.42, 40.7, mats.stone);
    box(bx + 0.8, 0, 40.3, bx + 1, 0.42, 40.7, mats.stone);
  }

  // courtyard torches on side walls (two are out — Incendio targets)
  torch(-16.7, 3.1, 22, 'e').light = pointLight(-16, 3.4, 28, 0xffa050, 9, 17, 0.35);
  torch(-16.7, 3.1, 34, 'e');
  torch(16.7, 3.1, 22, 'w').light = pointLight(16, 3.4, 28, 0xffa050, 9, 17, 0.35);
  torch(16.7, 3.1, 34, 'w');
  torch(-16.7, 3.1, 18, 'e', true, false);
  torch(16.7, 3.1, 38, 'w', true, false);
  // gate torches on the facade
  torch(-3.6, 3.9, 14.7, 's'); torch(3.6, 3.9, 14.7, 's');
  pointLight(0, 4.4, 15.8, 0xffa050, 13, 17, 0.3);

  // ═══ FACADE + TOWERS + UPPER MASSES ═══════════════════════════════════
  wallX(-48, 30, 13, 14, 0, 16, mats.stone,
    [{ x1: -2.4, x2: 2.4, h: 5.4 }], { castShadow: true, receiveShadow: true });
  // gate arch
  const arch = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.28, 8, 24, Math.PI), mats.stoneDark);
  arch.position.set(0, 5.4, 14.05);
  staticG.add(arch);

  // facade windows (courtyard face) — a few lit, most dark
  {
    const winMat = new THREE.MeshStandardMaterial({ color: 0x1a2438, emissive: 0xffc978, emissiveIntensity: 0.0, roughness: 0.6, ...DECAL });
    const winLitMat = new THREE.MeshStandardMaterial({ color: 0x0c0f18, emissive: 0xffc978, emissiveIntensity: 0.75, roughness: 0.6, ...DECAL });
    let wseed = 3;
    for (const wy of [8.2, 12.2]) {
      for (let wx = -45; wx <= 28; wx += 4.4) {
        if (Math.abs(wx) < 4.6) continue;
        wseed = (wseed * 16807 + 19) % 2147483647;
        const lit = (wseed / 2147483647) > 0.6;
        const wm = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.7), lit ? winLitMat : winMat);
        wm.position.set(wx, wy, 14.06);
        staticG.add(wm);
      }
    }
  }

  // towers: two flanking the gate + far corner + astronomy tower
  for (const [tx, tz, r, h, coneH] of [
    [-16, 14.2, 3.2, 24, 5.5], [16, 14.2, 3.2, 24, 5.5],
    [-46, 13.5, 4.5, 26, 6.5], [28, 13.5, 4.5, 34, 7.5],
  ]) {
    cylinder(tx, 0, tz, r, h, mats.stoneTower, { collide: true, seg: 18 });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r * 1.18, coneH, 18), mats.slate);
    cone.position.set(tx, h + coneH / 2 - 0.1, tz);
    cone.castShadow = true;
    staticG.add(cone);
    for (const wy of [h * 0.45, h * 0.72, h * 0.92]) {
      const wm = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.3),
        new THREE.MeshStandardMaterial({ color: 0x0c0f18, emissive: 0xffd98c, emissiveIntensity: 0.8, ...DECAL }));
      wm.position.set(tx, wy, tz + r + 0.1);
      staticG.add(wm);
    }
  }

  // upper stories + roofs (visual bulk above the interiors)
  box(-12, 9.8, -14, 30, 17, 13, mats.stone, { collide: false, castShadow: true });
  box(-48, 13.4, -14, -12, 18, 13, mats.stone, { collide: false, castShadow: true });
  {
    const roofE = new THREE.Mesh(new THREE.BoxGeometry(40, 7.4, 7.4), mats.slate);
    roofE.position.set(9, 17, -0.5);
    roofE.rotation.x = Math.PI / 4;
    roofE.castShadow = true;
    staticG.add(roofE);
    const roofW = new THREE.Mesh(new THREE.BoxGeometry(34, 8.4, 8.4), mats.slate);
    roofW.position.set(-30, 18, -0.5);
    roofW.rotation.x = Math.PI / 4;
    roofW.castShadow = true;
    staticG.add(roofW);
  }

  // ═══ ENTRANCE HALL ══════════════════════════════════════════════════════
  // floor — cut out at x[5,9] z[-7,-6] where the dungeon stairs descend through
  // the wall band, or the slab caps the stairwell and hides the steps from outside
  box(-12, -0.2, -6, 12, 0, 14, mats.floor, { collide: false });
  box(-12, -0.2, -7, 5, 0, -6, mats.floor, { collide: false });
  box(9, -0.2, -7, 12, 0, -6, mats.floor, { collide: false });
  box(-12, 9.6, -7, 12, 10, 14, mats.stoneDark, { collide: false }); // ceiling
  // west wall (shared with Great Hall, full hall height)
  wallZ(-13, 13, -12, -10, 0, 13, mats.stone, [{ z1: 2, z2: 6, h: 4.5 }]);
  // east wall (arch to corridor)
  wallZ(-7, 13, 10, 12, 0, 9.6, mats.stone, [{ z1: 2, z2: 6, h: 4.5 }]);
  // north wall (vista opening + dungeon stair opening)
  wallX(-12, 12, -7, -6, 0, 9.6, mats.stone, [
    { x1: -6, x2: -1, h: 4 },
    { x1: 5, x2: 9, h: 3.2 },
  ]);

  // columns
  for (const cx of [-7, 7]) {
    for (const cz of [-3, 1.5, 6, 10.5]) {
      cylinder(cx, 0, cz, 0.5, 9.6, mats.stoneColumn, { collide: true, seg: 12 });
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.35, 1.4), mats.stoneDark);
      cap.position.set(cx, 9.4, cz);
      staticG.add(cap);
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.4, 1.3), mats.stoneDark);
      base.position.set(cx, 0.2, cz);
      staticG.add(base);
    }
  }

  // red carpet from gate
  {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(3, 17.5), mats.carpet);
    c.rotation.x = -Math.PI / 2;
    c.position.set(0, 0.013, 4.2);
    staticG.add(c);
  }

  // house-point hourglasses along the north wall
  const houses = ['gryffindor', 'slytherin', 'ravenclaw', 'hufflepuff'];
  const sandColors = [0xd3352b, 0x2fae66, 0x3a6bd8, 0xe8c832];
  const houseSands = [];
  houses.forEach((h, i) => {
    const hx = 0 + i * 1.5;
    box(hx - 0.32, 0, -5.95, hx + 0.32, 0.85, -5.35, mats.stoneDark, { collide: false });
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 1.15, 12), mats.glass);
    glass.position.set(hx, 1.45, -5.65);
    staticG.add(glass);
    const sand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 0.5, 10),
      new THREE.MeshStandardMaterial({ color: sandColors[i], emissive: sandColors[i], emissiveIntensity: 0.55 })
    );
    sand.position.set(hx, 1.2, -5.65);
    staticG.add(sand);
    houseSands.push(sand);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.09, 12), mats.gold);
    cap.position.set(hx, 2.06, -5.65);
    staticG.add(cap);
  });
  // the player's house hourglass tracks their points (bottom edge stays put)
  let pointsHouseIdx = 0;
  function setHouse(i) {
    pointsHouseIdx = Math.max(0, Math.min(3, i));
    // reset all columns to their idle look first
    for (const sand of houseSands) {
      sand.scale.y = 1;
      sand.position.y = 1.2;
    }
  }
  function setHousePoints(n) {
    const sand = houseSands[pointsHouseIdx];
    if (!sand) return;
    const s = Math.max(0.2, Math.min(1.7, 0.3 + n / 70));
    sand.scale.y = s;
    sand.position.y = 0.95 + 0.25 * s;
  }
  colliders.push({ minX: -0.5, maxX: 5, minY: 0, maxY: 2.1, minZ: -6, maxZ: -5.3 });

  // chandelier
  {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.07, 8, 24), mats.iron);
    ring.position.set(0, 6.6, 4);
    ring.rotation.x = Math.PI / 2;
    staticG.add(ring);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 3, 6), mats.iron);
    chain.position.set(0, 8.1, 4);
    staticG.add(chain);
    const chandDefs = [];
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      const cx = Math.cos(a) * 1.2, cz = 4 + Math.sin(a) * 1.2;
      const cnd = new THREE.CylinderGeometry(0.035, 0.035, 0.35, 6);
      cnd.translate(cx, 6.8, cz);
      addMerged(cnd, mats.candleWax);
      chandDefs.push(addFlame(cx, 7.05, cz, 0.03));
    }
    // the whole chandelier ignites/douses as one
    ignitables.push({
      x: 0, y: 6.9, z: 4, defs: chandDefs,
      light: pointLight(0, 6.4, 4, 0xffb168, 9, 24, 0.18), lit: true,
    });
  }

  // wall torches (the unlit ones are Incendio practice — flame-only, no light cost)
  torch(-9.7, 3.4, 0, 'e'); torch(-9.7, 3.4, 9, 'e');
  torch(9.7, 3.4, 0, 'w'); torch(9.7, 3.4, 9, 'w');
  torch(-9.7, 3.4, -4, 'e', true, false);
  torch(9.7, 3.4, -4, 'w', true, false);
  pointLight(0, 3.4, -5, 0xffb168, 3.5, 12, 0.25);

  // framed, torch-lit doorway to the dungeon stairs (so it reads as a passage,
  // not a black wall)
  box(4.55, 0, -6.45, 5.15, 3.5, -5.95, mats.stoneDark);
  box(8.85, 0, -6.45, 9.45, 3.5, -5.95, mats.stoneDark);
  box(4.55, 3.2, -6.45, 9.45, 3.75, -5.95, mats.stoneDark, { collide: false });
  torch(4.85, 2.7, -5.85, 's').light = pointLight(7, 3, -5.2, 0xffa050, 7, 13, 0.3);
  torch(9.15, 2.7, -5.85, 's');
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.62),
    new THREE.MeshStandardMaterial({ map: signTexture('DUNGEONS'), roughness: 0.9, ...DECAL }));
  sign.position.set(10.7, 2.8, -5.9);
  staticG.add(sign);

  // an unlit candelabra on a pedestal — early Incendio practice
  box(-7.9, 0, -5.8, -7.1, 0.9, -5.0, mats.stoneDark);
  candelabra(-7.5, 0.9, -5.4);

  // vista railing
  box(-6, 0, -6.7, -1, 0.12, -6.5, mats.stoneDark);
  for (let rx = -6; rx <= -1; rx += 0.62) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.95, 8), mats.iron);
    post.position.set(rx, 0.55, -6.6);
    staticG.add(post);
  }
  box(-6.1, 0.98, -6.68, -0.9, 1.08, -6.52, mats.woodDark);
  colliders.push({ minX: -6.2, maxX: -0.8, minY: 0, maxY: 1.1, minZ: -6.75, maxZ: -6.45 });

  // ═══ GRAND STAIRCASE VISTA ══════════════════════════════════════════════
  box(-10, -0.6, -16, 3, -0.4, -7, mats.floorDark, { collide: false });
  box(-10, 12, -16, 3, 12.4, -7, mats.stoneDark, { collide: false });
  wallZ(-16, -7, -10, -9, 0, 12, mats.stone); // west
  wallZ(-16, -7, 2, 3, 0, 12, mats.stone);    // east
  wallX(-10, 3, -16, -15, 0, 12, mats.stone); // north
  // wall above the vista opening up to the shaft ceiling (the main wall already
  // fills y 0..9.6 including the lintel — duplicating it caused z-fighting)
  box(-10, 9.6, -7, 3, 12, -6, mats.stone, { collide: false });

  // floating staircases (two of them slowly swing)
  function stairFlight(x, y, z, ry, swingAmp, swingSpeed) {
    const g = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 0.34), mats.stoneDark);
      st.position.set(0, i * 0.24, -i * 0.36);
      g.add(st);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 2.9), mats.woodDark);
    rail.position.set(0.72, 1.05, -1.25);
    rail.rotation.x = 0.58;
    g.add(rail);
    g.position.set(x, y, z);
    g.rotation.y = ry;
    staticG.add(g);
    if (swingAmp) updatables.push((dt, t) => { g.rotation.y = ry + Math.sin(t * swingSpeed) * swingAmp; });
    return g;
  }
  stairFlight(-7.2, 1.8, -12.6, 0.55, 0, 0);
  stairFlight(-2.2, 4.2, -12.8, -0.8, 0.32, 0.42);
  stairFlight(-5.8, 6.9, -9.8, 2.3, 0.26, 0.33);

  // portraits
  let pseed = 1;
  function portrait(x, y, z, ry) {
    const g = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.14, 1.52, 0.07), mats.gold);
    const art = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 1.34),
      new THREE.MeshStandardMaterial({ map: portraitTexture(pseed++), roughness: 0.9, ...DECAL }));
    art.position.z = 0.06;
    g.add(frame, art);
    g.position.set(x, y, z);
    g.rotation.y = ry;
    staticG.add(g);
    const phase = Math.random() * 9;
    updatables.push((dt, t) => { g.rotation.z = Math.sin(t * 0.4 + phase) * 0.025; });
  }
  portrait(-8.94, 2.6, -9.3, Math.PI / 2);
  portrait(-8.94, 2.6, -11.4, Math.PI / 2);
  portrait(-8.94, 4.9, -10.3, Math.PI / 2);
  portrait(-7, 3.4, -14.94, 0);
  portrait(-4.4, 2.7, -14.94, 0);
  portrait(-1.8, 3.6, -14.94, 0);
  portrait(2.94, 3, -10.5, -Math.PI / 2);
  pointLight(-4, 4.6, -11, 0xffb168, 11, 22, 0.2);
  torch(-8.6, 2.6, -8.6, 'e'); torch(2.6, 2.6, -8.6, 'w');

  // ═══ GREAT HALL ═════════════════════════════════════════════════════════
  box(-45, -0.2, -13, -10, 0, 9, mats.floor, { collide: false });
  wallZ(-13, 9, -45, -44, 0, 13, mats.stone);            // west
  wallX(-45, -10, -13, -12, 0, 13, mats.stone);          // north
  wallX(-45, -12, 8, 9, 0, 13, mats.stone);              // south
  // enchanted ceiling — the night sky, indoors
  const hallSkyTex = starsTexture({ density: 1400, seed: 77 });
  const hallSky = new THREE.Mesh(
    new THREE.PlaneGeometry(33, 21),
    new THREE.MeshBasicMaterial({ map: hallSkyTex, fog: false })
  );
  hallSky.rotation.x = Math.PI / 2;
  hallSky.position.set(-28, 13, -2);
  staticG.add(hallSky);
  updatables.push((dt) => { hallSkyTex.offset.x += dt * 0.0016; });

  // dais + head table
  box(-44, 0, -9, -40, 0.4, 5, mats.stoneDark, { collide: false, receiveShadow: false });
  regions.push({ minX: -44, maxX: -40, minZ: -9, maxZ: 5, y: 0.4 });
  box(-43.1, 1.2, -7.5, -41.5, 1.32, 3.5, mats.wood);
  box(-42.9, 0.4, -7.2, -41.7, 1.2, -6.6, mats.woodDark);
  box(-42.9, 0.4, 2.6, -41.7, 1.2, 3.2, mats.woodDark);
  box(-42.9, 0.4, -2.3, -41.7, 1.2, -1.7, mats.woodDark);
  candelabra(-42.3, 1.32, 0.5); // on the head table
  // golden owl lectern
  cylinder(-40.6, 0.4, -2, 0.14, 1.15, mats.gold);
  const owl = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), mats.gold);
  owl.position.set(-40.6, 1.75, -2);
  owl.scale.set(0.8, 1.25, 0.8);
  staticG.add(owl);

  // four long house tables + benches
  const goblets = [];
  for (const tz of [-9, -5, 1, 5]) {
    box(-38, 0.68, tz - 0.65, -16, 0.78, tz + 0.65, mats.wood);
    for (let lx = -37; lx <= -17; lx += 5) {
      box(lx - 0.35, 0, tz - 0.5, lx + 0.35, 0.68, tz + 0.5, mats.woodDark, { collide: false });
    }
    colliders.push({ minX: -38, maxX: -16, minY: 0, maxY: 0.8, minZ: tz - 0.7, maxZ: tz + 0.7 });
    for (const bs of [-1.15, 1.15]) {
      box(-38, 0.4, tz + bs - 0.2, -16, 0.47, tz + bs + 0.2, mats.woodDark, { collide: false });
      colliders.push({ minX: -38, maxX: -16, minY: 0, maxY: 0.48, minZ: tz + bs - 0.25, maxZ: tz + bs + 0.25 });
    }
    for (let gx = -37; gx <= -17; gx += 2.6) {
      goblets.push([gx + (tz % 3) * 0.3, 0.78, tz + (gx % 2 ? 0.3 : -0.3)]);
    }
  }
  {
    // proper goblets: foot + stem + cup (three instanced meshes, same slots)
    const foot = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.045, 0.05, 0.016, 8), mats.gold, goblets.length);
    const stem = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.012, 0.014, 0.075, 6), mats.gold, goblets.length);
    const cup = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.055, 0.032, 0.095, 8), mats.gold, goblets.length);
    const m4 = new THREE.Matrix4();
    goblets.forEach(([gx, gy, gz], i) => {
      m4.setPosition(gx, gy + 0.008, gz); foot.setMatrixAt(i, m4);
      m4.setPosition(gx, gy + 0.055, gz); stem.setMatrixAt(i, m4);
      m4.setPosition(gx, gy + 0.14, gz); cup.setMatrixAt(i, m4);
    });
    staticG.add(foot, stem, cup);
  }

  // candelabras down the middle of every house table — unlit, Incendio targets
  // (kept well inside the table span x[-38,-16], on the center line)
  for (const tz of [-9, -5, 1, 5]) {
    for (const cx of [-33.5, -27, -20.5]) {
      candelabra(cx, 0.78, tz);
    }
  }

  // floating candles
  const candleCount = 110;
  const candles = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.035, 0.035, 0.5, 6), mats.candleWax, candleCount);
  candles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const candleBase = [];
  {
    let cs = 5;
    const crand = () => (cs = (cs * 16807 + 19) % 2147483647) / 2147483647;
    for (let i = 0; i < candleCount; i++) {
      candleBase.push({
        x: -40 + crand() * 26, y: 6 + crand() * 1.8, z: -10 + crand() * 16,
        phase: crand() * Math.PI * 2, speed: 0.55 + crand() * 0.5,
      });
    }
  }
  staticG.add(candles);
  const candleFlames = []; // filled every frame alongside the matrices
  updatables.push((dt, t) => {
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < candleCount; i++) {
      const c = candleBase[i];
      const y = c.y + Math.sin(t * c.speed + c.phase) * 0.22;
      m4.setPosition(c.x, y, c.z);
      candles.setMatrixAt(i, m4);
      const f = flameDefs[candleFlameStart + i];
      if (f) f.y = y + 0.32;
    }
    candles.instanceMatrix.needsUpdate = true;
  });
  const candleFlameStart = flameDefs.length;
  for (const c of candleBase) addFlame(c.x, c.y + 0.32, c.z, 0.0);

  // unlit wall sconces for Incendio
  torch(-37, 3.2, -11.7, 's', true, false);
  torch(-19, 3.2, -11.7, 's', true, false);

  // hall lighting — the candle cloud's glow as downward spotlights whose cones
  // cover tables and floor but cannot touch the walls (no sourceless wall pools)
  for (const sx of [-19, -28, -36]) {
    const s = new THREE.SpotLight(0xffb168, 24, 30, 0.72, 0.6, 2);
    s.position.set(sx, 9.5, -2);
    s.target.position.set(sx, 0, -2);
    scene.add(s, s.target);
    flickerLights.push({ l: s, base: 24, amp: 0.12, phase: Math.random() * 9, speed: 6 });
  }

  // fireplace on the north wall
  box(-30.2, 0, -12.9, -25.8, 3.4, -12.1, mats.stoneDark, { collide: false });
  box(-29.4, 0, -12.6, -26.6, 2.3, -12.05, new THREE.MeshStandardMaterial({ color: 0x050505 }), { collide: false });
  const fireDefs = [];
  for (let i = 0; i < 7; i++) fireDefs.push(addFlame(-28 + (i - 3) * 0.28, 0.5 + Math.abs(i - 3) * -0.04 + 0.3, -12.25, 0.1));
  ignitables.push({
    x: -28, y: 1, z: -12.2, defs: fireDefs,
    light: pointLight(-28, 1.4, -11.4, 0xff7a30, 6, 13, 0.5), lit: true,
  });
  colliders.push({ minX: -30.2, maxX: -25.8, minY: 0, maxY: 3.4, minZ: -13, maxZ: -12.05 });

  // banners (north wall + two on the west wall by the dais)
  const bannerHouses = ['gryffindor', 'ravenclaw', 'slytherin', 'hufflepuff'];
  [[-40, -11.88, 0], [-34, -11.88, 0], [-22, -11.88, 0], [-16, -11.88, 0]].forEach(([bx, bz, ry], i) => {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 3.4),
      new THREE.MeshStandardMaterial({ map: bannerTexture(bannerHouses[i]), roughness: 0.9, side: THREE.DoubleSide, ...DECAL }));
    b.position.set(bx, 8.6, bz);
    b.rotation.y = ry;
    staticG.add(b);
  });
  [['gryffindor', -6], ['slytherin', 2]].forEach(([h, bz]) => {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 3.4),
      new THREE.MeshStandardMaterial({ map: bannerTexture(h), roughness: 0.9, side: THREE.DoubleSide, ...DECAL }));
    b.position.set(-43.88, 8.6, bz);
    b.rotation.y = Math.PI / 2;
    staticG.add(b);
  });

  // tall windows on the south wall (moonlit)
  const hallWinMat = new THREE.MeshStandardMaterial({ color: 0x0e1524, emissive: 0x8fa8dd, emissiveIntensity: 0.5, roughness: 0.7, ...DECAL });
  for (const wx of [-40, -34, -28, -22, -16]) {
    const wm = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 5.6), hallWinMat);
    wm.position.set(wx, 6.4, 7.92);
    wm.rotation.y = Math.PI;
    staticG.add(wm);
    const at = new THREE.Mesh(new THREE.CircleGeometry(1.1, 16, 0, Math.PI), hallWinMat);
    at.position.set(wx, 9.2, 7.92);
    at.rotation.y = Math.PI;
    staticG.add(at);
  }

  // ═══ EAST CORRIDOR ══════════════════════════════════════════════════════
  box(10, -0.2, -1, 47, 0, 9, mats.floor, { collide: false });
  box(10, 6.6, -1, 47, 7, 9, mats.stoneDark, { collide: false });
  wallX(12, 47, -1, 0, 0, 6.6, mats.stone);   // north
  // south wall: classroom door + a second hole the Room of Requirement's
  // filler keeps sealed until the room deigns to exist
  wallX(12, 47, 8, 9, 0, 6.6, mats.stone, [
    { x1: 38.9, x2: 41.1, h: 3.2 },
    { x1: 22.9, x2: 25.1, h: 3.2 },
  ]);
  wallZ(-1, 22, 46, 47, 0, 6.6, mats.stone);  // east end

  // carpet runner
  {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(34, 1.8), mats.carpet);
    c.rotation.x = -Math.PI / 2;
    c.position.set(29, 0.012, 4);
    staticG.add(c);
  }

  // windows (north, moonlight side)
  const corrWinMat = new THREE.MeshStandardMaterial({ color: 0x0e1524, emissive: 0x9db8e8, emissiveIntensity: 0.55, roughness: 0.7, ...DECAL });
  for (const wx of [16, 22, 28, 34, 40]) {
    const wm = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 3.2), corrWinMat);
    wm.position.set(wx, 2.8, 0.06);
    staticG.add(wm);
    const at = new THREE.Mesh(new THREE.CircleGeometry(0.85, 14, 0, Math.PI), corrWinMat);
    at.position.set(wx, 4.4, 0.06);
    staticG.add(at);
  }
  pointLight(28, 3, 2, 0x6d87c8, 4.5, 12, 0);

  // torches (south wall) — every second one is out, awaiting Incendio
  for (const tx of [15, 27, 39]) {
    torch(tx, 3.3, 7.8, 'n').light = pointLight(tx, 3.6, 6.9, 0xffa050, 10, 17, 0.3);
  }
  for (const tx of [21, 33, 45]) torch(tx, 3.3, 7.8, 'n', true, false);

  // suits of armor
  for (const ax of [19, 31, 43]) {
    box(ax - 0.55, 0, 6.9, ax + 0.55, 0.35, 8, mats.stoneDark);
    box(ax - 0.21, 0.85, 7.25, ax + 0.21, 1.45, 7.65, mats.metal);      // torso
    box(ax - 0.18, 0.35, 7.3, ax + 0.18, 0.85, 7.6, mats.metal);        // legs
    const helm = new THREE.SphereGeometry(0.16, 10, 8);
    helm.translate(ax, 1.62, 7.45);
    addMerged(helm, mats.metal);
    const plume = new THREE.ConeGeometry(0.07, 0.3, 8);
    plume.translate(ax, 1.86, 7.45);
    addMerged(plume, mats.carpet);
    const spear = new THREE.CylinderGeometry(0.022, 0.022, 2.1, 6);
    spear.translate(ax + 0.34, 1.05, 7.4);
    addMerged(spear, mats.woodDark);
    const tip = new THREE.ConeGeometry(0.05, 0.18, 6);
    tip.translate(ax + 0.34, 2.19, 7.4);
    addMerged(tip, mats.metal);
  }

  // ═══ CHARMS CLASSROOM ═══════════════════════════════════════════════════
  box(33, -0.2, 9, 47, 0, 22, mats.floor, { collide: false });
  box(33, 5.2, 9, 47, 5.6, 22, mats.stoneDark, { collide: false });
  wallZ(9, 22, 33, 34, 0, 5.2, mats.stone);   // west
  wallX(33, 47, 21, 22, 0, 5.2, mats.stone);  // south
  // blackboard on the west wall (the north wall holds the door)
  const bbFrame = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.9, 6.7), mats.woodDark);
  bbFrame.position.set(34.05, 2.5, 15);
  staticG.add(bbFrame);
  const bb = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 2.6), new THREE.MeshStandardMaterial({ map: blackboardTexture(), roughness: 0.95 }));
  bb.position.set(34.1, 2.5, 15);
  bb.rotation.y = Math.PI / 2;
  staticG.add(bb);
  // teacher's desk, facing the class from beside the board
  box(34.7, 0, 12.2, 35.9, 0.85, 14.8, mats.woodDark);
  candelabra(35.3, 0.85, 13.5);
  // student desks in rows facing the west-wall blackboard
  for (const dx of [38.5, 41.5, 44.3]) {
    for (const dz of [12, 15, 18]) {
      box(dx - 0.4, 0.6, dz - 0.85, dx + 0.4, 0.72, dz + 0.85, mats.wood);
      box(dx - 0.32, 0, dz - 0.75, dx + 0.32, 0.6, dz - 0.6, mats.woodDark, { collide: false });
      box(dx - 0.32, 0, dz + 0.6, dx + 0.32, 0.6, dz + 0.75, mats.woodDark, { collide: false });
      colliders.push({ minX: dx - 0.45, maxX: dx + 0.45, minY: 0, maxY: 0.75, minZ: dz - 0.9, maxZ: dz + 0.9 });
    }
  }
  // south windows
  for (const wx of [37, 44]) {
    const wm = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.6),
      new THREE.MeshStandardMaterial({ color: 0x0e1524, emissive: 0x9db8e8, emissiveIntensity: 0.5, ...DECAL }));
    wm.position.set(wx, 2.3, 20.94);
    wm.rotation.y = Math.PI;
    staticG.add(wm);
  }
  pointLight(40, 4.1, 15, 0xffb168, 12, 18, 0.2);
  torch(34.2, 3, 15, 'e');

  // ═══ THE ROOM OF REQUIREMENT ═════════════════════════════════════════════
  // Carved from the dead space between the corridor and the facade
  // (interior x[20,28] z[9,13]). Sealed by a filler wall until revealed.
  box(19, -0.2, 9, 29, 0, 13, mats.floor, { collide: false });
  box(19, 4.6, 9, 29, 5, 13, mats.stoneDark, { collide: false });
  wallZ(9, 13, 19, 20, 0, 4.6, mats.stone);
  wallZ(9, 13, 28, 29, 0, 4.6, mats.stone);
  // hidden things: a crate pile, a wounded cabinet, a cracked mirror
  box(20.4, 0, 12, 21.6, 0.9, 12.9, mats.woodDark);
  box(20.6, 0.9, 12.2, 21.4, 1.5, 12.8, mats.woodDark, { collide: false });
  box(26.2, 0, 11.9, 27.4, 2.5, 12.8, mats.woodDark);
  {
    const cabDoor = new THREE.BoxGeometry(0.1, 2.2, 0.7);
    cabDoor.rotateZ(0.09);
    cabDoor.translate(26.05, 1.1, 12.35);
    addMerged(cabDoor, mats.doorWood);
    const mirrorFrame = new THREE.BoxGeometry(1.3, 2.5, 0.08);
    mirrorFrame.translate(22.6, 1.5, 12.78);
    addMerged(mirrorFrame, mats.gold);
    const mirror = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x27313f, emissive: 0x44586e, emissiveIntensity: 0.35 }));
    mirror.position.set(22.6, 1.45, 12.72);
    mirror.rotation.y = Math.PI;
    staticG.add(mirror);
    const c3 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), mats.woodDark);
    c3.position.set(27.2, 0.21, 9.8);
    liftable(c3, 'crate', 0.21);
  }
  candelabra(21, 1.5, 12.5, true); // unlit atop the crates — the room is dark
  const roomLight = pointLight(24, 3.4, 11, 0x8fa4c8, 4, 12, 0.15);
  roomLight.on = false;

  // the Invisibility Cloak, draped over a stand
  let cloakMesh = null;
  {
    const pole = new THREE.CylinderGeometry(0.03, 0.04, 1.5, 8);
    pole.translate(24, 0.75, 11.5);
    addMerged(pole, mats.woodDark);
    const arm = new THREE.BoxGeometry(0.7, 0.05, 0.05);
    arm.translate(24, 1.5, 11.5);
    addMerged(arm, mats.woodDark);
    const cloakMat = new THREE.MeshBasicMaterial({
      color: 0xbfd6ea, transparent: true, opacity: 0.45, side: THREE.DoubleSide,
    });
    const pts = [[0.5, 0.02], [0.46, 0.3], [0.36, 0.9], [0.3, 1.35], [0.04, 1.55]]
      .map(([r, y]) => new THREE.Vector2(r, y));
    cloakMesh = new THREE.Mesh(new THREE.LatheGeometry(pts, 14), cloakMat);
    cloakMesh.position.set(24, 0.05, 11.5);
    staticG.add(cloakMesh);
    updatables.push((dt2, tt) => {
      if (!cloakMesh.visible) return;
      cloakMesh.rotation.y += dt2 * 0.5;
      cloakMat.opacity = 0.4 + Math.sin(tt * 1.7) * 0.12;
    });
  }

  // the filler that pretends to be plain wall
  const rrFiller = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.2, 1), mats.stone);
  rrFiller.position.set(24, 1.6, 8.5);
  staticG.add(rrFiller);
  const rrCollider = { minX: 22.9, maxX: 25.1, minY: 0, maxY: 3.2, minZ: 8, maxZ: 9 };
  colliders.push(rrCollider);

  // ═══ DUNGEON STAIRWELL ══════════════════════════════════════════════════
  wallZ(-16, -6, 4, 5, -5.2, 9.6, mats.stoneDark);  // west
  wallZ(-16, -6, 9, 10, -5.2, 9.6, mats.stoneDark); // east
  box(4, 3, -16, 10, 3.4, -6, mats.stoneDark, { collide: false }); // low ceiling
  ramps.push({ minX: 5, maxX: 9, minZ: -15, maxZ: -6, zAt0: -6, yAt0: 0, zAt1: -15, yAt1: -5 });
  // visual steps following the ramp
  {
    // From the hall you look at the step TOPS (risers face away downhill), so a
    // uniform material reads as one smooth ramp. Alternate banding makes the
    // stair rhythm visible from above.
    const steps = new THREE.InstancedMesh(new THREE.BoxGeometry(4, 0.3, 0.62), mats.stone, 16);
    const m4 = new THREE.Matrix4();
    const bandA = new THREE.Color(0xffffff), bandB = new THREE.Color(0x6a7080);
    for (let i = 0; i < 16; i++) {
      const z = -6.3 - i * 0.56;
      const y = ((z + 6) / -9) * -5 - 0.15;
      m4.setPosition(7, y, z);
      steps.setMatrixAt(i, m4);
      steps.setColorAt(i, i % 2 ? bandB : bandA);
    }
    steps.frustumCulled = false;
    staticG.add(steps);
  }
  // ramp underside/sides fill
  box(4, -5.2, -16, 10, -5, -6, mats.stoneDark, { collide: false });
  torch(4.35, 1.9, -7.2, 'e');
  // light INSIDE the shaft so the descent reads as stairs, not a black wall
  pointLight(7, 0.4, -10.5, 0xffa050, 7, 14, 0.3);
  // torch on the stairwell's far wall — visible from the Entrance Hall straight
  // through the opening, so the "dead-end wall" reads as a passage going down
  torch(7, 0.6, -14.85, 's').light = pointLight(7, 1.3, -14.2, 0xffa050, 5, 12, 0.3);

  // ═══ DUNGEON ════════════════════════════════════════════════════════════
  box(-43, -5.2, -27, 10, -5, -14, mats.floorDark, { collide: false }); // floor
  box(-43, -0.5, -27, 10, -0.3, -15, mats.stoneDark, { collide: false }); // ceiling (stops at the stair shaft)
  // north wall with two barred cells
  const cellA = { a: -16, b: -12 }, cellB = { a: -6, b: -2 };
  wallX(-31, 10, -25, -24, -5.2, -0.3, mats.stoneDark, [
    { x1: cellA.a, x2: cellA.b, h: 3 },
    { x1: cellB.a, x2: cellB.b, h: 3 },
  ]);
  for (const cell of [cellA, cellB]) {
    box(cell.a - 0.5, -5.2, -27, cell.b + 0.5, -0.3, -26, mats.stoneDark); // back
    box(cell.a - 0.5, -5.2, -26, cell.a, -0.3, -24, mats.stoneDark);
    box(cell.b, -5.2, -26, cell.b + 0.5, -0.3, -24, mats.stoneDark);
    // bars
    for (let bx = cell.a + 0.2; bx <= cell.b - 0.15; bx += 0.42) {
      const bar = new THREE.CylinderGeometry(0.045, 0.045, 3, 6);
      bar.translate(bx, -3.5, -24.15);
      addMerged(bar, mats.iron);
    }
    box(cell.a, -2.1, -24.25, cell.b, -2, -24.05, mats.iron, { collide: false });
    colliders.push({ minX: cell.a, maxX: cell.b, minY: -5.2, maxY: -2, minZ: -24.3, maxZ: -24 });
    // cell clutter
    box(cell.a + 0.6, -5, -25.9, cell.a + 1.6, -4.2, -25.1, mats.woodDark, { collide: false });
    const straw = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 1),
      new THREE.MeshStandardMaterial({ color: 0x6b5a2c, roughness: 1 }));
    straw.position.set(cell.b - 0.9, -5.1, -25.4);
    staticG.add(straw);
  }
  // south wall (stairwell entry hole at x[5,9])
  wallX(-31, 5, -16, -15, -5.2, -0.3, mats.stoneDark);
  // wall above the stair entry hole, sealing the stairwell's north end up to its ceiling
  box(5, -1.8, -16, 9, 3.4, -15, mats.stoneDark, { collide: false });
  // east wall
  wallZ(-25, -15, 9, 10, -5.2, -0.3, mats.stoneDark);
  // west wall with the Potions door
  wallZ(-25, -15, -31, -30, -5.2, -0.3, mats.stoneDark, [{ z1: -21, z2: -18.8, h: 3 }]);

  // props: barrels & crates
  for (const [bx, bz] of [[-27, -17], [-25.8, -17.6], [-26.4, -16.8], [7, -23], [-18, -23.2]]) {
    cylinder(bx, -5, bz, 0.42, 0.95, mats.woodDark, { collide: true, seg: 10 });
  }
  box(-21.5, -5, -24, -20.3, -4.1, -22.8, mats.woodDark);
  box(-20.9, -4.1, -23.7, -20, -3.4, -22.9, mats.woodDark, { collide: false });
  // cold blue glimmers: dark enough for dread, bright enough that a Dementor
  // reads as a black silhouette against the stone
  pointLight(-8, -2.2, -20, 0x35496b, 6.5, 34, 0);
  pointLight(-24, -2.2, -20, 0x35496b, 4.5, 26, 0);
  // a lit torch beside the stair entry, so you can find your way back
  torch(3.5, -2.9, -16.15, 'n').light = pointLight(4, -2.2, -17.5, 0xffa050, 4.5, 10, 0.35);
  // unlit sconces — light them with Incendio [5]
  torch(-22, -2.9, -24.2, 's', true);
  torch(-10, -2.9, -24.2, 's', true);
  torch(0, -2.9, -24.2, 's', true);
  torch(-18, -2.9, -16.15, 'n', true);
  torch(-7, -2.9, -16.15, 'n', true);
  torch(5.15, -1.4, -11, 'e', true);   // half-way down the stairwell

  // ═══ POTIONS STORE ══════════════════════════════════════════════════════
  wallZ(-25, -15, -43, -42, -5.2, -0.3, mats.stoneDark); // west
  wallX(-43, -30, -26, -25, -5.2, -0.3, mats.stoneDark); // north
  wallX(-43, -30, -15, -14, -5.2, -0.3, mats.stoneDark); // south
  // cauldrons — open-mouthed pot: flat base, wide belly, slight neck, flared rim
  const cauldronPts = [
    [0, 0], [0.26, 0], [0.4, 0.06], [0.52, 0.2], [0.55, 0.38],
    [0.5, 0.55], [0.43, 0.66], [0.42, 0.72], [0.47, 0.76],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const cauldronGeo = new THREE.LatheGeometry(cauldronPts, 18);
  const potionColors = [0x59ffa0, 0x7a5cff, 0xff9a3d];
  [[-36, -22], [-39.5, -17.5], [-33, -17]].forEach(([cx, cz], i) => {
    const c = new THREE.Mesh(cauldronGeo, new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.7, metalness: 0.5, side: THREE.DoubleSide }));
    c.position.set(cx, -5, cz);
    staticG.add(c);
    colliders.push({ minX: cx - 0.5, maxX: cx + 0.5, minY: -5, maxY: -4.2, minZ: cz - 0.5, maxZ: cz + 0.5 });
    // brew surface sits INSIDE the pot, narrower than the neck (r 0.42 at y 0.72)
    const brew = new THREE.Mesh(new THREE.CircleGeometry(0.36, 14),
      new THREE.MeshStandardMaterial({ color: potionColors[i], emissive: potionColors[i], emissiveIntensity: 0.9 }));
    brew.rotation.x = -Math.PI / 2;
    brew.position.set(cx, -5 + 0.62, cz);
    staticG.add(brew);
  });
  pointLight(-36, -3.6, -22, 0x59ffa0, 3, 10, 0.3);
  pointLight(-38, -3.2, -18.5, 0xffb168, 1.8, 8, 0.3);
  torch(-41.85, -2.9, -20, 'e', true); // one more sconce for Incendio practice
  // shelves with glowing bottles on the north wall (ledges you can rest things on)
  for (const sy of [-3.6, -2.9, -2.2]) {
    box(-41, sy - 0.05, -24.9, -33, sy, -24.35, mats.woodDark, { collide: false });
    surfaces.push({ minX: -41, maxX: -33, minZ: -24.9, maxZ: -24.35, y: sy });
  }
  {
    // glowing potion bottles — each carries its own colour so they read as
    // potions, not white candles
    // every flask is its own liftable mesh — body+neck+cork baked into one
    // vertex-colored geometry, all 26 sharing a single self-lit material
    const bottleMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const tintGeo = (g, col) => {
      const n = g.attributes.position.count;
      const arr = new Float32Array(n * 3);
      for (let k = 0; k < n; k++) { arr[k * 3] = col.r; arr[k * 3 + 1] = col.g; arr[k * 3 + 2] = col.b; }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      return g;
    };
    const corkCol = new THREE.Color(0x4a3520);
    let bs = 17;
    const brand = () => (bs = (bs * 16807 + 19) % 2147483647) / 2147483647;
    for (let i = 0; i < 26; i++) {
      const sy = [-3.6, -2.9, -2.2][i % 3];
      const bx = -40.6 + brand() * 7.4;
      const col = new THREE.Color().setHSL(brand(), 0.9, 0.42);
      const body = new THREE.SphereGeometry(0.075, 10, 8); // round flask belly
      body.scale(1, 1.15, 1);
      const neck = new THREE.CylinderGeometry(0.02, 0.026, 0.1, 8);
      neck.translate(0, 0.12, 0);
      const cork = new THREE.CylinderGeometry(0.026, 0.026, 0.04, 6);
      cork.translate(0, 0.19, 0);
      const geo = mergeGeometries([tintGeo(body, col), tintGeo(neck, col), tintGeo(cork, corkCol)], false);
      const m = new THREE.Mesh(geo, bottleMat);
      m.position.set(bx, sy + 0.09, -24.6);
      liftable(m, 'bottle', 0.09);
    }
  }
  colliders.push({ minX: -41.2, maxX: -32.8, minY: -5.2, maxY: -2, minZ: -25, maxZ: -24.3 });
  // work table with a candelabra worth lighting
  box(-40, -5, -21.5, -38.4, -4.15, -19.8, mats.woodDark);
  candelabra(-39.2, -4.15, -20.6, true);

  // ═══ FLOOR REGIONS ══════════════════════════════════════════════════════
  regions.push({ minX: -43, maxX: 10, minZ: -27, maxZ: -14, y: -5 }); // dungeon + potions

  // ═══ DOORS ══════════════════════════════════════════════════════════════
  function addDoor(opts) {
    const d = new Door(opts, mats);
    doors.push(d);
    doorsG.add(d.group);
    return d;
  }
  addDoor({ id: 'gate', name: 'Castle Gate', x: 0, z: 13.5, width: 4.8, height: 5.4, axis: 'x', double: true, locked: true, swing: 1 });
  addDoor({ id: 'hall', name: 'Great Hall Doors', x: -11, z: 4, width: 4, height: 4.4, axis: 'z', double: true, locked: false, swing: -1 });
  addDoor({ id: 'classroom', name: 'Charms Classroom', x: 40, z: 8.5, width: 2.2, height: 3.2, axis: 'x', double: false, locked: true, swing: -1 });
  addDoor({ id: 'potions', name: 'Potions Store', x: -30.5, z: -19.9, width: 2.2, height: 3, axis: 'z', double: false, locked: true, baseY: -5, swing: -1 });
  const roomDoor = addDoor({ id: 'room', name: 'Room of Requirement', x: 24, z: 8.5, width: 2.2, height: 3.2, axis: 'x', double: false, locked: false, swing: -1 });
  roomDoor.revealed = false;
  roomDoor.group.visible = false;
  const doorByName = Object.fromEntries(doors.map((d) => [d.id, d]));

  // walking past the blank wall three times makes the door exist
  function revealRoom() {
    if (roomDoor.revealed) return false;
    roomDoor.revealed = true;
    roomDoor.group.visible = true;
    rrFiller.visible = false;
    const i = colliders.indexOf(rrCollider);
    if (i >= 0) colliders.splice(i, 1);
    roomLight.on = true;
    return true;
  }

  function takeCloak() {
    cloakMesh.visible = false;
  }

  // ═══ LIFTABLE PROPS (Wingardium Leviosa) — individual, never merged ══════
  {
    const crateG = new THREE.BoxGeometry(0.42, 0.42, 0.42);
    const c1 = new THREE.Mesh(crateG, mats.woodDark);
    c1.position.set(8.5, 0.21, 11);
    liftable(c1, 'crate', 0.21);
    const c2 = new THREE.Mesh(crateG, mats.woodDark);
    c2.position.set(6, -4.79, -22);
    liftable(c2, 'crate', 0.21);
    const bookMat = new THREE.MeshLambertMaterial({ color: 0x5a2020 });
    const bookG = new THREE.BoxGeometry(0.26, 0.06, 0.2);
    const b1 = new THREE.Mesh(bookG, bookMat);
    b1.position.set(-42.3, 1.35, -4);
    liftable(b1, 'book', 0.03);
    const b2 = new THREE.Mesh(bookG, new THREE.MeshLambertMaterial({ color: 0x23335a }));
    b2.position.set(35.2, 0.88, 12.6);
    liftable(b2, 'book', 0.03);
    const gob = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.032, 0.095, 8), mats.gold);
    gob.position.set(19, 0.4, 7.45);
    liftable(gob, 'goblet', 0.05);
    const flask = new THREE.Group();
    const fbody = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x7a5cff, emissive: 0x7a5cff, emissiveIntensity: 0.7, roughness: 0.3 }));
    const fneck = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.09, 8), mats.glass);
    fneck.position.y = 0.1;
    flask.add(fbody, fneck);
    flask.position.set(-38.6, -4.05, -20.9);
    liftable(flask, 'flask', 0.08);
  }

  // ═══ FLAME PARTICLES (single Points draw call) ═══════════════════════════
  const flameGeo = new THREE.BufferGeometry();
  const flamePos = new Float32Array(flameDefs.length * 3);
  flameDefs.forEach((f, i) => { flamePos.set([f.x, f.y, f.z], i * 3); });
  flameGeo.setAttribute('position', new THREE.BufferAttribute(flamePos, 3));
  const flameMat = new THREE.PointsMaterial({
    color: 0xffa64d, size: 0.34, map: glowTex, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  });
  const flames = new THREE.Points(flameGeo, flameMat);
  flames.frustumCulled = false;
  scene.add(flames);

  // build the per-material merged meshes before shadow flags are applied
  flushMerged();

  // Everything casts & receives moonlight shadows so the castle blocks the moon
  // and interiors stay dark. (Sprites/Points are unaffected.)
  staticG.traverse((m) => {
    if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
  });
  doorsG.traverse((m) => {
    if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
  });

  // ═══ WORLD API ══════════════════════════════════════════════════════════
  function groundHeight(x, z, curY = 10) {
    for (const r of ramps) {
      if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) {
        const t = (z - r.zAt0) / (r.zAt1 - r.zAt0);
        return r.yAt0 + (r.yAt1 - r.yAt0) * Math.min(1, Math.max(0, t));
      }
    }
    let best = 0; // default ground level
    let bestValid = 0 <= curY + 0.55;
    for (const r of regions) {
      if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) {
        if (r.y <= curY + 0.55 && (!bestValid || r.y > best)) { best = r.y; bestValid = true; }
      }
    }
    if (!bestValid) {
      // below everything valid — find the lowest region we're inside
      let low = 0;
      for (const r of regions) {
        if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) low = Math.min(low, r.y);
      }
      return low;
    }
    return best;
  }

  function doorsAnimating() {
    for (const d of doors) if (Math.abs(d.openT - d.target) > 0.001) return true;
    return false;
  }

  const doorAABBs = [];
  function activeColliders() {
    doorAABBs.length = 0;
    for (const d of doors) if (d.blocking) doorAABBs.push(d.aabb);
    return doorAABBs.length ? colliders.concat(doorAABBs) : colliders;
  }

  // Rough ambient light level at a point — sums nearby active light sources
  // plus moonlight outdoors. Mrs. Norris sees much farther in the light.
  function lightLevelAt(x, y, z) {
    let level = 0;
    for (const d of lightDescs) {
      if (!d.on) continue;
      const dd = (d.x - x) ** 2 + (d.y - y) ** 2 + (d.z - z) ** 2;
      level += d.intensity / (1 + dd);
    }
    if (y > -1 && z > 13.6) level += 1.2; // moonlit courtyard
    return level;
  }

  // A movable light source (e.g. Filch's lantern): caller updates x/y/z and `on`.
  function dynamicLight(color, intensity, distance) {
    const d = { x: 0, y: -999, z: 0, color, intensity, distance, on: false, amp: 0.3, phase: Math.random() * 9, speed: 7 };
    lightDescs.push(d);
    return d;
  }

  // Highest thing at (x,z) that an object falling from fromY can rest on:
  // floors/ramps, collider tops (tables, pedestals, crates), and shelf ledges.
  function surfaceHeightAt(x, z, fromY) {
    let best = groundHeight(x, z, fromY);
    for (const b of colliders) {
      if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) {
        if (b.maxY <= fromY + 0.01 && b.maxY > best) best = b.maxY;
      }
    }
    for (const s of surfaces) {
      if (x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ) {
        if (s.y <= fromY + 0.01 && s.y > best) best = s.y;
      }
    }
    return best;
  }

  // Floor height for teleports: prefer the actual room at that column
  // (lowest explicit region), not the "highest walkable" rule used for stepping.
  function teleportGround(x, z) {
    for (const r of ramps) {
      if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) {
        const t = (z - r.zAt0) / (r.zAt1 - r.zAt0);
        return r.yAt0 + (r.yAt1 - r.yAt0) * Math.min(1, Math.max(0, t));
      }
    }
    let y = null;
    for (const r of regions) {
      if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) {
        if (y === null || r.y < y) y = r.y;
      }
    }
    return y === null ? 0 : y;
  }

  function update(dt, t, playerPos = { x: 0, y: 5, z: 0 }) {
    // fade global night light out when the player is underground
    const under = Math.min(1, Math.max(0, (-playerPos.y - 1.5) / 2.5));
    hemi.intensity = 0.65 * (1 - under) + 0.34 * under;
    moon.intensity = 2.1 * (1 - under) + 0.2 * under;

    // assign the pooled GPU lights to the sources most relevant to the player
    const candidates = [];
    for (const d of lightDescs) {
      if (!d.on) continue;
      d._score = Math.hypot(d.x - playerPos.x, d.y - playerPos.y, d.z - playerPos.z) - d.distance;
      candidates.push(d);
    }
    candidates.sort((a, b) => a._score - b._score);
    for (let i = 0; i < POOL_SIZE; i++) {
      const l = lightPool[i];
      const d = candidates[i];
      if (!d) { l.intensity = 0; continue; }
      l.position.set(d.x, d.y, d.z);
      l.color.setHex(d.color);
      l.distance = d.distance;
      let inten = d.intensity;
      if (d.amp) {
        inten *= 1 - d.amp * 0.5 + d.amp * 0.5 *
          (Math.sin(t * d.speed + d.phase) * 0.6 + Math.sin(t * d.speed * 2.7 + d.phase * 2) * 0.4);
      }
      l.intensity = inten;
    }

    for (const d of doors) d.update(dt);
    for (const u of updatables) u(dt, t);
    // torch flame jitter (positions) + global size flicker
    const pos = flameGeo.attributes.position.array;
    for (let i = 0; i < flameDefs.length; i++) {
      const f = flameDefs[i];
      if (f.unlit) { pos[i * 3 + 1] = -9999; continue; } // sconce not yet lit by Incendio
      pos[i * 3] = f.x + (f.amp ? Math.sin(t * 11 + f.phase) * f.amp * 0.6 : 0);
      pos[i * 3 + 1] = f.y + (f.amp ? Math.sin(t * 13 + f.phase) * f.amp : 0);
      pos[i * 3 + 2] = f.z;
    }
    flameGeo.attributes.position.needsUpdate = true;
    flameMat.size = 0.32 + Math.sin(t * 16.3) * 0.03 + Math.sin(t * 7.1) * 0.02;
    for (const fl of flickerLights) {
      fl.l.intensity = fl.base * (1 - fl.amp * 0.5 + fl.amp * 0.5 * (Math.sin(t * fl.speed + fl.phase) * 0.6 + Math.sin(t * fl.speed * 2.7 + fl.phase * 2) * 0.4));
    }
    sky.rotation.y += dt * 0.003;
    water.material.emissiveIntensity = 0.45 + Math.sin(t * 1.7) * 0.12;
  }

  const zones = {
    greatHall: { minX: -44, maxX: -12, minZ: -12, maxZ: 8 },
    courtyard: { minX: -17, maxX: 17, minZ: 14, maxZ: 42 },
    classroom: { minX: 34, maxX: 46, minZ: 9, maxZ: 21 },
    potions: { minX: -42, maxX: -31, minZ: -25, maxZ: -15 },
  };
  const inZone = (zone, x, z) => x >= zone.minX && x <= zone.maxX && z >= zone.minZ && z <= zone.maxZ;

  return {
    colliders, doors, doorByName, groundHeight, teleportGround, activeColliders, update, zones, inZone,
    doorsAnimating, ignitables, ignite, extinguish,
    setHouse, setHousePoints, lightLevelAt, dynamicLight, surfaceHeightAt,
    revealRoom, takeCloak, cloakPos: { x: 24, y: 1, z: 11.5 },
    raycastRoot: [staticG, doorsG, liftG],
    liftables: liftG.children,
    spawn: { x: 0, z: 38, yaw: 0 },
    glowTex, coldGlowTex,
    dementorSpawns: [[-26, -20], [-10, -20], [2, -20]],
    dementorWaypoints: [[-28, -20], [-20, -17.5], [-12, -22], [-4, -17.5], [4, -20.5]],
    dungeonFloorY: -5,
  };
}
