import { useEffect } from "react";
import WebApp from "../../web/src/app/App";
import "./desktop.css";

function DesktopApp() {
  useEffect(() => {
    document.body.classList.add("tauri-desktop");
    return () => {
      document.body.classList.remove("tauri-desktop");
    };
  }, []);

  return (
    <>
      <header className="desktop-titlebar" data-tauri-drag-region>
        <strong data-tauri-drag-region>Secret Management Dashboard</strong>
        <span data-tauri-drag-region>Desktop modu</span>
      </header>
      <WebApp />
    </>
  );
}

export default DesktopApp;
