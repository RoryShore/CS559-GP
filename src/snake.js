import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

export class Snake {
  constructor({ scene, assets, grid }) {
    this.scene = scene;
    this.assets = assets;
    this.grid = grid;

    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.dir = "right";
    this.pendingDir = "right";

    this.body = [];
    this.maxLen = 6;

    this.headMesh = new THREE.Mesh(this.assets.snakeGeometry(), this.assets.snakeHeadMaterial());
    this.group.add(this.headMesh);

    this.bodyMeshes = [];
    for (let i = 0; i < 80; i++) {
      const m = new THREE.Mesh(this.assets.snakeGeometry(), this.assets.snakeBodyMaterial());
      m.visible = false;
      this.group.add(m);
      this.bodyMeshes.push(m);
    }

    this.visible = false;
    this.group.visible = false;

    this.reset();
  }

  setVisible(v) {
    this.visible = v;
    this.group.visible = v;
  }

  refreshMaterials() {
    this.headMesh.material = this.assets.snakeHeadMaterial();
    for (const m of this.bodyMeshes) m.material = this.assets.snakeBodyMaterial();
  }

  reset() {
    const mid = Math.floor(this.grid.size / 2);
    this.body = [{ x: mid, z: mid }, { x: mid - 1, z: mid }, { x: mid - 2, z: mid }];
    this.dir = "right";
    this.pendingDir = "right";
    this.maxLen = 6;
    this._syncMeshes();
  }

  headCell() { return { ...this.body[0] }; }

  setDirection(dir) { this.pendingDir = dir; }

  _dirVec(dir) {
    if (dir === "up") return { x: 0, z: -1 };
    if (dir === "down") return { x: 0, z: 1 };
    if (dir === "left") return { x: -1, z: 0 };
    return { x: 1, z: 0 };
  }

  _isOpposite(a, b) {
    return (a === "up" && b === "down") || (a === "down" && b === "up") ||
           (a === "left" && b === "right") || (a === "right" && b === "left");
  }

  step({ blockedFn, fruitCell }) {
    if (!this._isOpposite(this.dir, this.pendingDir)) this.dir = this.pendingDir;

    const v = this._dirVec(this.dir);
    const head = this.body[0];
    const next = { x: head.x + v.x, z: head.z + v.z };

    if (!this.grid.inBounds(next)) return { status: "dead", ateFruit: false };
    if (blockedFn(next)) return { status: "dead", ateFruit: false };

    // self collision (ignore last tail because it moves)
    for (let i = 0; i < this.body.length - 1; i++) {
      if (this.body[i].x === next.x && this.body[i].z === next.z) return { status: "dead", ateFruit: false };
    }

    let ateFruit = false;
    if (fruitCell && next.x === fruitCell.x && next.z === fruitCell.z) {
      ateFruit = true;
      this.maxLen = Math.min(30, this.maxLen + 1);
    }

    this.body.unshift(next);
    while (this.body.length > this.maxLen) this.body.pop();

    this._syncMeshes();
    return { status: "ok", ateFruit };
  }

  _syncMeshes() {
    const hp = this.grid.cellToWorld(this.body[0]);
    this.headMesh.position.set(hp.x, 0.7, hp.z);

    for (let i = 0; i < this.bodyMeshes.length; i++) {
      const m = this.bodyMeshes[i];
      if (i + 1 < this.body.length) {
        const c = this.body[i + 1];
        const p = this.grid.cellToWorld(c);
        m.visible = true;
        m.position.set(p.x, 0.6, p.z);
        m.scale.setScalar(0.82);
      } else {
        m.visible = false;
      }
    }
  }

  animate(t) {
    if (!this.visible) return;
    this.headMesh.position.y = 0.72 + 0.06 * Math.sin(t * 6.0);
    const rot = { up: Math.PI, down: 0, left: -Math.PI / 2, right: Math.PI / 2 }[this.dir] ?? 0;
    this.headMesh.rotation.y = rot;
  }
}
