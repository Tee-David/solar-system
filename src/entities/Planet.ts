import * as THREE from 'three';

export interface PlanetConfig {
    name: string;
    radius: number;
    distance: number;
    speed: number;
    color: number;
    textureName?: string;
    rotationSpeed: number;
    hasRings?: boolean;
}

export class Planet extends THREE.Group {
    public mesh: THREE.Mesh;
    private orbitSpeed: number;
    private rotSpeed: number;
    private distance: number;
    private angle: number;
    public timeScale: number = 1.0;

    public labelElement: HTMLElement;
    private atmosphere: THREE.Mesh;
    private rings?: THREE.Mesh;
    private clouds?: THREE.Mesh;

    constructor(config: PlanetConfig) {
        super();

        const geometry = new THREE.SphereGeometry(config.radius, 64, 64);
        const textureLoader = new THREE.TextureLoader();

        let material: THREE.MeshStandardMaterial;

        if (config.name === 'Earth') {
            const dayTexture = textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_day_4096.jpg');
            const specTexture = textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_specular_2048.jpg');
            const bumpTexture = textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_bump_2048.jpg');

            material = new THREE.MeshStandardMaterial({
                map: dayTexture,
                roughnessMap: specTexture,
                bumpMap: bumpTexture,
                bumpScale: 0.1,
                roughness: 0.8,
                metalness: 0.2,
            });

            // Cloud Layer
            const cloudGeom = new THREE.SphereGeometry(config.radius * 1.01, 64, 64);
            const cloudTex = textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_clouds_1024.png');
            const cloudMat = new THREE.MeshStandardMaterial({
                map: cloudTex,
                transparent: true,
                opacity: 0.4,
                depthWrite: false,
            });
            this.clouds = new THREE.Mesh(cloudGeom, cloudMat);
            this.add(this.clouds);

        } else if (config.textureName) {
            const texture = textureLoader.load(`https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/${config.textureName}.jpg`);
            material = new THREE.MeshStandardMaterial({
                map: texture,
                roughness: 0.8,
                metalness: 0.1,
            });
        } else {
            material = new THREE.MeshStandardMaterial({
                color: config.color,
                roughness: 0.7,
                metalness: 0.2,
            });
        }

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.name = config.name;
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.add(this.mesh);

        this.orbitSpeed = config.speed;
        this.rotSpeed = config.rotationSpeed;
        this.distance = config.distance;
        this.angle = Math.random() * Math.PI * 2;

        // Advanced Fresnel Atmosphere
        const atmoGeom = new THREE.SphereGeometry(config.radius * 1.1, 64, 64);
        const atmoMat = new THREE.ShaderMaterial({
            transparent: true,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            uniforms: {
                glowColor: { value: new THREE.Color(config.color) },
                powFactor: { value: 6.0 },
                viewVector: { value: new THREE.Vector3() }
            },
            vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
            fragmentShader: `
        uniform vec3 glowColor;
        uniform float powFactor;
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vec3 viewDir = normalize(-vPosition);
          float intensity = pow(0.7 - dot(vNormal, viewDir), powFactor);
          gl_FragColor = vec4(glowColor, intensity * 0.8);
        }
      `
        });
        this.atmosphere = new THREE.Mesh(atmoGeom, atmoMat);
        this.add(this.atmosphere);

        // Realistic Planetary Rings (Saturn Style)
        if (config.hasRings) {
            const innerRadius = config.radius * 1.4;
            const outerRadius = config.radius * 2.2;
            const ringGeom = new THREE.RingGeometry(innerRadius, outerRadius, 128);

            // UV mapping for rings to look like stripes
            const pos = ringGeom.attributes.position;
            const v3 = new THREE.Vector3();
            for (let i = 0; i < pos.count; i++) {
                v3.fromBufferAttribute(pos, i);
                ringGeom.attributes.uv.setXY(i, (v3.length() - innerRadius) / (outerRadius - innerRadius), 0);
            }

            const ringMat = new THREE.MeshStandardMaterial({
                color: config.color,
                transparent: true,
                opacity: 0.6,
                side: THREE.DoubleSide,
                metalness: 0.1,
                roughness: 0.8
            });

            this.rings = new THREE.Mesh(ringGeom, ringMat);
            this.rings.rotation.x = Math.PI / 2.1;
            this.add(this.rings);
        }

        // HUD Label
        this.labelElement = document.createElement('div');
        this.labelElement.className = 'planet-label';
        this.labelElement.innerHTML = `<div class="line"></div><div class="name">${config.name}</div>`;
        document.getElementById('ui-layer')?.appendChild(this.labelElement);

        this.updatePosition();
    }

    public update(delta: number, camera: THREE.Camera) {
        const scaledDelta = delta * this.timeScale;
        this.angle += this.orbitSpeed * scaledDelta;
        this.mesh.rotation.y += this.rotSpeed * scaledDelta;

        if (this.clouds) {
            this.clouds.rotation.y += this.rotSpeed * 1.2 * scaledDelta;
        }

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
