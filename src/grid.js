import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

function keyOf(c) { return `${c.x},${c.z}`; }
function randInt(n) { return Math.floor(Math.random() * n); }

export class Grid {
  constructor({ size, scene, assets }) {
    this.scene = scene;
    this.assets = assets;

    this.size = size;
    this.maxSize = 15;
    this.minSize = 7;

    this.cellSize = 1.0;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    // tiles: "x,z" -> { colorIndex, mesh, shrink }
    this.tiles = new Map();

    this._buildGridVisual();
  }

  clearAllTiles(withAnim = true) {
    const cells = [];
    for (const k of this.tiles.keys()) {
      const [x, z] = k.split(",").map(Number);
      cells.push({ x, z });
    }
    for (const c of cells) this.removeTile(c, withAnim);
    return cells.length;
  }


  moveTile(from, to) {
    const kFrom = keyOf(from);
    const kTo = keyOf(to);

    const tFrom = this.tiles.get(kFrom);
    if (!tFrom) return false;
    if (this.tiles.has(kTo)) return false; // destination must be empty
    if (!this.inBounds(to)) return false;

    // move mesh in world
    const p = this.cellToWorld(to);
    tFrom.mesh.position.set(p.x, 0.45, p.z);

    // move entry in map
    this.tiles.delete(kFrom);
    this.tiles.set(kTo, tFrom);
    return true;
  }


  reset() {
    this.group.clear();
    this.tiles.clear();
    this._buildGridVisual();
  }

  _buildGridVisual() {
    const half = (this.size - 1) * this.cellSize * 0.5;

    const plane = new THREE.Mesh(
      new THREE.BoxGeometry(this.size * this.cellSize + 0.2, 0.2, this.size * this.cellSize + 0.2),
      new THREE.MeshStandardMaterial({ color: 0x10162a, roughness: 0.95, metalness: 0.0 })
    );
    plane.position.set(0, -0.1, 0);
    this.group.add(plane);

    const lineMat = new THREE.LineBasicMaterial({ color: 0x2a3557, transparent: true, opacity: 0.55 });
    const geo = new THREE.BufferGeometry();
    const verts = [];

    for (let i = 0; i <= this.size; i++) {
      const p = -half + i * this.cellSize;
      verts.push(-half, 0.01, p, half, 0.01, p);
      verts.push(p, 0.01, -half, p, 0.01, half);
    }
    geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    this.group.add(new THREE.LineSegments(geo, lineMat));
  }

  refreshMaterials() {
    for (const [, t] of this.tiles) t.mesh.material = this.assets.tileMaterial(t.colorIndex);
  }

  inBounds(cell) {
    return cell.x >= 0 && cell.z >= 0 && cell.x < this.size && cell.z < this.size;
  }

  cellToWorld(cell) {
    const half = (this.size - 1) * this.cellSize * 0.5;
    return new THREE.Vector3((cell.x * this.cellSize) - half, 0, (cell.z * this.cellSize) - half);
  }

  isBlocked(cell) {
    // In snake mode: any uncleared tile blocks movement.
    return this.tiles.has(keyOf(cell));
  }

  getTileColor(cell) {
    const t = this.tiles.get(keyOf(cell));
    return t ? t.colorIndex : null;
  }

  hasTile(cell) { return this.tiles.has(keyOf(cell)); }

  placeTile(cell, colorIndex) {
    if (!this.inBounds(cell)) return false;
    const k = keyOf(cell);
    if (this.tiles.has(k)) return false;

    const mesh = new THREE.Mesh(this.assets.tileGeometry(), this.assets.tileMaterial(colorIndex));
    const p = this.cellToWorld(cell);
    mesh.position.set(p.x, 0.45, p.z);

    this.tiles.set(k, { colorIndex, mesh, shrink: 0 });
    this.group.add(mesh);
    return true;
  }

  removeTile(cell, withAnim = true) {
    const k = keyOf(cell);
    const t = this.tiles.get(k);
    if (!t) return false;

    if (withAnim) t.shrink = 1.0;
    else {
      this.group.remove(t.mesh);
      this.tiles.delete(k);
    }
    return true;
  }

  setTileColor(cell, colorIndex) {
    const k = keyOf(cell);
    const t = this.tiles.get(k);
    if (!t) return false;
    t.colorIndex = colorIndex;
    t.mesh.material = this.assets.tileMaterial(colorIndex);
    return true;
  }

  swapTiles(a, b) {
    const ka = keyOf(a), kb = keyOf(b);
    const ta = this.tiles.get(ka);
    const tb = this.tiles.get(kb);

    // Case 1: tile <-> tile : swap colors/materials
    if (ta && tb) {
      const ca = ta.colorIndex, cb = tb.colorIndex;
      ta.colorIndex = cb; tb.colorIndex = ca;
      ta.mesh.material = this.assets.tileMaterial(cb);
      tb.mesh.material = this.assets.tileMaterial(ca);
      return { kind: "swap" };
    }

    // Case 2: tile -> empty : move tile into empty cell
    if (ta && !tb) {
      const ok = this.moveTile(a, b);
      return ok ? { kind: "move", from: a, to: b } : null;
    }
    if (!ta && tb) {
      const ok = this.moveTile(b, a);
      return ok ? { kind: "move", from: b, to: a } : null;
    }

    // empty <-> empty
    return null;
  }


  randomTileCell() {
    return { x: randInt(this.size), z: randInt(this.size) };
  }

  seedTiles(fillRatio = 0.75) {
    // Fill board with lots of uncleared blocks (walls) at start.
    const target = Math.floor(this.size * this.size * fillRatio);
    let tries = 0;
    while (this.tiles.size < target && tries++ < target * 20) {
      const c = this.randomTileCell();
      if (this.hasTile(c)) continue;
      const colorIndex = randInt(this.assets.paletteSize());
      this.placeTile(c, colorIndex);
    }
  }

  // Match-4 clear
  findAndClearMatches() {
    const toClear = new Set();
    const getColor = (x, z) => this.tiles.get(`${x},${z}`)?.colorIndex ?? null;

    // Horizontal
    for (let z = 0; z < this.size; z++) {
      let runColor = null, runStart = 0, runLen = 0;
      for (let x = 0; x <= this.size; x++) {
        const c = (x < this.size) ? getColor(x, z) : null;
        if (c !== null && c === runColor) runLen++;
        else {
          if (runColor !== null && runLen >= 3) {
            for (let xx = runStart; xx < runStart + runLen; xx++) toClear.add(`${xx},${z}`);
          }
          runColor = c;
          runStart = x;
          runLen = (c !== null) ? 1 : 0;
        }
      }
    }

    // Vertical
    for (let x = 0; x < this.size; x++) {
      let runColor = null, runStart = 0, runLen = 0;
      for (let z = 0; z <= this.size; z++) {
        const c = (z < this.size) ? getColor(x, z) : null;
        if (c !== null && c === runColor) runLen++;
        else {
          if (runColor !== null && runLen >= 3) {
            for (let zz = runStart; zz < runStart + runLen; zz++) toClear.add(`${x},${zz}`);
          }
          runColor = c;
          runStart = z;
          runLen = (c !== null) ? 1 : 0;
        }
      }
    }

    for (const k of toClear) {
      const [x, z] = k.split(",").map(Number);
      this.removeTile({ x, z }, true);
    }
    return toClear.size;
  }

  animate() {
    for (const [k, t] of this.tiles) {
      if (t.shrink > 0) {
        t.shrink -= 0.18;
        const s = Math.max(0, t.shrink);
        t.mesh.scale.setScalar(s);
        if (s <= 0.001) {
          this.group.remove(t.mesh);
          this.tiles.delete(k);
        }
      }
    }
  }

  grow() {
    if (this.size >= this.maxSize) return false;
    // Snapshot tiles
    const snapshot = [];
    for (const [k, t] of this.tiles) {
      const [x, z] = k.split(",").map(Number);
      snapshot.push({ x: x + 1, z: z + 1, colorIndex: t.colorIndex });
    }

    this.size += 2;
    this.reset();
    for (const s of snapshot) this.placeTile({ x: s.x, z: s.z }, s.colorIndex);
    return true;
  }

  shrinkIfSafe() {
    if (this.size <= this.minSize) return false;

    // Must have empty border (no tiles)
    for (let i = 0; i < this.size; i++) {
      const border = [
        { x: i, z: 0 }, { x: i, z: this.size - 1 },
        { x: 0, z: i }, { x: this.size - 1, z: i },
      ];
      for (const c of border) if (this.hasTile(c)) return false;
    }

    // Snapshot inner tiles shifted in
    const snapshot = [];
    for (const [k, t] of this.tiles) {
      const [x, z] = k.split(",").map(Number);
      snapshot.push({ x: x - 1, z: z - 1, colorIndex: t.colorIndex });
    }

    this.size -= 2;
    this.reset();
    for (const s of snapshot) {
      if (this.inBounds(s)) this.placeTile({ x: s.x, z: s.z }, s.colorIndex);
    }
    return true;
  }
}
