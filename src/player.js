// First-person controller: pointer-lock look, WASD + run + jump, AABB collision,
// and height-map style ground (regions + ramps) so stairs and the dungeon work.
import * as THREE from 'three';

const EYE = 1.7;
const RADIUS = 0.42;

export class Player {
  constructor(camera, world, canvas) {
    this.camera = camera;
    this.world = world;
    this.canvas = canvas;
    this.pos = new THREE.Vector3(0, 0, 38); // pos.y is FOOT height
    this.yaw = 0;    // 0 faces -z (toward the castle)
    this.pitch = 0;
    this.vy = 0;
    this.grounded = true;
    this.keys = {};
    this.enabled = false;   // true while playing (pointer locked or debug)
    this.debug = false;
    this.moveT = 0;         // head-bob phase
    this.moving = false;
    this.vel = new THREE.Vector2(0, 0);

    camera.rotation.order = 'YXZ';

    document.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys[e.code] = true;
    });
    document.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    document.addEventListener('mousemove', (e) => {
      if (!this.enabled || (!this.debug && document.pointerLockElement !== this.canvas)) return;
      this.yaw -= e.movementX * 0.0023;
      this.pitch -= e.movementY * 0.0023;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    });
  }

  get position() {
    return new THREE.Vector3(this.pos.x, this.pos.y + EYE, this.pos.z);
  }

  forward() {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  teleport(x, z, yaw = this.yaw, pitch = 0, y = null) {
    this.pos.x = x;
    this.pos.z = z;
    this.pos.y = y !== null ? y : this.world.teleportGround(x, z);
    this.yaw = yaw;
    this.pitch = pitch;
    this.vy = 0;
    this.vel.set(0, 0);
    // sync the camera right away so raycasts between frames aim correctly
    this.camera.position.set(this.pos.x, this.pos.y + EYE, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    this.camera.updateMatrixWorld();
  }

  update(dt) {
    const k = this.keys;
    let ix = 0, iz = 0;
    if (this.enabled) {
      if (k.KeyW || k.ArrowUp) iz -= 1;
      if (k.KeyS || k.ArrowDown) iz += 1;
      if (k.KeyA || k.ArrowLeft) ix -= 1;
      if (k.KeyD || k.ArrowRight) ix += 1;
    }
    const run = k.ShiftLeft || k.ShiftRight;
    const speed = run ? 6.6 : 3.9;

    // input direction rotated by yaw (iz=-1 is forward)
    let dx = 0, dz = 0;
    if (ix || iz) {
      const len = Math.hypot(ix, iz);
      ix /= len; iz /= len;
      const fwd = this.forward();
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      dx = (right.x * ix + fwd.x * -iz) * speed;
      dz = (right.z * ix + fwd.z * -iz) * speed;
    }

    // smooth acceleration
    const accel = this.grounded ? 12 : 4;
    this.vel.x += (dx - this.vel.x) * Math.min(1, accel * dt);
    this.vel.y += (dz - this.vel.y) * Math.min(1, accel * dt);
    this.moving = Math.hypot(this.vel.x, this.vel.y) > 0.4;

    // horizontal move with collision (two half-steps for stability)
    for (let pass = 0; pass < 2; pass++) {
      this.pos.x += this.vel.x * dt * 0.5;
      this.pos.z += this.vel.y * dt * 0.5;
      this._collide();
    }

    // vertical: ground snap / gravity / jump
    const ground = this.world.groundHeight(this.pos.x, this.pos.z, this.pos.y);
    if (this.grounded && this.enabled && k.Space) {
      this.vy = 5.2;
      this.grounded = false;
    }
    if (this.grounded) {
      if (this.pos.y > ground + 0.35) {
        this.grounded = false; // walked off an edge
      } else {
        // snap (handles ramps up & down)
        this.pos.y += (ground - this.pos.y) * Math.min(1, 18 * dt);
        if (Math.abs(ground - this.pos.y) < 0.01) this.pos.y = ground;
      }
    }
    if (!this.grounded) {
      this.vy -= 16 * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= ground && this.vy <= 0) {
        this.pos.y = ground;
        this.vy = 0;
        this.grounded = true;
      }
    }

    // head bob
    if (this.moving && this.grounded) {
      this.moveT += dt * (run ? 11 : 7.5);
    }
    const bob = this.moving && this.grounded ? Math.sin(this.moveT) * 0.045 : 0;

    this.camera.position.set(this.pos.x, this.pos.y + EYE + bob, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }

  _collide() {
    const foot = this.pos.y;
    const boxes = this.world.activeColliders();
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (b.maxY <= foot + 0.25 || b.minY >= foot + 1.55) continue; // below feet / above head
      // closest point on the box to the player circle (XZ)
      const cx = Math.max(b.minX, Math.min(this.pos.x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(this.pos.z, b.maxZ));
      let ox = this.pos.x - cx, oz = this.pos.z - cz;
      const d2 = ox * ox + oz * oz;
      if (d2 >= RADIUS * RADIUS) continue;
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2);
        const push = (RADIUS - d) / d;
        this.pos.x += ox * push;
        this.pos.z += oz * push;
      } else {
        // center inside the box: push out along the smallest penetration axis
        const pxl = this.pos.x - b.minX + RADIUS, pxr = b.maxX - this.pos.x + RADIUS;
        const pzl = this.pos.z - b.minZ + RADIUS, pzr = b.maxZ - this.pos.z + RADIUS;
        const m = Math.min(pxl, pxr, pzl, pzr);
        if (m === pxl) this.pos.x = b.minX - RADIUS;
        else if (m === pxr) this.pos.x = b.maxX + RADIUS;
        else if (m === pzl) this.pos.z = b.minZ - RADIUS;
        else this.pos.z = b.maxZ + RADIUS;
      }
    }
  }
}
