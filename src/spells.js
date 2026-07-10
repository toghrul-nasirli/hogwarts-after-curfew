// The wand, the four spells, sparkle effects, and door interaction.
import * as THREE from 'three';
import { t } from './i18n.js';

class SparklePool {
  constructor(scene, tex, color, n = 240) {
    this.N = n;
    this.pos = new Float32Array(n * 3).fill(-999);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.head = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      color, size: 0.14, map: tex, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  burst(center, n = 36, speed = 2.2, lifeBase = 0.7) {
    for (let s = 0; s < n; s++) {
      const i = this.head = (this.head + 1) % this.N;
      const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 2 - 1);
      const sp = speed * (0.4 + Math.random() * 0.6);
      this.pos[i * 3] = center.x;
      this.pos[i * 3 + 1] = center.y;
      this.pos[i * 3 + 2] = center.z;
      this.vel[i * 3] = Math.sin(ph) * Math.cos(th) * sp;
      this.vel[i * 3 + 1] = Math.cos(ph) * sp * 0.8;
      this.vel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * sp;
      this.life[i] = lifeBase * (0.5 + Math.random() * 0.8);
    }
  }

  update(dt) {
    for (let i = 0; i < this.N; i++) {
      if (this.life[i] > 0) {
        this.life[i] -= dt;
        this.vel[i * 3 + 1] -= 2.2 * dt; // gentle gravity
        this.pos[i * 3] += this.vel[i * 3] * dt;
        this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
        this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
        if (this.life[i] <= 0) this.pos[i * 3 + 1] = -999;
      }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

export const SPELL_NAMES = ['Lumos', 'Nox', 'Alohomora', 'Incendio', 'Aguamenti', 'Wingardium Leviosa', 'Expecto Patronum'];

export class SpellSystem {
  constructor(scene, camera, player, world, creatures, ui, audio) {
    this.camera = camera;
    this.player = player;
    this.world = world;
    this.creatures = creatures;
    this.ui = ui;
    this.audio = audio;
    this.selected = 0;
    this.lumosOn = false;
    this.patronusCooldown = 0;
    this.castAnim = 0;
    this.onUnlock = null; // (door) => {}
    this.onIgnite = null; // (ignitable) => {}
    this.held = null;     // Wingardium Leviosa target
    this.dropping = [];   // released props falling to rest
    this._leviosaJoked = false;

    // wand view-model
    this.wandRoot = new THREE.Group();
    this.wandRoot.position.set(0.34, -0.28, -0.35);
    const wand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.011, 0.02, 0.56, 8),
      new THREE.MeshStandardMaterial({ color: 0x3a2417, roughness: 0.7 })
    );
    wand.rotation.x = -Math.PI / 2 + 0.12;
    wand.position.set(0, 0, -0.22);
    this.wandRoot.add(wand);
    const grip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.023, 0.026, 0.14, 8),
      new THREE.MeshStandardMaterial({ color: 0x241209, roughness: 0.9 })
    );
    grip.rotation.x = -Math.PI / 2 + 0.12;
    grip.position.set(0, -0.025, 0.02);
    this.wandRoot.add(grip);
    this.wandTip = new THREE.Object3D();
    this.wandTip.position.set(0, 0.035, -0.5);
    this.wandRoot.add(this.wandTip);
    camera.add(this.wandRoot);
    scene.add(camera);

    // lumos light + glow
    this.lumosLight = new THREE.PointLight(0xd8e8ff, 0, 24, 2);
    this.wandTip.add(this.lumosLight);
    this.lumosGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: world.coldGlowTex, color: 0xdceeff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.lumosGlow.scale.set(0.32, 0.32, 1);
    this.wandTip.add(this.lumosGlow);

    this.goldSparks = new SparklePool(scene, world.glowTex, 0xffd980);
    this.coldSparks = new SparklePool(scene, world.coldGlowTex, 0xaee0ff);

    this.ray = new THREE.Raycaster();
    this.ray.far = 8;

    document.addEventListener('keydown', (e) => {
      if (e.code.startsWith('Digit')) {
        const n = parseInt(e.code.slice(5), 10);
        if (n >= 1 && n <= 5) this.select(n - 1);
        else if (n === 6) this.select(5); // Wingardium Leviosa
        else if (n === 0) this.select(6); // Expecto Patronum lives on 0
      }
      if (e.code === 'KeyE') this.tryInteract();
    });
    document.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || !this.player.enabled) return;
      if (!this.player.debug && document.pointerLockElement !== this.player.canvas) return;
      this.cast();
    });
    ui.setSpell(0);
  }

  select(i) {
    this.selected = i;
    this.ui.setSpell(i);
  }

  _flick() {
    this.castAnim = 1;
    this.audio.whoosh();
  }

  _aimHit() {
    this.ray.setFromCamera({ x: 0, y: 0 }, this.camera);
    const hits = this.ray.intersectObjects(this.world.raycastRoot, true);
    return hits.length ? hits[0] : null;
  }

  // nearest ignitable roughly along the aim ray (walls block it)
  _findIgnitable(hit) {
    const origin = this.camera.getWorldPosition(new THREE.Vector3());
    const dir = this.camera.getWorldDirection(new THREE.Vector3());
    let best = null, bestD = Infinity;
    for (const ig of this.world.ignitables) {
      const to = new THREE.Vector3(ig.x - origin.x, ig.y - origin.y, ig.z - origin.z);
      const dist = to.length();
      if (dist > 11) continue;
      const along = to.dot(dir);
      if (along < 0.5) continue;
      const perp = Math.sqrt(Math.max(0, dist * dist - along * along));
      if (perp > 1.7) continue;
      if (hit && hit.distance + 0.8 < along) continue; // a wall is in the way
      if (dist < bestD) { best = ig; bestD = dist; }
    }
    return best;
  }

  cast(nameOverride = null) {
    const spell = nameOverride !== null ? nameOverride : this.selected;
    switch (spell) {
      case 0: { // Lumos
        this._flick();
        if (this.lumosOn) {
          this.ui.caption(t('lumosAlready'));
          break;
        }
        this.lumosOn = true;
        this.ui.setLumos(true);
        this.audio.lumos();
        this.coldSparks.burst(this.wandTip.getWorldPosition(new THREE.Vector3()), 24, 1.4, 0.5);
        this.ui.caption(t('lumosOn'));
        break;
      }
      case 1: { // Nox
        this._flick();
        if (!this.lumosOn) {
          this.ui.caption(t('noxAlready'));
          break;
        }
        this.lumosOn = false;
        this.ui.setLumos(false);
        this.audio.nox();
        this.ui.caption(t('noxOff'));
        break;
      }
      case 2: { // Alohomora
        this._flick();
        const hit = this._aimHit();
        const door = hit ? this._doorOf(hit.object) : null;
        if (door && door.locked) {
          door.unlock();
          this.audio.unlock();
          this.goldSparks.burst(hit.point, 64, 2.6, 0.9);
          this.ui.caption(t('alohomoraUnlock', { door: t('door_' + door.id) }));
          if (this.onUnlock) this.onUnlock(door);
        } else if (door) {
          this.ui.caption(t('alohomoraAlready', { door: t('door_' + door.id) }));
        } else {
          const p = this.camera.getWorldPosition(new THREE.Vector3())
            .add(this.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(3.5));
          this.goldSparks.burst(p, 10, 1.2, 0.4);
          this.audio.sparkle();
          this.ui.caption(t('alohomoraFizzle'));
        }
        break;
      }
      case 5: { // Wingardium Leviosa (key 6)
        this._flick();
        if (this.held) {
          this._dropHeld();
          this.ui.caption(t('leviosaDown'));
          break;
        }
        const hit = this._aimHit();
        let o = hit ? hit.object : null;
        while (o && !o.userData.liftable) o = o.parent;
        if (o && hit.distance < 7) {
          this.held = o;
          this.audio.sparkle();
          this.goldSparks.burst(o.position.clone(), 20, 1.2, 0.5);
          this.ui.caption(this._leviosaJoked
            ? t('leviosaFloat', { name: t('item_' + o.userData.name) })
            : t('leviosaJoke'));
          this._leviosaJoked = true;
        } else {
          // the diadem refuses the charm — it wants to be fetched, not summoned
          const d = this.world.diademPos;
          if (hit && d && this.world.diademVisible() &&
              Math.hypot(hit.point.x - d.x, hit.point.y - d.y, hit.point.z - d.z) < 1.0) {
            this.ui.caption(t('diademStuck'), 6400);
          } else {
            this.ui.caption(t('leviosaNothing'));
          }
        }
        break;
      }
      case 6: { // Expecto Patronum (key 0)
        if (this.patronusCooldown > 0) {
          this.ui.caption(t('patronusWait'));
          break;
        }
        this._flick();
        this.patronusCooldown = 6;
        this.audio.patronus();
        const origin = this.camera.getWorldPosition(new THREE.Vector3());
        origin.y = this.player.pos.y + 1.2;
        const dir = this.camera.getWorldDirection(new THREE.Vector3());
        this.creatures.castPatronus(origin, dir);
        this.coldSparks.burst(this.wandTip.getWorldPosition(new THREE.Vector3()), 60, 3, 0.8);
        this.ui.caption(t('patronusCast'));
        break;
      }
      case 3: { // Incendio — lights the sconce/candelabra you aim at
        this._flick();
        const hit = this._aimHit();
        const best = this._findIgnitable(hit);
        if (best && !best.lit) {
          this.world.ignite(best);
          this.audio.incendio();
          this.goldSparks.burst(new THREE.Vector3(best.x, best.y, best.z), 42, 1.9, 0.8);
          this.ui.caption(t('incendioLight'));
          if (this.onIgnite) this.onIgnite(best);
        } else if (best && best.lit) {
          this.ui.caption(t('incendioBurning'));
        } else if (hit) {
          this.goldSparks.burst(hit.point, 14, 1.4, 0.5);
          this.audio.sparkle();
          this.ui.caption(t('incendioStone'));
        } else {
          const p = this.camera.getWorldPosition(new THREE.Vector3())
            .add(this.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(4));
          this.goldSparks.burst(p, 12, 1.2, 0.4);
          this.audio.sparkle();
          this.ui.caption(t('incendioDark'));
        }
        break;
      }
      case 4: { // Aguamenti — a jet of water puts flames out
        this._flick();
        const hit = this._aimHit();
        const best = this._findIgnitable(hit);
        if (best && best.lit) {
          this.world.extinguish(best);
          this.audio.aguamenti();
          this.coldSparks.burst(new THREE.Vector3(best.x, best.y, best.z), 46, 2.2, 0.7);
          this.ui.caption(t('aguamentiDouse'));
        } else if (best && !best.lit) {
          this.ui.caption(t('aguamentiNothing'));
        } else {
          const p = hit ? hit.point
            : this.camera.getWorldPosition(new THREE.Vector3())
              .add(this.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(4));
          this.coldSparks.burst(p, 20, 1.8, 0.5);
          this.audio.aguamenti();
          this.ui.caption(t('aguamentiSplash'));
        }
        break;
      }
    }
  }

  _doorOf(obj) {
    let o = obj;
    while (o) {
      if (o.userData && o.userData.door) {
        return o.userData.door.revealed === false ? null : o.userData.door;
      }
      o = o.parent;
    }
    return null;
  }

  _nearestDoor() {
    const p = this.player.position;
    const fwd = this.player.forward();
    let best = null, bestD = 3.6;
    for (const d of this.world.doors) {
      if (d.revealed === false) continue;
      const dx = d.center.x - p.x, dz = d.center.z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist > bestD) continue;
      if (Math.abs(d.center.y - p.y) > 4) continue;
      const dot = (dx * fwd.x + dz * fwd.z) / (dist || 1);
      if (dot < 0.25 && dist > 1.2) continue;
      best = d; bestD = dist;
    }
    return best;
  }

  tryInteract() {
    if (!this.player.enabled) return;
    const door = this._nearestDoor();
    if (!door) return;
    const result = door.interact();
    if (result === 'locked') {
      this.audio.locked();
      this.ui.caption(t('doorBudge', { door: t('door_' + door.id) }));
    } else {
      this.audio.creak();
    }
  }

  _dropHeld() {
    if (!this.held) return;
    this.dropping.push({ mesh: this.held, vy: 0 });
    this.held = null;
  }

  update(dt, time) {
    if (this.patronusCooldown > 0) this.patronusCooldown -= dt;

    // Wingardium Leviosa: carried object floats close ahead of the wand,
    // pulling in even closer rather than pushing through whatever you face
    if (this.held) {
      let dist = 1.5;
      this.ray.setFromCamera({ x: 0, y: 0 }, this.camera);
      for (const h of this.ray.intersectObjects(this.world.raycastRoot, true)) {
        if (h.object === this.held) continue;
        dist = Math.min(dist, Math.max(0.6, h.distance - 0.35));
        break;
      }
      const target = this.camera.getWorldPosition(new THREE.Vector3())
        .add(this.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(dist));
      target.y += Math.sin(time * 2.2) * 0.06;
      this.held.position.lerp(target, 1 - Math.exp(-8 * dt));
      this.held.rotation.y += dt * 0.9;
    }
    for (let i = this.dropping.length - 1; i >= 0; i--) {
      const d = this.dropping[i];
      const restH = d.mesh.userData.restH || 0.15;
      // find the landing surface BEFORE moving, so fast falls can't tunnel
      // through thin shelves and tabletops
      const preBottom = d.mesh.position.y - restH;
      const surf = this.world.surfaceHeightAt(d.mesh.position.x, d.mesh.position.z, preBottom + 0.02);
      d.vy -= 14 * dt;
      d.mesh.position.y += d.vy * dt;
      if (d.mesh.position.y - restH <= surf) {
        d.mesh.position.y = surf + restH;
        this.dropping.splice(i, 1);
        this.audio.thud();
      }
    }

    // wand sway + cast flick
    if (this.castAnim > 0) this.castAnim = Math.max(0, this.castAnim - dt * 3.2);
    const flick = Math.sin(this.castAnim * Math.PI) * 0.5;
    const sway = this.player.moving ? Math.sin(this.player.moveT * 0.5) * 0.012 : 0;
    this.wandRoot.position.set(0.34 + sway, -0.28 + Math.sin(time * 1.3) * 0.006, -0.35);
    this.wandRoot.rotation.x = -flick * 0.7;
    this.wandRoot.rotation.z = flick * 0.15;

    // lumos glow
    const targetI = this.lumosOn ? 26 : 0;
    this.lumosLight.intensity += (targetI - this.lumosLight.intensity) * Math.min(1, 8 * dt);
    if (this.lumosOn) {
      this.lumosLight.intensity *= 0.97 + Math.sin(time * 9.7) * 0.03;
      this.lumosGlow.material.opacity = 0.85 + Math.sin(time * 7.3) * 0.1;
    } else {
      this.lumosGlow.material.opacity = Math.max(0, this.lumosGlow.material.opacity - dt * 3);
    }

    this.goldSparks.update(dt);
    this.coldSparks.update(dt);

    // door prompt
    const door = this._nearestDoor();
    if (door) {
      if (door.locked) {
        this.ui.prompt(t('promptLocked', { door: t('door_' + door.id) }));
      } else {
        this.ui.prompt(t(door.target > 0.5 ? 'promptClose' : 'promptOpen', { door: t('door_' + door.id) }));
      }
    } else {
      this.ui.prompt(null);
    }
  }
}
