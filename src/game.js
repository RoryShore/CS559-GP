import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { Grid } from "./grid.js";
import { Snake } from "./snake.js";
import { AssetBank } from "./assets.js";

export class Game {
  constructor({ canvas, ui }) {
    this.canvas = canvas;
    this.ui = ui;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x090b10);

    this.camera = new THREE.PerspectiveCamera(60, 2, 0.1, 200);
    this.camera.position.set(12, 14, 16);
    this.camera.lookAt(0, 0, 0);

    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(10, 18, 6);
    this.scene.add(key);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.35));

    this.stage = new THREE.Mesh(
      new THREE.CylinderGeometry(14, 14, 0.6, 64),
      new THREE.MeshStandardMaterial({ color: 0x0f1422, roughness: 0.9, metalness: 0.0 })
    );
    this.stage.position.y = -0.4;
    this.scene.add(this.stage);

    this.assets = new AssetBank();
    this.fullMode = false;

    this.grid = new Grid({ size: 9, scene: this.scene, assets: this.assets });
    this.snake = new Snake({ scene: this.scene, assets: this.assets, grid: this.grid });

    // Play mode
    this.playMode = "clear"; // start here
    this.growMode = true;

    // Clear-mode cursor & selection
    this.cursor = { x: 0, z: 0 };
    this.selected = null;

    this.cursorMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.98, 0.98, 0.98),
      new THREE.MeshBasicMaterial({ color: 0x7aa2ff, wireframe: true })
    );
    this.cursorMesh.position.y = 0.5;
    this.scene.add(this.cursorMesh);

    // Fruit for snake mode
    this.fruitCell = null;
    this.fruitMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 20, 20),
      new THREE.MeshStandardMaterial({ color: 0xffc857, roughness: 0.35, metalness: 0.05 })
    );
    this.fruitMesh.visible = false;
    this.scene.add(this.fruitMesh);

    // Timing
    this._clock = new THREE.Clock();
    this._raf = 0;

    this.score = 0;
    this.stepAccum = 0;
    this.snakeStepTime = 0.14;

    this._syncUI();
  }

  async start() {
    await this.assets.init();
    this.setFullMode(false);
    this.reset();
    this._tick();
  }

  godClearAll() {
    const n = this.grid.clearAllTiles(true);
    this.score += n * 2; // small reward, adjust if you want
    this.ui.flash(`GOD MODE: cleared ${n} tiles`);
    this._syncUI();

    // If you're in snake mode, re-place fruit (now many empty cells)
    if (this.playMode === "snake") this._spawnFruitIfNeeded(true);
  }

  placeTileAtCursor() {
    if (this.playMode !== "clear") return;

    const cell = { x: this.cursor.x, z: this.cursor.z };
    if (this.grid.hasTile(cell)) {
      this.ui.flash("Cell already has a tile.");
      return;
    }

    const colorIndex = Math.floor(Math.random() * this.assets.paletteSize());
    this.grid.placeTile(cell, colorIndex);
    this.ui.flash("Placed a tile.");

    // Optional: auto-clear if you create a match
    const cleared = this.grid.findAndClearMatches();
    if (cleared > 0) {
      this.score += cleared * 10;
      this.ui.flash(`Match cleared: ${cleared} tiles`);
    }
    this._syncUI();
  }



  reset() {
    this.score = 0;
    this.grid.reset();
    this.grid.seedTiles(0.75); // lots of uncleared/walls

    this.cursor = { x: Math.floor(this.grid.size / 2), z: Math.floor(this.grid.size / 2) };
    this.selected = null;

    this.snake.reset();
    this.snake.setVisible(false);
    this._despawnFruit();

    this.setPlayMode("clear"); // always reset into clear mode
    this._syncUI();
  }

  setPlayMode(mode) {
    this.playMode = mode;
    this.ui.setPlayText(mode === "snake" ? "Snake" : "Clear");

    if (mode === "snake") {
      this.snake.setVisible(true);
      this.selected = null;
      this._spawnFruitIfNeeded();
      this.ui.flash("Snake Mode: tiles are walls. Eat fruit!");
    } else {
      this.snake.setVisible(false);
      this._despawnFruit();
      this.ui.flash("Clear Mode: select/swap to clear 4+ matches.");
    }
  }

  setFullMode(v) {
    this.fullMode = !!v;
    this.assets.setFullMode(this.fullMode);
    this.grid.refreshMaterials();
    this.snake.refreshMaterials();
    this.ui.setModeText(this.fullMode ? "Full" : "Prototype");
  }

  setGrowMode(v) {
    this.growMode = !!v;
    this.ui.setGrowShrinkButtonLabel(this.growMode ? "Grow" : "Shrink");
  }

  growOrShrink() {
    if (this.growMode) this.growGrid();
    else this.shrinkGrid();
  }

  growGrid() {
    const ok = this.grid.grow();
    if (ok) {
      this._clampCursor();
      this.snake.reset();
      this._spawnFruitIfNeeded(true);
      this._syncUI();
      this.ui.flash("Grid grew!");
    }
  }

  shrinkGrid() {
    // snake cannot be on border for shrink to be safe; enforce by switching to clear mode if needed
    if (this.playMode === "snake") {
      const h = this.snake.headCell();
      if (h.x === 0 || h.z === 0 || h.x === this.grid.size - 1 || h.z === this.grid.size - 1) {
        this.ui.flash("Move snake off border before shrinking.");
        return;
      }
    }
    const ok = this.grid.shrinkIfSafe();
    if (ok) {
      this._clampCursor();
      this.snake.reset();
      this._spawnFruitIfNeeded(true);
      this._syncUI();
      this.ui.flash("Grid shrank!");
    } else {
      this.ui.flash("Shrink blocked: border must be cleared.");
    }
  }

  handleDirInput(dir) {
    if (this.playMode === "snake") {
      this.snake.setDirection(dir);
      return;
    }

    // Clear mode: move cursor
    const d = { up: [0,-1], down: [0,1], left: [-1,0], right: [1,0] }[dir];
    if (!d) return;
    this.cursor.x = Math.max(0, Math.min(this.grid.size - 1, this.cursor.x + d[0]));
    this.cursor.z = Math.max(0, Math.min(this.grid.size - 1, this.cursor.z + d[1]));
  }

  handleAction() {
    if (this.playMode === "snake") return; // no action in snake mode

    const here = { x: this.cursor.x, z: this.cursor.z };

    // First press: must select a tile (not empty)
    if (!this.selected) {
      if (!this.grid.hasTile(here)) {
        this.ui.flash("Select a TILE first (empty cells can be filled with Z).");
        return;
      }
      this.selected = here;
      this.ui.flash("Selected. Move to adjacent tile/empty cell and press again to swap/move.");
      return;
    }

    const a = this.selected;
    const b = here;
    const manhattan = Math.abs(a.x - b.x) + Math.abs(a.z - b.z);

    if (manhattan !== 1) {
      // reselect if they clicked far away
      if (this.grid.hasTile(here)) {
        this.selected = here;
        this.ui.flash("Selection changed. Swap/move must be adjacent.");
      } else {
        this.ui.flash("Swap/move must be adjacent (and first cell must be a tile).");
      }
      return;
    }

    // Attempt swap or move
    const result = this.grid.swapTiles(a, b);
    if (!result) {
      this.ui.flash("Invalid swap/move.");
      this.selected = null;
      return;
    }

    const cleared = this.grid.findAndClearMatches(); // connect-3 logic already
    if (cleared > 0) {
      this.score += cleared * 10;
      this.ui.flash(`Match cleared: ${cleared} tiles`);
    } else {
      // revert if no match made
      // If it was a move into empty, move back; if swap, swap again.
      if (result.kind === "move") {
        this.grid.moveTile(result.to, result.from);
      } else {
        this.grid.swapTiles(a, b);
      }
      this.ui.flash("No match-3 formed. Move reverted.");
    }

    this.selected = null;
    this._syncUI();
  }


  _spawnFruitIfNeeded(force = false) {
    if (this.playMode !== "snake") return;
    if (this.fruitCell && !force) return;

    // pick random empty cell not blocked and not on snake
    const occupied = new Set(this.snake.body?.map(c => `${c.x},${c.z}`) ?? []);
    for (let tries = 0; tries < 200; tries++) {
      const c = { x: Math.floor(Math.random() * this.grid.size), z: Math.floor(Math.random() * this.grid.size) };
      if (!this.grid.inBounds(c)) continue;
      if (this.grid.isBlocked(c)) continue;
      if (occupied.has(`${c.x},${c.z}`)) continue;
      this.fruitCell = c;
      const p = this.grid.cellToWorld(c);
      this.fruitMesh.position.set(p.x, 0.55, p.z);
      this.fruitMesh.visible = true;
      return;
    }

    // if no space, just hide fruit
    this._despawnFruit();
  }

  _despawnFruit() {
    this.fruitCell = null;
    this.fruitMesh.visible = false;
  }

  _syncUI() {
    this.ui.setScore(this.score);
    this.ui.setGridSize(`${this.grid.size}×${this.grid.size}`);
  }

  _clampCursor() {
    this.cursor.x = Math.max(0, Math.min(this.grid.size - 1, this.cursor.x));
    this.cursor.z = Math.max(0, Math.min(this.grid.size - 1, this.cursor.z));
  }

  _resizeIfNeeded() {
    const w = this.canvas.clientWidth | 0;
    const h = this.canvas.clientHeight | 0;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  }

  _tick = () => {
    this._raf = requestAnimationFrame(this._tick);
    const dt = this._clock.getDelta();
    const t = this._clock.elapsedTime;

    this._resizeIfNeeded();

    // Always animate tile shrink clears
    this.grid.animate();

    // Cursor visuals (clear mode only)
    const cp = this.grid.cellToWorld(this.cursor);
    this.cursorMesh.position.set(cp.x, 0.52, cp.z);
    this.cursorMesh.visible = (this.playMode === "clear");

    // Highlight selection by changing cursor color
    if (this.selected) this.cursorMesh.material.color.setHex(0xffc857);
    else this.cursorMesh.material.color.setHex(0x7aa2ff);

    // Snake mode simulation
    if (this.playMode === "snake") {
      this.stepAccum += dt;
      while (this.stepAccum >= this.snakeStepTime) {
        this.stepAccum -= this.snakeStepTime;

        const res = this.snake.step({
          blockedFn: (cell) => this.grid.isBlocked(cell),
          fruitCell: this.fruitCell
        });

        if (res.status === "dead") {
          this.ui.flash("Snake hit a wall/edge/self. Resetting…");
          this.reset();
          return;
        }

        if (res.ateFruit) {
          this.score += 25;
          this._spawnFruitIfNeeded(true);
          this._syncUI();
        }
      }

      // Fruit bob animation
      if (this.fruitMesh.visible) {
        this.fruitMesh.position.y = 0.55 + 0.06 * Math.sin(t * 4.0);
      }

      this.snake.animate(t);
    }

    this.renderer.render(this.scene, this.camera);
  };
}
