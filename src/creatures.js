// Dementors (patrol/chase/banish) and the Patronus stag.
import * as THREE from 'three';

const V2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

class Dementor {
  constructor(scene, spawn, floorY, waypoints) {
    this.spawn = spawn;
    this.floorY = floorY;
    this.waypoints = waypoints;
    this.state = 'patrol';
    this.wpIndex = (Math.random() * waypoints.length) | 0;
    this.phase = Math.random() * Math.PI * 2;
    this.banishT = 0;
    this.respawnT = 0;
    this.cooldown = 0;

    this.group = new THREE.Group();
    this.mat = new THREE.MeshLambertMaterial({
      color: 0x030306, transparent: true, opacity: 0.99, side: THREE.DoubleSide,
    });
    // ragged robe
    const profile = [
      [0.85, 0], [0.8, 0.3], [0.62, 0.8], [0.5, 1.3], [0.42, 1.7],
      [0.47, 2.0], [0.4, 2.2], [0.2, 2.45], [0.04, 2.6],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    this.robe = new THREE.Mesh(new THREE.LatheGeometry(profile, 18), this.mat);
    this.robeBase = this.robe.geometry.attributes.position.array.slice();
    this.group.add(this.robe);
    // hood
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), this.mat);
    hood.position.y = 2.32;
    hood.scale.set(1, 0.9, 1.08);
    this.group.add(hood);
    // the void where a face should be
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0x000000 }));
    face.position.set(0, 2.28, 0.18);
    this.group.add(face);
    // trailing hands
    for (const s of [-1, 1]) {
      const hand = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.5, 6), this.mat);
      hand.position.set(s * 0.55, 1.5, 0.25);
      hand.rotation.z = s * 2.6;
      this.group.add(hand);
    }
    this.group.position.set(spawn[0], floorY + 1.0, spawn[1]);
    scene.add(this.group);
  }

  get active() { return this.state === 'patrol' || this.state === 'chase'; }
  get x() { return this.group.position.x; }
  get z() { return this.group.position.z; }

  banish() {
    if (!this.active) return false;
    this.state = 'banished';
    this.banishT = 0;
    return true;
  }

  reset() {
    this.state = 'patrol';
    this.group.visible = true;
    this.group.scale.setScalar(1);
    this.mat.opacity = 0.97;
    this.group.position.set(this.spawn[0], this.floorY + 1.0, this.spawn[1]);
    this.cooldown = 0;
  }

  update(dt, t, player, playerInDungeon) {
    if (this.state === 'gone') {
      this.respawnT -= dt;
      if (this.respawnT <= 0) this.reset();
      return;
    }
    if (this.state === 'banished') {
      this.banishT += dt;
      const k = Math.min(1, this.banishT / 0.9);
      this.group.scale.setScalar(1 - k * 0.85);
      this.group.position.y += dt * 2.6;
      this.group.rotation.y += dt * 7;
      this.mat.opacity = 0.97 * (1 - k);
      if (k >= 1) {
        this.state = 'gone';
        this.group.visible = false;
        this.respawnT = 75;
      }
      return;
    }

    if (this.cooldown > 0) this.cooldown -= dt;
    const px = player.pos.x, pz = player.pos.z;
    const dist = V2(this.x, this.z, px, pz);
    this.state = (playerInDungeon && dist < 13 && this.cooldown <= 0) ? 'chase' : 'patrol';

    let tx, tz, speed;
    if (this.state === 'chase') {
      tx = px; tz = pz; speed = 2.5;
    } else {
      const wp = this.waypoints[this.wpIndex];
      if (V2(this.x, this.z, wp[0], wp[1]) < 0.9) {
        this.wpIndex = (this.wpIndex + 1 + ((Math.random() * (this.waypoints.length - 1)) | 0)) % this.waypoints.length;
      }
      const cur = this.waypoints[this.wpIndex];
      tx = cur[0]; tz = cur[1]; speed = 1.05;
    }
    const dx = tx - this.x, dz = tz - this.z;
    const d = Math.hypot(dx, dz) || 1;
    this.group.position.x += (dx / d) * speed * dt;
    this.group.position.z += (dz / d) * speed * dt;
    // Dementors haunt the dungeon corridor only — never through walls,
    // cell bars, or the locked Potions Store.
    this.group.position.x = Math.max(-29.4, Math.min(8.4, this.group.position.x));
    this.group.position.z = Math.max(-23.5, Math.min(-16.6, this.group.position.z));
    this.group.position.y = this.floorY + 1.0 + Math.sin(t * 0.9 + this.phase) * 0.28;

    // face movement direction
    const targetYaw = Math.atan2(dx, dz);
    let dy = targetYaw - this.group.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.group.rotation.y += dy * Math.min(1, 3 * dt);

    // robe billow
    const pos = this.robe.geometry.attributes.position.array;
    const base = this.robeBase;
    for (let i = 0; i < pos.length; i += 3) {
      const bx = base[i], by = base[i + 1], bz = base[i + 2];
      if (by < 1.35) {
        const ang = Math.atan2(bz, bx);
        const w = 1 + Math.sin(t * 2.3 + ang * 3 + by * 4 + this.phase) * 0.16 * (1.35 - by) / 1.35;
        pos[i] = bx * w;
        pos[i + 2] = bz * w;
      }
    }
    this.robe.geometry.attributes.position.needsUpdate = true;
  }
}

class Patronus {
  constructor(scene, world) {
    this.world = world;
    this.active = false;
    this.mat = new THREE.MeshBasicMaterial({
      color: 0xcfe8ff, transparent: true, opacity: 0.58,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const g = this.group = new THREE.Group();
    const add = (geo, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
      const m = new THREE.Mesh(geo, this.mat);
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, rz);
      m.scale.set(sx, sy, sz);
      g.add(m);
      return m;
    };
    // stag body (model faces +x)
    add(new THREE.CapsuleGeometry(0.4, 1.2, 4, 12), 0, 1.45, 0, 0, 0, Math.PI / 2);
    add(new THREE.SphereGeometry(0.42, 12, 10), 0.6, 1.5, 0);
    add(new THREE.SphereGeometry(0.38, 12, 10), -0.62, 1.42, 0);
    add(new THREE.CylinderGeometry(0.13, 0.2, 0.85, 10), 0.95, 1.98, 0, 0, 0, -0.85);
    add(new THREE.CapsuleGeometry(0.14, 0.34, 4, 10), 1.32, 2.34, 0, 0, 0, -1.32);
    add(new THREE.ConeGeometry(0.06, 0.2, 6), 1.2, 2.55, 0.11, 0.3, 0, -0.4);   // ears
    add(new THREE.ConeGeometry(0.06, 0.2, 6), 1.2, 2.55, -0.11, -0.3, 0, -0.4);
    add(new THREE.ConeGeometry(0.09, 0.4, 6), -1.02, 1.62, 0, 0, 0, 0.9);        // tail
    // antlers
    for (const s of [-1, 1]) {
      const beam = new THREE.Group();
      beam.position.set(1.12, 2.5, s * 0.13);
      beam.rotation.z = 0.55;
      beam.rotation.x = -s * 0.42;
      const main = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.035, 0.72, 6), this.mat);
      main.position.y = 0.36;
      beam.add(main);
      for (let i = 0; i < 3; i++) {
        const tine = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.024, 0.3, 5), this.mat);
        tine.position.set(0.02, 0.22 + i * 0.2, 0);
        tine.rotation.z = -0.8 - i * 0.15;
        tine.rotation.x = s * 0.3;
        beam.add(tine);
      }
      g.add(beam);
    }
    // legs with gallop pivots
    this.legs = [];
    for (const [lx, lz, phase] of [[0.55, 0.2, 0], [0.55, -0.2, 0.35], [-0.55, 0.2, Math.PI], [-0.55, -0.2, Math.PI + 0.35]]) {
      const hip = new THREE.Group();
      hip.position.set(lx, 1.2, lz);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.04, 1.15, 8), this.mat);
      leg.position.y = -0.55;
      hip.add(leg);
      g.add(hip);
      this.legs.push({ hip, phase });
    }
    g.scale.setScalar(1.12);

    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: world.coldGlowTex, color: 0x9fd4ff, transparent: true, opacity: 0.4,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.halo.scale.set(2.6, 2.0, 1);
    this.halo.position.set(0, 1.5, 0);
    g.add(this.halo);

    this.light = new THREE.PointLight(0x9fd4ff, 0, 30, 2);
    this.light.position.set(0, 1.6, 0);
    g.add(this.light);

    g.visible = false;
    scene.add(g);

    // trail particles
    this.N = 420;
    this.pPos = new Float32Array(this.N * 3).fill(-999);
    this.pVel = new Float32Array(this.N * 3);
    this.pLife = new Float32Array(this.N);
    this.pHead = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    this.trailMat = new THREE.PointsMaterial({
      color: 0xaee0ff, size: 0.18, map: world.coldGlowTex, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.trail = new THREE.Points(geo, this.trailMat);
    this.trail.frustumCulled = false;
    scene.add(this.trail);
  }

  cast(origin, dir) {
    this.active = true;
    this.life = 3.4;
    this.dir = dir.clone().setY(0).normalize();
    const gy = this.world.groundHeight(origin.x + this.dir.x * 2.6, origin.z + this.dir.z * 2.6, origin.y);
    this.group.position.set(origin.x + this.dir.x * 2.6, gy, origin.z + this.dir.z * 2.6);
    this.group.rotation.y = Math.atan2(-this.dir.z, this.dir.x);
    this.group.visible = true;
    this.mat.opacity = 0.75;
    this.halo.material.opacity = 0.4;
    this.light.intensity = 32;
    this.runT = 0;
  }

  update(dt, t, dementors, onBanish) {
    // advance trail even when inactive so leftovers fade
    for (let i = 0; i < this.N; i++) {
      if (this.pLife[i] > 0) {
        this.pLife[i] -= dt;
        this.pPos[i * 3] += this.pVel[i * 3] * dt;
        this.pPos[i * 3 + 1] += this.pVel[i * 3 + 1] * dt;
        this.pPos[i * 3 + 2] += this.pVel[i * 3 + 2] * dt;
        if (this.pLife[i] <= 0) this.pPos[i * 3 + 1] = -999;
      }
    }
    this.trail.geometry.attributes.position.needsUpdate = true;

    if (!this.active) return;
    this.life -= dt;
    this.runT += dt;
    if (this.life <= 0) {
      this.active = false;
      this.group.visible = false;
      this.light.intensity = 0;
      return;
    }

    const p = this.group.position;
    const speed = 7.5;
    p.x += this.dir.x * speed * dt;
    p.z += this.dir.z * speed * dt;
    const gy = this.world.groundHeight(p.x, p.z, p.y + 1);
    p.y += (gy - p.y) * Math.min(1, 8 * dt);
    this.group.position.y = p.y + Math.abs(Math.sin(this.runT * 7)) * 0.22;

    for (const l of this.legs) {
      l.hip.rotation.z = Math.sin(this.runT * 11 + l.phase) * 0.6;
    }

    // fade in the last 0.8s
    const fade = Math.min(1, this.life / 0.8);
    this.mat.opacity = 0.58 * fade;
    this.halo.material.opacity = 0.4 * fade;
    this.light.intensity = 32 * fade * (0.9 + Math.sin(t * 12) * 0.1);

    // spawn trail behind the stag so it doesn't hide the animal itself
    for (let s = 0; s < 5; s++) {
      const i = this.pHead = (this.pHead + 1) % this.N;
      this.pPos[i * 3] = p.x - this.dir.x * (0.9 + Math.random() * 0.8) + (Math.random() - 0.5) * 0.5;
      this.pPos[i * 3 + 1] = this.group.position.y + 0.8 + Math.random() * 1.3;
      this.pPos[i * 3 + 2] = p.z - this.dir.z * (0.9 + Math.random() * 0.8) + (Math.random() - 0.5) * 0.5;
      this.pVel[i * 3] = -this.dir.x * 1.0 + (Math.random() - 0.5) * 0.4;
      this.pVel[i * 3 + 1] = 0.3 + Math.random() * 0.35;
      this.pVel[i * 3 + 2] = -this.dir.z * 1.0 + (Math.random() - 0.5) * 0.4;
      this.pLife[i] = 0.45 + Math.random() * 0.5;
    }

    // banish nearby dementors
    for (const d of dementors) {
      if (d.active && V2(p.x, p.z, d.x, d.z) < 5.5) {
        if (d.banish()) onBanish(d);
      }
    }
  }
}

export class Creatures {
  constructor(scene, world) {
    this.world = world;
    this.dementors = world.dementorSpawns.map(
      (s) => new Dementor(scene, s, world.dungeonFloorY, world.dementorWaypoints)
    );
    this.patronus = new Patronus(scene, world);
    this.banishedCount = 0;
    this.chill = 0;
    this.everAggro = false;
    this.onBanish = null; // (dementor) => {}
    this.onCaught = null; // () => {}
    this._catchLock = false;
    this.catchEnabled = true; // QA can disable via __game.noCatch(true)
  }

  castPatronus(origin, dir) {
    this.patronus.cast(origin, dir);
  }

  // Called by main after the faint fade reaches full black.
  afterCaught() {
    for (const d of this.dementors) {
      d.reset();
      d.cooldown = 7;
    }
    setTimeout(() => { this._catchLock = false; }, 2500);
  }

  update(dt, t, player) {
    const playerInDungeon = player.pos.y < -2.5;
    let minDist = Infinity;
    let anyChase = false;
    for (const d of this.dementors) {
      d.update(dt, t, player, playerInDungeon);
      if (d.active && playerInDungeon) {
        const dist = V2(d.x, d.z, player.pos.x, player.pos.z);
        minDist = Math.min(minDist, dist);
        if (d.state === 'chase') anyChase = true;
        if (dist < 1.35 && this.catchEnabled && !this._catchLock && d.cooldown <= 0) {
          this._catchLock = true;
          if (this.onCaught) this.onCaught();
        }
      }
    }
    if (anyChase) this.everAggro = true;
    const targetChill = playerInDungeon && minDist < Infinity ? Math.max(0, 1 - minDist / 12) : 0;
    this.chill += (targetChill - this.chill) * Math.min(1, 4 * dt);

    this.patronus.update(dt, t, this.dementors, (d) => {
      this.banishedCount += 1;
      if (this.onBanish) this.onBanish(d);
    });
  }
}
