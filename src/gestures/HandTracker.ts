import { Hands, Results } from '@mediapipe/hands';

export class HandTracker {
    private hands: Hands;
    private video: HTMLVideoElement;
    private onResults: (results: Results) => void;

    constructor(video: HTMLVideoElement, onResults: (results: Results) => void) {
        this.video = video;
        this.onResults = onResults;

        this.hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });

        this.hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        this.hands.onResults(this.onResults);

        this.startCamera();
    }

    private async startCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480 }
            });
            this.video.srcObject = stream;
            this.video.play();

            this.processVideo();
        } catch (err) {
            console.error('Webcam access denied:', err);
        }
    }

    private async processVideo() {
        if (this.video.readyState >= 2) {
            await this.hands.send({ image: this.video });
        }
        requestAnimationFrame(() => this.processVideo());
    }
}
