import ApiClient from "./apiClient.js";

export default class AuthService {
  #creds;

  constructor({ creds, api }) {
    this.#creds = creds;
    /** @type {ApiClient} */
    this.api = api;
  }

  /**
   * Get base auth URL
   * @returns {string}
   */
  getUrl() {
    return `${this.#creds.baseUrl}/projects/${this.#creds.projectCode}/auth`;
  }

  /**
   * Validate email format
   * @param {string} email
   * @private
   */
  #validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      throw new Error("Invalid email format");
    }
  }

  /**
   * Validate password
   * @param {string} password
   * @private
   */
  #validatePassword(password) {
    if (!password || typeof password !== "string" || password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }
  }

  /**
   * Login with email and password
   * @param {Object} params
   * @param {string} params.email - User email
   * @param {string} params.password - User password
   * @returns {Promise<Object>}
   */
  async loginWithEmail({ email, password }) {
    try {
      this.#validateEmail(email);
      this.#validatePassword(password);

      const result = await this.api.post({
        url: `${this.getUrl()}/login-with-email`,
        data: { email, password },
      });

      if (!result.ok) {
        throw new Error(
          result.data?.message || `Login failed: ${result.status}`
        );
      }

      return result;
    } catch (error) {
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  /**
   * Register with email and password
   * @param {Object} params
   * @param {string} params.email - User email
   * @param {string} params.password - User password
   * @param {string} [params.name] - User name (optional, max 100 chars)
   * @param {string} [params.avatar] - Avatar URL (optional, max 500 chars)
   * @param {string[]} [params.roles] - User roles (optional)
   * @returns {Promise<Object>}
   */
  async registerWithEmail({ email, password, name, avatar, roles }) {
    try {
      this.#validateEmail(email);
      this.#validatePassword(password);

      const data = { email, password };
      if (name != null) data.name = String(name).trim();
      if (avatar != null) data.avatar = avatar;
      if (roles != null) data.roles = roles;

      const result = await this.api.post({
        url: `${this.getUrl()}/register-with-email`,
        data,
      });

      if (!result.ok) {
        throw new Error(
          result.data?.message || `Registration failed: ${result.status}`
        );
      }

      return result;
    } catch (error) {
      throw new Error(`Registration failed: ${error.message}`);
    }
  }

  /**
   * Login with an existing JWT token
   * @param {Object} params
   * @param {string} params.token - Existing JWT token
   * @returns {Promise<Object>}
   */
  async loginWithToken({ token }) {
    try {
      if (!token || typeof token !== "string") {
        throw new Error("Token is required");
      }

      const result = await this.api.post({
        url: `${this.getUrl()}/login-with-token`,
        data: { token },
      });

      if (!result.ok) {
        throw new Error(
          result.data?.message || `Token login failed: ${result.status}`
        );
      }

      return result;
    } catch (error) {
      throw new Error(`Token login failed: ${error.message}`);
    }
  }

  /**
   * Login anonymously (no email/password required)
   * @param {Object} [params] - Optional params
   * @param {string} [params.name] - Guest display name
   * @param {string} [params.avatar] - Avatar URL
   * @returns {Promise<Object>}
   */
  async anonymousLogin(params = {}) {
    try {
      const data = {};
      if (params.name != null) data.name = params.name;
      if (params.avatar != null) data.avatar = params.avatar;

      const result = await this.api.post({
        url: `${this.getUrl()}/anonymous-login`,
        data,
      });

      if (!result.ok) {
        throw new Error(
          result.data?.message || `Anonymous login failed: ${result.status}`
        );
      }

      return result;
    } catch (error) {
      throw new Error(`Anonymous login failed: ${error.message}`);
    }
  }

  /**
   * Change password
   * @param {Object} params
   * @param {string} params.oldPassword - Current password
   * @param {string} params.newPassword - New password
   * @returns {Promise<Object>}
   */
  async changePassword({ oldPassword, newPassword }) {
    try {
      this.#validatePassword(oldPassword);
      this.#validatePassword(newPassword);

      if (oldPassword === newPassword) {
        throw new Error("New password must be different from old password");
      }

      const result = await this.api.post({
        url: `${this.getUrl()}/change-password`,
        data: { oldPassword, newPassword },
      });

      if (!result.ok) {
        throw new Error(
          result.data?.message || `Password change failed: ${result.status}`
        );
      }

      return result;
    } catch (error) {
      throw new Error(`Password change failed: ${error.message}`);
    }
  }

  /**
   * Send reset password email
   * @param {Object} params
   * @param {string} params.email - User email
   * @returns {Promise<Object>}
   */
  async sendResetPasswordEmail({ email }) {
    try {
      this.#validateEmail(email);

      const result = await this.api.post({
        url: `${this.getUrl()}/send-reset-password-email`,
        data: { email },
      });

      if (!result.ok) {
        throw new Error(
          result.data?.message ||
            `Send reset password email failed: ${result.status}`
        );
      }

      return result;
    } catch (error) {
      throw new Error(`Send reset password email failed: ${error.message}`);
    }
  }

  /**
   * Send email verification
   * @returns {Promise<Object>}
   */
  async sendEmailVerification() {
    try {
      const result = await this.api.get({
        url: `${this.getUrl()}/send-email-verification`,
      });

      if (!result.ok) {
        throw new Error(
          result.data?.message ||
            `Send email verification failed: ${result.status}`
        );
      }

      return result;
    } catch (error) {
      throw new Error(`Send email verification failed: ${error.message}`);
    }
  }

  /**
   * Get current user
   * @returns {Promise<Object|null>}
   */
  async getCurrentUser() {
    try {
      const result = await this.api.get({
        url: `${this.getUrl()}/current-user`,
      });

      if (!result.ok) {
        return null;
      }

      return result.data;
    } catch (error) {
      throw new Error(`Get current user failed: ${error.message}`);
    }
  }

  /**
   * Logout
   * @returns {Promise<Object>}
   */
  async logout() {
    try {
      const result = await this.api.post({
        url: `${this.getUrl()}/logout`,
        data: {},
      });

      if (!result.ok) {
        throw new Error(
          result.data?.message || `Logout failed: ${result.status}`
        );
      }

      return result;
    } catch (error) {
      throw new Error(`Logout failed: ${error.message}`);
    }
  }
}
