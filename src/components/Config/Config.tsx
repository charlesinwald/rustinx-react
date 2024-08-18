import React, { useState, useEffect } from "react";
import "./Config.css";
import { invoke } from "@tauri-apps/api/tauri";

const Config: React.FC = () => {
  const [nginxConfig, setNginxConfig] = useState<{
    version: string;
    buildInfo: string;
    configureArgs: string[];
    tlsSupport: string | undefined;
  } | null>(null);

  useEffect(() => {
    invoke<string>("get_nginx_version")
      .then((output) => {
        const parsedConfig = parseNginxConfig(output);
        setNginxConfig(parsedConfig);
      })
      .catch((error) => console.error("Error fetching NGINX config:", error));
  }, []);

  const parseNginxConfig = (output: string) => {
    const lines = output.split("\n");
    const version = lines[0]?.trim() || "Unknown version";
    const buildInfo = lines[1]?.trim() || "Unknown build info";
    const tlsSupport = lines.find((line) => line.includes("TLS"));

    const configureArgsLine = lines.find((line) =>
      line.includes("configure arguments:")
    );
    const configureArgs = configureArgsLine
      ? configureArgsLine
          .replace("configure arguments: ", "")
          .split(" ")
          .filter((arg) => arg !== "")
      : [];

    return {
      version,
      buildInfo,
      configureArgs,
      tlsSupport,
    };
  };

  if (!nginxConfig) {
    return <div>Loading...</div>;
  }

  return (
    <div className="config-container">
      <h2 className="config-title">NGINX Configuration</h2>
      <div className="config-section">
        <h3 className="config-subtitle">Version</h3>
        <p>
            {nginxConfig.version.replace("nginx version: nginx/", "")}</p>
      </div>
      <div className="config-section">
        <h3 className="config-subtitle">Build Information</h3>
        <p>{nginxConfig.buildInfo}</p>
      </div>
      <div className="config-section">
        <h3 className="config-subtitle">TLS</h3>
        <p>{nginxConfig.tlsSupport}</p>
      </div>
      <div className="config-section">
        <h3 className="config-subtitle">Arguments</h3>
        <ul className="config-list">
          {nginxConfig.configureArgs.map((arg, index) => (
            <li key={index}>{arg}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default Config;
