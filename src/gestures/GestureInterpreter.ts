import { Results } from '@mediapipe/hands';

interface Point3D {
    x: number;
    y: number;
    z: number;
}

export interface GestureData {
    type: 'pinch' | 'pan' | 'rotate' | 'point' | null;
    delta: { x: number; y: number; z: number };
    velocity: number;
}

export class GestureInterpreter {
    private history: Point3D[][] = [];
    private smoothing = 0.5;
    private smoothedDeltas = { x: 0, y: 0, z: 0 };

    constructor() {
        this.history = [];
    }

    public process(results: Results): GestureData {
        if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
            return { type: null, delta: { x: 0, y: 0, z: 0 }, velocity: 0 };
        }

        const landmarks = results.multiHandLandmarks[0];
        this.history.push(landmarks);
        if (this.history.length > 10) this.history.shift();

        const thumb = landmarks[4];
        const index = landmarks[8];
        const middle = landmarks[12];
        const ring = landmarks[16];
        const wrist = landmarks[0];

        // Distances from wrist to determine "extended" or "curled"
        const distIndex = this.getDist(index, wrist);
        const distMiddle = this.getDist(middle, wrist);
        const distRing = this.getDist(ring, wrist);

        // Pinch distance
        const pinchDist = this.getDist(thumb, index);

        // Velocity calculation
        const rawDelta = this.getMovementDelta(0);
        const velocity = Math.sqrt(rawDelta.x ** 2 + rawDelta.y ** 2);

        // 1. Pointing (Index Extended, others curled)
        // Precise targeting: index is far from wrist, middle/ring/pinky are close to wrist
        if (distIndex > 0.4 && distMiddle < 0.25 && distRing < 0.25) {
            return { type: 'point', delta: { x: 0, y: 0, z: 0 }, velocity };
        }

        // 2. Pinch (Thumb + Index close)
        if (pinchDist < 0.06) {
            const d8 = this.getMovementDelta(8);
            this.applySmoothing(d8);
            return { type: 'pinch', delta: { x: 0, y: 0, z: d8.y }, velocity };
        }

        // 3. Closed Fist (Pan)
        // All fingers close to wrist
        if (distIndex < 0.25 && distMiddle < 0.25 && distRing < 0.25 && distPinky < 0.25) {
            this.applySmoothing(rawDelta);
            return { type: 'pan', delta: { ...this.smoothedDeltas }, velocity };
        }

        // 4. Open Palm (Rotate)
        // All fingers extended
        if (distIndex > 0.4 && distMiddle > 0.4 && distRing > 0.4) {
            this.applySmoothing(rawDelta);
            return { type: 'rotate', delta: { ...this.smoothedDeltas }, velocity };
        }

        return { type: null, delta: { x: 0, y: 0, z: 0 }, velocity: 0 };
    }

    private applySmoothing(raw: { x: number; y: number; z: number }) {
        this.smoothedDeltas.x = this.smoothedDeltas.x * (1 - this.smoothing) + raw.x * this.smoothing;
        this.smoothedDeltas.y = this.smoothedDeltas.y * (1 - this.smoothing) + raw.y * this.smoothing;
        this.smoothedDeltas.z = this.smoothedDeltas.z * (1 - this.smoothing) + raw.z * this.smoothing;
    }

    private getDist(p1: Point3D, p2: Point3D) {
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    }

    private getMovementDelta(index: number) {
        if (this.history.length < 2) return { x: 0, y: 0, z: 0 };
        const curr = this.history[this.history.length - 1][index];
        const prev = this.history[this.history.length - 2][index];
        return {
            x: curr.x - prev.x,
            y: curr.y - prev.y,
            z: curr.z - prev.z
        };
    }
}
