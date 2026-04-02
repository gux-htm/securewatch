import { createRoot } from "react-dom/client";
import { useState } from "react";
import App from "./App";
import { SplashScreen } from "./components/SplashScreen";
import "./index.css";

function Root() {
  const [splashDone, setSplashDone] = useState(false);
  return (
    <>
      {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
      <App />
    </>
  );
}

createRoot(document.getElementById("root")!).render(<Root />);
