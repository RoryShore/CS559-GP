export class UI {
  constructor() {
    this.scoreEl = document.querySelector("#score");
    this.gridSizeEl = document.querySelector("#gridSize");
    this.modeTextEl = document.querySelector("#modeText");
    this.playTextEl = document.querySelector("#playText");

    this.playModeSnake = document.querySelector("#playModeSnake");
    this.fullMode = document.querySelector("#fullMode");
    this.growMode = document.querySelector("#growMode");
    this.btnGrowShrink = document.querySelector("#btnGrowShrink");
    this.btnReset = document.querySelector("#btnReset");

    // mobile
    this.mcUp = document.querySelector("#mcUp");
    this.mcDown = document.querySelector("#mcDown");
    this.mcLeft = document.querySelector("#mcLeft");
    this.mcRight = document.querySelector("#mcRight");
    this.mcAction = document.querySelector("#mcAction");
    this.mcGrow = document.querySelector("#mcGrow");
    this.mcShrink = document.querySelector("#mcShrink");

    // toast
    this._toast = document.createElement("div");
    this._toast.style.cssText =
      "position:fixed;left:50%;bottom:18px;transform:translateX(-50%);padding:10px 14px;" +
      "background:rgba(10,12,18,.82);border:1px solid rgba(255,255,255,.12);border-radius:14px;" +
      "color:#e8eefc;font-weight:800;opacity:0;pointer-events:none;transition:opacity .18s;";
    document.body.appendChild(this._toast);

    const wireTap = (btn) => btn.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
    [this.btnGrowShrink, this.btnReset, this.mcUp, this.mcDown, this.mcLeft, this.mcRight, this.mcAction, this.mcGrow, this.mcShrink]
      .forEach(wireTap);
  }

  setScore(v) { this.scoreEl.textContent = String(v); }
  setGridSize(v) { this.gridSizeEl.textContent = String(v); }
  setModeText(v) { this.modeTextEl.textContent = String(v); }
  setPlayText(v) { this.playTextEl.textContent = String(v); }
  setGrowShrinkButtonLabel(v) { this.btnGrowShrink.textContent = v; }

  flash(msg) {
    this._toast.textContent = msg;
    this._toast.style.opacity = "1";
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => (this._toast.style.opacity = "0"), 700);
  }

  onTogglePlayModeSnake(cb) {
    this.playModeSnake.addEventListener("change", () => cb(this.playModeSnake.checked));
  }
  onToggleFullMode(cb) { this.fullMode.addEventListener("change", () => cb(this.fullMode.checked)); }
  onToggleGrowMode(cb) { this.growMode.addEventListener("change", () => cb(this.growMode.checked)); }

  onGrowShrink(cb) { this.btnGrowShrink.addEventListener("click", cb); }
  onReset(cb) { this.btnReset.addEventListener("click", cb); }

  onMoveDir(cb) {
    this.mcUp.addEventListener("click", () => cb("up"));
    this.mcDown.addEventListener("click", () => cb("down"));
    this.mcLeft.addEventListener("click", () => cb("left"));
    this.mcRight.addEventListener("click", () => cb("right"));
  }

  onAction(cb) { this.mcAction.addEventListener("click", cb); }

  onGrowShrinkExplicit({ onGrow, onShrink }) {
    this.mcGrow.addEventListener("click", onGrow);
    this.mcShrink.addEventListener("click", onShrink);
  }
}
