/* eslint-disable @typescript-eslint/no-explicit-any */

// Core types
export interface Credentials {
  baseUrl: string;
  projectName: string;
  projectCode: string;
  projectToken: string;
  createdAt?: string;
  downloadedAt?: string;
}

export interface ApiResponse<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  message?: string;
  error?: string;
}

// Configuration options
export interface ApiClientOptions {
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  getToken?: () => Promise<string | null> | string | null;
  onError?: (error: any) => void;
}

export interface SocketServiceOptions {
  timeout?: number;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
  chunkSize?: number;
  getToken?: () => Promise<string | null> | string | null;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: any) => void;
}

export interface ServiceOptions {
  api?: ApiClientOptions;
  socket?: SocketServiceOptions;
}

// Upload types
export interface UploadOptions {
  baseUrl?: string;
  bucketId?: string | null;
  bucket?: string | null;
  autoDispose?: boolean;
}

export interface UploadProgress {
  file: File;
  progress: number;
  status: "pending" | "inProgress" | "completed" | "error";
  bucketId?: string | null;
  error?: string;
  url?: string;
}

// Query types
export interface WhereOptions {
  isEqualTo?: any;
  isNotEqualTo?: any;
  isGreaterThan?: number;
  isGreaterThanOrEqualTo?: number;
  isLessThan?: number;
  isLessThanOrEqualTo?: number;
  arrayContains?: any;
  arrayContainsAny?: any[];
  whereIn?: any[];
  whereNotIn?: any[];
}

export interface CollectionChangeEvent {
  add?: any[];
  update?: any;
  delete?: any;
  error?: string;
}

export interface DocumentChangeEvent {
  action?: "update" | "delete";
  doc?: any;
  error?: string;
}

// Pagination types
export interface CollectionListResult {
  collections: Array<{ name: string; documentsCount: number }>;
  page: number;
  ipp: number;
  totalCount: number;
}

export interface BucketContentResult {
  totalCount: number;
  content: any[];
}

export interface BucketInfo {
  _id: string;
  name: string;
  type: "bucket";
  description: string;
  parentId: string | null;
  isPublic: boolean;
  createdAt: string;
}

// Auth types
export interface AuthResponse {
  uid: string;
  token: string;
  name: string;
  avatar: string;
  email: string;
  roles: string[];
  emailVerified: boolean;
}

export interface AnonymousAuthResponse {
  uid: string;
  token: string;
  name: string;
  avatar: string;
  isActive: boolean;
  lastLoginAt: string;
}

// Auth Service
export class AuthService {
  constructor(params: { creds: Credentials; api: ApiClient });
  getUrl(): string;
  loginWithEmail(params: {
    email: string;
    password: string;
  }): Promise<ApiResponse<AuthResponse>>;
  registerWithEmail(params: {
    email: string;
    password: string;
    name?: string;
    avatar?: string;
    roles?: string[];
  }): Promise<ApiResponse<AuthResponse>>;
  loginWithToken(params: {
    token: string;
  }): Promise<ApiResponse<AuthResponse>>;
  anonymousLogin(params?: {
    name?: string;
    avatar?: string;
  }): Promise<ApiResponse<AnonymousAuthResponse>>;
  changePassword(params: {
    oldPassword: string;
    newPassword: string;
  }): Promise<ApiResponse>;
  sendResetPasswordEmail(params: { email: string }): Promise<ApiResponse>;
  sendEmailVerification(): Promise<ApiResponse>;
  getCurrentUser(): Promise<any | null>;
  logout(): Promise<ApiResponse>;
}

// Storage Service
export class StorageService {
  constructor(params: {
    creds: Credentials;
    api: ApiClient;
    socket: SocketService;
  });
  getUrl(): string;
  upload(params: {
    files: File | File[];
    options?: UploadOptions;
  }): CustomUpload;
  deleteFile(params: { fileId: string }): Promise<boolean>;
  getBucketContent(params: {
    bucketId: string;
    page?: number;
    ipp?: number;
  }): Promise<BucketContentResult>;
  search(params: {
    searchTerm: string;
    bucketId?: string;
    page?: number;
    ipp?: number;
  }): Promise<BucketContentResult>;
  createBucket(params: {
    name: string;
    description?: string;
    parentId?: string;
  }): Promise<BucketInfo>;
  updateBucket(params: {
    bucketId: string;
    name?: string;
    description?: string;
  }): Promise<any>;
  deleteBucket(params: { bucketId: string }): Promise<boolean>;
  getFileUrl(params: {
    fileId: string;
    filename: string;
    size?: "small" | "medium" | "large";
    token?: string;
  }): string;
}

export class CustomUpload {
  constructor(params: {
    socket: SocketService;
    files: File[];
    options: UploadOptions;
  });
  onProgress(cb: (progress: UploadProgress[]) => void): () => void;
  cancel(): void;
  then<TResult1 = string[], TResult2 = never>(
    onfulfilled?:
      | ((value: string[]) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null,
  ): Promise<TResult1 | TResult2>;
  catch<TResult = never>(
    onrejected?:
      | ((reason: any) => TResult | PromiseLike<TResult>)
      | undefined
      | null,
  ): Promise<string[] | TResult>;
  finally(onfinally?: (() => void) | undefined | null): Promise<string[]>;
}

// Database Service
export class DbService {
  constructor(params: {
    creds: Credentials;
    api: ApiClient;
    socket: SocketService;
  });
  doc(docPath: string): DocumentRef;
  col(colPath: string): CollectionRef;
  collections(params?: {
    where?: Record<string, any>;
    page?: number;
    limit?: number;
  }): Promise<CollectionListResult>;
  createCollection(params: { name: string }): Promise<{ success: boolean }>;
  renameCollection(params: { oldName: string; newName: string }): Promise<{ success: boolean }>;
}

export class CollectionRef {
  constructor(params: {
    creds: Credentials;
    colPath: string;
    socket: SocketService;
    apiClient: ApiClient;
  });
  getUrl(): string;
  get(): Promise<any[]>;
  add(data: any): Promise<any>;
  updateMany(params: {
    filter: Record<string, any>;
    newData: Record<string, any>;
  }): Promise<any>;
  deleteMany(params: { filter: Record<string, any> }): Promise<any>;
  getFilters(): Promise<{ fields: string[] }>;
  sort(sortObj: Record<string, 1 | -1>): this;
  select(selectObj: Record<string, 1 | 0> | string | string[]): this;
  limit(count: number): this;
  skip(count: number): this;
  page(num: number): this;
  where(field: string, opts: WhereOptions): this;
  watch(cb: (change: CollectionChangeEvent) => void): () => void;
  doc(docPath: string): DocumentRef;
}

export class DocumentRef {
  constructor(params: {
    creds: Credentials;
    docPath: string;
    socket: SocketService;
    apiClient: ApiClient;
  });
  getUrl(): string;
  get(): Promise<any>;
  update(data: any): Promise<boolean>;
  replace(data: any): Promise<boolean>;
  delete(): Promise<boolean>;
  watch(cb: (change: DocumentChangeEvent) => void): () => void;
}

// API Client
export class ApiClient {
  constructor(creds: Credentials, options?: ApiClientOptions);
  init(): this;
  test(): Promise<boolean>;
  post(params: { url: string; data: any; config?: any }): Promise<ApiResponse>;
  get(params: { url: string; config?: any }): Promise<ApiResponse>;
  put(params: { url: string; data: any; config?: any }): Promise<ApiResponse>;
  delete(params: { url: string; config?: any }): Promise<ApiResponse>;
}

// Socket Service
export class SocketService {
  constructor(creds: Credentials, options?: SocketServiceOptions);
  setUserToken(token: string | null): void;
  isConnected(): boolean;
  waitForConnection(timeout?: number): Promise<boolean>;
  watchCol(
    colPath: string,
    cb: (change: CollectionChangeEvent) => void,
  ): () => void;
  watchDoc(
    docPath: string,
    cb: (change: DocumentChangeEvent) => void,
  ): () => void;
  uploadFile(
    file: File,
    options: { bucketId?: string; bucketName?: string },
    onProgressUpdate?: (progress: any) => void,
  ): () => void;
  cancelUpload(uploadKey: string): void;
  getUploadStatus(uploadKey: string): {
    status: string;
    progress: number;
    error: string | null;
    url: string | null;
  } | null;
  getAllUploads(): Array<{
    key: string;
    name: string;
    size: number;
    status: string;
    progress: number;
    error: string | null;
    url: string | null;
  }>;
  close(): void;
}

// Logger
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

export interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
}

export class Logger {
  constructor(options?: LoggerOptions);
  setLevel(level: LogLevel): void;
  debug(...args: any[]): void;
  log(...args: any[]): void;
  info(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
}

export const logger: Logger;

// Main exports
export function getDatabase(
  creds: Credentials,
  options?: ServiceOptions,
): DbService;
export function getAuth(
  creds: Credentials,
  options?: ServiceOptions,
): AuthService;
export function getStorage(
  creds: Credentials,
  options?: ServiceOptions,
): StorageService;
export function dispose(): void;
