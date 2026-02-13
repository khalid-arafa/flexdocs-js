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

  async delete({ url }) {
    if (!url || typeof url !== "string") {
      throw new Error("Invalid file URL");
    }

    const result = await this.api.delete({
      url: `${this.getUrl()}/delete`,
      config: { params: { url } },
    });

    return result.ok;
  }

  async getFileInfo({ url }) {
    if (!url || typeof url !== "string") {
      throw new Error("Invalid file URL");
    }

    const result = await this.api.get({
      url: `${this.getUrl()}/info`,
      config: { params: { url } },
    });

    if (result.ok) return result.data;
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
