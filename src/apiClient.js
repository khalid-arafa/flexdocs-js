import axios from "axios";

class ApiClient {
  constructor(creds, options = {}) {
    this.creds = creds;
    this.connected = false;
    this.options = {
      timeout: options.timeout || 30000,
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 1000,
      getToken: options.getToken || null,
      onError: options.onError || null,
      ...options,
    };
  }

  init() {
    try {
      if (!this.creds || Object.keys(this.creds).length === 0) {
        throw new Error("Credentials are empty");
      }

      this.api = axios.create({
        baseURL: this.creds.baseUrl,
        timeout: this.options.timeout,
        validateStatus: () => true,
      });

      // Request interceptor
      this.api.interceptors.request.use(
        async (config) => {
          if (this.creds.projectToken) {
            config.headers = config.headers || {};
            config.headers["project-token"] = this.creds.projectToken;
          }

          // User token (if provided via callback)
          if (this.options.getToken) {
            try {
              const token = await this.options.getToken();
              if (token) {
                config.headers["Authorization"] = `Bearer ${token}`;
              }
            } catch (error) {
              console.error("Error getting user token:", error);
            }
          }

          return config;
        },
        (error) => Promise.reject(error)
      );

      // Response interceptor
      this.api.interceptors.response.use(
        (response) => ({
          ...response,
          ok: response.status >= 200 && response.status < 300,
        }),
        (error) => {
          if (this.options.onError) {
            this.options.onError(error);
          }
          return Promise.reject(error);
        }
      );

      return this;
    } catch (error) {
      throw new Error(`API client initialization failed: ${error.message}`);
    }
  }

  async test() {
    try {
      const res = await this.handleRequest(
        "get",
        `/projects/${this.creds.projectCode}/test-connection`,
        null
      );
      this.connected = res.ok;
      return this.connected;
    } catch (error) {
      this.connected = false;
      throw new Error(`Connection test failed: ${error.message}`);
    }
  }

  async handleRequest(method, url, data, config = {}, retryCount = 0) {
    try {
      let res;
      if (method === "get" || method === "delete") {
        res = await this.api[method](url, config);
      } else {
        res = await this.api[method](url, data, config);
      }

      return {
        ok: res.status >= 200 && res.status < 300,
        status: res.status,
        data: res.data,
      };
    } catch (error) {
      // Retry logic for network errors
      if (
        retryCount < this.options.retryAttempts &&
        this.shouldRetry(error)
      ) {
        await this.delay(this.options.retryDelay * Math.pow(2, retryCount));
        return this.handleRequest(method, url, data, config, retryCount + 1);
      }

      const res = error.response || {};
      return {
        ok: false,
        status: res.status || 500,
        data: res.data || { message: error.message },
        error: error.message,
      };
    }
  }

  shouldRetry(error) {
    // Retry on network errors or 5xx server errors
    return (
      !error.response ||
      error.code === "ECONNABORTED" ||
      error.code === "ETIMEDOUT" ||
      (error.response && error.response.status >= 500)
    );
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  get({ url, config }) {
    if (!url) throw new Error("URL is required");
    return this.handleRequest("get", url, null, config);
  }

  post({ url, data, config }) {
    if (!url) throw new Error("URL is required");
    return this.handleRequest("post", url, data, config);
  }

  put({ url, data, config }) {
    if (!url) throw new Error("URL is required");
    return this.handleRequest("put", url, data, config);
  }

  delete({ url, config }) {
    if (!url) throw new Error("URL is required");
    return this.handleRequest("delete", url, null, config);
  }
}

export default ApiClient;
