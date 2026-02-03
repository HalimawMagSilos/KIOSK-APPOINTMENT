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
  Heart,
  Activity,
  Pill,
  Stethoscope,
  Calendar,
  ChevronRight,
  ChevronDown,
  Search,
  Download,
  Printer,
  Phone,
  Mail,
  Droplet,
  Thermometer,
  HeartPulse,
  AlertOctagon,
  Zap,
} from "lucide-react";
import * as faceapi from "face-api.js";
import { useKiosk } from "../../contexts/KisokContext";

function EmergencyMedicalRecordsSystem() {
  const { getMedicalRecords } = useKiosk();

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [countdown, setCountdown] = useState(2);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [status, setStatus] = useState({ message: "", type: "" });
  const [isVerifying, setIsVerifying] = useState(false);
  const [isInCooldown, setIsInCooldown] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [feedback, setFeedback] = useState({
    centered: false,
    rightSize: false,
    lighting: false,
    faceDetected: false,
    message: "Initializing emergency camera...",
    brightness: 0,
  });

  const [activeTab, setActiveTab] = useState("overview");
  const [expandedRecords, setExpandedRecords] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilters, setSelectedFilters] = useState({
    type: "all",
    dateRange: "all",
    status: "all",
  });

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const detectionIntervalRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const cooldownIntervalRef = useRef(null);

  const cameraActiveRef = useRef(false);
  const requirementsMetRef = useRef(false);
  const countdownStartedRef = useRef(false);
  const isCapturingRef = useRef(false);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    const initialize = async () => {
      await loadModels();
    };
    initialize();

    return () => {
      stopCamera();
      if (cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (modelsLoaded && !isInitializedRef.current) {
      isInitializedRef.current = true;
      setTimeout(() => {
        startCamera();
      }, 300);
    }
  }, [modelsLoaded]);

  const loadModels = async () => {
    try {
      setStatus({ message: "Loading emergency AI models...", type: "info" });

      const MODEL_URL = "/models/";

      await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);

      setModelsLoaded(true);
      setStatus({
        message:
          "Emergency system ready! Positioning patient for immediate identification.",
        type: "success",
      });
    } catch (error) {
      setStatus({
        message: "Error loading emergency models. Please restart system.",
        type: "error",
      });
    }
  };

  const startCamera = async () => {
    try {
      setStatus({ message: "Activating emergency camera...", type: "info" });

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
      setCountdown(2);
      setIsCountingDown(false);

      requirementsMetRef.current = false;
      countdownStartedRef.current = false;

      setStatus({
        message:
          "Camera active! Position patient's face for immediate identification.",
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
      }, 500);
    } catch (error) {
      let errorMessage = "Emergency camera access failed. ";
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
    setCountdown(2);
    countdownStartedRef.current = false;
  };

  const startCountdown = () => {
    if (isCountingDown || isCapturingRef.current) return;

    setIsCountingDown(true);
    setCountdown(2);
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
            setCountdown(2);
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
    setCountdown(2);
    requirementsMetRef.current = false;
    countdownStartedRef.current = false;
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
            new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }),
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
        const isGoodLighting = avgBrightness > 40 && avgBrightness < 220;

        let isCentered = false;
        let isRightSize = false;

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

          isCentered = distanceFromCenter < circleRadius * 0.4;
          isRightSize = sizeDiff < targetSize * 0.4;

          const positions = detections.landmarks.positions;
          ctx.fillStyle = "#00ff00";
          positions.forEach((point) => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI);
            ctx.fill();
          });

          overlayCtx.beginPath();
          overlayCtx.arc(centerX, centerY, circleRadius, 0, 2 * Math.PI);

          if (isCentered && isRightSize && isGoodLighting) {
            overlayCtx.strokeStyle = "#10b981";
            overlayCtx.lineWidth = 8;
          } else if (!isGoodLighting) {
            overlayCtx.strokeStyle = "#f59e0b";
            overlayCtx.lineWidth = 6;
          } else if (!isCentered || !isRightSize) {
            overlayCtx.strokeStyle = "#3b82f6";
            overlayCtx.lineWidth = 6;
          } else {
            overlayCtx.strokeStyle = "#ef4444";
            overlayCtx.lineWidth = 6;
          }
          overlayCtx.stroke();

          let message = "";

          if (!isGoodLighting) {
            message =
              avgBrightness <= 40
                ? "💡 Low light - consider emergency lighting"
                : "☀️ Adjust lighting if possible";
          } else if (!isCentered) {
            if (faceCenterX < centerX - circleRadius * 0.3) {
              message = "← Adjust position";
            } else if (faceCenterX > centerX + circleRadius * 0.3) {
              message = "→ Adjust position";
            } else if (faceCenterY < centerY - circleRadius * 0.3) {
              message = "↓ Adjust position";
            } else {
              message = "↑ Adjust position";
            }
          } else if (!isRightSize) {
            message =
              faceSize < targetSize
                ? "🔍 Adjust distance"
                : "🔍 Adjust distance";
          } else {
            message = "✓ Ready for immediate identification";
          }

          setFeedback({
            centered: isCentered,
            rightSize: isRightSize,
            lighting: isGoodLighting,
            faceDetected: true,
            message,
            brightness: Math.round(avgBrightness),
          });

          const allRequirementsMet =
            isCentered && isRightSize && isGoodLighting;

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

          setFeedback({
            centered: false,
            rightSize: false,
            lighting: false,
            faceDetected: false,
            message: "⚠️ Position patient's face in frame",
            brightness: Math.round(avgBrightness),
          });

          requirementsMetRef.current = false;
          resetCountdown();
        }
      } catch (error) {
        // Detection error - continue silently
      }
    }, 150);
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
        message:
          "Identifying patient and retrieving emergency medical records...",
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

      console.log("Emergency: Calling getMedicalRecords");

      const response = await getMedicalRecords(livePhotoBase64);
      console.log("Emergency response received:", response);

      if (response?.success || response?.patient) {
        const patientData = response.patient || {};
        const medicalRecordsData = response.medicalRecords || {};

        // Get data from the new structure
        const appointments = medicalRecordsData.appointments || [];
        const admissions = medicalRecordsData.admissions || [];
        const medicalRecords = medicalRecordsData.medicalRecords || [];
        const timeline = medicalRecordsData.timeline || [];
        const summary = medicalRecordsData.summary || {
          totalRecords: timeline.length,
          totalMedicalRecords: medicalRecords.length,
          totalAppointments: appointments.length,
          totalAdmissions: admissions.length,
        };

        // Format timeline items
        const formattedTimeline = timeline.map((record) => {
          let recordType = "medical_record";
          if (record.type) recordType = record.type;
          else if (record.appointment_id) recordType = "appointment";
          else if (record.admission_id) recordType = "admission";

          return {
            id:
              record.record_id ||
              record.appointment_id ||
              record.admission_id ||
              `record-${Math.random()}`,
            type: recordType,
            date:
              record.date ||
              record.record_date ||
              record.appointment_date ||
              record.admission_date,
            title:
              record.title ||
              record.record_type ||
              (recordType === "appointment"
                ? "Appointment"
                : recordType === "admission"
                  ? "Admission"
                  : "Medical Record"),
            status: record.status || "completed",
            diagnosis:
              record.diagnosis ||
              record.diagnosis_at_admission ||
              record.reason ||
              "",
            doctor: record.doctor?.person
              ? `Dr. ${record.doctor.person.first_name} ${record.doctor.person.last_name}`
              : record.doctor || "Unknown Doctor",
            vitals: record.vitals || null,
            prescriptions: record.prescriptions || [],
            admission_type: record.admission_type,
            admission_status: record.admission_status,
            admission_number: record.admission_number,
            appointment_number: record.appointment_number,
            chiefComplaint:
              record.chief_complaint || record.chiefComplaint || "",
            diagnosis_at_admission: record.diagnosis_at_admission,
            length_of_stay_days: record.length_of_stay_days,
            // Include original record for reference
            originalRecord: record,
          };
        });

        // Extract critical info from patient data or medical records
        const criticalInfo = {
          allergies: patientData.allergies || [],
          conditions: patientData.chronic_conditions || [],
          medications: patientData.current_medications || [],
        };

        setVerificationResult({
          success: true,
          scenario: "medical_record_found",
          confidence: response.confidence || 95.67,
          patient: {
            patientId: patientData.patientId || patientData.patient_id,
            patientNumber:
              patientData.patientNumber || patientData.patient_number,
            fullName:
              patientData.fullName ||
              `${patientData.firstName} ${patientData.lastName}` ||
              "Unknown Patient",
            firstName: patientData.firstName || patientData.first_name,
            lastName: patientData.lastName || patientData.last_name,
            dateOfBirth: patientData.dateOfBirth || patientData.date_of_birth,
            age: patientData.age,
            gender: patientData.gender,
            bloodType:
              patientData.bloodType || patientData.blood_type || "Unknown",
            contactNumber:
              patientData.contactNumber ||
              patientData.contact_number ||
              patientData.phone,
            email: patientData.email,
            emergencyContacts:
              patientData.emergencyContact ||
              patientData.emergency_contacts ||
              [],
            // Include any other patient data
            ...patientData,
          },
          medicalRecords: {
            timeline: formattedTimeline,
            summary: summary,
            criticalInfo: criticalInfo,
            // Include the raw structured data
            admissions: admissions,
            appointments: appointments,
            medicalRecords: medicalRecords,
            // For backward compatibility
            rawData: medicalRecordsData,
          },
          accessTimestamp: new Date().toISOString(),
          liveFaceImage: canvas.toDataURL(),
        });
      } else {
        setVerificationResult({
          success: false,
          scenario: "no_face_data",
          confidence: 0,
          error: true,
          errorMessage: response?.message || "Patient identification failed.",
          patient: null,
          message: response?.message || "Patient identification failed.",
          liveFaceImage: canvas.toDataURL(),
        });

        setStatus({
          message: response?.message || "Patient identification failed.",
          type: "error",
        });
      }

      setIsVerifying(false);
      stopCamera();
    } catch (error) {
      console.error("Emergency capture and verify error:", error);

      const errorData = error.response?.data || error;
      let scenario = "no_face_data";
      let errorMessage =
        error.message ||
        "Emergency identification failed. Please try manual identification.";

      if (errorData?.message) {
        errorMessage = errorData.message;

        if (
          errorMessage.includes("No registered face") ||
          errorMessage.includes("not found")
        ) {
          scenario = "no_face_data";
        } else if (errorMessage.includes("No medical records")) {
          scenario = "no_medical_record";
        }
      }

      setVerificationResult({
        success: false,
        scenario: scenario,
        confidence: errorData?.confidence || 0,
        error: true,
        errorMessage: errorMessage,
        patient: errorData?.patient || null,
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
      }, 1000);
    }
  };

  const resetVerification = () => {
    setVerificationResult(null);
    setStatus({
      message: "Emergency system ready for patient identification",
      type: "info",
    });
    setIsVerifying(false);
    isCapturingRef.current = false;
    setActiveTab("overview");
    setExpandedRecords({});
    setSearchQuery("");
    setSelectedFilters({ type: "all", dateRange: "all", status: "all" });

    setTimeout(() => {
      if (modelsLoaded && !cameraActive) {
        startCamera();
      }
    }, 300);
  };

  const manuallyRestart = () => {
    resetVerification();
  };

  const toggleRecordExpansion = (recordId) => {
    setExpandedRecords((prev) => ({
      ...prev,
      [recordId]: !prev[recordId],
    }));
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

  // UI Components
  const PatientInfoCard = ({ patient }) => (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
      <div className="flex items-start gap-4 mb-6">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
          <User className="w-8 h-8 text-red-600" />
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900">
            {patient.fullName}
          </h2>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
              {patient.gender}
            </span>
            <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
              Age: {patient.age}
            </span>
            <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
              <Droplet className="w-3 h-3 inline mr-1" />{" "}
              {patient.bloodType || "Unknown"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-xs text-gray-600 mb-1">Patient ID</div>
          <div className="text-lg font-semibold text-gray-900">
            {patient.patientUuid}
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-xs text-gray-600 mb-1">MRN</div>
          <div className="text-lg font-semibold text-gray-900">
            {patient.mrn}
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-xs text-gray-600 mb-1">Date of Birth</div>
          <div className="text-lg font-semibold text-gray-900">
            {patient.dateOfBirth}
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-xs text-gray-600 mb-1">Contact</div>
          <div className="text-lg font-semibold text-gray-900">
            {patient?.contactNumber || "No contact"}
          </div>
        </div>
      </div>
    </div>
  );

  const QuickStats = ({ summary }) => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <FileText className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {summary?.totalRecords || 0}
            </div>
            <div className="text-sm text-gray-600">Total Records</div>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <Stethoscope className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {summary?.totalAppointments || 0}
            </div>
            <div className="text-sm text-gray-600">Appointments</div>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <Heart className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {summary?.totalAdmissions || 0}
            </div>
            <div className="text-sm text-gray-600">Admissions</div>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {summary?.totalMedicalRecords || 0}
            </div>
            <div className="text-sm text-gray-600">Medical Records</div>
          </div>
        </div>
      </div>
    </div>
  );

  const CriticalInfoPanel = ({ criticalInfo }) => {
    if (
      !criticalInfo ||
      (!criticalInfo.allergies?.length &&
        !criticalInfo.conditions?.length &&
        !criticalInfo.medications?.length)
    ) {
      return (
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6">
          <h3 className="text-xl font-bold text-yellow-900 mb-4 flex items-center gap-3">
            <AlertTriangle className="w-6 h-6" />
            NO CRITICAL INFORMATION FOUND
          </h3>
          <p className="text-yellow-700">
            No critical medical information found in patient's records.
          </p>
        </div>
      );
    }

    return (
      <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6">
        <h3 className="text-xl font-bold text-red-900 mb-4 flex items-center gap-3">
          <AlertOctagon className="w-6 h-6" />
          CRITICAL EMERGENCY INFORMATION
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {criticalInfo.allergies && criticalInfo.allergies.length > 0 && (
            <div>
              <h4 className="font-semibold text-red-800 mb-3">⚠️ ALLERGIES</h4>
              <div className="space-y-2">
                {criticalInfo.allergies.map((allergy, index) => (
                  <div
                    key={index}
                    className="bg-red-100 border border-red-300 rounded p-3"
                  >
                    <div className="font-bold text-red-900">
                      {allergy.name || allergy}
                    </div>
                    {allergy.reaction && (
                      <div className="text-sm text-red-700">
                        {allergy.reaction}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {criticalInfo.conditions && criticalInfo.conditions.length > 0 && (
            <div>
              <h4 className="font-semibold text-red-800 mb-3">
                ⚠️ CHRONIC CONDITIONS
              </h4>
              <div className="space-y-3">
                {criticalInfo.conditions.map((condition, index) => (
                  <div
                    key={index}
                    className="bg-white border border-red-200 rounded p-3"
                  >
                    <div className="font-bold text-gray-900">
                      {condition.name || condition}
                    </div>
                    {condition.diagnosed_date && (
                      <div className="text-sm text-gray-600">
                        Diagnosed: {condition.diagnosed_date}
                      </div>
                    )}
                    {condition.current_medication && (
                      <div className="text-sm text-gray-600">
                        Medication: {condition.current_medication}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {criticalInfo.medications && criticalInfo.medications.length > 0 && (
          <div className="mt-6">
            <h4 className="font-semibold text-red-800 mb-3">
              ⚠️ CURRENT MEDICATIONS
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {criticalInfo.medications.map((med, index) => (
                <div
                  key={index}
                  className="bg-blue-50 border border-blue-200 rounded-lg p-4"
                >
                  <div className="font-bold text-blue-900">
                    {med.name || med}
                  </div>
                  {med.dosage && (
                    <div className="text-sm text-blue-700">{med.dosage}</div>
                  )}
                  {med.for && (
                    <div className="text-xs text-blue-600 mt-1">{med.for}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const EmergencyProtocolPanel = ({ patient, criticalInfo }) => {
    // Get emergency contacts from patient data
    const emergencyContacts = patient?.emergencyContacts || [];
    const primaryContact = emergencyContacts?.find(
      (contact) => contact.is_primary,
    );
    const emergencyContact = emergencyContacts?.find(
      (contact) => contact.contact_type === "emergency",
    );

    return (
      <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6">
        <h3 className="text-xl font-bold text-red-900 mb-4 flex items-center gap-3">
          <AlertOctagon className="w-6 h-6" />
          EMERGENCY PROTOCOL
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-red-800 mb-3">
              🆘 EMERGENCY CONTACTS
            </h4>
            <div className="space-y-3">
              {primaryContact && (
                <div className="bg-white p-4 rounded-lg border border-red-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-gray-900">
                        {primaryContact.contact_name || "Primary Contact"}
                        <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                          PRIMARY
                        </span>
                      </div>
                      <div className="text-gray-600 mt-1">
                        {primaryContact.contact_number}
                      </div>
                      {primaryContact.relationship && (
                        <div className="text-sm text-gray-500 mt-1">
                          Relationship: {primaryContact.relationship}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {emergencyContact && (
                <div className="bg-white p-4 rounded-lg border border-red-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-gray-900">
                        {emergencyContact.contact_name || "Emergency Contact"}
                        <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">
                          EMERGENCY
                        </span>
                      </div>
                      <div className="text-gray-600 mt-1">
                        {emergencyContact.contact_number}
                      </div>
                      {emergencyContact.relationship && (
                        <div className="text-sm text-gray-500 mt-1">
                          Relationship: {emergencyContact.relationship}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {!primaryContact && !emergencyContact && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="text-yellow-800 text-center">
                    <AlertTriangle className="w-6 h-6 mx-auto mb-2" />
                    <p>No emergency contacts found in patient records</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-red-800 mb-3">
              ⚠️ EMERGENCY INSTRUCTIONS
            </h4>
            <div className="bg-white p-4 rounded-lg border border-red-200 space-y-4">
              {criticalInfo?.allergies && criticalInfo.allergies.length > 0 && (
                <div>
                  <div className="font-bold text-red-900 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    CRITICAL ALLERGIES
                  </div>
                  <div className="mt-2 space-y-2">
                    {criticalInfo.allergies.slice(0, 3).map((allergy, idx) => (
                      <div key={idx} className="text-sm">
                        <span className="font-medium">
                          • {allergy.name || allergy}
                        </span>
                        {allergy.reaction && (
                          <span className="text-red-700 ml-2">
                            ({allergy.reaction})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {criticalInfo?.conditions &&
                criticalInfo.conditions.length > 0 && (
                  <div>
                    <div className="font-bold text-red-900 flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      CHRONIC CONDITIONS
                    </div>
                    <div className="mt-2 space-y-2">
                      {criticalInfo.conditions
                        .slice(0, 3)
                        .map((condition, idx) => (
                          <div key={idx} className="text-sm">
                            <span className="font-medium">
                              • {condition.name || condition}
                            </span>
                            {condition.current_medication && (
                              <span className="text-blue-700 ml-2">
                                Med: {condition.current_medication}
                              </span>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}

              {criticalInfo?.medications &&
                criticalInfo.medications.length > 0 && (
                  <div>
                    <div className="font-bold text-red-900 flex items-center gap-2">
                      <Pill className="w-4 h-4" />
                      CURRENT MEDICATIONS
                    </div>
                    <div className="mt-2 space-y-2">
                      {criticalInfo.medications.slice(0, 3).map((med, idx) => (
                        <div key={idx} className="text-sm">
                          <span className="font-medium">
                            • {med.name || med}
                          </span>
                          {med.dosage && (
                            <span className="text-gray-600 ml-2">
                              {med.dosage}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {!criticalInfo?.allergies?.length &&
                !criticalInfo?.conditions?.length &&
                !criticalInfo?.medications?.length && (
                  <div className="text-yellow-700 text-sm">
                    No critical medical information available in patient records
                  </div>
                )}

              <div className="pt-4 border-t border-gray-200">
                <div className="font-bold text-red-900">
                  PATIENT INFORMATION
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                  <div>
                    <span className="text-gray-600">Name:</span>
                    <span className="font-medium ml-2">
                      {patient?.fullName}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Age:</span>
                    <span className="font-medium ml-2">{patient?.age}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Blood Type:</span>
                    <span className="font-medium ml-2">
                      {patient?.bloodType || "Unknown"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">MRN:</span>
                    <span className="font-medium ml-2">{patient?.mrn}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const RecordIcon = ({ type }) => {
    const iconConfig = {
      admission: { icon: Heart, bg: "bg-red-100", color: "text-red-600" },
      appointment: {
        icon: Calendar,
        bg: "bg-blue-100",
        color: "text-blue-600",
      },
      medical_record: {
        icon: FileText,
        bg: "bg-green-100",
        color: "text-green-600",
      },
    };

    const config = iconConfig[type] || {
      icon: FileText,
      bg: "bg-gray-100",
      color: "text-gray-600",
    };
    const Icon = config.icon;

    return (
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center ${config.bg}`}
      >
        <Icon className={`w-5 h-5 ${config.color}`} />
      </div>
    );
  };

  const StatusBadge = ({ status }) => {
    const statusConfig = {
      completed: {
        bg: "bg-green-100",
        text: "text-green-800",
        label: "Completed",
      },
      discharged: {
        bg: "bg-blue-100",
        text: "text-blue-800",
        label: "Discharged",
      },
      active: { bg: "bg-yellow-100", text: "text-yellow-800", label: "Active" },
      scheduled: {
        bg: "bg-purple-100",
        text: "text-purple-800",
        label: "Scheduled",
      },
      cancelled: { bg: "bg-red-100", text: "text-red-800", label: "Cancelled" },
    };

    const config = statusConfig[status?.toLowerCase()] || {
      bg: "bg-gray-100",
      text: "text-gray-800",
      label: status,
    };

    return (
      <span
        className={`px-2 py-1 text-xs rounded-full ${config.bg} ${config.text}`}
      >
        {config.label}
      </span>
    );
  };

  const AdmissionTypeBadge = ({ type }) => (
    <span className="px-2 py-1 text-xs rounded-full bg-indigo-100 text-indigo-800">
      {type}
    </span>
  );

  const RecordDetails = ({ record }) => {
    // Get original record for detailed information
    const originalRecord = record.originalRecord || {};

    return (
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Vitals Section */}
          {(record.vitals || originalRecord.vitals) && (
            <div className="bg-white p-4 rounded border">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4" /> Vitals
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(
                  record.vitals || originalRecord.vitals || {},
                ).map(([key, value]) => (
                  <div key={key} className="text-left">
                    <div className="text-xs text-gray-500 capitalize">
                      {key.replace(/_/g, " ")}
                    </div>
                    <div className="font-semibold">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Additional Information */}
          <div className="space-y-4">
            {/* Prescriptions */}
            {(record.prescriptions?.length > 0 ||
              originalRecord.prescriptions?.length > 0) && (
              <div className="bg-white p-4 rounded border">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Pill className="w-4 h-4" /> Prescriptions
                </h4>
                <div className="space-y-2">
                  {(
                    record.prescriptions ||
                    originalRecord.prescriptions ||
                    []
                  ).map((prescription, idx) => (
                    <div
                      key={idx}
                      className="text-sm border-l-2 border-blue-500 pl-2"
                    >
                      <div className="font-medium">
                        {prescription.name || "Unnamed medication"}
                      </div>
                      <div className="text-gray-600">
                        {prescription.dosage || "No dosage specified"}
                      </div>
                      {prescription.notes && (
                        <div className="text-gray-500 text-xs mt-1">
                          {prescription.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Admission Details */}
            {record.admission_id && (
              <div className="bg-white p-4 rounded border">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Heart className="w-4 h-4" /> Admission Details
                </h4>
                <div className="space-y-1 text-sm">
                  {record.admission_number && (
                    <div>
                      <span className="text-gray-600">Admission #:</span>
                      <span className="font-medium ml-2">
                        {record.admission_number}
                      </span>
                    </div>
                  )}
                  {record.diagnosis_at_admission && (
                    <div>
                      <span className="text-gray-600">Diagnosis:</span>
                      <span className="font-medium ml-2">
                        {record.diagnosis_at_admission}
                      </span>
                    </div>
                  )}
                  {record.length_of_stay_days && (
                    <div>
                      <span className="text-gray-600">Length of Stay:</span>
                      <span className="font-medium ml-2">
                        {record.length_of_stay_days} days
                      </span>
                    </div>
                  )}
                  {originalRecord.admission_source && (
                    <div>
                      <span className="text-gray-600">Source:</span>
                      <span className="font-medium ml-2">
                        {originalRecord.admission_source}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Appointment Details */}
            {record.type === "appointment" && (
              <div className="bg-white p-4 rounded border">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Appointment Details
                </h4>
                <div className="space-y-1 text-sm">
                  {record.appointment_number && (
                    <div>
                      <span className="text-gray-600">Appointment #:</span>
                      <span className="font-medium ml-2">
                        {record.appointment_number}
                      </span>
                    </div>
                  )}
                  {originalRecord.appointment_type && (
                    <div>
                      <span className="text-gray-600">Type:</span>
                      <span className="font-medium ml-2">
                        {originalRecord.appointment_type}
                      </span>
                    </div>
                  )}
                  {originalRecord.reason && (
                    <div>
                      <span className="text-gray-600">Reason:</span>
                      <span className="font-medium ml-2">
                        {originalRecord.reason}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const TimelineRecord = ({
    record,
    expandedRecords,
    toggleRecordExpansion,
  }) => (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      <button
        onClick={() => toggleRecordExpansion(record.id)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition"
      >
        <div className="flex items-start gap-3 flex-1">
          <RecordIcon type={record.type} />
          <div className="text-left flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="font-semibold text-gray-900">{record.title}</h3>
              {record.status && <StatusBadge status={record.status} />}
              {record.admission_type && (
                <AdmissionTypeBadge type={record.admission_type} />
              )}
            </div>
            {record.diagnosis && (
              <p className="text-sm text-gray-600">
                Diagnosis: {record.diagnosis}
              </p>
            )}
            {record.chiefComplaint && (
              <p className="text-sm text-gray-600 mt-1">
                Complaint: {record.chiefComplaint}
              </p>
            )}
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 flex-wrap">
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {record.doctor || "Unknown Doctor"}
              </span>
              {record.admission_number && (
                <span className="flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  {record.admission_number}
                </span>
              )}
              {record.appointment_number && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {record.appointment_number}
                </span>
              )}
            </div>
          </div>
        </div>
        {expandedRecords[record.id] ? (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {expandedRecords[record.id] && <RecordDetails record={record} />}
    </div>
  );

  const MedicalTimeline = ({ timeline }) => {
    const typeOptions = [
      { value: "all", label: "All Types" },
      { value: "appointment", label: "Appointments" },
      { value: "admission", label: "Admissions" },
      { value: "medical_record", label: "Medical Records" },
    ];

    const dateRangeOptions = [
      { value: "all", label: "All Time" },
      { value: "today", label: "Today" },
      { value: "week", label: "Last 7 Days" },
      { value: "month", label: "Last 30 Days" },
      { value: "year", label: "Last Year" },
    ];

    const statusOptions = [
      { value: "all", label: "All Status" },
      { value: "completed", label: "Completed" },
      { value: "discharged", label: "Discharged" },
      { value: "active", label: "Active" },
      { value: "scheduled", label: "Scheduled" },
      { value: "cancelled", label: "Cancelled" },
    ];

    const filteredTimeline = timeline.filter((record) => {
      const matchesSearch =
        !searchQuery ||
        record.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.diagnosis?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.doctor?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.chiefComplaint
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase());

      const matchesType =
        selectedFilters.type === "all" || record.type === selectedFilters.type;

      const matchesStatus =
        selectedFilters.status === "all" ||
        record.status === selectedFilters.status;

      const matchesDateRange = () => {
        if (selectedFilters.dateRange === "all") return true;

        const recordDate = new Date(record.date);
        const now = new Date();

        switch (selectedFilters.dateRange) {
          case "today":
            return recordDate.toDateString() === now.toDateString();
          case "week":
            const weekAgo = new Date(now);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return recordDate >= weekAgo;
          case "month":
            const monthAgo = new Date(now);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            return recordDate >= monthAgo;
          case "year":
            const yearAgo = new Date(now);
            yearAgo.setFullYear(yearAgo.getFullYear() - 1);
            return recordDate >= yearAgo;
          default:
            return true;
        }
      };

      return (
        matchesSearch && matchesType && matchesStatus && matchesDateRange()
      );
    });

    const groupedByDate = {};
    filteredTimeline.forEach((record) => {
      const date = new Date(record.date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      if (!groupedByDate[date]) {
        groupedByDate[date] = [];
      }
      groupedByDate[date].push(record);
    });

    const dates = Object.keys(groupedByDate).sort(
      (a, b) => new Date(b) - new Date(a),
    );

    return (
      <div className="space-y-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search records by diagnosis, doctor, complaint..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 focus:outline-none"
                autoFocus={false}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Record Type
                </label>
                <select
                  value={selectedFilters.type}
                  onChange={(e) =>
                    setSelectedFilters({
                      ...selectedFilters,
                      type: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {typeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date Range
                </label>
                <select
                  value={selectedFilters.dateRange}
                  onChange={(e) =>
                    setSelectedFilters({
                      ...selectedFilters,
                      dateRange: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {dateRangeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={selectedFilters.status}
                  onChange={(e) =>
                    setSelectedFilters({
                      ...selectedFilters,
                      status: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {(selectedFilters.type !== "all" ||
              selectedFilters.dateRange !== "all" ||
              selectedFilters.status !== "all") && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-600">Active filters:</span>
                {selectedFilters.type !== "all" && (
                  <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                    {
                      typeOptions.find(
                        (opt) => opt.value === selectedFilters.type,
                      )?.label
                    }
                    <button
                      onClick={() =>
                        setSelectedFilters({ ...selectedFilters, type: "all" })
                      }
                      className="text-blue-600 hover:text-blue-800"
                    >
                      ✕
                    </button>
                  </span>
                )}
                {selectedFilters.dateRange !== "all" && (
                  <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                    {
                      dateRangeOptions.find(
                        (opt) => opt.value === selectedFilters.dateRange,
                      )?.label
                    }
                    <button
                      onClick={() =>
                        setSelectedFilters({
                          ...selectedFilters,
                          dateRange: "all",
                        })
                      }
                      className="text-green-600 hover:text-green-800"
                    >
                      ✕
                    </button>
                  </span>
                )}
                {selectedFilters.status !== "all" && (
                  <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs">
                    {
                      statusOptions.find(
                        (opt) => opt.value === selectedFilters.status,
                      )?.label
                    }
                    <button
                      onClick={() =>
                        setSelectedFilters({
                          ...selectedFilters,
                          status: "all",
                        })
                      }
                      className="text-purple-600 hover:text-purple-800"
                    >
                      ✕
                    </button>
                  </span>
                )}
                <button
                  onClick={() =>
                    setSelectedFilters({
                      type: "all",
                      dateRange: "all",
                      status: "all",
                    })
                  }
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Clear all filters
                </button>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {filteredTimeline.length} of {timeline.length} records
              </div>
              <div className="text-sm">
                <span className="font-medium">{filteredTimeline.length}</span>{" "}
                results found
              </div>
            </div>
          </div>
        </div>

        {dates.length > 0 ? (
          <div className="space-y-6">
            {dates.map((date) => (
              <div key={date} className="space-y-3">
                <h3 className="text-lg font-bold text-gray-900 border-b pb-2">
                  {date}
                </h3>
                <div className="space-y-3">
                  {groupedByDate[date].map((record) => (
                    <TimelineRecord
                      key={record.id}
                      record={record}
                      expandedRecords={expandedRecords}
                      toggleRecordExpansion={toggleRecordExpansion}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No records found
            </h3>
            <p className="text-gray-600">
              {searchQuery ||
              selectedFilters.type !== "all" ||
              selectedFilters.dateRange !== "all" ||
              selectedFilters.status !== "all"
                ? "Try adjusting your search or filters"
                : "No medical records available for this patient"}
            </p>
            {(searchQuery ||
              selectedFilters.type !== "all" ||
              selectedFilters.dateRange !== "all" ||
              selectedFilters.status !== "all") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedFilters({
                    type: "all",
                    dateRange: "all",
                    status: "all",
                  });
                }}
                className="mt-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Clear all filters and search
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  if (!modelsLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl p-10 text-center max-w-md w-full border border-gray-200">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-gray-300"></div>
            <div className="absolute inset-0 rounded-full border-4 border-t-red-600 animate-spin"></div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            LOADING EMERGENCY SYSTEM
          </h2>
          <p className="text-gray-600 mb-4">
            Initializing facial recognition for emergency identification
          </p>
          <div className="text-sm text-red-600 font-medium">
            ⚠️ This system is for emergency use only
          </div>
        </div>
      </div>
    );
  }

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl p-10 text-center max-w-lg w-full border border-gray-200">
          <div className="w-24 h-24 mx-auto mb-8 text-red-600">
            <Zap className="w-full h-full animate-pulse" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            EMERGENCY IDENTIFICATION IN PROGRESS
          </h2>
          <p className="text-gray-600 mb-8">
            Retrieving critical medical information for emergency response...
          </p>
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Face Detection & Matching
                </span>
                <span className="text-xs font-semibold text-red-600">
                  PROCESSING
                </span>
              </div>
              <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-red-500 to-orange-500 rounded-full w-4/5 animate-pulse"></div>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Medical Records Access
                </span>
                <span className="text-xs font-semibold text-red-600">
                  RETRIEVING
                </span>
              </div>
              <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full w-3/4 animate-pulse"></div>
              </div>
            </div>
          </div>
          <div className="mt-8 text-sm text-red-600 font-medium bg-red-50 p-3 rounded-lg">
            ⚡ Emergency mode: Bypassing normal security protocols for immediate
            access
          </div>
        </div>
      </div>
    );
  }

  if (verificationResult && verificationResult.success) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-xl shadow-xl p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                    <Heart className="w-7 h-7" />
                  </div>
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold">
                      EMERGENCY MEDICAL RECORDS ACCESSED
                    </h1>
                    <p className="text-white/90">
                      Critical patient information retrieved successfully
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    <div>
                      <div className="text-sm">Confidence</div>
                      <div className="text-2xl font-bold">
                        {verificationResult.confidence.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={manuallyRestart}
                  className="bg-white text-red-600 px-6 py-3 rounded-lg hover:bg-gray-100 transition font-bold flex items-center gap-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  NEW PATIENT
                </button>
              </div>
            </div>
          </div>

          <CriticalInfoPanel
            criticalInfo={verificationResult.medicalRecords.criticalInfo}
          />

          <PatientInfoCard patient={verificationResult.patient} />

          <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
            <div className="border-b border-gray-200">
              <nav className="flex flex-wrap -mb-px">
                <button
                  onClick={() => setActiveTab("overview")}
                  className={`px-6 py-4 font-bold text-sm border-b-2 whitespace-nowrap ${
                    activeTab === "overview"
                      ? "border-red-600 text-red-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Overview
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab("timeline")}
                  className={`px-6 py-4 font-bold text-sm border-b-2 whitespace-nowrap ${
                    activeTab === "timeline"
                      ? "border-red-600 text-red-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Medical Timeline
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab("emergency")}
                  className={`px-6 py-4 font-bold text-sm border-b-2 whitespace-nowrap ${
                    activeTab === "emergency"
                      ? "border-red-600 text-red-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <AlertOctagon className="w-4 h-4" />
                    Emergency Protocol
                  </span>
                </button>
              </nav>
            </div>

            <div className="p-6">
              {activeTab === "overview" && (
                <div className="space-y-6">
                  <QuickStats
                    summary={verificationResult.medicalRecords.summary}
                  />

                  <div className="bg-white border border-blue-300 rounded-lg p-6">
                    <h3 className="text-lg font-bold text-blue-900 mb-4">
                      Current Medications
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {verificationResult.medicalRecords.criticalInfo
                        ?.medications?.length > 0 ? (
                        verificationResult.medicalRecords.criticalInfo.medications.map(
                          (med, idx) => (
                            <div
                              key={idx}
                              className="bg-blue-50 border border-blue-200 rounded-lg p-4"
                            >
                              <div className="font-bold text-blue-900">
                                {med.name || med}
                              </div>
                              {med.dosage && (
                                <div className="text-sm text-blue-700">
                                  {med.dosage}
                                </div>
                              )}
                              {med.for && (
                                <div className="text-xs text-blue-600 mt-1">
                                  {med.for}
                                </div>
                              )}
                            </div>
                          ),
                        )
                      ) : (
                        <div className="col-span-3 text-center py-4 text-gray-500">
                          No current medications found in records
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "timeline" && (
                <MedicalTimeline
                  timeline={verificationResult.medicalRecords.timeline}
                />
              )}

              {activeTab === "emergency" && (
                <EmergencyProtocolPanel
                  patient={verificationResult.patient}
                  criticalInfo={verificationResult.medicalRecords.criticalInfo}
                />
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-sm text-gray-600">
                <span className="font-bold">Emergency Access:</span>{" "}
                {new Date(verificationResult.accessTimestamp).toLocaleString()}
              </div>
              <div className="flex items-center gap-4">
                <button className="text-sm text-gray-600 hover:text-gray-900">
                  Privacy Notice
                </button>
                <button className="text-sm text-red-600 hover:text-red-700 font-bold">
                  🚨 REPORT EMERGENCY
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (verificationResult && !verificationResult.success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white p-8 text-center">
              <XCircle className="w-16 h-16 mx-auto mb-4" />
              <h1 className="text-2xl font-bold">PATIENT NOT IDENTIFIED</h1>
              <p className="text-white/90 mt-2">
                Emergency identification failed
              </p>
            </div>

            <div className="p-8">
              <div className="text-center mb-8">
                <div className="w-24 h-24 mx-auto mb-6 text-gray-400">
                  <User className="w-full h-full" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  NO MEDICAL RECORDS FOUND
                </h3>
                <p className="text-gray-600 mb-6">
                  Patient's face not registered in emergency database
                </p>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
                <h4 className="font-bold text-red-900 mb-4">
                  IMMEDIATE ACTIONS REQUIRED:
                </h4>
                <ul className="space-y-3 text-sm text-red-800">
                  <li className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <span>Proceed with MANUAL patient identification</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <span>
                      Check for identification documents or medical alert
                      jewelry
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <span>Contact hospital administration immediately</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-4">
                <button
                  onClick={manuallyRestart}
                  className="w-full bg-red-600 text-white px-6 py-4 rounded-lg hover:bg-red-700 transition font-bold flex items-center justify-center gap-3"
                >
                  <RefreshCw className="w-5 h-5" />
                  TRY IDENTIFICATION AGAIN
                </button>
                <button className="w-full bg-gray-800 text-white px-6 py-4 rounded-lg hover:bg-gray-900 transition font-bold">
                  PROCEED WITH MANUAL ENTRY
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 py-6 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-xl p-6 shadow-xl">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <Zap className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">
                  EMERGENCY PATIENT IDENTIFICATION
                </h1>
                <p className="text-white/90">
                  For unresponsive patients in emergency situations
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
                ⚡ IMMEDIATE ACCESS
              </span>
              <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
                ⚠️ NO BLINK REQUIRED
              </span>
              <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
                🚨 EMERGENCY MODE
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
              <div className="bg-red-600 text-white px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Camera className="w-6 h-6" />
                    <h2 className="text-lg font-bold">
                      EMERGENCY FACIAL IDENTIFICATION
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full ${cameraActive ? "bg-green-400 animate-pulse" : "bg-red-400"}`}
                    ></div>
                    <span className="text-sm font-medium">
                      {cameraActive ? "LIVE" : "OFFLINE"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <StatusAlert message={status.message} type={status.type} />

                <div
                  className={`relative ${cameraActive ? "block" : "hidden"}`}
                >
                  <div className="relative max-w-xl mx-auto">
                    <div className="relative aspect-square rounded-2xl overflow-hidden bg-black shadow-2xl border-4 border-red-500">
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
                        <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/80">
                          <div className="text-white text-8xl font-bold drop-shadow-2xl animate-pulse">
                            {countdown}
                          </div>
                          <div className="absolute bottom-10 text-white text-lg font-medium">
                            EMERGENCY IDENTIFICATION
                          </div>
                        </div>
                      )}

                      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20 w-full max-w-md px-4">
                        <div className="bg-black/90 backdrop-blur-md text-white px-5 py-4 rounded-xl font-bold text-center shadow-2xl text-base border-2 border-white/30">
                          {feedback.message}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {!cameraActive && (
                  <div className="text-center p-12 bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-dashed border-gray-400 rounded-2xl">
                    <div className="w-24 h-24 mx-auto mb-6 text-gray-500">
                      <Camera className="w-full h-full" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-700 mb-3">
                      EMERGENCY CAMERA INITIALIZING
                    </h3>
                    <p className="text-gray-500">
                      Preparing immediate identification system...
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertOctagon className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">
                  EMERGENCY PROCEDURE
                </h3>
              </div>

              <div className="space-y-4">
                <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-lg p-5">
                  <ol className="space-y-4 text-gray-800">
                    <li className="flex items-start gap-4">
                      <div className="w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                        1
                      </div>
                      <div>
                        <div className="font-bold text-red-900">
                          POSITION PATIENT
                        </div>
                        <div className="text-sm mt-1">
                          Position patient's face within the emergency frame
                        </div>
                      </div>
                    </li>
                    <li className="flex items-start gap-4">
                      <div className="w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                        2
                      </div>
                      <div>
                        <div className="font-bold text-red-900">
                          ENSURE VISIBILITY
                        </div>
                        <div className="text-sm mt-1">
                          Adjust emergency lighting if needed
                        </div>
                      </div>
                    </li>
                    <li className="flex items-start gap-4">
                      <div className="w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                        3
                      </div>
                      <div>
                        <div className="font-bold text-red-900">
                          HOLD POSITION
                        </div>
                        <div className="text-sm mt-1">
                          Keep patient still for immediate identification
                        </div>
                      </div>
                    </li>
                    <li className="flex items-start gap-4">
                      <div className="w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                        4
                      </div>
                      <div>
                        <div className="font-bold text-red-900">
                          IMMEDIATE ACCESS
                        </div>
                        <div className="text-sm mt-1">
                          Medical records retrieved automatically
                        </div>
                      </div>
                    </li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6">
                EMERGENCY STATUS
              </h3>

              <div className="grid grid-cols-2 gap-4">
                {[
                  {
                    label: "FACE DETECTED",
                    value: feedback.faceDetected,
                    icon: "👤",
                    critical: true,
                  },
                  { label: "LIGHTING", value: feedback.lighting, icon: "💡" },
                  {
                    label: "POSITION",
                    value: feedback.centered,
                    icon: "🎯",
                    critical: true,
                  },
                  { label: "DISTANCE", value: feedback.rightSize, icon: "📏" },
                  {
                    label: "SYSTEM READY",
                    value: feedback.faceDetected && feedback.lighting,
                    icon: "✅",
                    critical: true,
                  },
                  { label: "COUNTDOWN", value: isCountingDown, icon: "⏱️" },
                ].map((metric, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-xl text-center transition-all border-2 ${
                      metric.value
                        ? metric.critical
                          ? "bg-gradient-to-br from-green-50 to-emerald-50 border-emerald-400"
                          : "bg-gradient-to-br from-blue-50 to-sky-50 border-blue-300"
                        : metric.critical
                          ? "bg-gradient-to-br from-red-50 to-orange-50 border-red-300"
                          : "bg-gradient-to-br from-gray-50 to-gray-100 border-gray-300"
                    }`}
                  >
                    <div className="text-2xl mb-2">{metric.icon}</div>
                    <div className="text-xs font-bold text-gray-700 mb-1">
                      {metric.label}
                    </div>
                    <div
                      className={`text-sm font-bold ${
                        metric.value
                          ? metric.critical
                            ? "text-emerald-700"
                            : "text-blue-700"
                          : metric.critical
                            ? "text-red-700"
                            : "text-gray-500"
                      }`}
                    >
                      {metric.value
                        ? metric.critical
                          ? "✓ READY"
                          : "✓ OK"
                        : metric.critical
                          ? "✗ NEEDED"
                          : "✗ PENDING"}
                    </div>
                  </div>
                ))}
              </div>

              {isCountingDown && (
                <div className="mt-6 bg-gradient-to-r from-red-600 to-orange-600 text-white p-5 rounded-xl animate-pulse shadow-lg">
                  <div className="flex items-center gap-4 justify-center">
                    <Zap className="w-6 h-6" />
                    <span className="text-xl font-bold">
                      EMERGENCY IDENTIFICATION IN {countdown}S
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-xl shadow-xl p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-3">
                <AlertTriangle className="w-6 h-6" />
                IMMEDIATE ACTIONS
              </h3>
              <div className="space-y-3">
                <button
                  onClick={manuallyRestart}
                  className="w-full bg-white/20 text-white border-2 border-white/30 px-5 py-3 rounded-lg hover:bg-white/30 transition flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  RESTART IDENTIFICATION
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10">
          <div className="bg-white/80 backdrop-blur-sm border border-gray-300 rounded-full px-8 py-4 shadow-lg">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="font-bold text-gray-700">
                    AI SYSTEM: ACTIVE
                  </span>
                </div>
                <div className="hidden md:block text-gray-400">|</div>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${cameraActive ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`}
                  ></div>
                  <span className="font-bold text-gray-700">
                    CAMERA: {cameraActive ? "LIVE" : "OFFLINE"}
                  </span>
                </div>
                <div className="hidden md:block text-gray-400">|</div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                  <span className="font-bold text-gray-700">
                    EMERGENCY MODE: ACTIVE
                  </span>
                </div>
              </div>
              <div className="text-sm text-gray-600 italic">
                ⚠️ FOR EMERGENCY USE ONLY • ⚡ NO BLINK REQUIRED • 🚨 IMMEDIATE
                ACCESS
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmergencyMedicalRecordsSystem;
