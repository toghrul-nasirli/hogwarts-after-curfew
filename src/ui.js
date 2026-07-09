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
    };
    this._capTimer = null;
    this._fainting = false;
    this.onStart = null;
    this.el.overlay.addEventListener('click', () => {
      if (this.onStart) this.onStart();
    });
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
