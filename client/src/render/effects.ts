/* Effets : particules (Points additifs), textes flottants (DOM projeté),
 * anneaux soniques, faisceaux. */
import * as THREE from "three";

const MAX = 3000;

function dotTexture(): THREE.Texture {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 32;
  const ctx = cv.getContext("2d")!;
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.5, "rgba(255,255,255,0.5)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(cv);
}

interface Particle { life: number; max: number; vx: number; vy: number; vz: number; grav: number }

export class Effects {
  private geo = new THREE.BufferGeometry();
  private pos = new Float32Array(MAX * 3);
  private col = new Float32Array(MAX * 3);
  private parts: Particle[] = new Array(MAX);
  private cursor = 0;
  private points: THREE.Points;
  private floaters: Array<{ el: HTMLDivElement; x: number; y: number; z: number; t: number }> = [];
  private rings: Array<{ mesh: THREE.Mesh; t: number }> = [];
  private layer: HTMLDivElement;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene, uiLayer: HTMLDivElement) {
    this.scene = scene;
    this.layer = uiLayer;
    for (let i = 0; i < MAX; i++) this.parts[i] = { life: 0, max: 1, vx: 0, vy: 0, vz: 0, grav: 0 };
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute("color", new THREE.BufferAttribute(this.col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.6, map: dotTexture(), transparent: true, depthWrite: false,
      vertexColors: true, blending: THREE.AdditiveBlending, sizeAttenuation: true
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  private emit(x: number, y: number, z: number, color: string, spread: number, up: number, grav: number, life: number): void {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % MAX;
    const p = this.parts[i];
    p.life = p.max = life * (0.7 + Math.random() * 0.6);
    p.vx = (Math.random() - 0.5) * spread;
    p.vy = up * (0.5 + Math.random());
    p.vz = (Math.random() - 0.5) * spread;
    p.grav = grav;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    const c = new THREE.Color(color);
    this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
  }

  /** poussière/fumée */
  puff(x: number, y: number, z: number, color = "#9a8b78", n = 3): void {
    for (let i = 0; i < n; i++) this.emit(x, y, z, color, 1.6, 1.2, -0.5, 1.1);
  }
  /** éclats de forage/impacts */
  chunks(x: number, y: number, z: number, color = "#c9a27a", n = 6): void {
    for (let i = 0; i < n; i++) this.emit(x, y, z, color, 5, 2.6, 9, 0.7);
  }
  /** explosion */
  boom(x: number, y: number, z: number): void {
    for (let i = 0; i < 26; i++) this.emit(x, y, z, i % 3 ? "#ff8c42" : "#ffd23e", 9, 4, 4, 0.9);
    for (let i = 0; i < 14; i++) this.emit(x, y, z, "#5a5a66", 4, 3, -1, 1.8);
  }
  /** flamme de réacteur */
  flame(x: number, y: number, z: number): void {
    this.emit(x, y, z, Math.random() < 0.5 ? "#ffd23e" : "#ff8c42", 2, -6, -14, 0.5);
  }
  /** colonne du monte-charge */
  beamCol(x: number, y: number, z: number): void {
    for (let i = 0; i < 16; i++) this.emit(x, y + i * 0.8, z, "#7de0d8", 0.8, 1.5, -0.2, 0.8);
  }
  /** impulsion sonique */
  sonic(x: number, y: number, z: number): void {
    const m = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.07, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0x7de0d8, transparent: true, opacity: 0.8 })
    );
    m.position.set(x, y, z);
    m.rotation.x = Math.PI / 2;
    this.scene.add(m);
    this.rings.push({ mesh: m, t: 0 });
  }

  floater(x: number, y: number, z: number, txt: string, color = "#fff"): void {
    const el = document.createElement("div");
    el.className = "floater";
    el.textContent = txt;
    el.style.color = color;
    this.layer.appendChild(el);
    this.floaters.push({ el, x, y, z, t: 0 });
    if (this.floaters.length > 40) {
      const f = this.floaters.shift();
      f?.el.remove();
    }
  }

  update(dt: number, camera: THREE.Camera): void {
    for (let i = 0; i < MAX; i++) {
      const p = this.parts[i];
      if (p.life <= 0) { this.col[i * 3] *= 0.9; this.col[i * 3 + 1] *= 0.9; this.col[i * 3 + 2] *= 0.9; continue; }
      p.life -= dt;
      p.vy -= p.grav * dt;
      this.pos[i * 3] += p.vx * dt;
      this.pos[i * 3 + 1] += p.vy * dt;
      this.pos[i * 3 + 2] += p.vz * dt;
      const f = Math.max(0, p.life / p.max);
      this.col[i * 3] *= 0.985; this.col[i * 3 + 1] *= 0.985; this.col[i * 3 + 2] *= 0.985;
      if (f <= 0) { this.col[i * 3] = this.col[i * 3 + 1] = this.col[i * 3 + 2] = 0; }
    }
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      const s = 1 + r.t * 14;
      r.mesh.scale.setScalar(s);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.8 - r.t * 1.4);
      if (r.t > 0.65) {
        this.scene.remove(r.mesh);
        r.mesh.geometry.dispose();
        this.rings.splice(i, 1);
      }
    }

    const v = new THREE.Vector3();
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.t += dt;
      if (f.t > 1.7) { f.el.remove(); this.floaters.splice(i, 1); continue; }
      v.set(f.x, f.y + f.t * 1.4, f.z).project(camera);
      const behind = v.z > 1;
      if (behind || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) { f.el.style.display = "none"; continue; }
      f.el.style.display = "block";
      f.el.style.left = ((v.x * 0.5 + 0.5) * window.innerWidth) + "px";
      f.el.style.top = ((-v.y * 0.5 + 0.5) * window.innerHeight) + "px";
      f.el.style.opacity = String(Math.max(0, 1 - f.t / 1.7));
    }
  }
}
