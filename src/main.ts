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
        const video = document.querySelector('#input-video') as HTMLVideoElement;
        this.handTrackingIndicator = document.getElementById('hand-tracking-status');

        this.tooltip = document.createElement('div');
        this.tooltip.id = 'planet-tooltip';
        this.tooltip.className = 'glass hidden';
        document.body.appendChild(this.tooltip);

        this.sceneManager = new SceneManager(canvas);
        this.solarSystem = new SolarSystem();
        this.gestureInterpreter = new GestureInterpreter();
        this.raycaster = new THREE.Raycaster();

        new HandTracker(video, (results) => {
            this.handleResults(results);
        });

        this.init();
    }

    private init() {
        this.sceneManager.add(this.solarSystem);
        this.addStarfield();

        this.sceneManager.camera.position.set(0, 300, 1000);
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
        const { type, delta } = data;
        const camera = this.sceneManager.camera;

        this.updateSelection(results);

        if (type === 'pinch') {
            const zoomAmount = delta.z * 20;
            gsap.to(camera.position, {
                z: THREE.MathUtils.clamp(camera.position.z + zoomAmount, 100, 3000),
                duration: 0.1
            });
        } else if (type === 'pan' && !this.selectedPlanet) {
            gsap.to(camera.position, {
                x: camera.position.x - delta.x * 6,
                y: camera.position.y + delta.y * 6,
                duration: 0.1
            });
        } else if (type === 'rotate' && !this.selectedPlanet) {
            const orbitSpeed = 0.05;
            const angle = -delta.x * orbitSpeed;

            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const x = camera.position.x;
            const z = camera.position.z;

            gsap.to(camera.position, {
                x: x * cos - z * sin,
                z: x * sin + z * cos,
                duration: 0.1,
                onUpdate: () => camera.lookAt(0, 0, 0)
            });
        }

        if (type) this.updateGestureIndicator(type);
    }

    private updateSelection(results: any) {
        if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) return;

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
              <div class="label">Spectral Type</div>
              <div class="value">Planet Class-M</div>
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

        gsap.to(this.sceneManager.camera.position, {
            x: 0,
            y: 300,
            z: 1000,
            duration: 1.5,
            ease: 'expo.inOut',
            onUpdate: () => this.sceneManager.camera.lookAt(0, 0, 0)
        });
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
            positions[i] = (Math.random() - 0.5) * 8000;
            positions[i + 1] = (Math.random() - 0.5) * 8000;
            positions[i + 2] = (Math.random() - 0.5) * 8000;

            const b = 0.6 + Math.random() * 0.4;
            colors[i] = b;
            colors[i + 1] = b;
            colors[i + 2] = b * 1.3;
        }

        starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        // Star texture using canvas to avoid "box" particles
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d')!;
        const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        gradient.addColorStop(0, 'white');
        gradient.addColorStop(0.3, 'rgba(255,255,255,0.8)');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 32, 32);
        const starTexture = new THREE.CanvasTexture(canvas);

        const starMaterial = new THREE.PointsMaterial({
            size: 5,
            map: starTexture,
            transparent: true,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.sceneManager.add(new THREE.Points(starGeometry, starMaterial));
    }

    private animate() {
        requestAnimationFrame(() => this.animate());
        this.sceneManager.update((delta) => {
            this.solarSystem.update(delta);
            this.solarSystem.planets.forEach(p => p.update(delta, this.sceneManager.camera));

            if (this.selectedPlanet) {
                const targetPos = new THREE.Vector3();
                this.selectedPlanet.getWorldPosition(targetPos);
                const offset = new THREE.Vector3(0, 20, 50);
                this.sceneManager.camera.position.lerp(targetPos.clone().add(offset), 0.1);
                this.sceneManager.camera.lookAt(targetPos);
            }
        });
    }
}

new App();
