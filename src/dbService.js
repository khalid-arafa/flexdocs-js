export default class DbService {
  #creds;

  constructor({ creds, api, socket }) {
    this.#creds = creds;
    this.api = api;
    this.socket = socket;
  }

  /**
   * Get document reference
   * @param {string} docPath - Document path (e.g., "users/user123")
   * @returns {DocumentRef}
   */
  doc(docPath) {
    if (!docPath || typeof docPath !== "string") {
      throw new Error("Document path must be a non-empty string");
    }

    return new DocumentRef({
      docPath,
      creds: this.#creds,
      socket: this.socket,
      apiClient: this.api,
    });
  }

  /**
   * Get collection reference
   * @param {string} colPath - Collection path (e.g., "users")
   * @returns {CollectionRef}
   */
  col(colPath) {
    if (!colPath || typeof colPath !== "string") {
      throw new Error("Collection path must be a non-empty string");
    }

    return new CollectionRef({
      colPath,
      creds: this.#creds,
      socket: this.socket,
      apiClient: this.api,
    });
  }
}

// Collections

class CollectionRef {
  #creds;
  #sort = { createdAt: -1 };
  #selectedFields = {};
  #query = {};
  #limit = 100;
  #skip = 0;

  constructor({ creds, colPath, socket, apiClient }) {
    this.colPath = colPath;
    this.#creds = creds;
    this.socket = socket;
    this.apiClient = apiClient;
  }

  getUrl() {
    return `${this.#creds.baseUrl}/projects/${
      this.#creds.projectCode
    }/db/${this.colPath.replace(/^\/+|\/+$/g, "")}`;
  }

  /**
   * Get documents from collection
   * @returns {Promise<Array|undefined>}
   */
  async get() {
    try {
      const filters = {
        sort: this.#sort,
        select: this.#selectedFields,
        query: this.#query,
        limit: this.#limit,
        skip: this.#skip,
      };

      const result = await this.apiClient.post({
        url: this.getUrl(),
        data: filters,
      });

      if (result.ok) return result.data;

      throw new Error(
        result.data?.message || `Failed to get collection: ${result.status}`
      );
    } catch (error) {
      throw new Error(`Collection get failed: ${error.message}`);
    }
  }

  /**
   * Add document to collection
   * @param {Object} data - Document data
   * @returns {Promise<Object|undefined>}
   */
  async add(data) {
    if (!data || typeof data !== "object") {
      throw new Error("Document data must be an object");
    }

    try {
      const result = await this.apiClient.post({
        url: this.getUrl() + "/add",
        data: data,
      });

      if (result.ok) return result.data;

      throw new Error(
        result.data?.message || `Failed to add document: ${result.status}`
      );
    } catch (error) {
      throw new Error(`Collection add failed: ${error.message}`);
    }
  }

  /**
   * Sort results
   * @param {Object} sortObj - Sort object (e.g., { createdAt: -1 })
   * @returns {CollectionRef}
   */
  sort(sortObj) {
    if (!sortObj || typeof sortObj !== "object") {
      throw new Error("Sort must be an object");
    }
    this.#sort = sortObj;
    return this;
  }

  /**
   * Select specific fields
   * @param {Object|string|string[]} selectObj - Select object or fields
   * @returns {CollectionRef}
   */
  select(selectObj) {
    if (typeof selectObj === "string") {
      const fields = selectObj.split(/[\s,]+/).filter(Boolean);
      if (fields.length === 0) {
        throw new Error("Select string must contain at least one field");
      }
      this.#selectedFields = Object.fromEntries(
        fields.map((field) => [field, 1]),
      );
      return this;
    }

    if (Array.isArray(selectObj)) {
      if (selectObj.length === 0) {
        throw new Error("Select array must contain at least one field");
      }
      this.#selectedFields = Object.fromEntries(
        selectObj.map((field) => [field, 1]),
      );
      return this;
    }

    if (!selectObj || typeof selectObj !== "object") {
      throw new Error("Select must be an object, string, or string array");
    }

    this.#selectedFields = selectObj;
    return this;
  }

  /**
   * Limit results
   * @param {number} count - Limit count
   * @returns {CollectionRef}
   */
  limit(count) {
    if (typeof count !== "number" || count < 0) {
      throw new Error("Limit must be a non-negative number");
    }
    this.#limit = count;
    return this;
  }

  /**
   * Skip results
   * @param {number} count - Skip count
   * @returns {CollectionRef}
   */
  skip(count) {
    if (typeof count !== "number" || count < 0) {
      throw new Error("Skip must be a non-negative number");
    }
    this.#skip = count;
    return this;
  }

  /**
   * Add where clause
   * @param {string} field - Field name
   * @param {Object} opts - Query options
   * @returns {CollectionRef}
   */
  where(field, opts) {
    if (!field || typeof field !== "string") {
      throw new Error("Field must be a non-empty string");
    }

    if (!opts || typeof opts !== "object") {
      throw new Error("Where options must be an object");
    }

    const {
      isEqualTo,
      isNotEqualTo,
      isGreaterThan,
      isGreaterThanOrEqualTo,
      isLessThan,
      isLessThanOrEqualTo,
      arrayContains,
      arrayContainsAny,
      whereIn,
      whereNotIn,
    } = opts;

    if (isEqualTo !== undefined) {
      this.#query[field] = isEqualTo;
    } else if (isNotEqualTo !== undefined) {
      this.#query[field] = { $ne: isNotEqualTo };
    } else if (isGreaterThan !== undefined) {
      this.#query[field] = { $gt: isGreaterThan };
    } else if (isGreaterThanOrEqualTo !== undefined) {
      this.#query[field] = { $gte: isGreaterThanOrEqualTo };
    } else if (isLessThan !== undefined) {
      this.#query[field] = { $lt: isLessThan };
    } else if (isLessThanOrEqualTo !== undefined) {
      this.#query[field] = { $lte: isLessThanOrEqualTo };
    } else if (arrayContains !== undefined) {
      this.#query[field] = arrayContains;
    } else if (arrayContainsAny !== undefined) {
      this.#query[field] = { $in: arrayContainsAny };
    } else if (whereIn !== undefined) {
      this.#query[field] = { $in: whereIn };
    } else if (whereNotIn !== undefined) {
      this.#query[field] = { $nin: whereNotIn };
    } else {
      this.#query[field] = { $exists: true };
    }

    return this;
  }

  /**
   * Watch collection for changes
   * @param {Function} cb - Callback function
   * @returns {Function} Unsubscribe function
   */
  watch(cb) {
    if (typeof cb !== "function") {
      throw new Error("Watch callback must be a function");
    }

    // Initial fetch
    this.get()
      .then((res) => cb({ add: res }))
      .catch((err) => {
        console.error("Initial collection fetch failed:", err);
        cb({ error: err.message });
      });

    return this.socket.watchCol(this.colPath, cb);
  }

  /**
   * Get document reference
   * @param {string} docPath - Document path
   * @returns {DocumentRef}
   */
  doc(docPath) {
    if (!docPath || typeof docPath !== "string") {
      throw new Error("Document path must be a non-empty string");
    }

    return new DocumentRef({
      docPath,
      creds: this.#creds,
      socket: this.socket,
      apiClient: this.apiClient,
    });
  }
}

// Documents

class DocumentRef {
  #creds;

  constructor({ creds, docPath, socket, apiClient }) {
    this.docPath = docPath;
    this.#creds = creds;
    this.socket = socket;
    this.apiClient = apiClient;
  }

  getUrl() {
    return `${this.#creds.baseUrl}/projects/${
      this.#creds.projectCode
    }/db/${this.docPath.replace(/^\/+|\/+$/g, "")}`;
  }

  /**
   * Get document
   * @returns {Promise<Object|undefined>}
   */
  async get() {
    try {
      const result = await this.apiClient.get({
        url: this.getUrl(),
      });

      if (result.ok) return result.data;

      throw new Error(
        result.data?.message || `Failed to get document: ${result.status}`
      );
    } catch (error) {
      throw new Error(`Document get failed: ${error.message}`);
    }
  }

  /**
   * Update document
   * @param {Object} data - Update data
   * @returns {Promise<boolean>}
   */
  async update(data) {
    if (!data || typeof data !== "object") {
      throw new Error("Update data must be an object");
    }

    try {
      const result = await this.apiClient.put({
        url: this.getUrl(),
        data: { data, type: "update" },
      });

      if (result.ok) return true;

      throw new Error(
        result.data?.message || `Failed to update document: ${result.status}`
      );
    } catch (error) {
      throw new Error(`Document update failed: ${error.message}`);
    }
  }

  /**
   * Delete document
   * @returns {Promise<boolean>}
   */
  async delete() {
    try {
      const result = await this.apiClient.delete({
        url: this.getUrl(),
      });

      if (result.ok) return true;

      throw new Error(
        result.data?.message || `Failed to delete document: ${result.status}`
      );
    } catch (error) {
      throw new Error(`Document delete failed: ${error.message}`);
    }
  }

  /**
   * Watch document for changes
   * @param {Function} cb - Callback function
   * @returns {Function} Unsubscribe function
   */
  watch(cb) {
    if (typeof cb !== "function") {
      throw new Error("Watch callback must be a function");
    }

    // Initial fetch
    this.get()
      .then((res) => cb({ action: "update", doc: res }))
      .catch((err) => {
        console.error("Initial document fetch failed:", err);
        cb({ error: err.message });
      });

    return this.socket.watchDoc(this.docPath, cb);
  }
}
