import FaceVerificationSystem from "./services/FaceVerification";
import KioskProvider from "./contexts/KisokContext";

const App = () => {
  return (
    <KioskProvider>
      <FaceVerificationSystem />;
    </KioskProvider>
  );
};

export default App;
