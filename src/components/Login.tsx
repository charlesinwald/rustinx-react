import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Meteors } from "./ui/meteors";
import { Eye, EyeOff } from "lucide-react";

const Login: React.FC = () => {
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();

  const handleLogin = async () => {
    console.log("🔐 Login button clicked");

    if (!password.trim()) {
      console.log("❌ Empty password provided");
      setError("Please enter your sudo password");
      return;
    }

    console.log("📝 Password length:", password.length);
    setIsLoading(true);
    setError("");

    try {
      console.log("🚀 Calling login function...");
      const success = await login(password);
      console.log("🔍 Login result:", success);

      if (!success) {
        console.log("❌ Login failed");
        setError("Invalid sudo password. Please try again.");
      } else {
        console.log("✅ Login successful");
      }
    } catch (err) {
      console.error("💥 Login exception:", err);
      setError("Login failed. Please check your connection and try again.");
    } finally {
      console.log("🏁 Login process finished");
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleLogin();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 relative overflow-hidden">
      <div className="max-w-lg w-full mx-4 space-y-10 relative z-10">
        <div className="text-center">
            {/* text gradient top should be foreground and bottom should be accent */}
            <h2 className="text-6xl font-black text-foreground mb-6 tracking-tight bg-gradient-to-b from-foreground to-app-green-hover bg-clip-text text-transparent">
                Sign In
            </h2>
          <p className="text-xl text-muted-foreground font-medium">
            Enter your sudo password to access the dashboard
          </p>
        </div>
        <div className="space-y-8 bg-card/30 backdrop-blur-sm border border-border/50 rounded-2xl p-8 shadow-2xl">
          <div className="relative">
            <label htmlFor="password" className="sr-only">
              Sudo Password
            </label>
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              className="appearance-none rounded-xl relative block w-full px-5 py-4 pr-12 text-lg border-2 border-border bg-background/80 text-foreground placeholder-muted-foreground/70 focus:outline-none focus:ring-4 focus:ring-primary/20 focus:border-primary transition-all duration-200 disabled:opacity-50 shadow-sm"
              placeholder="Enter sudo password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-muted-foreground hover:text-foreground focus:outline-none transition-colors duration-200"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLoading}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive text-center font-medium">
              {error}
            </div>
          )}

          <div>
            <button
              onClick={handleLogin}
              disabled={isLoading}
              className="group relative w-full flex justify-center py-4 px-6 border border-transparent text-lg font-semibold rounded-xl text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"
            >
              {isLoading ? "Authenticating..." : "Sign In"}
            </button>
          </div>
        </div>
      </div>
      <Meteors number={20} />
    </div>
  );
};

export default Login;
