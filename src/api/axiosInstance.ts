import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";

class ApiClient {
  private axiosInstance: AxiosInstance;

  constructor() {
    // In development, point to the web-server port, otherwise use relative path
    const isDevelopment = window.location.port === "1234";
    const baseURL = isDevelopment ? "http://localhost:8081/api" : "/api";

    this.axiosInstance = axios.create({
      baseURL,
      headers: {
        "Content-Type": "application/json",
      },
      withCredentials: true, // Important for session cookies
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.axiosInstance.interceptors.request.use(
      (config) => {
        console.log(
          "📤 Axios request:",
          config.method?.toUpperCase(),
          config.url
        );
        console.log("🔧 Request config:", {
          baseURL: config.baseURL,
          withCredentials: config.withCredentials,
          headers: config.headers,
        });
        return config;
      },
      (error) => {
        console.error("❌ Axios request error:", error);
        return Promise.reject(error);
      }
    );

    this.axiosInstance.interceptors.response.use(
      (response) => {
        console.log("📥 Axios response:", response.status, response.config.url);
        console.log("✅ Response data:", response.data);
        return response;
      },
      (error) => {
        console.error("❌ Axios response error:", {
          status: error.response?.status,
          url: error.config?.url,
          data: error.response?.data,
        });

        // Don't reload on 401 for session check - let the auth context handle it
        if (
          error.response?.status === 401 &&
          !error.config?.url?.includes("/session")
        ) {
          console.log("🔄 401 error on non-session request - reloading page");
          // Only reload on 401 for other authenticated requests, not for session checks
          window.location.reload();
        } else if (error.response?.status === 401) {
          console.log(
            "🚫 401 error on session check - letting auth context handle it"
          );
        }

        return Promise.reject(error);
      }
    );
  }

  get(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse> {
    return this.axiosInstance.get(url, config);
  }

  post(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse> {
    return this.axiosInstance.post(url, data, config);
  }

  put(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse> {
    return this.axiosInstance.put(url, data, config);
  }

  delete(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse> {
    return this.axiosInstance.delete(url, config);
  }

  patch(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse> {
    return this.axiosInstance.patch(url, data, config);
  }
}

export const apiClient = new ApiClient();
export default apiClient;
