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

  /* soleil */
  float s = max(dot(d, uSunDir), 0.0);
  col += vec3(1.0, 0.85, 0.6) * pow(s, 600.0) * 3.0 * uDay;
  col += vec3(1.0, 0.6, 0.3) * pow(s, 8.0) * 0.25 * uDay;

  /* étoiles (la nuit) */
  vec3 sp = floor(d * 220.0);
  float st = step(0.9985, hash(sp));
  float tw = 0.6 + 0.4 * sin(uTime * 2.0 + hash(sp.zxy) * 20.0);
  col += vec3(0.9, 0.95, 1.0) * st * tw * (1.0 - uDay) * step(0.02, h);

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
    /* trajectoire du soleil liée à la phase du jour */
    const a = dayPhase * Math.PI * 2 - Math.PI * 0.5;
    this.uniforms.uSunDir.value.set(Math.cos(a) * 0.9, Math.sin(a), 0.35).normalize();
  }
}
