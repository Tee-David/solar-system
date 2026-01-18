import { Hands, Results, HAND_CONNECTIONS } from '@mediapipe/hands';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';

export class HandTracker {
    private hands: Hands;
    private video: HTMLVideoElement;
    private debugCanvas: HTMLCanvasElement | null;
    private debugCtx: CanvasRenderingContext2D | null = null;
    private onResults: (results: Results) => void;

    constructor(video: HTMLVideoElement, debugCanvas: HTMLCanvasElement | null, onResults: (results: Results) => void) {
        this.video = video;
        this.debugCanvas = debugCanvas;
        this.onResults = onResults;

        if (this.debugCanvas) {
            this.debugCtx = this.debugCanvas.getContext('2d');
        }

        this.hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });

        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        this.hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1, // Increased back to 1 for "fine-grained" tracking
            minDetectionConfidence: 0.7, // Higher confidence for better stability
            minTrackingConfidence: 0.7,
            selfieMode: true
        });

        this.hands.onResults((results) => {
            this.drawDebug(results);
            this.onResults(results);
        });

        this.startCamera(isMobile);
    }

    private async startCamera(isMobile: boolean) {
        try {
            const constraints = {
                video: {
                    facingMode: 'user',
                    width: isMobile ? 320 : 640,
                    height: isMobile ? 240 : 480
                }
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = stream;
            this.video.play();

            this.processVideo();
        } catch (err) {
            console.error('Webcam access denied:', err);
        }
    }

    private drawDebug(results: Results) {
        if (!this.debugCanvas || !this.debugCtx) return;

        this.debugCtx.save();
        this.debugCtx.clearRect(0, 0, this.debugCanvas.width, this.debugCanvas.height);

        // Draw the mirrored video frame background (optional, but good for feedback)
        this.debugCtx.drawImage(results.image, 0, 0, this.debugCanvas.width, this.debugCanvas.height);

        if (results.multiHandLandmarks) {
            for (const landmarks of results.multiHandLandmarks) {
                drawConnectors(this.debugCtx, landmarks, HAND_CONNECTIONS, {
                    color: '#00e5ff',
                    lineWidth: 2
                });
                drawLandmarks(this.debugCtx, landmarks, {
                    color: '#ffffff',
                    lineWidth: 1,
                    radius: 2
                });
            }
        }
        this.debugCtx.restore();
    }

    private async processVideo() {
        if (this.video.readyState >= 2) {
            await this.hands.send({ image: this.video });
        }
        requestAnimationFrame(() => this.processVideo());
    }
}
