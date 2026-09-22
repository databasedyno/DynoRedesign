import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/**
 * WebGL escrow flow (plain three.js): buyer (left) → SafeDeal vault (centre) → seller (right).
 * Gold USDT coins travel a curve into the vault, orbit while "held", then flow on to the seller.
 * Pure lights, no network assets. Pauses when off-screen or the tab is hidden.
 */

const GOLD = 0xffc61a;
const GOLD_DEEP = 0xb77e00;
const INK = 0x141417;

const BUYER = new THREE.Vector3(-3.6, -0.2, 0);
const VAULT = new THREE.Vector3(0, 0, 0);
const SELLER = new THREE.Vector3(3.6, -0.2, 0);
const IN_CURVE = new THREE.QuadraticBezierCurve3(BUYER, new THREE.Vector3(-1.8, 1.6, 0.4), VAULT);
const OUT_CURVE = new THREE.QuadraticBezierCurve3(VAULT, new THREE.Vector3(1.8, 1.6, -0.4), SELLER);
const COINS = 7;
const CYCLE = 9;

const gold = (emissiveIntensity: number, roughness = 0.25) => new THREE.MeshStandardMaterial({ color: GOLD, emissive: GOLD_DEEP, emissiveIntensity, metalness: 0.88, roughness });

function coinPosition(t: number, index: number, out: THREE.Vector3): number {
  if (t < 0.36) { IN_CURVE.getPoint(t / 0.36, out); return 1; }
  if (t < 0.64) {
    const a = ((t - 0.36) / 0.28) * Math.PI * 2 + index;
    out.set(Math.cos(a) * 0.55, Math.sin(a * 2) * 0.18 + 0.05, Math.sin(a) * 0.55);
    return 0.75;
  }
  OUT_CURVE.getPoint((t - 0.64) / 0.36, out);
  return 1;
}

function buildScene() {
  const scene = new THREE.Scene();
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(x: T): T => { disposables.push(x); return x; };

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(5, 6, 4); scene.add(key);
  const fill = new THREE.DirectionalLight(0x8fb3ff, 0.5); fill.position.set(-6, 2, -3); scene.add(fill);
  const glow = new THREE.PointLight(GOLD, 2.2, 4); glow.position.copy(VAULT); scene.add(glow);

  // Dust
  const pos = new Float32Array(180 * 3);
  for (let i = 0; i < 180; i++) { pos[i * 3] = (Math.random() - 0.5) * 12; pos[i * 3 + 1] = (Math.random() - 0.5) * 6; pos[i * 3 + 2] = (Math.random() - 0.5) * 6 - 1; }
  const dustGeo = track(new THREE.BufferGeometry()); dustGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(dustGeo, track(new THREE.PointsMaterial({ size: 0.035, color: GOLD, transparent: true, opacity: 0.55, sizeAttenuation: true })));
  scene.add(dust);

  // Paths
  const pathMat = track(new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.35 }));
  [IN_CURVE, OUT_CURVE].forEach((c) => scene.add(new THREE.Mesh(track(new THREE.TubeGeometry(c, 64, 0.012, 8, false)), pathMat)));

  // Buyer / seller nodes
  const sphereGeo = track(new THREE.SphereGeometry(0.55, 48, 48));
  const ringGeo = track(new THREE.TorusGeometry(0.82, 0.03, 16, 96));
  const inkMat = track(new THREE.MeshStandardMaterial({ color: INK, metalness: 0.6, roughness: 0.35 }));
  const ringMat = track(new THREE.MeshStandardMaterial({ color: GOLD, emissive: GOLD, emissiveIntensity: 0.6, metalness: 0.8, roughness: 0.3 }));
  const makeNode = (p: THREE.Vector3) => {
    const g = new THREE.Group(); g.position.copy(p);
    g.add(new THREE.Mesh(sphereGeo, inkMat));
    const ring = new THREE.Mesh(ringGeo, ringMat); ring.rotation.x = Math.PI / 2; g.add(ring);
    scene.add(g);
    return { group: g, ring, base: p.clone() };
  };
  const buyer = makeNode(BUYER);
  const seller = makeNode(SELLER);

  // Vault
  const vault = new THREE.Group(); vault.position.copy(VAULT); scene.add(vault);
  const box = new THREE.Mesh(track(new RoundedBoxGeometry(1.7, 1.7, 1.7, 6, 0.22)), track(new THREE.MeshPhysicalMaterial({ color: INK, metalness: 0.7, roughness: 0.2, transparent: true, opacity: 0.85, clearcoat: 0.6, clearcoatRoughness: 0.2 })));
  vault.add(box);
  const halo = new THREE.Mesh(track(new THREE.TorusGeometry(1.25, 0.035, 16, 120)), track(new THREE.MeshStandardMaterial({ color: GOLD, emissive: GOLD, emissiveIntensity: 0.9, metalness: 0.9, roughness: 0.2 })));
  halo.rotation.x = Math.PI / 2; vault.add(halo);
  const shackle = new THREE.Mesh(track(new THREE.TorusGeometry(0.32, 0.07, 16, 48, Math.PI)), track(gold(0.3)));
  shackle.position.y = 1.05; vault.add(shackle);

  // Coins
  const coinGeo = track(new THREE.CylinderGeometry(0.22, 0.22, 0.07, 40));
  const coinMat = track(gold(0.25));
  const coins = Array.from({ length: COINS }, () => { const m = new THREE.Mesh(coinGeo, coinMat); scene.add(m); return m; });

  const tmp = new THREE.Vector3();
  const update = (t: number) => {
    dust.rotation.y = t * 0.02;
    buyer.ring.rotation.z = t * 0.4; seller.ring.rotation.z = -t * 0.4;
    buyer.group.position.y = buyer.base.y + Math.sin(t * 1.6) * 0.08;
    seller.group.position.y = seller.base.y + Math.sin(t * 1.6 + 1.3) * 0.08;
    vault.position.y = Math.sin(t * 1.2) * 0.05;
    box.rotation.y = t * 0.25; box.rotation.x = Math.sin(t * 0.3) * 0.15;
    halo.rotation.z = -t * 0.6;
    coins.forEach((m, i) => {
      const phase = ((t / CYCLE) + i / COINS) % 1;
      const s = coinPosition(phase, i, tmp);
      m.position.copy(tmp); m.scale.setScalar(s);
      m.rotation.x += 0.02; m.rotation.y += 0.035;
    });
  };

  return { scene, update, dispose: () => disposables.forEach((d) => d.dispose()) };
}

export default function EscrowScene3D() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    renderer.domElement.setAttribute("data-testid", "sd-escrow-canvas");
    el.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 1.2, 8.2);
    const { scene, update, dispose } = buildScene();
    const clock = new THREE.Clock();
    const pointer = { x: 0, y: 0 };
    let baseZ = 8.2;

    const resize = () => {
      const w = el.clientWidth || 1, h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      // Pull the camera back on narrow aspects so both end nodes (±4.5 world units) stay in frame.
      baseZ = Math.max(8.2, 4.6 / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(el);

    const frame = () => {
      const t = clock.getElapsedTime();
      update(t);
      camera.position.x += (pointer.x * 0.9 - camera.position.x) * 0.05;
      camera.position.y += (1.2 + pointer.y * 0.5 - camera.position.y) * 0.05;
      camera.position.z += (baseZ - camera.position.z) * 0.1;
      camera.lookAt(0, 0.1, 0);
      renderer.render(scene, camera);
    };
    let visible = true;
    const run = () => renderer.setAnimationLoop(visible && !document.hidden ? frame : null);
    run();
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; run(); }, { threshold: 0.05 });
    io.observe(el);
    document.addEventListener("visibilitychange", run);

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      pointer.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
      pointer.y = -((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    const onLeave = () => { pointer.x = 0; pointer.y = 0; };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);

    return () => {
      renderer.setAnimationLoop(null);
      io.disconnect(); ro.disconnect();
      document.removeEventListener("visibilitychange", run);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={host} style={{ position: "absolute", inset: 0 }} aria-hidden />;
}
