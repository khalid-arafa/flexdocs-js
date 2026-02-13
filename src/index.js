import ApiClient from "./apiClient.js";
import AuthService from "./authService.js";
import DbService from "./dbService.js";
import SocketService from "./socketService.js";
import StorageService from "./storageService.js";

/**
 * Validates credentials object
 * @param {Object} creds - Credentials object
 * @throws {Error} If credentials are invalid
 */
function validateCredentials(creds) {
  if (!creds || typeof creds !== "object") {
    throw new Error("Credentials must be an object");
  }

  const required = ["baseUrl", "projectCode", "projectToken"];
  const missing = required.filter((key) => !creds[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required credentials: ${missing.join(", ")}`);
  }

  if (typeof creds.baseUrl !== "string" || !creds.baseUrl.startsWith("http")) {
    throw new Error("baseUrl must be a valid HTTP(S) URL");
  }
}

// Singleton instances
let apiClient;
let socketClient;
let db;
let auth;
let storage;

/**
 * Gets or creates ApiClient instance
 * @param {Object} creds - Credentials
 * @param {Object} options - Configuration options
 * @returns {ApiClient}
 */
const getApiClientInstance = (creds, options = {}) => {
  if (apiClient) return apiClient;
  validateCredentials(creds);
  try {
    apiClient = new ApiClient(creds, options).init();
    return apiClient;
  } catch (error) {
    throw new Error(`Failed to initialize API client: ${error.message}`);
  }
};

/**
 * Gets or creates SocketService instance
 * @param {Object} creds - Credentials
 * @param {Object} options - Configuration options
 * @returns {SocketService}
 */
const getSocketClientInstance = (creds, options = {}) => {
  if (socketClient) return socketClient;
  validateCredentials(creds);
  try {
    socketClient = new SocketService(creds, options);
    return socketClient;
  } catch (error) {
    throw new Error(`Failed to initialize socket client: ${error.message}`);
  }
};

/**
 * Gets database service instance
 * @param {Object} creds - Credentials
 * @param {Object} options - Configuration options
 * @returns {DbService}
 */
export const getDatabase = (creds, options = {}) => {
  if (db) return db;
  try {
    db = new DbService({
      creds,
      api: getApiClientInstance(creds, options.api),
      socket: getSocketClientInstance(creds, options.socket),
    });
    return db;
  } catch (error) {
    throw new Error(`Failed to initialize database service: ${error.message}`);
  }
};

/**
 * Gets auth service instance
 * @param {Object} creds - Credentials
 * @param {Object} options - Configuration options
 * @returns {AuthService}
 */
export const getAuth = (creds, options = {}) => {
  if (auth) return auth;
  try {
    auth = new AuthService({
      creds,
      api: getApiClientInstance(creds, options.api),
    });
    return auth;
  } catch (error) {
    throw new Error(`Failed to initialize auth service: ${error.message}`);
  }
};

/**
 * Gets storage service instance
 * @param {Object} creds - Credentials
 * @param {Object} options - Configuration options
 * @returns {StorageService}
 */
export const getStorage = (creds, options = {}) => {
  if (storage) return storage;
  try {
    storage = new StorageService({
      creds,
      api: getApiClientInstance(creds, options.api),
      socket: getSocketClientInstance(creds, options.socket),
    });
    return storage;
  } catch (error) {
    throw new Error(`Failed to initialize storage service: ${error.message}`);
  }
};

/**
 * Disposes all singleton instances and cleans up resources
 */
export const dispose = () => {
  if (socketClient) {
    try {
      socketClient.close();
    } catch (error) {
      console.error("Error closing socket:", error);
    }
  }
  apiClient = null;
  socketClient = null;
  db = null;
  auth = null;
  storage = null;
};
