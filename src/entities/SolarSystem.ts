import * as THREE from 'three';
import { Planet, PlanetConfig } from './Planet';

export class SolarSystem extends THREE.Group {
    public planets: Planet[] = [];
    private timeScale: number = 2.5;
    private sunMaterial!: THREE.ShaderMaterial;
    private asteroidBelt!: THREE.InstancedMesh;

    constructor() {
        super();
        this.createSun();
        this.createPlanets();
        this.createAsteroidBelt();
    }

    private createSun() {
        const sunGeom = new THREE.SphereGeometry(30, 64, 64);

        // Advanced Sun Surface Shader using noise
        this.sunMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                sunColor: { value: new THREE.Color(0xffaa00) },
                coreColor: { value: new THREE.Color(0xffffff) }
            },
            vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
            fragmentShader: `
        uniform float time;
        uniform vec3 sunColor;
        uniform vec3 coreColor;
        varying vec2 vUv;
        varying vec3 vNormal;

        // Custom noise implementation
        float mod289(float x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
        vec4 mod289(vec4 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
        vec4 perm(vec4 x){return mod289(((x * 34.0) + 1.0) * x);}

        float noise(vec3 p){
            vec3 a = floor(p);
            vec3 d = p - a;
            d = d * d * (3.0 - 2.0 * d);

            vec4 b = a.xxyy + vec4(0.0, 1.0, 0.0, 1.0);
            vec4 k1 = perm(b.xyxy);
            vec4 k2 = perm(k1.xyxy + b.zzww);

            vec4 f = k2 + a.zzzz;
            vec4 g = k2 + a.zzzz + 1.0;

            vec4 h = mix(perm(f), perm(g), d.z);
            vec2 i = mix(h.xz, h.yw, d.y);
            return mix(i.x, i.y, d.x);
        }

        void main() {
          float n = noise(vNormal * 4.0 + time * 0.5);
          float n2 = noise(vNormal * 8.0 - time * 0.3);
          float combined = (n + n2) * 0.5;
          
          vec3 color = mix(sunColor, coreColor, pow(combined, 3.0));
          float rim = 1.0 - max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0);
          color += sunColor * pow(rim, 2.0);
          
          gl_FragColor = vec4(color, 1.0);
        }
      `
        });

        const sun = new THREE.Mesh(sunGeom, this.sunMaterial);
        this.add(sun);

        const sunLight = new THREE.PointLight(0xffffff, 15, 5000, 1.5);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.set(2048, 2048);
        this.add(sunLight);

        this.add(new THREE.AmbientLight(0x404040, 0.5));
    }

    private createPlanets() {
        const configs: PlanetConfig[] = [
            { name: 'Mercury', radius: 4, distance: 100, speed: 0.05, color: 0xaaaaaa, rotationSpeed: 0.01, textureName: 'mercury' },
            { name: 'Venus', radius: 8, distance: 180, speed: 0.04, color: 0xffcc99, rotationSpeed: 0.005, textureName: 'venusa' },
            { name: 'Earth', radius: 9, distance: 260, speed: 0.035, color: 0x3366ff, rotationSpeed: 0.02, textureName: 'earth_day_4096' },
            { name: 'Mars', radius: 6, distance: 340, speed: 0.03, color: 0xff3300, rotationSpeed: 0.015, textureName: 'mars' },
            { name: 'Jupiter', radius: 25, distance: 580, speed: 0.015, color: 0xffcc66, rotationSpeed: 0.04, textureName: 'jupiter' },
            { name: 'Saturn', radius: 22, distance: 750, speed: 0.012, color: 0xcc9966, rotationSpeed: 0.035, textureName: 'saturn' },
            { name: 'Uranus', radius: 15, distance: 900, speed: 0.008, color: 0x66ffff, rotationSpeed: 0.03, textureName: 'uranus' },
            { name: 'Neptune', radius: 14, distance: 1050, speed: 0.006, color: 0x3333ff, rotationSpeed: 0.025, textureName: 'neptune' },
        ];

        configs.forEach(config => {
            const planet = new Planet(config);
            this.planets.push(planet);
            this.add(planet);
            this.add(this.createOrbitRing(config.distance));
        });
    }

    private createOrbitRing(distance: number): THREE.Line {
        const curve = new THREE.EllipseCurve(0, 0, distance, distance);
        const points = curve.getPoints(128);
        const geometry = new THREE.BufferGeometry().setFromPoints(
            points.map(p => new THREE.Vector3(p.x, 0, p.y))
        );
        const material = new THREE.LineBasicMaterial({
            color: 0x00e5ff,
            transparent: true,
            opacity: 0.15,
            blending: THREE.AdditiveBlending
        });
        return new THREE.Line(geometry, material);
    }

    private createAsteroidBelt() {
        const count = 2000;
        const geometry = new THREE.IcosahedronGeometry(0.5, 0);
        const material = new THREE.MeshStandardMaterial({ color: 0x888888 });
        this.asteroidBelt = new THREE.InstancedMesh(geometry, material, count);

        const dummy = new THREE.Object3D();
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 400 + Math.random() * 80;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            const y = (Math.random() - 0.5) * 10;

            dummy.position.set(x, y, z);
            dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            const s = 0.5 + Math.random() * 2;
            dummy.scale.set(s, s, s);
            dummy.updateMatrix();
            this.asteroidBelt.setMatrixAt(i, dummy.matrix);
        }
        this.add(this.asteroidBelt);
    }

    public setTimeScale(scale: number) {
        this.timeScale = scale;
    }

    public update(delta: number) {
        if (this.sunMaterial) {
            this.sunMaterial.uniforms.time.value += delta * 2.0;
        }
        this.planets.forEach(p => {
            p.timeScale = this.timeScale;
        });
        // Rotate asteroid belt slowly
        this.asteroidBelt.rotation.y += delta * 0.02 * this.timeScale;
    }
}
