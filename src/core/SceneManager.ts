import * as THREE from 'three';
import Stats from 'stats.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export class SceneManager {
    public scene: THREE.Scene;
    public camera: THREE.PerspectiveCamera;
    public renderer: THREE.WebGLRenderer;
    private composer: EffectComposer;
    public outlinePass!: OutlinePass;
    private stats: Stats;
    private clock: THREE.Clock;

    constructor(canvas: HTMLCanvasElement) {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 1, 20000);
        this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            powerPreference: 'high-performance',
            alpha: true,
        });
        this.clock = new THREE.Clock();
        this.stats = new Stats();

        this.init();
        this.composer = new EffectComposer(this.renderer);
        this.setupPostProcessing();
    }

    private init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        window.addEventListener('resize', () => this.onResize());
    }

    private setupPostProcessing() {
        const renderScene = new RenderPass(this.scene, this.camera);

        // 1. Bloom: Technical sharp glow
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.6, 0.4, 0.85
        );

        // 2. Outline: High-fidelity targeting
        this.outlinePass = new OutlinePass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            this.scene,
            this.camera
        );
        this.outlinePass.edgeStrength = 3.0;
        this.outlinePass.edgeGlow = 1.0;
        this.outlinePass.edgeThickness = 1.0;
        this.outlinePass.visibleEdgeColor.set('#00e5ff');
        this.outlinePass.hiddenEdgeColor.set('#004466');

        const outputPass = new OutputPass();

        this.composer.addPass(renderScene);
        this.composer.addPass(bloomPass);
        this.composer.addPass(this.outlinePass);
        this.composer.addPass(outputPass);
    }

    private onResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
        this.composer.setSize(width, height);
    }

    public update(callback?: (delta: number) => void) {
        const delta = this.clock.getDelta();
        this.stats.begin();
        if (callback) callback(delta);
        this.composer.render();
        this.stats.end();
    }

    public add(object: THREE.Object3D) {
        this.scene.add(object);
    }
}
