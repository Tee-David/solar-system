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
        console.log("App initializing...");
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

        this.sceneManager.camera.position.set(0, 500, 1500); // Start further out for scale awareness
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

        // Adaptive Sensitivity based on camera distance
        const distFactor = camera.position.length() * 0.005;

        this.updateSelection(results);

        if (type === 'pinch') {
            // Scale zoom by distance for "Logarithmic" feel
            const zoomAmount = delta.z * distFactor * 250;

            gsap.to(camera.position, {
                z: camera.position.z + zoomAmount,
                x: camera.position.x * (1 + delta.z * 0.1), // Slight perspectival zoom shift
                y: camera.position.y * (1 + delta.z * 0.1),
                duration: 0.15,
                onUpdate: () => {
                    // Space-warp effect (FOV change)
                    const fovMod = Math.abs(delta.z) * 15;
                    camera.fov = 65 + fovMod;
                    camera.updateProjectionMatrix();
                }
            });

            // Focus Override: If zooming out aggressively, release planet
            if (delta.z > 0.05 && this.selectedPlanet) {
                this.exitFocus();
            }

        } else if (type === 'pan') {
            // Pan scaled by distance to feel 1:1 with screen space
            const panX = -delta.x * distFactor * 1000;
            const panY = delta.y * distFactor * 1000;

            gsap.to(camera.position, {
                x: camera.position.x + panX,
                y: camera.position.y + panY,
                duration: 0.2
            });

            // Break focus if panned away significantly
            if (velocity > 0.1 && this.selectedPlanet) {
                this.exitFocus();
            }

        } else if (type === 'rotate' && !this.selectedPlanet) {
            const orbitSpeed = 0.08;
            const angle = -delta.x * orbitSpeed;

            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const x = camera.position.x;
            const z = camera.position.z;

            gsap.to(camera.position, {
                x: x * cos - z * sin,
                z: x * sin + z * cos,
                duration: 0.15,
                onUpdate: () => camera.lookAt(0, 0, 0)
            });
        } else {
            // Return FOV to normal when not zooming
            gsap.to(camera, { fov: 65, duration: 0.5, onUpdate: () => camera.updateProjectionMatrix() });
        }

        if (type) this.updateGestureIndicator(type);
    }

    private updateSelection(results: any) {
        if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) return;

        // Use index tip for targeting
        const indexTip = results.multiHandLandmarks[0][8];
        const pointer = new THREE.Vector2(
            (1 - indexTip.x) * 2 - 1,
            -(indexTip.y * 2 - 1)
        );

        this.raycaster.setFromCamera(pointer, this.sceneManager.camera);
        const intersects = this.raycaster.intersectObjects(this.solarSystem.planets);

        const tx = (1 - indexTip.x) * window.innerWidth;
        const ty = indexTip.y * window.innerHeight;
        this.tooltip.style.transform = `translate(${tx}px, ${ty}px)`;

        if (intersects.length > 0) {
            const planet = intersects[0].object as Planet;
            this.tooltip.classList.remove('hidden');
            this.tooltip.innerHTML = `<strong>${planet.name}</strong><br>Dwell to focus...`;

            if (this.hoveredPlanet !== planet) {
                this.hoveredPlanet = planet;
                this.hoverStartTime = Date.now();
            } else {
                if (Date.now() - this.hoverStartTime > 1200 && this.selectedPlanet !== planet) {
                    this.focusOnPlanet(planet);
                }
            }
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
            <div class="stat-box">
              <div class="label">Status</div>
              <div class="value">ORBITAL LOCK ACTIVE</div>
            </div>
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
        if (indicator) {
            indicator.textContent = `OPS MODE: ${type.toUpperCase()}`;
        }
    }

    private addStarfield() {
        const starGeometry = new THREE.BufferGeometry();
        const starCount = 15000;
        const positions = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);

        for (let i = 0; i < starCount * 3; i += 3) {
            positions[i] = (Math.random() - 0.5) * 12000;
            positions[i + 1] = (Math.random() - 0.5) * 12000;
            positions[i + 2] = (Math.random() - 0.5) * 12000;

            const b = 0.6 + Math.random() * 0.4;
            colors[i] = b;
            colors[i + 1] = b;
            colors[i + 2] = b * 1.3;
        }

        starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const canvas = document.createElement('canvas');
        canvas.width = 32; canvas.height = 32;
        const ctx = canvas.getContext('2d')!;
        const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        grad.addColorStop(0, 'white'); grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, 32, 32);
        const starTex = new THREE.CanvasTexture(canvas);

        const starMat = new THREE.PointsMaterial({
            size: 5, map: starTex, transparent: true, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false
        });

        this.sceneManager.add(new THREE.Points(starGeometry, starMat));
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
