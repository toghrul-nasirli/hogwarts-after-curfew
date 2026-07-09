// The Marauder's Map — a parchment overlay showing the castle plan and the
// live position of everyone in it. Toggled with M; drawn on a 2D canvas.

const INK = '#4a3319';
const INK_FAINT = 'rgba(74, 51, 25, 0.55)';

// world extents (matches the MAP comment in world.js)
const X0 = -50, X1 = 50, Z0 = -31, Z1 = 46;

const ROOMS = [
  { r: [-17, 14, 17, 42], label: 'The Courtyard' },
  { r: [-10, -6, 10, 13], label: 'Entrance Hall' },
  { r: [-44, -12, -12, 8], label: 'The Great Hall' },
  { r: [12, 0, 46, 8], label: 'Corridor' },
  { r: [34, 9, 46, 21], label: 'Charms' },
  { r: [-9, -15, 2, -7], label: 'Staircase' },
  { r: [5, -15, 9, -6], label: '', dashed: true },          // stairwell down
  { r: [-30, -24, 9, -16], label: 'The Dungeons', dashed: true },
  { r: [-42, -25, -31, -15], label: 'Potions', dashed: true },
];

// door positions (little ink ticks)
const DOORS = [[0, 13.5], [-11, 4], [40, 8.5], [-30.5, -19.9]];

export class MaraudersMap {
  constructor() {
    this.el = document.getElementById('map');
    this.canvas = document.getElementById('mapcanvas');
    this.open = false;
    this.W = 680;
    this.H = 560;
    this.canvas.width = this.W * 2;
    this.canvas.height = this.H * 2;
    this.canvas.style.width = this.W + 'px';
    this.canvas.style.height = this.H + 'px';
    this.ctx = this.canvas.getContext('2d');

    const availW = this.W - 56, availH = this.H - 116;
    this.scale = Math.min(availW / (X1 - X0), availH / (Z1 - Z0));
    this.ox = (this.W - (X1 - X0) * this.scale) / 2;
    this.oy = 74 + (availH - (Z1 - Z0) * this.scale) / 2;

    this.staticLayer = document.createElement('canvas');
    this.staticLayer.width = this.W * 2;
    this.staticLayer.height = this.H * 2;
    this._drawStatic();
  }

  _px(x) { return this.ox + (x - X0) * this.scale; }
  _py(z) { return this.oy + (z - Z0) * this.scale; }

  _drawStatic() {
    const c = this.staticLayer.getContext('2d');
    c.setTransform(2, 0, 0, 2, 0, 0);
    // parchment
    c.fillStyle = '#e2d0a5';
    c.fillRect(0, 0, this.W, this.H);
    let seed = 9;
    const rnd = () => (seed = (seed * 16807 + 19) % 2147483647) / 2147483647;
    for (let i = 0; i < 26; i++) { // age blotches
      const x = rnd() * this.W, y = rnd() * this.H, r = 18 + rnd() * 70;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(150, 116, 62, ${0.03 + rnd() * 0.05})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const edge = c.createRadialGradient(this.W / 2, this.H / 2, this.H * 0.42, this.W / 2, this.H / 2, this.H * 0.78);
    edge.addColorStop(0, 'rgba(0,0,0,0)');
    edge.addColorStop(1, 'rgba(92, 66, 32, 0.34)');
    c.fillStyle = edge;
    c.fillRect(0, 0, this.W, this.H);
    // double border
    c.strokeStyle = INK;
    c.lineWidth = 1.6;
    c.strokeRect(10, 10, this.W - 20, this.H - 20);
    c.lineWidth = 0.7;
    c.strokeRect(15, 15, this.W - 30, this.H - 30);
    // title
    c.fillStyle = INK;
    c.textAlign = 'center';
    c.font = 'italic 11px Georgia';
    c.fillText('Messrs. Moony, Wormtail, Padfoot and Prongs', this.W / 2, 34);
    c.font = 'small-caps bold 22px Georgia';
    c.fillText('The Marauder’s Map', this.W / 2, 58);
    c.font = 'italic 10.5px Georgia';
    c.fillText('“I solemnly swear that I am up to no good.”', this.W / 2, this.H - 22);
    // rooms
    for (const room of ROOMS) {
      const [x1, z1, x2, z2] = room.r;
      c.setLineDash(room.dashed ? [5, 4] : []);
      c.strokeStyle = room.dashed ? INK_FAINT : INK;
      c.lineWidth = 1.4;
      c.strokeRect(this._px(x1), this._py(z1), (x2 - x1) * this.scale, (z2 - z1) * this.scale);
      if (room.label) {
        c.setLineDash([]);
        c.fillStyle = room.dashed ? INK_FAINT : INK;
        c.font = 'italic 11px Georgia';
        c.fillText(room.label, this._px((x1 + x2) / 2), this._py((z1 + z2) / 2) - 2);
      }
    }
    c.setLineDash([]);
    // door ticks
    c.fillStyle = INK;
    for (const [dx, dz] of DOORS) {
      c.fillRect(this._px(dx) - 2.5, this._py(dz) - 2.5, 5, 5);
    }
    // compass north (game north = up)
    c.font = 'small-caps 12px Georgia';
    c.fillText('N', this.W - 34, 86);
    c.beginPath();
    c.moveTo(this.W - 34, 92);
    c.lineTo(this.W - 34, 108);
    c.moveTo(this.W - 38, 97);
    c.lineTo(this.W - 34, 92);
    c.lineTo(this.W - 30, 97);
    c.strokeStyle = INK;
    c.lineWidth = 1.2;
    c.stroke();
  }

  toggle() {
    this.open = !this.open;
    this.el.classList.toggle('show', this.open);
  }

  // actors: [{x, z, label, color, player?, yaw?}]
  draw(actors) {
    const c = this.ctx;
    c.setTransform(2, 0, 0, 2, 0, 0);
    c.drawImage(this.staticLayer, 0, 0, this.W, this.H);
    c.textAlign = 'center';
    for (const a of actors) {
      const px = this._px(a.x), py = this._py(a.z);
      if (a.player) {
        // heading wedge in the player's house colour
        const dx = -Math.sin(a.yaw), dz = -Math.cos(a.yaw);
        c.fillStyle = a.color;
        c.beginPath();
        c.moveTo(px + dx * 8, py + dz * 8);
        c.lineTo(px - dz * 4.5, py + dx * 4.5);
        c.lineTo(px + dz * 4.5, py - dx * 4.5);
        c.closePath();
        c.fill();
      } else {
        c.fillStyle = a.color;
        c.beginPath();
        c.arc(px, py, 3.2, 0, Math.PI * 2);
        c.fill();
      }
      // name banner with a parchment halo for legibility
      c.font = 'italic 10px Georgia';
      c.lineWidth = 3;
      c.strokeStyle = 'rgba(226, 208, 165, 0.85)';
      c.strokeText(a.label, px, py - 7);
      c.fillStyle = INK;
      c.fillText(a.label, px, py - 7);
    }
  }
}
