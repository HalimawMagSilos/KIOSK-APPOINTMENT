import { createContext, useCallback, useContext } from "react";
import kioskApi from "../services/kioskApi";

const KioskContext = createContext();

const KioskProvider = ({ children }) => {
  const verifyAppointmentArrival = useCallback(async (livePhotoBase64) => {
    try {
      const res = await kioskApi.verifyAppointmentArrival(livePhotoBase64);

      return res.data;
    } catch (error) {
      console.error(
        "Verifiy appointment arrival failed: ",
        error.response?.data?.message || error.message,
      );
      throw error;
    }
  }, []);

  const getMedicalRecords = useCallback(async (livePhotoBase64) => {
    try {
      const res = await kioskApi.getPatientMedicalRecords(livePhotoBase64);

      return res.data;
    } catch (error) {
      console.error(
        "Getting patient medical record failed: ",
        error.response?.data?.message || error.message,
      );
      throw error;
    }
  }, []);

  const value = { verifyAppointmentArrival, getMedicalRecords };

  return (
    <KioskContext.Provider value={value}>{children}</KioskContext.Provider>
  );
};

export const useKiosk = () => {
  const context = useContext(KioskContext);

  if (!context) {
    throw new Error("Kiosk context must be used inside the KioskProvider");
  }

  return context;
};

export default KioskProvider;
