import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

function makeCanvasTexture(drawFn, size = 256) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  drawFn(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

export class AssetBank {
  constructor() {
    this._fullMode = false;

    // Color palette for candies
// src/assets.js
this.palette = [
  0xff4d6d, // pink-red
  0xffc857, // gold
  0x7cff6b, // green
  0x6bc7ff, // sky
];


    // Geometries (primitive-only for prototype mode)
    this._tileGeo = new THREE.BoxGeometry(0.84, 0.84, 0.84);
    this._snakeGeo = new THREE.SphereGeometry(0.42, 24, 24);

    // Materials (set in init)
    this._tileMats = [];
    this._snakeHeadMat = null;
    this._snakeBodyMat = null;

    // Optional loaded texture
    this._atlas = null;
  }

  paletteSize() { return this.palette.length; }
  setFullMode(v) {
    this._fullMode = !!v;
    this._rebuildMaterials(); // <-- ADD THIS
  }

  async init() {
    // Attempt to load an optional texture file. If it fails, we fall back safely.
    this._atlas = await this._tryLoadTexture("assets/textures/candy_atlas.png");

    // Build materials now
    this._rebuildMaterials();
  }

  _rebuildMaterials() {
    this._tileMats = this.palette.map((hex, i) => {
      if (!this._fullMode) {
        return new THREE.MeshStandardMaterial({ color: hex, roughness: 0.55, metalness: 0.05 });
      }

      // Full mode: use atlas if present; else use procedural candy texture
      let map = this._atlas;
      if (!map) {
        map = makeCanvasTexture((ctx, s) => {
          ctx.fillStyle = "#10162a";
          ctx.fillRect(0, 0, s, s);
          ctx.save();
          ctx.translate(s/2, s/2);
          // candy stripes
          ctx.rotate((i * 22) * Math.PI / 180);
          for (let k = -6; k <= 6; k++) {
            ctx.fillStyle = k % 2 === 0 ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.08)";
            ctx.fillRect(-s, k * 28, 2*s, 18);
          }
          ctx.restore();
          // center candy
          ctx.beginPath();
          ctx.arc(s/2, s/2, s*0.18, 0, Math.PI*2);
          ctx.fillStyle = "#ffffff";
          ctx.globalAlpha = 0.25;
          ctx.fill();
          ctx.globalAlpha = 1;
        }, 256);
      }

      return new THREE.MeshStandardMaterial({
        color: hex,
        map,
        roughness: 0.35,
        metalness: 0.08,
      });
    });

    this._snakeHeadMat = new THREE.MeshStandardMaterial({
      color: this._fullMode ? 0x9ad3ff : 0xffffff,
      roughness: 0.35,
      metalness: 0.05,
    });

    this._snakeBodyMat = new THREE.MeshStandardMaterial({
      color: this._fullMode ? 0x4b7dff : 0x89a1ff,
      roughness: 0.55,
      metalness: 0.02,
    });
  }

  tileGeometry() { return this._tileGeo; }
  snakeGeometry() { return this._snakeGeo; }

  tileMaterial(colorIndex) {
    // If mode changed since last build, rebuild now
    if (this._tileMats.length === 0) this._rebuildMaterials();
    return this._tileMats[colorIndex % this._tileMats.length];
  }

  snakeHeadMaterial() {
    if (!this._snakeHeadMat) this._rebuildMaterials();
    return this._snakeHeadMat;
  }

  snakeBodyMaterial() {
    if (!this._snakeBodyMat) this._rebuildMaterials();
    return this._snakeBodyMat;
  }

  _tryLoadTexture(url) {
    return new Promise((resolve) => {
      const loader = new THREE.TextureLoader();
      loader.load(
        url,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          resolve(tex);
        },
        undefined,
        () => resolve(null)
      );
    });
  }
}
