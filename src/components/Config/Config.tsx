import React, { useState, useEffect } from "react";
import "./Config.css";
import { invoke } from "@tauri-apps/api/tauri";
import { NGINX_BUILD_OPTIONS, NginxBuildOption } from "./arguments";

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
      ? parseConfigureArgs(
          configureArgsLine.replace("configure arguments: ", "")
        )
      : [];

    return {
      version,
      buildInfo,
      configureArgs,
      tlsSupport,
    };
  };

  // Helper function to correctly parse arguments
  const parseConfigureArgs = (argsLine: string): string[] => {
    const args: string[] = [];
    let currentArg = "";
    let insideQuotes = false;

    for (let i = 0; i < argsLine.length; i++) {
      const char = argsLine[i];

      if (char === "'") {
        insideQuotes = !insideQuotes; // Toggle insideQuotes flag
      } else if (char === " " && !insideQuotes) {
        if (currentArg) {
          args.push(currentArg);
          currentArg = "";
        }
      } else {
        currentArg += char;
      }
    }

    if (currentArg) {
      args.push(currentArg);
    }

    // If there are nested options like --with-cc-opt='-g -O2 ...', split them further
    return args.flatMap((arg) => {
      if (arg.includes("=") && arg.includes("'")) {
        const [option, nestedArgs] = arg.split("=");
        if (
          nestedArgs &&
          nestedArgs.startsWith("'") &&
          nestedArgs.endsWith("'")
        ) {
          const cleanedArgs = nestedArgs.slice(1, -1); // Remove surrounding quotes
          return [option, ...cleanedArgs.split(" ")];
        }
      }
      return arg;
    });
  };

  const getArgumentDescription = (arg: string): string => {
    for (const [key, value] of Object.entries(NGINX_BUILD_OPTIONS)) {
      if (arg.startsWith(key)) {
        console.log(arg, value);
        if (typeof value === "string") {
          return value;
        } else if (typeof value === "object") {
          console.log(arg, value);
          const specificArg = arg.replace(key, "").trim();
          console.log("specificArg", specificArg);
          return (
            value[specificArg] || `${specificArg}: No description available.`
          );
        }
      }
    }
    return "No description available.";
  };

  if (!nginxConfig) {
    return <div>Loading...</div>;
  }

  return (
    <div className="config-container">
      <h2 className="config-title">NGINX Configuration</h2>
      <div className="config-section">
        <h3 className="config-subtitle">Version</h3>
        <p>{nginxConfig.version.replace("nginx version: nginx/", "")}</p>
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
            <li key={index} className="config-list-item">
              <span className="tooltip">
                {arg}
                <span className="tooltip-text">
                  {getArgumentDescription(arg)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default Config;
