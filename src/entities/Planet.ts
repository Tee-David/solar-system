import * as THREE from 'three';

export interface PlanetConfig {
    name: string;
    radius: number;
    distance: number;
    speed: number;
    color: number;
    textureName?: string;
    rotationSpeed: number;
}

export class Planet extends THREE.Mesh {
    private orbitSpeed: number;
    private rotSpeed: number;
    private distance: number;
    private angle: number;
    public timeScale: number = 1.0;

    public labelElement: HTMLElement;

    constructor(config: PlanetConfig) {
        const geometry = new THREE.SphereGeometry(config.radius, 64, 64);

        let material: THREE.MeshStandardMaterial;
        if (config.textureName) {
            const textureLoader = new THREE.TextureLoader();
            const texture = textureLoader.load(`https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/${config.textureName}.jpg`);
            material = new THREE.MeshStandardMaterial({
                map: texture,
                roughness: 0.8,
                metalness: 0.1,
                emissive: new THREE.Color(config.color),
                emissiveIntensity: 0.15,
            });
        } else {
            material = new THREE.MeshStandardMaterial({
                color: config.color,
                roughness: 0.7,
                metalness: 0.2,
                emissive: new THREE.Color(config.color),
                emissiveIntensity: 0.2,
            });
        }

        super(geometry, material);

        this.name = config.name;
        this.orbitSpeed = config.speed;
        this.rotSpeed = config.rotationSpeed;
        this.distance = config.distance;
        this.angle = Math.random() * Math.PI * 2;

        this.castShadow = true;
        this.receiveShadow = true;

        this.labelElement = document.createElement('div');
        this.labelElement.className = 'planet-label';
        this.labelElement.innerHTML = `
      <div class="line"></div>
      <div class="name">${config.name}</div>
    `;
        document.getElementById('ui-layer')?.appendChild(this.labelElement);

        this.updatePosition();
    }

    public update(delta: number, camera: THREE.Camera) {
        const scaledDelta = delta * this.timeScale;
        this.angle += this.orbitSpeed * scaledDelta;
        this.rotation.y += this.rotSpeed * scaledDelta;
        this.updatePosition();
        this.updateLabel(camera);
    }

    private updatePosition() {
        this.position.x = Math.cos(this.angle) * this.distance;
        this.position.z = Math.sin(this.angle) * this.distance;
    }

    private updateLabel(camera: THREE.Camera) {
        const vector = new THREE.Vector3();
        this.getWorldPosition(vector);
        vector.project(camera);

        const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-(vector.y * 0.5) + 0.5) * window.innerHeight;

        if (vector.z > 1) {
            this.labelElement.style.display = 'none';
        } else {
            this.labelElement.style.display = 'block';
            this.labelElement.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
        }
    }
}
