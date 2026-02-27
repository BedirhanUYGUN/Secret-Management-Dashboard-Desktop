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
        <div className="desktop-titlebar-brand" data-tauri-drag-region>
          <img className="desktop-titlebar-logo" src="/siriki-logo.svg" alt="" aria-hidden="true" />
          <strong data-tauri-drag-region>SırIKI</strong>
        </div>
        <span data-tauri-drag-region>Secret Management Desktop</span>
      </header>
      <WebApp />
    </>
  );
}

export default DesktopApp;
