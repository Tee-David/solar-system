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
    private hoveredPlanet: Planet | null = null;
    private selectedPlanet: Planet | null = null;
    private hoverStartTime: number = 0;
    private handTrackingIndicator: HTMLElement | null;
    private tooltip: HTMLElement;

    constructor() {
        const canvas = document.querySelector('#three-canvas') as HTMLCanvasElement;
        const debugCanvas = document.querySelector('#debug-canvas') as HTMLCanvasElement;
        const video = document.querySelector('#input-video') as HTMLVideoElement;
        this.handTrackingIndicator = document.getElementById('hand-tracking-status');

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

        this.sceneManager.camera.position.set(0, 500, 1500);
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
            this.handTrackingIndicator?.classList.add('active');
            this.handleGestures(results);
        } else {
            this.handTrackingIndicator?.classList.remove('active');
            this.tooltip.classList.add('hidden');
        }
    }

    private handleGestures(results: any) {
        const data = this.gestureInterpreter.process(results);
        const { type, delta, velocity } = data;
        const camera = this.sceneManager.camera;
        const distFactor = camera.position.length() * 0.005;

        this.updateSelection(results);

        if (type === 'pinch') {
            const zoomAmount = delta.z * distFactor * 250;
            gsap.to(camera.position, {
                z: camera.position.z + zoomAmount,
                x: camera.position.x * (1 + delta.z * 0.1),
                y: camera.position.y * (1 + delta.z * 0.1),
                duration: 0.15,
                onUpdate: () => {
                    const fovMod = Math.abs(delta.z) * 15;
                    camera.fov = 65 + fovMod;
                    camera.updateProjectionMatrix();
                }
            });
            if (delta.z > 0.05 && this.selectedPlanet) this.exitFocus();

        } else if (type === 'pan') {
            const panX = -delta.x * distFactor * 1000;
            const panY = delta.y * distFactor * 1000;
            gsap.to(camera.position, { x: camera.position.x + panX, y: camera.position.y + panY, duration: 0.2 });
            if (velocity > 0.1 && this.selectedPlanet) this.exitFocus();

        } else if (type === 'rotate' && !this.selectedPlanet) {
            const orbitSpeed = 0.08;
            const angle = -delta.x * orbitSpeed;
            const cos = Math.cos(angle); const sin = Math.sin(angle);
            const x = camera.position.x; const z = camera.position.z;
            gsap.to(camera.position, { x: x * cos - z * sin, z: x * sin + z * cos, duration: 0.15, onUpdate: () => camera.lookAt(0, 0, 0) });
        } else {
            gsap.to(camera, { fov: 65, duration: 0.5, onUpdate: () => camera.updateProjectionMatrix() });
        }
        if (type) this.updateGestureIndicator(type);
    }

    private updateSelection(results: any) {
        if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) return;
        const indexTip = results.multiHandLandmarks[0][8];
        const pointer = new THREE.Vector2((1 - indexTip.x) * 2 - 1, -(indexTip.y * 2 - 1));
        this.raycaster.setFromCamera(pointer, this.sceneManager.camera);
        const intersects = this.raycaster.intersectObjects(this.solarSystem.planets);

        const tx = (1 - indexTip.x) * window.innerWidth;
        const ty = indexTip.y * window.innerHeight;
        this.tooltip.style.transform = `translate(${tx}px, ${ty}px)`;

        if (intersects.length > 0) {
            const planet = intersects[0].object as Planet;
            this.tooltip.classList.remove('hidden');
            this.tooltip.innerHTML = `<strong>${planet.name}</strong><br>Dwell to focus...`;
            if (this.hoveredPlanet !== planet) { this.hoveredPlanet = planet; this.hoverStartTime = Date.now(); }
            else if (Date.now() - this.hoverStartTime > 1200 && this.selectedPlanet !== planet) this.focusOnPlanet(planet);
        } else {
            this.tooltip.classList.add('hidden');
            this.hoveredPlanet = null;
        }
    }

    private focusOnPlanet(planet: Planet) {
        this.selectedPlanet = planet;
        this.solarSystem.setTimeScale(0.02);
        this.tooltip.classList.add('hidden');
        this.showInfoPanel(planet);
    }

    private showInfoPanel(planet: Planet) {
        const panel = document.getElementById('info-panel');
        if (panel) {
            panel.classList.remove('hidden');
            panel.innerHTML = `
        <div class="panel-content">
          <span class="planet-tag">Tactical Overlay</span>
          <h1>${planet.name.toUpperCase()}</h1>
          <div class="divider"></div>
          <div class="stats-grid">
            <div class="stat-box"><div class="label">Status</div><div class="value">ORBITAL LOCK ACTIVE</div></div>
          </div>
          <button id="exit-focus">DISENGAGE</button>
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
        if (indicator) indicator.textContent = `OPS MODE: ${type.toUpperCase()}`;
    }

    private addStarfield() {
        // Advanced Star System: Multi-layered sharp particles
        const layers = [
            { count: 12000, size: 2, brightness: 1.0, color: 0xffffff }, // Sharp distant stars
            { count: 4000, size: 5, brightness: 0.8, color: 0xccddff },  // Closer blue-tinted stars
            { count: 1000, size: 10, brightness: 0.5, color: 0xffccaa }, // Rare bright spots (distant suns)
        ];

        layers.forEach(layer => {
            const geom = new THREE.BufferGeometry();
            const pos = new Float32Array(layer.count * 3);
            const cols = new Float32Array(layer.count * 3);

            for (let i = 0; i < layer.count * 3; i += 3) {
                const r = 2000 + Math.random() * 8000;
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

            // Sharp sparkle texture
            const canvas = document.createElement('canvas');
            canvas.width = 64; canvas.height = 64;
            const ctx = canvas.getContext('2d')!;
            ctx.fillStyle = 'black'; ctx.fillRect(0, 0, 64, 64); // Star texture must have black/transparent

            const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
            grad.addColorStop(0, 'white');
            grad.addColorStop(0.1, 'white');
            grad.addColorStop(0.2, 'rgba(255,255,255,0.4)');
            grad.addColorStop(1, 'transparent');

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(32, 32, 30, 0, Math.PI * 2);
            ctx.fill();

            // Add cross-flare for largest stars
            if (layer.size > 5) {
                ctx.strokeStyle = 'rgba(255,255,255,0.2)';
                ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(32, 0); ctx.lineTo(32, 64); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0, 32); ctx.lineTo(64, 32); ctx.stroke();
            }

            const tex = new THREE.CanvasTexture(canvas);
            const mat = new THREE.PointsMaterial({
                size: layer.size, map: tex, transparent: true, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false
            });
            this.sceneManager.add(new THREE.Points(geom, mat));
        });
    }

    private addNebula() {
        // Subtle distant volumetric nebula using a large noise-textured sphere
        const geom = new THREE.SphereGeometry(7000, 32, 32);

        // Create noise texture
        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 512;
        const ctx = canvas.getContext('2d')!;
        for (let i = 0; i < 2000; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const r = 20 + Math.random() * 60;
            const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
            const opacity = 0.01 + Math.random() * 0.02;
            grad.addColorStop(0, `rgba(0, 150, 255, ${opacity})`);
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 512, 512);
        }
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;

        const mat = new THREE.MeshBasicMaterial({
            map: tex,
            side: THREE.BackSide,
            transparent: true,
            opacity: 0.4,
            blending: THREE.AdditiveBlending
        });
        const nebula = new THREE.Mesh(geom, mat);
        this.sceneManager.add(nebula);

        // Slowly rotate nebula
        gsap.to(nebula.rotation, { y: Math.PI * 2, duration: 1000, repeat: -1, ease: 'none' });
    }

    private animate() {
        requestAnimationFrame(() => this.animate());
        this.sceneManager.update((delta) => {
            this.solarSystem.update(delta);
            this.solarSystem.planets.forEach(p => p.update(delta, this.sceneManager.camera));

            if (this.selectedPlanet) {
                const targetPos = new THREE.Vector3();
                this.selectedPlanet.getWorldPosition(targetPos);
                const offset = new THREE.Vector3(0, 25, 60);
                this.sceneManager.camera.position.lerp(targetPos.clone().add(offset), 0.1);
                this.sceneManager.camera.lookAt(targetPos);
            }
        });
    }
}

new App();
