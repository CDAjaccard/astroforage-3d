/* Ciel de KEPLER-9b : dôme shader jour/nuit (soleil, étoiles, deux lunes),
 * piloté par daylight (0..1) et l'intensité de tempête. */
import * as THREE from "three";

const VSH = /* glsl */`
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position, 0.0);   // dôme collé à la caméra
  gl_Position = (projectionMatrix * vec4(p.xyz, 1.0)).xyww;
}`;

const FSH = /* glsl */`
varying vec3 vDir;
uniform float uDay;      // 0 nuit .. 1 jour
uniform float uStorm;    // 0..1
uniform float uTime;
uniform vec3 uSunDir;

float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }

void main(){
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -1.0, 1.0);

  vec3 dayZen  = vec3(0.30, 0.52, 0.62);
  vec3 dayHor  = vec3(0.86, 0.62, 0.42);
  vec3 nightZen= vec3(0.015, 0.02, 0.05);
  vec3 nightHor= vec3(0.05, 0.05, 0.10);

  vec3 zen = mix(nightZen, dayZen, uDay);
  vec3 hor = mix(nightHor, dayHor, uDay);
  vec3 col = mix(hor, zen, pow(max(h, 0.0), 0.6));

  /* aube / crépuscule : embrasement de l'horizon côté soleil */
  float dawn = 1.0 - smoothstep(0.0, 0.32, abs(uSunDir.y));
  vec2 az = normalize(d.xz + vec2(1e-4));
  vec2 saz = normalize(uSunDir.xz + vec2(1e-4));
  float facing = max(0.0, dot(az, saz)) * 0.5 + 0.5;
  col += vec3(0.90, 0.38, 0.14) * dawn * facing * pow(max(0.0, 1.0 - abs(h)), 3.0) * 0.55;

  /* soleil */
  float s = max(dot(d, uSunDir), 0.0);
  col += vec3(1.0, 0.85, 0.6) * pow(s, 600.0) * 3.0 * uDay;
  col += vec3(1.0, 0.6, 0.3) * pow(s, 8.0) * 0.25 * uDay;

  /* voie lactée : fine écharpe laiteuse en travers du ciel nocturne */
  float mw = pow(max(0.0, 1.0 - abs(dot(d, normalize(vec3(0.62, 0.30, -0.72))))), 3.6);
  float mwn = 0.65 + 0.35 * hash(floor(d * 90.0));
  col += vec3(0.26, 0.30, 0.42) * mw * mwn * 0.16 * (1.0 - uDay) * step(0.0, h);

  /* étoiles (la nuit) */
  vec3 sp = floor(d * 220.0);
  float st = step(0.9985, hash(sp));
  float tw = 0.6 + 0.4 * sin(uTime * 2.0 + hash(sp.zxy) * 20.0);
  col += vec3(0.9, 0.95, 1.0) * st * tw * (1.0 - uDay) * step(0.02, h);

  /* géante gazeuse annelée, fixe dans le ciel de KEPLER-9b */
  {
    vec3 gg = normalize(vec3(-0.52, 0.34, -0.78));
    vec3 t1 = normalize(cross(gg, vec3(0.0, 1.0, 0.0)));
    vec3 t2 = cross(t1, gg);
    float gr = 0.15;                             // rayon angulaire (corde)
    vec2 pq = vec2(dot(d, t1), dot(d, t2)) / gr;
    float rr = length(pq);
    float gvis = mix(1.0, 0.38, uDay) * (1.0 - uStorm) * step(0.0, dot(d, gg));
    /* anneaux : ellipse inclinée, cachée derrière le disque */
    vec2 rp = vec2(pq.x * 0.921 + pq.y * 0.390, (pq.x * -0.390 + pq.y * 0.921) / 0.24);
    float rho = length(rp);
    float ring = smoothstep(1.20, 1.42, rho) * (1.0 - smoothstep(1.95, 2.20, rho));
    ring *= 0.55 + 0.45 * sin(rho * 24.0);       // sillons
    if (rr < 1.0) {
      float limb = sqrt(max(0.0, 1.0 - rr * rr));
      float bands = 0.5 + 0.5 * sin(pq.y * 13.0 + sin(pq.x * 2.5 + pq.y * 4.0) * 0.6);
      vec3 gcol = mix(vec3(0.50, 0.34, 0.27), vec3(0.92, 0.76, 0.58), bands) * (0.40 + 0.60 * limb);
      float disk = smoothstep(1.0, 0.965, rr);
      col = mix(col, gcol, disk * gvis);
    } else {
      col = mix(col, vec3(0.86, 0.74, 0.60), ring * 0.45 * gvis);
    }
  }

  /* deux lunes */
  vec3 m1 = normalize(vec3(0.5, 0.45, -0.6));
  vec3 m2 = normalize(vec3(-0.66, 0.3, 0.35));
  float md1 = distance(d, m1), md2 = distance(d, m2);
  col += vec3(0.75, 0.78, 0.85) * smoothstep(0.045, 0.028, md1) * (1.0 - uDay * 0.7);
  col += vec3(0.82, 0.70, 0.62) * smoothstep(0.028, 0.016, md2) * (1.0 - uDay * 0.7);

  /* tempête : voile ocre */
  col = mix(col, vec3(0.55, 0.42, 0.28), uStorm * 0.75);

  gl_FragColor = vec4(col, 1.0);
}`;

export class Sky {
  mesh: THREE.Mesh;
  uniforms = {
    uDay: { value: 1 },
    uStorm: { value: 0 },
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.2).normalize() }
  };

  constructor(scene: THREE.Scene) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: VSH,
      fragmentShader: FSH,
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(10, 24, 16), mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
    scene.add(this.mesh);
  }

  update(daylight: number, storm: number, time: number, dayPhase: number): void {
    this.uniforms.uDay.value = daylight;
    this.uniforms.uStorm.value = storm;
    this.uniforms.uTime.value = time;
    /* trajectoire du soleil alignée sur la lumière de la sim : zénith à
     * dayPhase = 0.25 (pic de daylight), couchant vers 0.54. Élévation
     * plafonnée (~62°) pour garder du modelé sur les faces verticales. */
    const a = dayPhase * Math.PI * 2;
    this.uniforms.uSunDir.value.set(Math.cos(a) * 0.9, Math.sin(a) * 0.82, 0.44).normalize();
  }
}
