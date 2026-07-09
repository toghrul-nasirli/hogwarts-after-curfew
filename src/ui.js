// DOM HUD: overlay, objective, captions, prompts, spell bar, chill vignette, faint fade.
export class UI {
  constructor() {
    this.el = {
      overlay: document.getElementById('overlay'),
      objective: document.getElementById('objtext'),
      caption: document.getElementById('caption'),
      prompt: document.getElementById('prompt'),
      chill: document.getElementById('chill'),
      faint: document.getElementById('faint'),
      fainttext: document.getElementById('fainttext'),
      slots: [...document.querySelectorAll('#spellbar .slot')],
      points: document.getElementById('points'),
      pointsval: document.getElementById('pointsval'),
      sorting: document.getElementById('sorting'),
    };
    this._pointsTimer = null;
    this._capTimer = null;
    this._fainting = false;
    this.onStart = null;
    this.onHouse = null; // (value: '0'..'3' | 'hat') => {}
    this.el.overlay.addEventListener('click', (e) => {
      // clicks inside the sorting panel are handled by the house buttons
      if (this.el.sorting.classList.contains('show')) return;
      if (this.onStart) this.onStart();
    });
    for (const b of this.el.sorting.querySelectorAll('.house')) {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onHouse) this.onHouse(b.dataset.house);
      });
    }
  }

  showSorting() { this.el.sorting.classList.add('show'); }
  hideSorting() { this.el.sorting.classList.remove('show'); }

  setHouse(name, color) {
    const head = this.el.points.querySelector('.head');
    head.textContent = name;
    head.style.color = color;
  }

  hideOverlay() { this.el.overlay.classList.add('hidden'); }
  showOverlay() { this.el.overlay.classList.remove('hidden'); }

  setPaused(paused) {
    if (paused) {
      this.el.overlay.querySelector('.enter').textContent = 'Paused — click to resume';
      this.showOverlay();
    } else {
      this.hideOverlay();
    }
  }

  objective(html) {
    this.el.objective.innerHTML = html;
  }

  caption(text, ms = 3200) {
    this.el.caption.textContent = text;
    this.el.caption.style.opacity = 1;
    clearTimeout(this._capTimer);
    this._capTimer = setTimeout(() => { this.el.caption.style.opacity = 0; }, ms);
  }

  prompt(html) {
    if (html) {
      this.el.prompt.innerHTML = html;
      this.el.prompt.style.opacity = 1;
    } else {
      this.el.prompt.style.opacity = 0;
    }
  }

  setSpell(i) {
    this.el.slots.forEach((s, j) => s.classList.toggle('sel', i === j));
  }

  setLumos(on) {
    this.el.slots[0].classList.toggle('lit', on);
  }

  setPoints(n, delta = 0) {
    this.el.pointsval.textContent = n;
    if (delta !== 0) {
      this.el.points.classList.remove('gain', 'loss');
      void this.el.points.offsetWidth; // restart the flash
      this.el.points.classList.add(delta > 0 ? 'gain' : 'loss');
      clearTimeout(this._pointsTimer);
      this._pointsTimer = setTimeout(() => this.el.points.classList.remove('gain', 'loss'), 1200);
    }
  }

  chill(level) {
    this.el.chill.style.opacity = Math.min(1, Math.max(0, level)) * 0.9;
  }

  // Fade to black, run the callback at full black, then fade back.
  faint(text, midCallback) {
    if (this._fainting) return;
    this._fainting = true;
    this.el.fainttext.textContent = '';
    this.el.faint.style.opacity = 1;
    setTimeout(() => {
      this.el.fainttext.textContent = text;
      if (midCallback) midCallback();
    }, 1200);
    setTimeout(() => { this.el.fainttext.textContent = ''; this.el.faint.style.opacity = 0; }, 3400);
    setTimeout(() => { this._fainting = false; }, 4600);
  }
}
