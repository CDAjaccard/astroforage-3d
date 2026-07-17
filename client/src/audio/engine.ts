/* Synthèse audio WebAudio — port fidèle de js/audio.js du jeu original
 * (aucun fichier externe) : nappe réactive profondeur/nuit/tempête, boucle de
 * forage filtrée, SFX synthétisés. Ajout 3D : atténuation par distance. */
import { settings } from "../config.js";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let digGain: GainNode | null = null;
let digFilter: BiquadFilterNode | null = null;
let jetGain: GainNode | null = null;
let musicBus: GainNode | null = null;
let musFilter: BiquadFilterNode | null = null;
let padGain: GainNode | null = null;
let windGain: GainNode | null = null;
const padOsc: Array<{ o: OscillatorNode; base: number }> = [];
let muted = localStorage.getItem("af3d_mute") === "1";

function noiseBuffer(sec: number): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx!.sampleRate * sec));
  const b = ctx!.createBuffer(1, len, ctx!.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function buildMusic(): void {
  musicBus = ctx!.createGain();
  musicBus.gain.value = settings.music ? 1 : 0;
  musicBus.connect(master!);
  musFilter = ctx!.createBiquadFilter();
  musFilter.type = "lowpass";
  musFilter.frequency.value = 520;
  musFilter.Q.value = 6;
  padGain = ctx!.createGain();
  padGain.gain.value = 0.05;
  musFilter.connect(padGain);
  padGain.connect(musicBus);
  const freqs = [110, 130.81, 164.81, 220]; // La mineur, planant
  const types: OscillatorType[] = ["sine", "sine", "triangle", "sine"];
  for (let i = 0; i < freqs.length; i++) {
    const o = ctx!.createOscillator();
    o.type = types[i];
    o.frequency.value = freqs[i];
    o.detune.value = (i - 1.5) * 4;
    const g = ctx!.createGain();
    g.gain.value = i === 3 ? 0.25 : 0.6;
    o.connect(g);
    g.connect(musFilter);
    o.start();
    padOsc.push({ o, base: freqs[i] });
  }
  const lfo = ctx!.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 0.05;
  const lfoG = ctx!.createGain();
  lfoG.gain.value = 180;
  lfo.connect(lfoG);
  lfoG.connect(musFilter.frequency);
  lfo.start();
  const wsrc = ctx!.createBufferSource();
  wsrc.buffer = noiseBuffer(2);
  wsrc.loop = true;
  const wf = ctx!.createBiquadFilter();
  wf.type = "bandpass";
  wf.frequency.value = 520;
  wf.Q.value = 0.6;
  windGain = ctx!.createGain();
  windGain.gain.value = 0;
  wsrc.connect(wf);
  wf.connect(windGain);
  windGain.connect(musicBus);
  wsrc.start();
}

export function ensure(): boolean {
  if (ctx) { if (ctx.state === "suspended") void ctx.resume(); return true; }
  try {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : settings.volume;
    master.connect(ctx.destination);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(1);
    src.loop = true;
    digFilter = ctx.createBiquadFilter();
    digFilter.type = "bandpass";
    digFilter.frequency.value = 220;
    digFilter.Q.value = 0.7;
    digGain = ctx.createGain();
    digGain.gain.value = 0;
    src.connect(digFilter);
    digFilter.connect(digGain);
    digGain.connect(master);
    src.start();
    /* souffle de jetpack */
    const jsrc = ctx.createBufferSource();
    jsrc.buffer = noiseBuffer(1);
    jsrc.loop = true;
    const jf = ctx.createBiquadFilter();
    jf.type = "highpass";
    jf.frequency.value = 900;
    jetGain = ctx.createGain();
    jetGain.gain.value = 0;
    jsrc.connect(jf);
    jf.connect(jetGain);
    jetGain.connect(master);
    jsrc.start();
    buildMusic();
    return true;
  } catch {
    return false;
  }
}

function tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0): void {
  if (!ctx || !master) return;
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.03);
}

function burst(dur: number, vol: number, fc: number, type: BiquadFilterType = "lowpass", delay = 0): void {
  if (!ctx || !master) return;
  const t0 = ctx.currentTime + delay;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = ctx.createBufferSource();
  s.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = fc;
  const g = ctx.createGain();
  g.gain.value = vol;
  s.connect(f);
  f.connect(g);
  g.connect(master);
  s.start(t0);
}

/** Atténuation simple par distance (SFX localisés). */
function att(dist: number, ref = 26): number {
  return Math.max(0, Math.min(1, 1 - dist / ref));
}

export const au = {
  ensure,
  suspend(): void { if (ctx?.state === "running") void ctx.suspend(); },
  resume(): void { if (ctx?.state === "suspended") void ctx.resume(); },
  muted: (): boolean => muted,
  toggle(): boolean {
    muted = !muted;
    localStorage.setItem("af3d_mute", muted ? "1" : "0");
    if (master) master.gain.value = muted ? 0 : settings.volume;
    return muted;
  },
  applyVolume(): void { if (master) master.gain.value = muted ? 0 : settings.volume; },
  applyMusic(): void { if (musicBus && ctx) musicBus.gain.setTargetAtTime(settings.music ? 1 : 0, ctx.currentTime, 0.4); },
  /** ambiance réactive : profondeur 0..1, nuit 0..1, tempête 0..1 */
  mood(depth: number, night: number, storm: number): void {
    if (!ctx || !musFilter || !padGain || !windGain) return;
    const t = ctx.currentTime;
    const cut = 620 - depth * 380 - night * 80;
    musFilter.frequency.setTargetAtTime(Math.max(160, cut), t, 1.2);
    padGain.gain.setTargetAtTime(0.04 + depth * 0.02, t, 1.5);
    windGain.gain.setTargetAtTime(storm * 0.05, t, 0.8);
    for (const p of padOsc) p.o.detune.setTargetAtTime(night > 0.5 ? -14 : 0, t, 2);
  },
  setDig(on: boolean): void {
    if (!ctx || !digGain) return;
    digGain.gain.setTargetAtTime(on ? 0.16 : 0, ctx.currentTime, 0.05);
  },
  setBoost(on: boolean, digging: boolean): void {
    if (!ctx || !digFilter || !digGain) return;
    digFilter.frequency.setTargetAtTime(on ? 470 : 220, ctx.currentTime, 0.06);
    digGain.gain.setTargetAtTime(on && digging ? 0.22 : digging ? 0.16 : 0, ctx.currentTime, 0.06);
  },
  setJet(on: boolean): void {
    if (!ctx || !jetGain) return;
    jetGain.gain.setTargetAtTime(on ? 0.06 : 0, ctx.currentTime, 0.07);
  },
  blip(f = 880, d = 0.06, v = 0.12): void { tone("square", f, 0, d, v); },
  tink(): void { tone("square", 1500, 900, 0.05, 0.07); },
  pickup(): void { tone("square", 620, 0, 0.05, 0.1); tone("square", 930, 0, 0.07, 0.1, 0.05); },
  cash(): void { tone("triangle", 523, 0, 0.09, 0.14); tone("triangle", 659, 0, 0.09, 0.14, 0.07); tone("triangle", 784, 0, 0.13, 0.14, 0.14); },
  thud(dist = 0): void { const a = att(dist) || 1; burst(0.12, 0.3 * a, 150); tone("triangle", 95, 42, 0.13, 0.2 * a); },
  boom(dist = 0): void { const a = Math.max(0.15, att(dist, 60)); burst(0.5, 0.5 * a, 320); tone("sawtooth", 130, 32, 0.45, 0.22 * a); },
  err(): void { tone("square", 140, 0, 0.09, 0.14); tone("square", 110, 0, 0.11, 0.14, 0.1); },
  build(): void { burst(0.09, 0.25, 220); tone("square", 1050, 0, 0.08, 0.1, 0.06); },
  sizzle(): void { burst(0.15, 0.12, 3200, "highpass"); },
  launch(): void { burst(4, 0.5, 420); tone("sawtooth", 52, 36, 4, 0.22); }
};
