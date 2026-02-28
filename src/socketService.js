import { io } from "socket.io-client";

export default class SocketService {
  #creds;
  #options;

  constructor(creds, options = {}) {
    this.#creds = creds;
    this.#options = {
      timeout: options.timeout || 10000,
      reconnectionAttempts: options.reconnectionAttempts || 5,
      reconnectionDelay: options.reconnectionDelay || 1000,
      chunkSize: options.chunkSize || 64 * 1024, // 64KB
      getToken: options.getToken || null,
      onConnect: options.onConnect || null,
      onDisconnect: options.onDisconnect || null,
      onError: options.onError || null,
      ...options,
    };

    this.listeners = new Map();
    this.activeUploads = new Map();
    this.connected = false;
    this.socket = null;

    this.#initSocket();
  }

  #initSocket() {
    try {
      this.socket = io(this.#creds.baseUrl, {
        auth: (cb) => {
          const baseAuth = { projectToken: this.#creds.projectToken };

          if (!this.#options.getToken) {
            cb(baseAuth);
            return;
          }

          Promise.resolve(this.#options.getToken())
            .then((token) => {
              if (token) {
                cb({
                  ...baseAuth,
                  userToken: token,
                });
                return;
              }
              cb(baseAuth);
            })
            .catch(() => cb(baseAuth));
        },
        transports: ["websocket"],
        reconnectionAttempts: this.#options.reconnectionAttempts,
        reconnectionDelay: this.#options.reconnectionDelay,
        timeout: this.#options.timeout,
      });

      this.socket.on("connect", () => {
        this.connected = true;
        if (this.#options.onConnect) {
          this.#options.onConnect();
        }
      });

      this.socket.on("disconnect", () => {
        this.connected = false;
        // Mark all in-progress uploads as failed
        this.activeUploads.forEach((upload) => {
          if (upload.status === "uploading") {
            upload.status = "error";
            upload.error = "Connection lost";
            if (upload.onProgressUpdate) {
              upload.onProgressUpdate({
                key: upload.key,
                name: upload.file.name,
                size: upload.file.size,
                status: "error",
                progress: upload.progress,
                error: "Connection lost",
                url: null,
              });
            }
          }
        });
        if (this.#options.onDisconnect) {
          this.#options.onDisconnect();
        }
      });

      this.socket.on("connect_error", (err) => {
        this.connected = false;
        if (this.#options.onError) {
          this.#options.onError(err);
        }
      });
    } catch (error) {
      throw new Error(`Socket initialization failed: ${error.message}`);
    }
  }

  setUserToken(token) {
    if (this.socket) {
      this.socket.emit("set-user-token", token || null);
    }
  }

  isConnected() {
    return this.connected && this.socket?.connected;
  }

  waitForConnection(timeout = 5000) {
    return new Promise((resolve, reject) => {
      if (this.isConnected()) {
        resolve(true);
        return;
      }

      const timer = setTimeout(() => {
        reject(new Error("Connection timeout"));
      }, timeout);

      this.socket.once("connect", () => {
        clearTimeout(timer);
        resolve(true);
      });
    });
  }

  watchCol(colPath, cb) {
    if (!colPath || typeof colPath !== "string") {
      throw new Error("Invalid collection path");
    }
    if (typeof cb !== "function") {
      throw new Error("Callback must be a function");
    }

    const colName = colPath.replace(/^\/+|\/+$/g, "");
    const room = `update:${this.#creds.projectCode}/${colName}`;

    this.socket.on(room, cb);

    if (!this.listeners.has(room)) {
      this.listeners.set(room, new Set());
    }
    this.listeners.get(room).add(cb);

    this.socket.emit("watch-col-updates", { col: colName });

    return () => {
      this.socket.off(room, cb);
      const set = this.listeners.get(room);
      if (set) {
        set.delete(cb);
        if (set.size === 0) {
          this.listeners.delete(room);
          this.socket.emit("unwatch-col-updates", { col: colName });
        }
      }
    };
  }

  watchDoc(docPath, cb) {
    if (!docPath || typeof docPath !== "string") {
      throw new Error("Invalid document path");
    }
    if (typeof cb !== "function") {
      throw new Error("Callback must be a function");
    }

    const pathParts = docPath.replace(/^\/+|\/+$/g, "").split("/");
    if (pathParts.length < 2) {
      throw new Error("Document path must include collection and document ID");
    }

    const docId = pathParts[1];

    this.socket.on(docId, cb);

    if (!this.listeners.has(docId)) {
      this.listeners.set(docId, new Set());
    }
    this.listeners.get(docId).add(cb);

    this.socket.emit("watch-doc", { path: docPath });

    return () => {
      this.socket.off(docId, cb);
      const set = this.listeners.get(docId);
      if (set) {
        set.delete(cb);
        if (set.size === 0) {
          this.listeners.delete(docId);
          this.socket.emit("unwatch-doc", { path: docPath });
        }
      }
    };
  }

  uploadFile(file, options = {}, onProgressUpdate = null) {
    if (!file || !file.name || !file.size || !file.type) {
      throw new Error("Invalid file object");
    }

    const uploadKey = `${file.name}_${file.size}_${file.lastModified || Date.now()}`;

    // Check for duplicate uploads
    if (this.activeUploads.has(uploadKey)) {
      throw new Error("File upload already in progress");
    }

    const upload = {
      key: uploadKey,
      file,
      status: "preparing",
      progress: 0,
      error: null,
      url: null,
      bucket: options.bucketId || options.bucketName || null,
      offset: 0,
      isReady: false,
      onProgressUpdate,
    };

    this.activeUploads.set(uploadKey, upload);

    const updateStatus = (updates) => {
      const current = this.activeUploads.get(uploadKey);
      if (current) {
        Object.assign(current, updates);

        // Fire callback on every update
        if (onProgressUpdate) {
          onProgressUpdate({
            key: uploadKey,
            name: file.name,
            size: file.size,
            status: current.status,
            progress: current.progress,
            error: current.error,
            url: current.url,
          });
        }
      }
    };

    const readAndUploadChunk = () => {
      const reader = new FileReader();
      const chunkSize = this.#options.chunkSize;
      const blob = file.slice(upload.offset, upload.offset + chunkSize);

      reader.onload = (e) => {
        if (e.target.error) {
          updateStatus({ status: "error", error: "Failed to read file" });
          this.#cleanupUpload(uploadKey);
          return;
        }

        // FIXED: Send {name, chunk} object to match backend
        this.socket.emit("upload:chunk", {
          name: file.name,
          chunk: new Uint8Array(e.target.result),
        });
      };

      reader.onerror = () => {
        updateStatus({ status: "error", error: "File read error" });
        this.#cleanupUpload(uploadKey);
      };

      reader.readAsArrayBuffer(blob);
    };

    const handleReady = (data) => {
      if (data?.name !== file.name) return;
      updateStatus({ status: "uploading", progress: 0, isReady: true });
      readAndUploadChunk();
    };

    const handleProgress = (data) => {
      const current = this.activeUploads.get(uploadKey);
      if (!current || !current.isReady) return;
      if (data?.name !== file.name || !data?.received) return;

      upload.offset += this.#options.chunkSize;
      const progress = Math.min(
        100,
        Math.floor((upload.offset / file.size) * 100),
      );
      updateStatus({ progress });

      if (upload.offset < file.size) {
        readAndUploadChunk();
      } else {
        // FIXED: Send filename to match backend
        this.socket.emit("upload:done", file.name);
      }
    };

    const handleComplete = (data) => {
      if (data?.name !== file.name) return;
      updateStatus({
        status: "complete",
        progress: 100,
        url: data.url,
      });
      this.#cleanupUpload(uploadKey);
    };

    const handleError = (error) => {
      const errorName = error?.name;
      if (errorName && errorName !== file.name) return;
      const errorMessage =
        typeof error === "string" ? error : error?.message || "Upload failed";
      updateStatus({ status: "error", error: errorMessage });
      this.#cleanupUpload(uploadKey);
    };

    // Store listeners for cleanup
    upload.listeners = {
      ready: handleReady,
      progress: handleProgress,
      complete: handleComplete,
      error: handleError,
    };

    this.socket.on("upload:ready", handleReady);
    this.socket.on("upload:progress", handleProgress);
    this.socket.on("upload:complete", handleComplete);
    this.socket.on("upload:error", handleError);

    // Start upload
    this.socket.emit("upload:start", {
      name: file.name,
      size: file.size,
      type: file.type,
      bucket: upload.bucket,
    });

    // Return cancel function
    return () => this.cancelUpload(uploadKey);
  }

  #cleanupUpload(uploadKey) {
    const upload = this.activeUploads.get(uploadKey);
    if (!upload) return;

    // Remove listeners
    if (upload.listeners) {
      this.socket.off("upload:ready", upload.listeners.ready);
      this.socket.off("upload:progress", upload.listeners.progress);
      this.socket.off("upload:complete", upload.listeners.complete);
      this.socket.off("upload:error", upload.listeners.error);
    }

    this.activeUploads.delete(uploadKey);
  }

  cancelUpload(uploadKey) {
    const upload = this.activeUploads.get(uploadKey);
    if (!upload) return;

    this.socket.emit("upload:cancel", { name: upload.file.name });
    this.#cleanupUpload(uploadKey);
  }

  getUploadStatus(uploadKey) {
    const upload = this.activeUploads.get(uploadKey);
    if (!upload) return null;

    return {
      status: upload.status,
      progress: upload.progress,
      error: upload.error,
      url: upload.url,
    };
  }

  getAllUploads() {
    const uploads = [];
    this.activeUploads.forEach((upload, key) => {
      uploads.push({
        key,
        name: upload.file.name,
        size: upload.file.size,
        status: upload.status,
        progress: upload.progress,
        error: upload.error,
        url: upload.url,
      });
    });
    return uploads;
  }

  close() {
    // Clean up all listeners
    this.listeners.forEach((cbs, eventName) => {
      cbs.forEach((cb) => this.socket.off(eventName, cb));
    });
    this.listeners.clear();

    // Cancel all active uploads
    this.activeUploads.forEach((upload, key) => {
      this.cancelUpload(key);
    });

    // Close socket
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this.connected = false;
  }
}
