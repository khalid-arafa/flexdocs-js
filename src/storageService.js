import SocketService from "./socketService.js";

export default class StorageService {
  #creds;
  #socket;

  constructor({ creds, api, socket }) {
    this.#creds = creds;
    this.api = api;
    /** @type {SocketService} */
    this.#socket = socket;
  }

  getUrl() {
    return `${this.#creds.baseUrl}/projects/${this.#creds.projectCode}/storage`;
  }

  upload({ files, options = {} }) {
    const {
      baseUrl = this.#creds.baseUrl,
      bucketId = null,
      autoDispose = true,
    } = options;

    return new CustomUpload({
      socket: this.#socket,
      files: Array.isArray(files) ? files : [files],
      options: { baseUrl, bucketId, autoDispose },
    });
  }

  /**
   * Delete a file by its ID
   * @param {Object} params
   * @param {string} params.fileId - File ID to delete
   * @returns {Promise<boolean>}
   */
  async deleteFile({ fileId }) {
    if (!fileId || typeof fileId !== "string") {
      throw new Error("File ID must be a non-empty string");
    }

    const result = await this.api.delete({
      url: `${this.getUrl()}/files/${fileId}`,
    });

    return result.ok;
  }

  /**
   * Get bucket contents (buckets and files)
   * @param {Object} params
   * @param {string} params.bucketId - Bucket ID or "home" for root
   * @param {number} [params.page] - Page number (default 1)
   * @param {number} [params.ipp] - Items per page (default 20)
   * @returns {Promise<Object>} { totalCount, content }
   */
  async getBucketContent({ bucketId, page, ipp }) {
    if (!bucketId || typeof bucketId !== "string") {
      throw new Error("Bucket ID must be a non-empty string");
    }

    const params = {};
    if (page != null) params.page = page;
    if (ipp != null) params.ipp = ipp;

    const result = await this.api.get({
      url: `${this.getUrl()}/buckets/${bucketId}/content`,
      config: { params },
    });

    if (result.ok) return result.data;

    throw new Error(
      result.data?.message || `Failed to get bucket content: ${result.status}`
    );
  }

  /**
   * Search files and buckets by name
   * @param {Object} params
   * @param {string} params.searchTerm - Search term (min 1, max 200 chars)
   * @param {string} [params.bucketId] - Scope search to a bucket
   * @param {number} [params.page] - Page number
   * @param {number} [params.ipp] - Items per page (max 100)
   * @returns {Promise<Object>} { totalCount, content }
   */
  async search({ searchTerm, bucketId, page, ipp }) {
    if (!searchTerm || typeof searchTerm !== "string") {
      throw new Error("Search term must be a non-empty string");
    }

    const data = { searchTerm };
    if (bucketId != null) data.bucketId = bucketId;
    if (page != null) data.page = page;
    if (ipp != null) data.ipp = ipp;

    const result = await this.api.post({
      url: `${this.getUrl()}/search`,
      data,
    });

    if (result.ok) return result.data;

    throw new Error(
      result.data?.message || `Search failed: ${result.status}`
    );
  }

  /**
   * Create a new bucket
   * @param {Object} params
   * @param {string} params.name - Bucket name (max 100 chars)
   * @param {string} [params.description] - Description (max 500 chars)
   * @param {string} [params.parentId] - Parent bucket ID (null for root)
   * @returns {Promise<Object>} Created bucket object
   */
  async createBucket({ name, description, parentId }) {
    if (!name || typeof name !== "string") {
      throw new Error("Bucket name must be a non-empty string");
    }

    const data = { name };
    if (description != null) data.description = description;
    if (parentId != null) data.parentId = parentId;

    const result = await this.api.post({
      url: `${this.getUrl()}/buckets`,
      data,
    });

    if (result.ok) return result.data;

    throw new Error(
      result.data?.message || `Failed to create bucket: ${result.status}`
    );
  }

  /**
   * Update a bucket
   * @param {Object} params
   * @param {string} params.bucketId - Bucket ID
   * @param {string} [params.name] - New name
   * @param {string} [params.description] - New description
   * @returns {Promise<Object>}
   */
  async updateBucket({ bucketId, name, description }) {
    if (!bucketId || typeof bucketId !== "string") {
      throw new Error("Bucket ID must be a non-empty string");
    }

    const data = {};
    if (name != null) data.name = name;
    if (description != null) data.description = description;

    const result = await this.api.put({
      url: `${this.getUrl()}/buckets/${bucketId}`,
      data,
    });

    if (result.ok) return result.data;

    throw new Error(
      result.data?.message || `Failed to update bucket: ${result.status}`
    );
  }

  /**
   * Delete a bucket and all its contents recursively
   * @param {Object} params
   * @param {string} params.bucketId - Bucket ID
   * @returns {Promise<boolean>}
   */
  async deleteBucket({ bucketId }) {
    if (!bucketId || typeof bucketId !== "string") {
      throw new Error("Bucket ID must be a non-empty string");
    }

    const result = await this.api.delete({
      url: `${this.getUrl()}/buckets/${bucketId}`,
    });

    return result.ok;
  }

  /**
   * Get file download URL
   * @param {Object} params
   * @param {string} params.fileId - File ID
   * @param {string} params.filename - Filename with extension (e.g., "photo.jpg")
   * @param {string} [params.size] - Image size: "small", "medium", or "large"
   * @param {string} [params.token] - JWT token for private files
   * @returns {string} Download URL
   */
  getFileUrl({ fileId, filename, size, token }) {
    if (!fileId || !filename) {
      throw new Error("fileId and filename are required");
    }

    let url = `${this.getUrl()}/${fileId}/${filename}`;
    const params = [];
    if (size) params.push(`size=${size}`);
    if (token) params.push(`token=${token}`);
    if (params.length > 0) url += `?${params.join("&")}`;

    return url;
  }
}

class CustomUpload {
  constructor({ socket, files, options }) {
    if (!socket) {
      throw new Error("Socket service is required");
    }
    if (!files || files.length === 0) {
      throw new Error("At least one file is required");
    }

    this.socket = socket;
    this.files = files;
    this.options = options;
    this.progressCallbacks = new Set();
    this.cancelled = false;
    this.cancelFunctions = [];
    this.uploadPromise = this.#createUploadPromise();
  }

  #createUploadPromise() {
    return new Promise((resolve, reject) => {
      try {
        // Track upload states by key
        const uploadStatesByKey = new Map();

        const emitProgress = () => {
          const uploads = Array.from(uploadStatesByKey.values());
          this.progressCallbacks.forEach((cb) => {
            try {
              cb(uploads);
            } catch (error) {
              console.error("Progress callback error:", error);
            }
          });
        };

        // Start upload for each file
        this.files.forEach((file) => {
          const uploadKey = `${file.name}_${file.size}_${file.lastModified || Date.now()}`;

          // Initialize state
          uploadStatesByKey.set(uploadKey, {
            file,
            key: uploadKey,
            status: "pending",
            progress: 0,
            error: null,
            url: null,
          });

          try {
            const cancelFn = this.socket.uploadFile(
              file,
              {
                bucketId: this.options.bucketId,
                bucketName: this.options.bucketName,
              },
              (progress) => {
                // Progress callback - update state directly
                if (this.cancelled) return;

                const state = uploadStatesByKey.get(progress.key);
                if (state) {
                  state.status = progress.status;
                  state.progress = progress.progress;
                  state.error = progress.error;
                  state.url = progress.url;

                  emitProgress();

                  // Check if all uploads are complete
                  this.#checkCompletion(uploadStatesByKey, resolve, reject);
                }
              },
            );

            this.cancelFunctions.push(cancelFn);
          } catch (error) {
            const state = uploadStatesByKey.get(uploadKey);
            if (state) {
              state.status = "error";
              state.error = error.message;
            }
            emitProgress();
            reject(error);
            return;
          }
        });

        // Initial emit
        emitProgress();
      } catch (error) {
        reject(error);
      }
    });
  }

  #checkCompletion(uploadStatesByKey, resolve, reject) {
    const uploads = Array.from(uploadStatesByKey.values());
    const pending = uploads.filter(
      (u) => u.status !== "complete" && u.status !== "error",
    );

    if (pending.length === 0 && uploads.length > 0) {
      const errors = uploads.filter((u) => u.status === "error");
      if (errors.length > 0) {
        reject(
          new Error(`Upload failed: ${errors.map((e) => e.error).join(", ")}`),
        );
      } else {
        const urls = uploads
          .map((u) => {
            if (u.url && u.url.startsWith("http")) {
              return u.url;
            }
            return u.url ? `${this.options.baseUrl}/${u.url}` : "";
          })
          .filter(Boolean);
        resolve(urls);
      }
    }
  }

  onProgress(cb) {
    if (typeof cb !== "function") {
      throw new Error("Progress callback must be a function");
    }

    this.progressCallbacks.add(cb);

    return () => {
      this.progressCallbacks.delete(cb);
    };
  }

  cancel() {
    this.cancelled = true;

    this.cancelFunctions.forEach((fn) => {
      try {
        fn();
      } catch (error) {
        console.error("Cancel function error:", error);
      }
    });
    this.cancelFunctions = [];
    this.progressCallbacks.clear();
  }

  then(onfulfilled, onrejected) {
    return this.uploadPromise.then(onfulfilled, onrejected);
  }

  catch(onrejected) {
    return this.uploadPromise.catch(onrejected);
  }

  finally(onfinally) {
    return this.uploadPromise.finally(onfinally);
  }
}
