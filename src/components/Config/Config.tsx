import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { NGINX_BUILD_OPTIONS } from "./arguments";

const Config: React.FC = () => {
  const [nginxConfig, setNginxConfig] = useState<{
    version: string;
    buildInfo: string;
    configureArgs: string[];
    tlsSupport: string | undefined;
  } | null>(null);

  const [editArgs, setEditArgs] = useState<string[]>([]);

  useEffect(() => {
    invoke<string>("get_nginx_version")
      .then((output) => {
        const parsedConfig = parseNginxConfig(output);
        setNginxConfig(parsedConfig);
        setEditArgs(parsedConfig.configureArgs);
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

  const parseConfigureArgs = (argsLine: string): string[] => {
    const args: string[] = [];
    let currentArg = "";
    let insideQuotes = false;

    for (let i = 0; i < argsLine.length; i++) {
      const char = argsLine[i];

      if (char === "'") {
        insideQuotes = !insideQuotes;
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

    return args.flatMap((arg) => {
      if (arg.includes("=") && arg.includes("'")) {
        const [option, nestedArgs] = arg.split("=");
        if (
          nestedArgs &&
          nestedArgs.startsWith("'") &&
          nestedArgs.endsWith("'")
        ) {
          const cleanedArgs = nestedArgs.slice(1, -1);
          return [option, ...cleanedArgs.split(" ")];
        }
      }
      return arg;
    });
  };

  const getArgumentDescription = (arg: string): string => {
    for (const [key, value] of Object.entries(NGINX_BUILD_OPTIONS)) {
      if (arg.startsWith(key)) {
        if (typeof value === "string") {
          return value;
        } else if (typeof value === "object") {
          const specificArg = arg.replace(key, "").trim();
          return (
            value[specificArg] || `${specificArg}: No description available.`
          );
        }
      }
    }
    return "No description available.";
  };

  const handleInputChange = (index: number, newValue: string) => {
    const newArgs = [...editArgs];
    newArgs[index] = newValue;
    setEditArgs(newArgs);
  };

  const handleSaveChanges = () => {
    // Join the edited arguments into a single string
    const updatedArgs = editArgs.join(" ");
    
    // Call the Rust function via Tauri's invoke, passing the arguments as a string
    invoke("modify_nginx_service", { custom_args: updatedArgs })
      .then(() => {
        alert("Nginx command-line arguments updated successfully.");
      })
      .catch((error) => {
        console.error("Failed to update Nginx arguments:", error);
        alert("Failed to update Nginx arguments.");
      });
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
        <h3 className="config-subtitle">Edit Arguments</h3>
        <ul className="config-list">
          {editArgs.map((arg, index) => (
            <li key={index} className="config-list-item">
              <input
                type="text"
                value={arg}
                onChange={(e) => handleInputChange(index, e.target.value)}
                className="arg-input"
              />
              <span className="tooltip">
                ?
                <span className="tooltip-text">
                  {getArgumentDescription(arg)}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <button onClick={handleSaveChanges} className="save-button">
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default Config;
