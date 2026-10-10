import { useCallback, useRef, useState } from 'react';
import * as faceapi from '@vladmandic/face-api';

// Public CDN hosting the same pre-trained face-api.js model weights used
// by the library's own demos. For a production deployment these should be
// copied into /public/models and served from the app's own origin instead.
const MODEL_URL = 'https://vladmandic.github.io/face-api/model';

const EXPRESSION_TO_EMOTION = {
  happy: 'happy',
  neutral: 'neutral',
  sad: 'sad',
  angry: 'angry',
  fearful: 'anxious',
  disgusted: 'confused',
  surprised: 'surprised'
};

let modelsLoadedPromise = null;

function ensureModelsLoaded() {
  if (!modelsLoadedPromise) {
    modelsLoadedPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
    ]);
  }
  return modelsLoadedPromise;
}

/**
 * Runs facial expression detection entirely in the browser (face-api.js /
 * TensorFlow.js) against a live <video> element. Webcam frames never leave
 * the device — only the derived {emotionLabel, confidenceScore, ...}
 * readings are handed to the caller, matching the "derived data only, no
 * raw recordings" decision from the Phase 1 architecture review.
 *
 * eyeContactScore and nervousnessScore are heuristic approximations
 * (face-detection confidence as a facing-camera proxy; negative-expression
 * probability as a nervousness proxy) — not true gaze tracking, which
 * would require a dedicated model this project doesn't ship.
 */
export function useFaceEmotionDetector() {
  const [isReady, setIsReady] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const loadModels = useCallback(async () => {
    try {
      await ensureModelsLoaded();
      setIsReady(true);
    } catch (err) {
      setError('Could not load facial emotion detection models. Continuing without emotion analysis.');
      // eslint-disable-next-line no-console
      console.error('face-api model load failed', err);
    }
  }, []);

  const startDetection = useCallback(
    (videoEl, onReading, intervalMs = 3000) => {
      if (!videoEl || intervalRef.current) return;

      setIsDetecting(true);
      intervalRef.current = setInterval(async () => {
        if (!isReady || videoEl.readyState < 2) return;

        try {
          const detection = await faceapi
            .detectSingleFace(videoEl, new faceapi.TinyFaceDetectorOptions())
            .withFaceExpressions();

          if (!detection) return;

          const expressions = Object.entries(detection.expressions);
          const [topExpression, topScore] = expressions.sort((a, b) => b[1] - a[1])[0];
          const nervousness = (detection.expressions.fearful || 0) + (detection.expressions.sad || 0) * 0.5 + (detection.expressions.angry || 0) * 0.5;

          onReading({
            emotionLabel: EXPRESSION_TO_EMOTION[topExpression] || 'neutral',
            confidenceScore: Number(topScore.toFixed(3)),
            eyeContactScore: Number(detection.detection.score.toFixed(3)),
            nervousnessScore: Number(Math.min(1, nervousness).toFixed(3)),
            capturedAt: new Date().toISOString()
          });
        } catch {
          // Skip this tick silently - a single failed detection frame
          // shouldn't interrupt the interview.
        }
      }, intervalMs);
    },
    [isReady]
  );

  const stopDetection = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsDetecting(false);
  }, []);

  return { isReady, isDetecting, error, loadModels, startDetection, stopDetection };
}
