import axios from "axios";
import { BASE_URL, INTERNAL_API_KEY } from "../configs/constants/backendData";

class kioskService {
  constructor() {
    this.kioskApi = axios.create({
      baseURL: `${BASE_URL}/api/v1/kiosk`,
      withCredentials: true,
      headers: {
        "x-internal-api-key": INTERNAL_API_KEY,
      },
    });
  }

  async verifyAppointmentArrival(livePhotoBase64) {
    try {
      const res = await this.kioskApi.patch("/verify-arrived-appointment", {
        livePhotoBase64,
      });

      return res.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}

export default new kioskService();
