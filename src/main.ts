import { SceneManager } from './core/SceneManager';
import { SolarSystem } from './entities/SolarSystem';
import { Planet } from './entities/Planet';
import { HandTracker } from './gestures/HandTracker';
import { GestureInterpreter } from './gestures/GestureInterpreter';
import * as THREE from 'three';
import gsap from 'gsap';

class App {
    private sceneManager: SceneManager;
    private solarSystem: SolarSystem;
    private gestureInterpreter: GestureInterpreter;
    private raycaster: THREE.Raycaster;
    private selectedPlanet: Planet | null = null;
    private indicator: HTMLElement | null;
    private tooltip: HTMLElement;

    constructor() {
        const canvas = document.querySelector('#three-canvas') as HTMLCanvasElement;
        const debugCanvas = document.querySelector('#debug-canvas') as HTMLCanvasElement;
        const video = document.querySelector('#input-video') as HTMLVideoElement;
        this.indicator = document.getElementById('hand-tracking-status');

        if (debugCanvas) {
            debugCanvas.width = 160;
            debugCanvas.height = 120;
        }

        this.tooltip = document.createElement('div');
        this.tooltip.id = 'planet-tooltip';
        this.tooltip.className = 'glass hidden';
        document.body.appendChild(this.tooltip);

        this.sceneManager = new SceneManager(canvas);
        this.solarSystem = new SolarSystem();
        this.gestureInterpreter = new GestureInterpreter();
        this.raycaster = new THREE.Raycaster();

        new HandTracker(video, debugCanvas, (results) => {
            this.handleResults(results);
        });

        this.init();
    }

    private init() {
        this.sceneManager.add(this.solarSystem);
        this.addStarfield();
        this.addNebula();

        this.sceneManager.camera.position.set(0, 800, 2000);
        this.sceneManager.camera.lookAt(0, 0, 0);

        this.animate();

        setTimeout(() => {
            const loader = document.getElementById('loading-screen');
            if (loader) {
                loader.style.opacity = '0';
                setTimeout(() => loader.classList.add('hidden'), 1000);
            }
        }, 1500);
    }

    private handleResults(results: any) {
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            this.indicator?.classList.add('active');
            this.handleGestures(results);
        } else {
            this.indicator?.classList.remove('active');
            this.tooltip.classList.add('hidden');
            this.sceneManager.outlinePass.selectedObjects = [];
        }
    }

    private handleGestures(results: any) {
        const data = this.gestureInterpreter.process(results);
        const { type, delta, velocity } = data;
        const camera = this.sceneManager.camera;
        const distFactor = camera.position.length() * 0.005;

        // 1. Pointing (Selection & Highlighting)
        if (type === 'point') {
            this.updateSelection(results, true);
        } else {
            this.updateSelection(results, false);
        }

        // 2. Pinch (Zoom)
        if (type === 'pinch') {
            const zoomAmount = delta.z * distFactor * 350;
            gsap.to(camera.position, {
                z: camera.position.z + zoomAmount,
                duration: 0.15,
                onUpdate: () => {
                    const fovMod = Math.abs(delta.z) * 20;
                    camera.fov = THREE.MathUtils.lerp(camera.fov, 65 + fovMod, 0.2);
                    camera.updateProjectionMatrix();
                }
            });
            if (delta.z > 0.05 && this.selectedPlanet) this.exitFocus();

            // 3. Closed Fist (Pan)
        } else if (type === 'pan') {
            const panX = -delta.x * distFactor * 1200;
            const panY = delta.y * distFactor * 1200;
            gsap.to(camera.position, {
                x: camera.position.x + panX,
                y: camera.position.y + panY,
                duration: 0.25,
                ease: "power2.out"
            });
            if (velocity > 0.1 && this.selectedPlanet) this.exitFocus();

            // 4. Open Palm (Rotate)
        } else if (type === 'rotate' && !this.selectedPlanet) {
            const orbitSpeed = 0.1;
            const angle = -delta.x * orbitSpeed;
            const cos = Math.cos(angle); const sin = Math.sin(angle);
            const x = camera.position.x; const z = camera.position.z;
            gsap.to(camera.position, {
                x: x * cos - z * sin,
                z: x * sin + z * cos,
                duration: 0.2,
                onUpdate: () => camera.lookAt(0, 0, 0)
            });
        } else {
            gsap.to(camera, { fov: 65, duration: 0.5, onUpdate: () => camera.updateProjectionMatrix() });
        }

        if (type) this.updateGestureIndicator(type);
    }

    private updateSelection(results: any, isPointing: boolean) {
        if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) return;
        const indexTip = results.multiHandLandmarks[0][8];
        const pointer = new THREE.Vector2((1 - indexTip.x) * 2 - 1, -(indexTip.y * 2 - 1));
        this.raycaster.setFromCamera(pointer, this.sceneManager.camera);

        const planetMeshes = this.solarSystem.planets.map(p => p.mesh);
        const intersects = this.raycaster.intersectObjects(planetMeshes);

        const tx = (1 - indexTip.x) * window.innerWidth;
        const ty = indexTip.y * window.innerHeight;
        this.tooltip.style.transform = `translate(${tx}px, ${ty}px)`;

        if (intersects.length > 0) {
            const mesh = intersects[0].object as THREE.Mesh;
            const planet = mesh.parent as Planet;

            this.sceneManager.outlinePass.selectedObjects = [mesh];
            this.tooltip.classList.remove('hidden');
            this.tooltip.innerHTML = `<strong>${planet.name}</strong><br>${isPointing ? 'TARGET ACQUIRED' : 'Point to Lock'}`;

            if (isPointing && this.selectedPlanet !== planet) {
                this.focusOnPlanet(planet);
            }
            this.hoveredPlanet = planet;
        } else {
            this.sceneManager.outlinePass.selectedObjects = [];
            this.tooltip.classList.add('hidden');
            this.hoveredPlanet = null;
        }
    }

    private focusOnPlanet(planet: Planet) {
        this.selectedPlanet = planet;
        this.solarSystem.setTimeScale(0.01);
        this.tooltip.classList.add('hidden');
        this.showInfoPanel(planet);

        const targetPos = new THREE.Vector3();
        planet.getWorldPosition(targetPos);
        gsap.to(this.sceneManager.camera.position, {
            x: targetPos.x,
            y: targetPos.y + 30,
            z: targetPos.z + 100,
            duration: 1.5,
            ease: "power3.inOut"
        });
    }

    private showInfoPanel(planet: Planet) {
        const panel = document.getElementById('info-panel');
        if (panel) {
            panel.classList.remove('hidden');
            panel.innerHTML = `
        <div class="panel-content">
          <span class="planet-tag">Tactical Observation</span>
          <h1>${planet.name.toUpperCase()}</h1>
          <div class="divider"></div>
          <div class="stats-grid">
            <div class="stat-box"><div class="label">Orbit Sync</div><div class="value">STABLE</div></div>
            <div class="stat-box"><div class="label">Telemetry</div><div class="value">LOCK ON</div></div>
          </div>
          <button id="exit-focus">RELEASE ANCHOR</button>
        </div>
      `;
            document.getElementById('exit-focus')?.addEventListener('click', () => this.exitFocus());
        }
    }

    private exitFocus() {
        this.selectedPlanet = null;
        this.solarSystem.setTimeScale(2.5);
        document.getElementById('info-panel')?.classList.add('hidden');
    }

    private updateGestureIndicator(type: string) {
        const indicator = document.getElementById('gesture-indicator');
        if (indicator) {
            const labels: any = { pinch: 'ZOOM', pan: 'THRUST', rotate: 'OBSERVE', point: 'TARGET' };
            indicator.textContent = `SYSTEM OPS: ${labels[type] || type.toUpperCase()}`;
        }
    }

    private addStarfield() {
        const layers = [
            { count: 18000, size: 2, brightness: 1.2, color: 0xffffff },
            { count: 6000, size: 5, brightness: 1.0, color: 0xccddff },
            { count: 1500, size: 15, brightness: 0.8, color: 0xffccaa },
        ];

        layers.forEach(layer => {
            const geom = new THREE.BufferGeometry();
            const pos = new Float32Array(layer.count * 3);
            const cols = new Float32Array(layer.count * 3);
            for (let i = 0; i < layer.count * 3; i += 3) {
                const r = 4000 + Math.random() * 10000;
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                pos[i] = r * Math.sin(phi) * Math.cos(theta);
                pos[i + 1] = r * Math.sin(phi) * Math.sin(theta);
                pos[i + 2] = r * Math.cos(phi);
                const b = (0.7 + Math.random() * 0.3) * layer.brightness;
                const c = new THREE.Color(layer.color);
                cols[i] = c.r * b; cols[i + 1] = c.g * b; cols[i + 2] = c.b * b;
            }
            geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            geom.setAttribute('color', new THREE.BufferAttribute(cols, 3));

            const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
            const ctx = canvas.getContext('2d')!;
            const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
            grad.addColorStop(0, 'white'); grad.addColorStop(0.2, 'white');
            grad.addColorStop(0.5, 'rgba(255,255,255,0.4)'); grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(32, 32, 30, 0, Math.PI * 2); ctx.fill();

            if (layer.size > 8) {
                ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.moveTo(32, 0); ctx.lineTo(32, 64); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0, 32); ctx.lineTo(64, 32); ctx.stroke();
            }
            const tex = new THREE.CanvasTexture(canvas);
            const mat = new THREE.PointsMaterial({ size: layer.size, map: tex, transparent: true, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false });
            this.sceneManager.add(new THREE.Points(geom, mat));
        });
    }

    private addNebula() {
        const geom = new THREE.SphereGeometry(15000, 32, 32);
        const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 1024;
        const ctx = canvas.getContext('2d')!;
        for (let i = 0; i < 4000; i++) {
            const x = Math.random() * 1024; const y = Math.random() * 1024;
            const r = 40 + Math.random() * 120;
            const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
            const opacity = 0.01 + Math.random() * 0.02;
            grad.addColorStop(0, `rgba(0, 120, 255, ${opacity})`); grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad; ctx.fillRect(0, 0, 1024, 1024);
        }
        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
        const nebula = new THREE.Mesh(geom, mat);
        this.sceneManager.add(nebula);
        gsap.to(nebula.rotation, { y: Math.PI * 2, duration: 2000, repeat: -1, ease: 'none' });
    }

    private animate() {
        requestAnimationFrame(() => this.animate());
        this.sceneManager.update((delta) => {
            this.solarSystem.update(delta);
            this.solarSystem.planets.forEach(p => p.update(delta, this.sceneManager.camera));

            if (this.selectedPlanet) {
                const targetPos = new THREE.Vector3();
                this.selectedPlanet.getWorldPosition(targetPos);
                const offset = new THREE.Vector3(0, 40, 100);
                this.sceneManager.camera.position.lerp(targetPos.clone().add(offset), 0.05);
                this.sceneManager.camera.lookAt(targetPos);
            }
        });
    }
}

new App();
