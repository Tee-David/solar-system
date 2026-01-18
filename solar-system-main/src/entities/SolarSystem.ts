import * as THREE from 'three';
import { Planet, PlanetConfig } from './Planet';

export class SolarSystem extends THREE.Group {
    public planets: Planet[] = [];
    private timeScale: number = 2.5;

    constructor() {
        super();
        this.createSun();
        this.createPlanets();
    }

    private createSun() {
        const sunGeom = new THREE.SphereGeometry(25, 32, 32);
        const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const sun = new THREE.Mesh(sunGeom, sunMat);
        this.add(sun);

        const innerGlowGeom = new THREE.SphereGeometry(28, 32, 32);
        const innerGlowMat = new THREE.MeshBasicMaterial({
            color: 0xffaa00,
            transparent: true,
            opacity: 0.8,
        });
        this.add(new THREE.Mesh(innerGlowGeom, innerGlowMat));

        const outerGlowGeom = new THREE.SphereGeometry(45, 32, 32);
        const outerGlowMat = new THREE.MeshBasicMaterial({
            color: 0xff6600,
            transparent: true,
            opacity: 0.3,
            side: THREE.BackSide
        });
        this.add(new THREE.Mesh(outerGlowGeom, outerGlowMat));

        const sunLight = new THREE.PointLight(0xffffff, 10, 3000, 1);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.set(1024, 1024);
        this.add(sunLight);

        const ambient = new THREE.AmbientLight(0x222233, 1.0);
        this.add(ambient);
    }

    private createPlanets() {
        const configs: PlanetConfig[] = [
            { name: 'Mercury', radius: 4, distance: 100, speed: 0.05, color: 0xaaaaaa, rotationSpeed: 0.01, textureName: 'mercury' },
            { name: 'Venus', radius: 8, distance: 180, speed: 0.04, color: 0xffcc99, rotationSpeed: 0.005, textureName: 'venusa' },
            { name: 'Earth', radius: 9, distance: 260, speed: 0.035, color: 0x3366ff, rotationSpeed: 0.02, textureName: 'earth_day_4096' },
            { name: 'Mars', radius: 6, distance: 340, speed: 0.03, color: 0xff3300, rotationSpeed: 0.015, textureName: 'mars' },
            { name: 'Jupiter', radius: 25, distance: 480, speed: 0.015, color: 0xffcc66, rotationSpeed: 0.04, textureName: 'jupiter' },
            { name: 'Saturn', radius: 22, distance: 620, speed: 0.012, color: 0xcc9966, rotationSpeed: 0.035, textureName: 'saturn' },
            { name: 'Uranus', radius: 15, distance: 750, speed: 0.008, color: 0x66ffff, rotationSpeed: 0.03, textureName: 'uranus' },
            { name: 'Neptune', radius: 14, distance: 880, speed: 0.006, color: 0x3333ff, rotationSpeed: 0.025, textureName: 'neptune' },
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
        const points = curve.getPoints(64);
        const geometry = new THREE.BufferGeometry().setFromPoints(
            points.map(p => new THREE.Vector3(p.x, 0, p.y))
        );
        const material = new THREE.LineBasicMaterial({
            color: 0x00e5ff,
            transparent: true,
            opacity: 0.3,
            blending: THREE.AdditiveBlending
        });
        return new THREE.Line(geometry, material);
    }

    public setTimeScale(scale: number) {
        this.timeScale = scale;
    }

    public update(_delta: number) { // Fixed unused variable
        this.planets.forEach(p => {
            p.timeScale = this.timeScale;
        });
    }
}
