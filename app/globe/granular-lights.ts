/**
 * granular-lights.ts
 */

export type LightDot = { lat: number; lon: number; I: number };
export type DensityLike = { countryCode: string; claimCount: number };
export type AnchorLike = { lat: number; lon: number; claimCount: number };

export const LIGHTS_PARAMS = {
  globeColor: "#060709",
  atmosColor: "#5a2e08",
  atmosAlt: 0.07,
  hexRes: 3,
  hexMargin: 0.62,
  hexBase: [50, 52, 56] as readonly number[],
  hexWarm: [110, 84, 44] as readonly number[],
  hexTint: 0.55,
  oceanColor: "#232932",
  oceanSize: 1.2,
  oceanCount: 16000,
  oceanOpacity: 0.75,
  dotScale: 14,
  dotPow: 0.5,
  dotCap: 3400,
  dotMin: 30,
  dotAlt: 0.006,
  sizeBase: 0.8,
  sizeRange: 2.2,
  haloScale: 3.4,
  haloAlpha: 0.16,
  coreAlpha: 0.95,
};

type Params = typeof LIGHTS_PARAMS;

function rndSeed(s: number): () => number {
  let a = s | 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rnd: () => number): number {
  let u = 0;
  let v = 0;
  while (!u) u = rnd();
  while (!v) v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

type Ring = number[][];
type PolyRings = Ring[];

function inRing(x: number, y: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function inPolys(lon: number, lat: number, polys: PolyRings[]): boolean {
  for (const rings of polys) {
    if (inRing(lon, lat, rings[0])) {
      let hole = false;
      for (let k = 1; k < rings.length; k++) {
        if (inRing(lon, lat, rings[k])) {
          hole = true;
          break;
        }
      }
      if (!hole) return true;
    }
  }
  return false;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function featPolys(f: any): PolyRings[] {
  const g = f.geometry;
  if (!g) return [];
  return g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
}

function polysBBox(polys: PolyRings[]): [number, number, number, number] {
  let mnx = 180;
  let mny = 90;
  let mxx = -180;
  let mxy = -90;
  for (const rings of polys) {
    for (const p of rings[0]) {
      if (p[0] < mnx) mnx = p[0];
      if (p[0] > mxx) mxx = p[0];
      if (p[1] < mny) mny = p[1];
      if (p[1] > mxy) mxy = p[1];
    }
  }
  return [mnx, mny, mxx, mxy];
}

const RAMP: Array<[number, [number, number, number]]> = [
  [0, [107, 43, 13]],
  [0.35, [163, 71, 14]],
  [0.6, [224, 123, 15]],
  [0.8, [245, 158, 11]],
  [1, [255, 211, 77]],
];

function rampColor(t: number): [number, number, number] {
  t = Math.max(0, Math.min(1, t));
  for (let i = 1; i < RAMP.length; i++) {
    if (t <= RAMP[i][0]) {
      const [a, ca] = RAMP[i - 1];
      const [b, cb] = RAMP[i];
      const k = (t - a) / (b - a || 1);
      return [
        ca[0] + (cb[0] - ca[0]) * k,
        ca[1] + (cb[1] - ca[1]) * k,
        ca[2] + (cb[2] - ca[2]) * k,
      ];
    }
  }
  return RAMP[RAMP.length - 1][1];
}

export function hexDotColor(count: number, maxCount: number, P: Params = LIGHTS_PARAMS): string {
  const t = (Math.log(count + 1) / Math.log(maxCount + 1)) * P.hexTint;
  const b = P.hexBase;
  const w = P.hexWarm;
  return `rgb(${Math.round(b[0] + (w[0] - b[0]) * t)},${Math.round(
    b[1] + (w[1] - b[1]) * t
  )},${Math.round(b[2] + (w[2] - b[2]) * t)})`;
}

function buildCountryDots(
  code: string,
  count: number,
  polys: PolyRings[],
  bbox: [number, number, number, number],
  anchors: AnchorLike[],
  P: Params,
  out: LightDot[]
): void {
  const rnd = rndSeed(code.charCodeAt(0) * 7919 + (code.charCodeAt(1) || 0) * 131 + 17);
  const nd = Math.max(P.dotMin, Math.min(P.dotCap, Math.round(P.dotScale * Math.pow(count, P.dotPow))));
  const diag = Math.hypot(bbox[2] - bbox[0], bbox[3] - bbox[1]);
  const spread = Math.max(0.5, Math.min(2.8, diag / 26));

  type Seed = { lat: number; lon: number; w: number; sig: number; anchor: boolean };
  const seeds: Seed[] = [];

  const anchorClaims = anchors.reduce((s, a) => s + a.claimCount, 0);
  const anchorShare = Math.min(0.55, (anchorClaims / count) * 0.7);
  const sumPow = anchors.reduce((s, a) => s + Math.pow(a.claimCount, 0.7), 0) || 1;
  for (const a of anchors) {
    seeds.push({
      lat: a.lat,
      lon: a.lon,
      w: (anchorShare * Math.pow(a.claimCount, 0.7)) / sumPow,
      sig: spread * (0.3 + 0.5 * rnd()),
      anchor: true,
    });
  }

  const nRand = Math.max(5, Math.min(26, 3 + Math.floor(Math.sqrt(nd) * 0.8)));
  const randW: number[] = [];
  let randSum = 0;
  for (let i = 0; i < nRand; i++) {
    const w = Math.pow(rnd(), 1.6) + 0.15;
    randW.push(w);
    randSum += w;
  }
  let tries = 0;
  let made = 0;
  while (made < nRand && tries < 500) {
    tries++;
    const lon = bbox[0] + rnd() * (bbox[2] - bbox[0]);
    const lat = bbox[1] + rnd() * (bbox[3] - bbox[1]);
    if (!inPolys(lon, lat, polys)) continue;
    seeds.push({
      lat,
      lon,
      w: ((1 - anchorShare) * randW[made]) / randSum,
      sig: spread * (0.55 + 1.0 * rnd()),
      anchor: false,
    });
    made++;
  }
  if (!seeds.length) return;

  let wsum = 0;
  for (const s of seeds) wsum += s.w;
  const cum: number[] = [];
  let acc = 0;
  for (const s of seeds) {
    acc += s.w / wsum;
    cum.push(acc);
  }
  const wMax = Math.max(...seeds.map((s) => s.w / wsum));

  for (let i = 0; i < nd; i++) {
    const r = rnd();
    let si = 0;
    while (si < cum.length - 1 && cum[si] < r) si++;
    const s = seeds[si];
    let placed = false;
    let lat = 0;
    let lon = 0;
    let dist = 0;
    for (let t = 0; t < 3 && !placed; t++) {
      const dLat = gauss(rnd) * s.sig;
      const dLon = (gauss(rnd) * s.sig) / Math.max(0.35, Math.cos((s.lat * Math.PI) / 180));
      lat = s.lat + dLat;
      lon = s.lon + dLon;
      dist = Math.hypot(dLat, dLon);
      if (inPolys(lon, lat, polys)) placed = true;
    }
    if (!placed) {
      if (rnd() < 0.22 && dist < s.sig * 2.2) placed = true;
      else continue;
    }
    const wn = s.w / wsum / wMax;
    const prox = Math.exp(-Math.pow(dist / (s.sig * 1.5), 2));
    let I = 0.12 + 0.55 * Math.pow(wn, 0.45) * prox + rnd() * 0.14;
    if (s.anchor && dist < s.sig * 0.25) I = Math.max(I, 0.7 + rnd() * 0.3);
    out.push({ lat, lon, I: Math.max(0.05, Math.min(1, I)) });
  }

  for (const s of seeds) {
    if (!s.anchor) continue;
    const n = Math.min(12, Math.max(2, Math.round(nd * s.w * 0.05)));
    for (let i = 0; i < n; i++) {
      const dLat = gauss(rnd) * s.sig * 0.12;
      const dLon = (gauss(rnd) * s.sig * 0.12) / Math.max(0.35, Math.cos((s.lat * Math.PI) / 180));
      out.push({ lat: s.lat + dLat, lon: s.lon + dLon, I: 0.78 + rnd() * 0.22 });
    }
  }
}

export function buildLightDots(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  features: any[],
  density: DensityLike[],
  anchors: AnchorLike[] = [],
  P: Params = LIGHTS_PARAMS
): LightDot[] {
  const densMap = new Map(density.map((d) => [d.countryCode, d.claimCount]));
  const dots: LightDot[] = [];
  for (const f of features) {
    const code: string | undefined = f.properties?.ISO_A2 ?? f.properties?.iso_a2;
    if (!code || code === "-99") continue;
    const count = densMap.get(code);
    if (!count) continue;
    const polys = featPolys(f);
    if (!polys.length) continue;
    const bbox = polysBBox(polys);
    const countryAnchors = anchors.filter(
      (o) =>
        o.lon >= bbox[0] - 0.5 &&
        o.lon <= bbox[2] + 0.5 &&
        o.lat >= bbox[1] - 0.5 &&
        o.lat <= bbox[3] + 0.5 &&
        inPolys(o.lon, o.lat, polys)
    );
    buildCountryDots(code, count, polys, bbox, countryAnchors, P, dots);
  }
  return dots;
}

const VERT = `attribute float dsize; varying vec3 vC;
void main(){ vC = color; gl_PointSize = dsize; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

function frag(alphaExpr: string): string {
  return `varying vec3 vC;
void main(){ vec2 c = gl_PointCoord - vec2(0.5); float d = length(c); ${alphaExpr} gl_FragColor = vec4(vC, a); }`;
}

export type Disposable = { dispose: () => void };

export function createLightsObject(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  THREE: any,
  getCoords: (lat: number, lng: number, alt: number) => { x: number; y: number; z: number },
  dots: LightDot[],
  P: Params = LIGHTS_PARAMS
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): { group: any } & Disposable {
  const n = dots.length;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const siz = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const d = dots[i];
    const c = getCoords(d.lat, d.lon, P.dotAlt);
    pos[i * 3] = c.x;
    pos[i * 3 + 1] = c.y;
    pos[i * 3 + 2] = c.z;
    const rc = rampColor(d.I);
    col[i * 3] = rc[0] / 255;
    col[i * 3 + 1] = rc[1] / 255;
    col[i * 3 + 2] = rc[2] / 255;
    siz[i] = P.sizeBase + d.I * P.sizeRange;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const disposables: any[] = [];
  const mk = (sizes: Float32Array, alphaExpr: string) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.setAttribute("dsize", new THREE.BufferAttribute(sizes, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      vertexShader: VERT,
      fragmentShader: frag(alphaExpr),
    });
    disposables.push(g, m);
    return new THREE.Points(g, m);
  };

  const halo = mk(
    siz.map((s) => s * P.haloScale),
    `float a = smoothstep(0.5, 0.0, d) * ${P.haloAlpha.toFixed(3)};`
  );
  const core = mk(siz, `float a = smoothstep(0.5, 0.06, d) * ${P.coreAlpha.toFixed(3)};`);
  const group = new THREE.Group();
  group.add(halo);
  group.add(core);

  return {
    group,
    dispose: () => {
      for (const d of disposables) d.dispose?.();
    },
  };
}

export function createOceanGrid(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  THREE: any,
  radius: number,
  P: Params = LIGHTS_PARAMS
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): { points: any } & Disposable {
  const N = P.oceanCount;
  const pos = new Float32Array(N * 3);
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    const th = ga * i;
    pos[i * 3] = Math.cos(th) * rad * radius * 1.001;
    pos[i * 3 + 1] = y * radius * 1.001;
    pos[i * 3 + 2] = Math.sin(th) * rad * radius * 1.001;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({
    color: P.oceanColor,
    size: P.oceanSize,
    sizeAttenuation: false,
    transparent: true,
    opacity: P.oceanOpacity,
    depthWrite: false,
  });
  const points = new THREE.Points(g, m);
  return {
    points,
    dispose: () => {
      g.dispose();
      m.dispose();
    },
  };
}

export const BACKDROP_PATTERN_URI =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='26' height='26'%3E%3Cpath d='M9 9 L17 17 M17 9 L9 17' stroke='%23f59e0b' stroke-width='1.6' stroke-linecap='round' opacity='0.5'/%3E%3C/svg%3E\")";

export const BACKDROP_PATTERN_MASK =
  "radial-gradient(90% 95% at 88% 78%, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.35) 38%, transparent 68%)";
