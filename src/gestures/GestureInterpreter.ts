import { Results } from '@mediapipe/hands';

interface Point3D {
    x: number;
    y: number;
    z: number;
}

export interface GestureData {
    type: 'pinch' | 'pan' | 'rotate' | null;
    delta: { x: number; y: number; z: number };
}

export class GestureInterpreter {
    private history: Point3D[][] = [];

    constructor() {
        this.history = [];
    }

    public process(results: Results): GestureData {
        if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
            return { type: null, delta: { x: 0, y: 0, z: 0 } };
        }

        const landmarks = results.multiHandLandmarks[0];
        this.history.push(landmarks);
        if (this.history.length > 5) this.history.shift();

        const thumb = landmarks[4];
        const index = landmarks[8];
        const middle = landmarks[12];
        const wrist = landmarks[0];

        const pinchDist = this.getDist(thumb, index);
        if (pinchDist < 0.05) {
            const delta = this.getMovementDelta(8);
            return { type: 'pinch', delta: { x: 0, y: 0, z: delta.y } };
        }

        const indexWrist = this.getDist(index, wrist);
        const middleWrist = this.getDist(middle, wrist);
        if (indexWrist < 0.2 && middleWrist < 0.2) {
            const delta = this.getMovementDelta(0);
            return { type: 'pan', delta };
        }

        if (indexWrist > 0.4 && middleWrist > 0.4) {
            const delta = this.getMovementDelta(0);
            return { type: 'rotate', delta };
        }

        return { type: null, delta: { x: 0, y: 0, z: 0 } };
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
