import { useState, useEffect, useRef } from "react";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Loader,
  Shield,
  Camera,
  Info,
  Clock,
  FileText,
  AlertTriangle,
  User,
  Calendar,
} from "lucide-react";
import * as faceapi from "face-api.js";
import { useKiosk } from "../../contexts/KisokContext";

function FaceVerificationSystem() {
  const { verifyAppointmentArrival } = useKiosk();

  const [mode, setMode] = useState(null); // 'appointment' | 'medical-record' | null
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [status, setStatus] = useState({ message: "", type: "" });
  const [isVerifying, setIsVerifying] = useState(false);
  const [feedback, setFeedback] = useState({
    centered: false,
    rightSize: false,
    blinked: false,
    lighting: false,
    faceDetected: false,
    message: "Initializing camera...",
    blinkCount: 0,
    brightness: 0,
    currentEAR: 0,
  });

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const detectionIntervalRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  const blinkCountRef = useRef(0);
  const cameraActiveRef = useRef(false);
  const requirementsMetRef = useRef(false);
  const lastBlinkTimeRef = useRef(0);
  const lastEARRef = useRef(0.4);
  const isBlinkingRef = useRef(false);
  const countdownStartedRef = useRef(false);

  const isCapturingRef = useRef(false);

  useEffect(() => {
    const initialize = async () => {
      await loadModels();
    };
    initialize();

    return () => {
      stopCamera();
    };
  }, []);

  const loadModels = async () => {
    try {
      setStatus({ message: "Loading AI models...", type: "info" });

      const MODEL_URL = "/models/";

      await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);

      setModelsLoaded(true);
      setStatus({
        message: "AI Models loaded! Select a verification mode.",
        type: "success",
      });
    } catch (error) {
      setStatus({
        message: "Error loading models. Please refresh the page.",
        type: "error",
      });
    }
  };

  const startCamera = async () => {
    try {
      setStatus({ message: "Accessing camera...", type: "info" });

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          "Camera API not available. This requires HTTPS or localhost connection.",
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
      });

      streamRef.current = stream;
      videoRef.current.srcObject = stream;

      await new Promise((resolve) => {
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().then(resolve);
        };
      });

      setCameraActive(true);
      cameraActiveRef.current = true;
      setCountdown(3);
      setIsCountingDown(false);

      blinkCountRef.current = 0;
      requirementsMetRef.current = false;
      lastBlinkTimeRef.current = 0;
      lastEARRef.current = 0.4;
      isBlinkingRef.current = false;
      countdownStartedRef.current = false;

      setStatus({
        message: "Camera active! Follow the instructions.",
        type: "info",
      });

      setTimeout(() => {
        if (canvasRef.current && videoRef.current && overlayCanvasRef.current) {
          const video = videoRef.current;
          canvasRef.current.width = video.videoWidth;
          canvasRef.current.height = video.videoHeight;
          overlayCanvasRef.current.width = video.videoWidth;
          overlayCanvasRef.current.height = video.videoHeight;
          startDetection();
        }
      }, 1000);
    } catch (error) {
      let errorMessage = "Camera access failed. ";
      if (error.message.includes("not available")) {
        errorMessage += "Camera API requires HTTPS or localhost.";
      } else if (error.name === "NotAllowedError") {
        errorMessage += "Camera permission denied.";
      } else if (error.name === "NotFoundError") {
        errorMessage += "No camera found.";
      } else {
        errorMessage += error.message;
      }
      setStatus({ message: errorMessage, type: "error" });
    }
  };

  const stopCamera = () => {
    cameraActiveRef.current = false;
    requirementsMetRef.current = false;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setIsCountingDown(false);
    setCountdown(3);
    countdownStartedRef.current = false;
  };

  const startCountdown = () => {
    if (isCountingDown || isCapturingRef.current) return;

    setIsCountingDown(true);
    setCountdown(3);
    countdownStartedRef.current = true;

    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
          if (requirementsMetRef.current && !isCapturingRef.current) {
            captureAndVerify();
          } else {
            setIsCountingDown(false);
            setCountdown(3);
            countdownStartedRef.current = false;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const resetCountdown = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setIsCountingDown(false);
    setCountdown(3);
    requirementsMetRef.current = false;
    countdownStartedRef.current = false;
  };

  const detectBlink = (avgEAR) => {
    const BLINK_THRESHOLD = 0.27;
    const DEBOUNCE_TIME = 600;
    const now = Date.now();
    const isEyesClosed = avgEAR < BLINK_THRESHOLD;

    if (!isBlinkingRef.current && isEyesClosed) {
      isBlinkingRef.current = true;
    } else if (isBlinkingRef.current && !isEyesClosed) {
      isBlinkingRef.current = false;
      const timeSinceLastBlink = now - lastBlinkTimeRef.current;
      if (timeSinceLastBlink > DEBOUNCE_TIME) {
        blinkCountRef.current = Math.min(2, blinkCountRef.current + 1);
        lastBlinkTimeRef.current = now;
        return true;
      }
    }
    lastEARRef.current = avgEAR;
    return false;
  };

  const calculateEAR = (eye) => {
    if (!eye || eye.length < 6) return 0.3;

    try {
      const [p1, p2, p3, p4, p5, p6] = eye;

      const vertical1 = Math.sqrt(
        Math.pow(p2.x - p6.x, 2) + Math.pow(p2.y - p6.y, 2),
      );
      const vertical2 = Math.sqrt(
        Math.pow(p3.x - p5.x, 2) + Math.pow(p3.y - p5.y, 2),
      );

      const horizontal = Math.sqrt(
        Math.pow(p1.x - p4.x, 2) + Math.pow(p1.y - p4.y, 2),
      );

      if (horizontal === 0) return 0.3;

      const ear = (vertical1 + vertical2) / (2.0 * horizontal);

      return Math.max(0.1, Math.min(0.5, ear));
    } catch (error) {
      return 0.3;
    }
  };

  const startDetection = () => {
    detectionIntervalRef.current = setInterval(async () => {
      if (!cameraActiveRef.current || !videoRef.current) return;

      if (
        videoRef.current.videoWidth === 0 ||
        videoRef.current.videoHeight === 0
      ) {
        return;
      }

      try {
        const detections = await faceapi
          .detectSingleFace(
            videoRef.current,
            new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }),
          )
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!canvasRef.current || !overlayCanvasRef.current) {
          return;
        }

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const overlayCanvas = overlayCanvasRef.current;
        const overlayCtx = overlayCanvas.getContext("2d");
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

        const centerX = overlayCanvas.width / 2;
        const centerY = overlayCanvas.height / 2;
        const circleRadius =
          Math.min(overlayCanvas.width, overlayCanvas.height) * 0.48;

        overlayCtx.fillStyle = "rgba(0, 0, 0, 0.7)";
        overlayCtx.fillRect(0, 0, overlayCanvas.width, overlayCanvas.height);

        overlayCtx.globalCompositeOperation = "destination-out";
        overlayCtx.beginPath();
        overlayCtx.arc(centerX, centerY, circleRadius, 0, 2 * Math.PI);
        overlayCtx.fill();
        overlayCtx.globalCompositeOperation = "source-over";

        const tempCanvas = document.createElement("canvas");
        const size = Math.floor(circleRadius * 2);
        tempCanvas.width = size;
        tempCanvas.height = size;
        const tempCtx = tempCanvas.getContext("2d");

        tempCtx.drawImage(
          videoRef.current,
          centerX - circleRadius,
          centerY - circleRadius,
          size,
          size,
          0,
          0,
          size,
          size,
        );

        const imageData = tempCtx.getImageData(0, 0, size, size);
        let totalBrightness = 0;
        for (let i = 0; i < imageData.data.length; i += 4) {
          totalBrightness +=
            (imageData.data[i] +
              imageData.data[i + 1] +
              imageData.data[i + 2]) /
            3;
        }
        const avgBrightness = totalBrightness / (imageData.data.length / 4);
        const isGoodLighting = avgBrightness > 60 && avgBrightness < 200;

        let isCentered = false;
        let isRightSize = false;
        const hasBlinked = blinkCountRef.current >= 2;

        if (detections) {
          const box = detections.detection.box;
          const faceCenterX = box.x + box.width / 2;
          const faceCenterY = box.y + box.height / 2;

          const distanceFromCenter = Math.sqrt(
            Math.pow(faceCenterX - centerX, 2) +
              Math.pow(faceCenterY - centerY, 2),
          );

          const faceSize = (box.width + box.height) / 2;
          const targetSize = circleRadius * 1.4;
          const sizeDiff = Math.abs(faceSize - targetSize);

          isCentered = distanceFromCenter < circleRadius * 0.3;
          isRightSize = sizeDiff < targetSize * 0.3;

          // Draw facial landmarks
          const positions = detections.landmarks.positions;
          ctx.fillStyle = "#00ff00";
          positions.forEach((point) => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI);
            ctx.fill();
          });

          // Eye aspect ratio for blink detection
          const leftEye = detections.landmarks.getLeftEye();
          const rightEye = detections.landmarks.getRightEye();
          const leftEAR = calculateEAR(leftEye);
          const rightEAR = calculateEAR(rightEye);
          const avgEAR = (leftEAR + rightEAR) / 2;

          detectBlink(avgEAR);

          // Highlight eyes
          const eyeColor = isBlinkingRef.current ? "#ff4444" : "#00ff00";
          ctx.fillStyle = eyeColor;
          ctx.strokeStyle = eyeColor;
          ctx.lineWidth = 3;

          [leftEye, rightEye].forEach((eye) => {
            eye.forEach((point) => {
              ctx.beginPath();
              ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI);
              ctx.fill();
            });

            ctx.beginPath();
            ctx.moveTo(eye[0].x, eye[0].y);
            for (let i = 1; i < eye.length; i++) {
              ctx.lineTo(eye[i].x, eye[i].y);
            }
            ctx.closePath();
            ctx.stroke();
          });

          overlayCtx.beginPath();
          overlayCtx.arc(centerX, centerY, circleRadius, 0, 2 * Math.PI);

          if (isCentered && isRightSize && hasBlinked && isGoodLighting) {
            overlayCtx.strokeStyle = "#10b981";
            overlayCtx.lineWidth = 8;
          } else if (!isGoodLighting) {
            overlayCtx.strokeStyle = "#f59e0b";
            overlayCtx.lineWidth = 6;
          } else if (!isCentered || !isRightSize) {
            overlayCtx.strokeStyle = "#3b82f6";
            overlayCtx.lineWidth = 6;
          } else if (!hasBlinked) {
            overlayCtx.strokeStyle = "#8b5cf6";
            overlayCtx.lineWidth = 6;
          } else {
            overlayCtx.strokeStyle = "#ef4444";
            overlayCtx.lineWidth = 6;
          }
          overlayCtx.stroke();

          let message = "";
          let canBlink = false;

          if (!isGoodLighting) {
            message =
              avgBrightness <= 60
                ? "💡 Too dark - add more light"
                : "☀️ Too bright - reduce light";
          } else if (!isCentered) {
            if (faceCenterX < centerX - circleRadius * 0.25) {
              message = "← Move right";
            } else if (faceCenterX > centerX + circleRadius * 0.25) {
              message = "→ Move left";
            } else if (faceCenterY < centerY - circleRadius * 0.25) {
              message = "↓ Move down";
            } else {
              message = "↑ Move up";
            }
            blinkCountRef.current = 0;
          } else if (!isRightSize) {
            message = faceSize < targetSize ? "🔍 Move closer" : "🔍 Move back";
            blinkCountRef.current = 0;
          } else {
            canBlink = true;
            if (!hasBlinked) {
              const remainingBlinks = 2 - blinkCountRef.current;
              message = `👁️ Blink ${remainingBlinks} more time${
                remainingBlinks > 1 ? "s" : ""
              } naturally`;
            } else {
              message = "✓ Perfect! Hold still...";
            }
          }

          if (!canBlink && blinkCountRef.current > 0) {
            blinkCountRef.current = 0;
            isBlinkingRef.current = false;
          }

          setFeedback({
            centered: isCentered,
            rightSize: isRightSize,
            blinked: hasBlinked,
            lighting: isGoodLighting,
            faceDetected: true,
            message,
            blinkCount: blinkCountRef.current,
            brightness: Math.round(avgBrightness),
            currentEAR: avgEAR,
          });

          const allRequirementsMet =
            isCentered && isRightSize && hasBlinked && isGoodLighting;

          if (allRequirementsMet) {
            if (!requirementsMetRef.current) {
              requirementsMetRef.current = true;
            }

            if (!isCountingDown && !countdownStartedRef.current) {
              startCountdown();
            }
          } else {
            if (requirementsMetRef.current) {
              requirementsMetRef.current = false;
            }
            if (isCountingDown) {
              resetCountdown();
            }
          }
        } else {
          overlayCtx.beginPath();
          overlayCtx.arc(centerX, centerY, circleRadius, 0, 2 * Math.PI);
          overlayCtx.strokeStyle = "#ef4444";
          overlayCtx.lineWidth = 6;
          overlayCtx.stroke();

          blinkCountRef.current = 0;
          isBlinkingRef.current = false;

          setFeedback({
            centered: false,
            rightSize: false,
            blinked: false,
            lighting: false,
            faceDetected: false,
            message: "❌ No face detected",
            blinkCount: 0,
            brightness: Math.round(avgBrightness),
            currentEAR: 0,
          });

          requirementsMetRef.current = false;
          resetCountdown();
        }
      } catch (error) {
        // Detection error - continue silently
      }
    }, 100);
  };

  const captureAndVerify = async () => {
    const canvas = document.createElement("canvas");
    if (isCapturingRef.current) {
      console.log("Already capturing, skipping duplicate call");
      return;
    }
    try {
      isCapturingRef.current = true;
      setIsVerifying(true);
      setStatus({
        message: `Processing ${
          mode === "appointment"
            ? "appointment verification"
            : "medical record lookup"
        }...`,
        type: "info",
      });

      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

      const dataURL = canvas.toDataURL("image/jpeg", 0.9);
      const livePhotoBase64 = dataURL.replace(/^data:image\/jpeg;base64,/, "");

      console.log("About to call verifyAppointmentArrival"); // ← Debug log

      const response = await verifyAppointmentArrival(livePhotoBase64);
      console.log("Response received:", response);

      if (response.alreadyCheckedIn) {
        setVerificationResult({
          isMatch: true,
          scenario: "already_arrived",
          confidence: response.confidence,
          patient: response.patient,
          appointment: response.appointment,
          message: "You have already checked in for this appointment.",
          notificationSent: response.notificationSent,
          liveFaceImage: canvas.toDataURL(),
        });
      } else {
        // ✅ Normal success response
        setVerificationResult({
          isMatch: true,
          scenario: "success",
          confidence: response.confidence,
          patient: response.patient,
          appointment: response.appointment,
          message: "Check-in successful! Patient marked as arrived.",
          notificationSent: response.notificationSent,
          liveFaceImage: canvas.toDataURL(),
        });
      }
      setIsVerifying(false);
      stopCamera();
    } catch (error) {
      console.error("Capture and verify error:", error);

      // ✅ Handle different error scenarios
      const errorData = error.response?.data;
      let scenario = "no_face_data";
      let errorMessage =
        error.message || "Verification failed. Please try again.";

      if (errorData?.message) {
        errorMessage = errorData.message;

        // Detect scenario from error message
        if (
          errorMessage.includes("already marked as arrived") ||
          errorMessage.includes("already checked in")
        ) {
          scenario = "already_arrived";
        } else if (
          errorMessage.includes("No-Show") ||
          errorMessage.includes("window has passed")
        ) {
          scenario = "too_late";
        } else if (
          errorMessage.includes("more than 1 hour away") ||
          errorMessage.includes("not yet open")
        ) {
          scenario = "too_early";
        } else if (
          errorMessage.includes("No registered face") ||
          errorMessage.includes("not found")
        ) {
          scenario = "no_face_data";
        } else if (errorMessage.includes("No appointments scheduled")) {
          scenario = "no_appointments";
        }
      }

      setVerificationResult({
        isMatch: errorData?.patient ? true : false,
        scenario: scenario,
        confidence: errorData?.confidence || 0,
        error: true,
        errorMessage: errorMessage,
        patient: errorData?.patient || null,
        appointment: errorData?.appointment || null,
        message: errorMessage,
        liveFaceImage: canvas.toDataURL(),
      });

      setStatus({
        message: errorMessage,
        type: "error",
      });
      setIsVerifying(false);
      stopCamera();
    } finally {
      setTimeout(() => {
        isCapturingRef.current = false;
      }, 2000); // 2 second cooldown
    }
  };

  const resetDemo = () => {
    setVerificationResult(null);
    setStatus({ message: "", type: "" });
    setIsVerifying(false);
    blinkCountRef.current = 0;
    isCapturingRef.current = false;
    setMode(null);
  };

  const selectMode = (selectedMode) => {
    setMode(selectedMode);
    if (modelsLoaded) {
      setTimeout(() => {
        startCamera();
      }, 500);
    }
  };

  const StatusAlert = ({ message, type }) => {
    if (!message) return null;
    const colors = {
      info: "bg-blue-50 text-blue-800 border-blue-200",
      success: "bg-green-50 text-green-800 border-green-200",
      error: "bg-red-50 text-red-800 border-red-200",
      warning: "bg-yellow-50 text-yellow-800 border-yellow-200",
    };
    const icons = {
      info: <AlertCircle className="w-5 h-5" />,
      success: <CheckCircle className="w-5 h-5" />,
      error: <XCircle className="w-5 h-5" />,
      warning: <AlertCircle className="w-5 h-5" />,
    };
    return (
      <div
        className={`flex items-center gap-3 p-4 rounded-lg border ${colors[type]} mb-4`}
      >
        {icons[type]}
        <span className="font-medium text-sm">{message}</span>
      </div>
    );
  };

  // Mode Selection Screen
  if (!mode && modelsLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
              <Shield className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Face Verification System
            </h1>
            <p className="text-gray-600">
              Select the verification mode to continue
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <button
              onClick={() => selectMode("appointment")}
              className="bg-white rounded-xl shadow-lg p-8 border-2 border-transparent hover:border-blue-500 transition-all group"
            >
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-500 transition-colors">
                <Calendar className="w-8 h-8 text-blue-600 group-hover:text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Appointment Check-In
              </h2>
              <p className="text-gray-600 mb-4">
                Verify patient identity and mark appointment arrival
                automatically
              </p>
              <ul className="text-sm text-gray-700 space-y-2 text-left">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                  <span>Automatic arrival marking</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                  <span>Time window validation</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                  <span>Real-time staff notification</span>
                </li>
              </ul>
            </button>

            <button
              onClick={() => selectMode("medical-record")}
              className="bg-white rounded-xl shadow-lg p-8 border-2 border-transparent hover:border-emerald-500 transition-all group"
            >
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-emerald-500 transition-colors">
                <FileText className="w-8 h-8 text-emerald-600 group-hover:text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Emergency Medical Lookup
              </h2>
              <p className="text-gray-600 mb-4">
                Quick access to patient records for emergency situations
              </p>
              <ul className="text-sm text-gray-700 space-y-2 text-left">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                  <span>Instant patient identification</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                  <span>Critical medical history access</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                  <span>Allergy and condition alerts</span>
                </li>
              </ul>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!modelsLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-10 text-center max-w-md w-full border border-gray-200">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-t-blue-600 animate-spin"></div>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Initializing System
          </h2>
          <p className="text-gray-600 text-sm">
            Loading facial recognition models...
          </p>
        </div>
      </div>
    );
  }

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-10 text-center max-w-lg w-full border border-gray-200">
          <div className="w-20 h-20 mx-auto mb-6 text-blue-600">
            <Shield className="w-full h-full" />
          </div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-3">
            {mode === "appointment"
              ? "Verifying Appointment"
              : "Retrieving Medical Records"}
          </h2>
          <p className="text-gray-600 mb-8">
            Please wait while we process your facial biometrics...
          </p>
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Face Detection
                </span>
                <span className="text-xs font-semibold text-blue-600">
                  100%
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full w-full transition-all"></div>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Database Matching
                </span>
                <span className="text-xs font-semibold text-blue-600">
                  Processing...
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full w-3/4 animate-pulse transition-all"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (verificationResult) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
            <div
              className={`p-6 text-white ${
                verificationResult.scenario === "success" ||
                verificationResult.scenario === "medical_record_found"
                  ? "bg-linear-to-r from-emerald-600 to-emerald-700"
                  : verificationResult.scenario === "no_face_data" ||
                      verificationResult.scenario === "no_medical_record"
                    ? "bg-linear-to-r from-gray-600 to-gray-700"
                    : verificationResult.scenario === "too_late"
                      ? "bg-linear-to-r from-red-600 to-red-700"
                      : "bg-linear-to-r from-amber-600 to-amber-700"
              }`}
            >
              <div className="flex items-center gap-3">
                {mode === "appointment" ? (
                  <Calendar className="w-8 h-8" />
                ) : (
                  <FileText className="w-8 h-8" />
                )}
                <div>
                  <h1 className="text-2xl font-semibold">
                    {mode === "appointment"
                      ? "Appointment Verification"
                      : "Medical Record Lookup"}
                  </h1>
                  <p className="text-white/90 text-sm">
                    {verificationResult.message}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6">
              {verificationResult.liveFaceImage && (
                <div className="mb-6 text-center">
                  <img
                    src={verificationResult.liveFaceImage}
                    alt="Captured Face"
                    className="rounded-lg shadow-md mx-auto max-w-sm w-full border border-gray-200"
                  />
                </div>
              )}

              {/* Appointment Mode Results */}
              {mode === "appointment" &&
                verificationResult.scenario === "success" && (
                  <div className="space-y-4">
                    <div className="bg-emerald-50 border-2 border-emerald-300 rounded-lg p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                          <CheckCircle className="w-7 h-7 text-emerald-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-emerald-900">
                            Check-In Successful
                          </h3>
                          <p className="text-sm text-emerald-700">
                            Patient marked as arrived
                          </p>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="bg-white rounded-lg p-4 border border-emerald-200">
                          <div className="text-xs text-gray-600 mb-1">
                            Patient Name
                          </div>
                          <div className="text-lg font-bold text-gray-900">
                            {verificationResult.patient.name}
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-emerald-200">
                          <div className="text-xs text-gray-600 mb-1">
                            Patient ID
                          </div>
                          <div className="text-lg font-bold text-gray-900">
                            {verificationResult.patient.id}
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-emerald-200">
                          <div className="text-xs text-gray-600 mb-1">
                            Doctor
                          </div>
                          <div className="text-lg font-bold text-gray-900">
                            {verificationResult.appointment.doctor}
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-emerald-200">
                          <div className="text-xs text-gray-600 mb-1">
                            Department
                          </div>
                          <div className="text-lg font-bold text-gray-900">
                            {verificationResult.appointment.department}
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-emerald-200">
                          <div className="text-xs text-gray-600 mb-1">
                            Appointment Time
                          </div>
                          <div className="text-lg font-bold text-gray-900">
                            {verificationResult.appointment.time}
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-emerald-200">
                          <div className="text-xs text-gray-600 mb-1">
                            Arrival Time
                          </div>
                          <div className="text-lg font-bold text-gray-900">
                            {verificationResult.appointment.currentTime}
                          </div>
                        </div>
                      </div>

                      {verificationResult.notificationSent && (
                        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-center gap-2 text-blue-800">
                            <CheckCircle className="w-5 h-5" />
                            <span className="font-medium text-sm">
                              Receptionist and doctor have been notified
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <div className="text-xs text-gray-600 mb-2">
                        Match Confidence
                      </div>
                      <div className="text-3xl font-bold text-gray-800 mb-3">
                        {verificationResult.confidence.toFixed(1)}%
                      </div>
                      <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 transition-all"
                          style={{ width: `${verificationResult.confidence}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )}

              {mode === "appointment" &&
                verificationResult.scenario === "too_early" && (
                  <div className="space-y-4">
                    <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                          <Clock className="w-7 h-7 text-amber-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-amber-900">
                            Too Early to Check In
                          </h3>
                          <p className="text-sm text-amber-700">
                            Please return closer to your appointment time
                          </p>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="bg-white rounded-lg p-4 border border-amber-200">
                          <div className="text-xs text-gray-600 mb-1">
                            Patient Name
                          </div>
                          <div className="text-lg font-bold text-gray-900">
                            {verificationResult.patient.name}
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-amber-200">
                          <div className="text-xs text-gray-600 mb-1">
                            Patient ID
                          </div>
                          <div className="text-lg font-bold text-gray-900">
                            {verificationResult.patient.id}
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-amber-200">
                          <div className="text-xs text-gray-600 mb-1">
                            Appointment Time
                          </div>
                          <div className="text-lg font-bold text-gray-900">
                            {verificationResult.appointment.time}
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-amber-200">
                          <div className="text-xs text-gray-600 mb-1">
                            Current Time
                          </div>
                          <div className="text-lg font-bold text-gray-900">
                            {verificationResult.appointment.currentTime}
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-amber-200">
                          <div className="text-xs text-gray-600 mb-1">
                            Doctor
                          </div>
                          <div className="text-lg font-bold text-gray-900">
                            {verificationResult.appointment.doctor}
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-amber-200">
                          <div className="text-xs text-gray-600 mb-1">
                            Department
                          </div>
                          <div className="text-lg font-bold text-gray-900">
                            {verificationResult.appointment.department}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 bg-white border border-amber-200 rounded-lg p-4">
                        <div className="text-sm text-gray-700">
                          <strong>Check-in window:</strong> Opens 1 hour before
                          your appointment time. Please return after that time.
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              {mode === "appointment" &&
                verificationResult.scenario === "already_arrived" && (
                  <div className="space-y-4">
                    <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <CheckCircle className="w-7 h-7 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-blue-900">
                            Already Checked In
                          </h3>
                          <p className="text-sm text-blue-700">
                            You have already checked in for this appointment
                          </p>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="bg-white rounded-lg p-4 border border-blue-200">
                          <div className="text-xs text-gray-600 mb-1">
                            Patient Name
                          </div>
                          <div className="text-lg font-bold text-gray-900">
                            {verificationResult.patient.name}
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-blue-200">
                          <div className="text-xs text-gray-600 mb-1">
                            Patient ID
                          </div>
                          <div className="text-lg font-bold text-gray-900">
                            {verificationResult.patient.id}
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-blue-200">
                          <div className="text-xs text-gray-600 mb-1">
                            Appointment Time
                          </div>
                          <div className="text-lg font-bold text-gray-900">
                            {verificationResult.appointment.time}
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-blue-200">
                          <div className="text-xs text-gray-600 mb-1">
                            Original Arrival Time
                          </div>
                          <div className="text-lg font-bold text-gray-900">
                            {verificationResult.appointment.arrivalTime}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 bg-white border border-blue-200 rounded-lg p-4">
                        <div className="text-sm text-gray-700">
                          <strong>Status:</strong> Your appointment is already
                          marked as arrived. Please proceed to the waiting area.
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              {mode === "appointment" &&
                verificationResult.scenario === "too_late" && (
                  <div className="space-y-4">
                    <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                          <XCircle className="w-7 h-7 text-red-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-red-900">
                            Appointment Window Passed
                          </h3>
                          <p className="text-sm text-red-700">
                            Status automatically updated to No-Show
                          </p>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="bg-white rounded-lg p-4 border border-red-200">
                          <div className="text-xs text-gray-600 mb-1">
                            Patient Name
                          </div>
                          <div className="text-lg font-bold text-gray-900">
                            {verificationResult.patient.name}
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-red-200">
                          <div className="text-xs text-gray-600 mb-1">
                            Patient ID
                          </div>
                          <div className="text-lg font-bold text-gray-900">
                            {verificationResult.patient.id}
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-red-200">
                          <div className="text-xs text-gray-600 mb-1">
                            Appointment Time
                          </div>
                          <div className="text-lg font-bold text-gray-900">
                            {verificationResult.appointment.time}
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-red-200">
                          <div className="text-xs text-gray-600 mb-1">
                            Current Time
                          </div>
                          <div className="text-lg font-bold text-gray-900">
                            {verificationResult.appointment.currentTime}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 bg-white border border-red-200 rounded-lg p-4">
                        <div className="text-sm text-gray-700 space-y-2">
                          <p>
                            <strong>Appointment missed.</strong> Please contact
                            reception to reschedule.
                          </p>
                          <p className="text-xs text-gray-600">
                            Note: The appointment has been marked as No-Show in
                            the system.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              {mode === "appointment" &&
                verificationResult.scenario === "no_face_data" && (
                  <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                        <AlertCircle className="w-7 h-7 text-gray-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">
                          No Registration Found
                        </h3>
                        <p className="text-sm text-gray-700">
                          Face not found in the system
                        </p>
                      </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <p className="text-sm text-gray-700 mb-3">
                        Your face is not registered in our system. Please
                        proceed to the reception desk for manual check-in.
                      </p>
                      <div className="text-xs text-gray-600">
                        <strong>Note:</strong> Face registration is required for
                        automated check-in.
                      </div>
                    </div>
                  </div>
                )}

              {mode === "medical-record" &&
                verificationResult.scenario === "medical_record_found" && (
                  <div className="space-y-4">
                    <div className="bg-emerald-50 border-2 border-emerald-300 rounded-lg p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                          <User className="w-7 h-7 text-emerald-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-emerald-900">
                            Patient Identified
                          </h3>
                          <p className="text-sm text-emerald-700">
                            Medical records retrieved successfully
                          </p>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4 mb-4">
                        <div className="bg-white rounded-lg p-4 border border-emerald-200">
                          <div className="text-xs text-gray-600 mb-1">
                            Patient Name
                          </div>
                          <div className="text-lg font-bold text-gray-900">
                            {verificationResult.patient.name}
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-emerald-200">
                          <div className="text-xs text-gray-600 mb-1">
                            Patient ID
                          </div>
                          <div className="text-lg font-bold text-gray-900">
                            {verificationResult.patient.id}
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-emerald-200">
                          <div className="text-xs text-gray-600 mb-1">Age</div>
                          <div className="text-lg font-bold text-gray-900">
                            {verificationResult.patient.age} years
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-emerald-200">
                          <div className="text-xs text-gray-600 mb-1">
                            Blood Type
                          </div>
                          <div className="text-lg font-bold text-gray-900">
                            {verificationResult.patient.bloodType}
                          </div>
                        </div>
                      </div>

                      <div className="bg-red-50 border border-red-300 rounded-lg p-4 mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="w-5 h-5 text-red-600" />
                          <h4 className="font-bold text-red-900">ALLERGIES</h4>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {verificationResult.patient.allergies.map(
                            (allergy, idx) => (
                              <span
                                key={idx}
                                className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium"
                              >
                                {allergy}
                              </span>
                            ),
                          )}
                        </div>
                      </div>

                      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
                        <h4 className="font-bold text-gray-900 mb-2">
                          Medical Conditions
                        </h4>
                        <ul className="space-y-1">
                          {verificationResult.patient.conditions.map(
                            (condition, idx) => (
                              <li
                                key={idx}
                                className="text-sm text-gray-700 flex items-start gap-2"
                              >
                                <span className="text-blue-600 mt-1">•</span>
                                <span>{condition}</span>
                              </li>
                            ),
                          )}
                        </ul>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <div className="text-xs text-gray-600 mb-1">
                            Last Visit
                          </div>
                          <div className="text-sm font-semibold text-gray-900">
                            {verificationResult.patient.lastVisit}
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <div className="text-xs text-gray-600 mb-1">
                            Emergency Contact
                          </div>
                          <div className="text-sm font-semibold text-gray-900">
                            {verificationResult.patient.emergencyContact}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <div className="text-xs text-gray-600 mb-2">
                        Match Confidence
                      </div>
                      <div className="text-3xl font-bold text-gray-800 mb-3">
                        {verificationResult.confidence.toFixed(1)}%
                      </div>
                      <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 transition-all"
                          style={{ width: `${verificationResult.confidence}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )}

              {mode === "medical-record" &&
                verificationResult.scenario === "no_medical_record" && (
                  <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                        <AlertCircle className="w-7 h-7 text-gray-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">
                          No Patient Record Found
                        </h3>
                        <p className="text-sm text-gray-700">
                          Face not registered in the system
                        </p>
                      </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <p className="text-sm text-gray-700 mb-3">
                        No medical records found for this patient. This may be a
                        first-time visitor or the face has not been registered
                        yet.
                      </p>
                      <div className="text-xs text-gray-600">
                        <strong>Action required:</strong> Proceed with standard
                        patient registration process.
                      </div>
                    </div>
                  </div>
                )}

              <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={resetDemo}
                  className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition shadow-sm"
                >
                  <RefreshCw className="w-5 h-5" />
                  {mode === "appointment"
                    ? "Check Another Patient"
                    : "Lookup Another Patient"}
                </button>

                <button
                  onClick={resetDemo}
                  className="inline-flex items-center gap-2 bg-gray-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 transition shadow-sm"
                >
                  Change Mode
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            {mode === "appointment" ? (
              <Calendar className="w-7 h-7 text-blue-600" />
            ) : (
              <FileText className="w-7 h-7 text-emerald-600" />
            )}
            <div>
              <h1 className="text-2xl font-semibold text-gray-800">
                {mode === "appointment"
                  ? "Appointment Check-In"
                  : "Emergency Medical Lookup"}
              </h1>
              <p className="text-sm text-gray-600">
                {mode === "appointment"
                  ? "Automated patient arrival verification"
                  : "Quick access to patient medical records"}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Camera className="w-5 h-5 text-gray-600" />
                  <h2 className="text-base font-semibold text-gray-800">
                    Live Camera Capture
                  </h2>
                </div>
              </div>

              <div className="p-5">
                <StatusAlert message={status.message} type={status.type} />

                <div
                  className={`relative mb-5 ${
                    cameraActive ? "block" : "hidden"
                  }`}
                >
                  <div className="relative max-w-lg mx-auto">
                    <div className="relative aspect-square rounded-full overflow-hidden bg-black shadow-lg border-4 border-gray-300">
                      <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                        style={{ transform: "scaleX(-1)" }}
                      />
                      <canvas
                        ref={canvasRef}
                        className="absolute top-0 left-0 w-full h-full pointer-events-none"
                        style={{ transform: "scaleX(-1)", zIndex: 1 }}
                      />
                      <canvas
                        ref={overlayCanvasRef}
                        className="absolute top-0 left-0 w-full h-full pointer-events-none"
                        style={{ transform: "scaleX(-1)", zIndex: 2 }}
                      />

                      {isCountingDown && countdown > 0 && (
                        <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/50">
                          <div className="text-white text-7xl font-bold drop-shadow-lg">
                            {countdown}
                          </div>
                        </div>
                      )}

                      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 max-w-xs w-full px-4">
                        <div className="bg-black/75 text-white px-4 py-2.5 rounded-lg font-medium text-center shadow-lg text-sm">
                          {feedback.message}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {!cameraActive && modelsLoaded && !verificationResult && (
                  <div className="text-center p-10 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="relative w-14 h-14 mx-auto mb-4">
                      <div className="absolute inset-0 rounded-full border-4 border-gray-300"></div>
                      <div className="absolute inset-0 rounded-full border-4 border-t-blue-600 animate-spin"></div>
                    </div>
                    <p className="text-gray-700 font-medium text-sm">
                      Initializing Camera
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      Please grant camera permissions
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {cameraActive && (
              <div className="space-y-4">
                <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-base">👁️</span>
                    </div>
                    <h3 className="text-sm font-semibold text-gray-800">
                      Blink Detection
                    </h3>
                  </div>
                  <ul className="space-y-2 text-xs text-gray-700">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 mt-0.5">•</span>
                      <span>Blink naturally and slowly</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 mt-0.5">•</span>
                      <span>
                        Progress:{" "}
                        <strong className="text-gray-900">
                          {feedback.blinkCount}/2
                        </strong>{" "}
                        blinks
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200">
                    <Loader className="w-4 h-4 text-blue-600" />
                    <h3 className="text-sm font-semibold text-gray-800">
                      Status Indicators
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Face Detected", value: feedback.faceDetected },
                      { label: "Lighting", value: feedback.lighting },
                      { label: "Centered", value: feedback.centered },
                      { label: "Distance", value: feedback.rightSize },
                    ].map((metric, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg text-center border ${
                          metric.value
                            ? "bg-emerald-50 border-emerald-300"
                            : "bg-gray-50 border-gray-300"
                        }`}
                      >
                        <div className="text-xs text-gray-600 mb-1">
                          {metric.label}
                        </div>
                        <div
                          className={`text-sm font-bold ${
                            metric.value ? "text-emerald-700" : "text-gray-400"
                          }`}
                        >
                          {metric.value ? "✓" : "○"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {isCountingDown && (
                  <div className="bg-blue-50 border border-blue-300 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-blue-700 justify-center">
                      <Loader className="w-4 h-4 animate-spin" />
                      <span className="font-medium text-sm">
                        Capturing in {countdown}s
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold text-blue-900 mb-2">
                    Instructions
                  </h3>
                  <ol className="space-y-1.5 text-xs text-blue-800">
                    <li>1. Position face within the circle</li>
                    <li>2. Ensure proper lighting</li>
                    <li>3. Complete 2 blinks</li>
                    <li>4. Hold still during countdown</li>
                    <li>
                      5. System{" "}
                      {mode === "appointment"
                        ? "checks appointment"
                        : "retrieves records"}{" "}
                      automatically
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-center">
          <div className="inline-flex items-center gap-5 bg-white border border-gray-200 px-6 py-2.5 rounded-lg shadow-sm">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  modelsLoaded ? "bg-emerald-500" : "bg-gray-400"
                }`}
              ></div>
              <span className="text-xs font-medium text-gray-700">
                AI System
              </span>
            </div>
            <div className="w-px h-4 bg-gray-300"></div>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  cameraActive ? "bg-emerald-500" : "bg-gray-400"
                }`}
              ></div>
              <span className="text-xs font-medium text-gray-700">Camera</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FaceVerificationSystem;
