import FaceVerificationSystem from "./components/capture/FaceCapture";
import KioskProvider from "./contexts/KisokContext";

const App = () => {
  return (
    <KioskProvider>
      <FaceVerificationSystem />;
    </KioskProvider>
  );
};

export default App;
