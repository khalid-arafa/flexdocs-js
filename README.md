# FlexDocs SDK

JavaScript/TypeScript SDK for FlexDocs BaaS (Backend as a Service).

## Installation

```bash
npm install flexdocs
```

## Quick Start

```javascript
import { getDatabase, getAuth, getStorage } from 'flexdocs';

// Initialize with credentials
const creds = {
  baseUrl: 'https://api.flexdocs.io',
  projectCode: 'your-project-code',
  projectToken: 'your-project-token',
  projectName: 'Your Project'
};

// Get service instances
const db = getDatabase(creds);
const auth = getAuth(creds);
const storage = getStorage(creds);
```

## Configuration Options

### API Client Options
```javascript
const options = {
  api: {
    timeout: 30000,           // Request timeout in ms
    retryAttempts: 3,         // Number of retry attempts
    retryDelay: 1000,         // Delay between retries in ms
    getToken: async () => {   // Custom token provider
      return await getUserToken();
    },
    onError: (error) => {     // Error handler
      console.error(error);
    }
  }
};

const db = getDatabase(creds, options);
```

### Socket Options
```javascript
const options = {
  socket: {
    timeout: 10000,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    chunkSize: 64 * 1024,     // Upload chunk size
    getToken: async () => {   // User token for authenticated socket
      return await getUserToken();
    },
    onConnect: () => console.log('Connected'),
    onDisconnect: () => console.log('Disconnected'),
    onError: (err) => console.error(err)
  }
};

const storage = getStorage(creds, options);
```

## Authentication

### Register
```javascript
const result = await auth.registerWithEmail({
  email: 'john@example.com',
  password: 'password123',
  name: 'John Doe',           // optional
  avatar: 'https://...',      // optional
  roles: ['editor']           // optional
});
```

### Login
```javascript
const result = await auth.loginWithEmail({
  email: 'john@example.com',
  password: 'password123'
});
```

### Login with Token
```javascript
const result = await auth.loginWithToken({
  token: 'existing-jwt-token'
});
```

### Anonymous Login
```javascript
const result = await auth.anonymousLogin({
  name: 'Guest User',   // optional
  avatar: 'https://...' // optional
});
```

### Change Password
```javascript
const result = await auth.changePassword({
  oldPassword: 'oldpass123',
  newPassword: 'newpass123'
});
```

### Reset Password
```javascript
await auth.sendResetPasswordEmail({
  email: 'john@example.com'
});
```

### Get Current User
```javascript
const user = await auth.getCurrentUser();
```

### Logout
```javascript
await auth.logout();
```

## Database

### Manage Collections

#### List Collections
```javascript
const result = await db.collections({
  page: 1,
  limit: 20
});
// { collections: [{ name: 'users', documentsCount: 42 }], page: 1, ipp: 20, totalCount: 5 }
```

#### Create Collection
```javascript
await db.createCollection({ name: 'posts' });
```

### Collection Operations

#### Get Documents
```javascript
const users = await db.col('users').get();
```

#### Add Document
```javascript
const newUser = await db.col('users').add({
  name: 'Jane Doe',
  email: 'jane@example.com',
  age: 25
});
```

#### Query with Filters
```javascript
const adults = await db.col('users')
  .where('age', { isGreaterThanOrEqualTo: 18 })
  .where('status', { isEqualTo: 'active' })
  .sort({ createdAt: -1 })
  .limit(10)
  .get();
```

#### Pagination
```javascript
// Page-based
const page2 = await db.col('users').page(2).limit(20).get();

// Skip-based
const results = await db.col('users').skip(40).limit(20).get();
```

#### Get Field Names
```javascript
const { fields } = await db.col('users').getFilters();
// { fields: ['_id', 'name', 'email', 'age', 'createdAt'] }
```

#### Update Many Documents
```javascript
const result = await db.col('posts').updateMany({
  filter: { status: 'draft' },
  newData: { status: 'published' }
});
```

#### Delete Many Documents
```javascript
const result = await db.col('posts').deleteMany({
  filter: { status: 'archived' }
});
```

#### Watch Collection (Real-time)
```javascript
const unsubscribe = db.col('users').watch((change) => {
  if (change.add) {
    console.log('Initial data:', change.add);
  }
  if (change.update) {
    console.log('Updated:', change.update);
  }
  if (change.delete) {
    console.log('Deleted:', change.delete);
  }
});

// Cleanup
unsubscribe();
```

### Documents

#### Get Document
```javascript
const user = await db.doc('users/user123').get();
```

#### Update Document
```javascript
await db.doc('users/user123').update({
  name: 'Updated Name',
  lastModified: new Date()
});
```

#### Replace Document
```javascript
await db.doc('users/user123').replace({
  name: 'Completely New Data',
  email: 'new@example.com'
});
```

#### Delete Document
```javascript
await db.doc('users/user123').delete();
```

#### Watch Document (Real-time)
```javascript
const unsubscribe = db.doc('users/user123').watch((change) => {
  if (change.action === 'update') {
    console.log('Document updated:', change.doc);
  }
  if (change.action === 'delete') {
    console.log('Document deleted');
  }
});

// Cleanup
unsubscribe();
```

### Query Operators

```javascript
// Equality
.where('status', { isEqualTo: 'active' })
.where('status', { isNotEqualTo: 'deleted' })

// Comparison
.where('age', { isGreaterThan: 18 })
.where('age', { isGreaterThanOrEqualTo: 21 })
.where('age', { isLessThan: 65 })
.where('age', { isLessThanOrEqualTo: 100 })

// Arrays
.where('tags', { arrayContains: 'javascript' })
.where('tags', { arrayContainsAny: ['javascript', 'typescript'] })
.where('category', { whereIn: ['tech', 'science'] })
.where('category', { whereNotIn: ['spam', 'deleted'] })
```

## Storage

### Upload Files
```javascript
const fileInput = document.querySelector('input[type="file"]');
const files = fileInput.files;

const upload = storage.upload({
  files: files,
  options: {
    bucketId: 'my-bucket',
    autoDispose: true
  }
});

// Track progress
const unsubscribe = upload.onProgress((uploads) => {
  uploads.forEach(u => {
    console.log(`${u.file.name}: ${u.progress}%`);
    if (u.status === 'complete') {
      console.log('URL:', u.url);
    }
    if (u.status === 'error') {
      console.log('Error:', u.error);
    }
  });
});

// Wait for completion
try {
  const urls = await upload;
  console.log('All uploads completed:', urls);
} catch (error) {
  console.error('Upload failed:', error);
}

// Cancel upload
upload.cancel();
```

### Buckets

#### Browse Bucket Content
```javascript
const content = await storage.getBucketContent({
  bucketId: 'home',  // or a specific bucket ID
  page: 1,
  ipp: 20
});
// { totalCount: 25, content: [{ name: 'images', type: 'bucket' }, ...] }
```

#### Create Bucket
```javascript
const bucket = await storage.createBucket({
  name: 'avatars',
  description: 'User avatars',
  parentId: null   // null for root
});
```

#### Update Bucket
```javascript
await storage.updateBucket({
  bucketId: 'bucket-id',
  name: 'new-name',
  description: 'Updated description'
});
```

#### Delete Bucket
```javascript
await storage.deleteBucket({ bucketId: 'bucket-id' });
```

### Files

#### Delete File
```javascript
await storage.deleteFile({ fileId: 'file-id' });
```

#### Search Files & Buckets
```javascript
const results = await storage.search({
  searchTerm: 'photo',
  bucketId: 'bucket-id',  // optional, scope search
  page: 1,
  ipp: 20
});
```

#### Get File URL
```javascript
const url = storage.getFileUrl({
  fileId: 'file-id',
  filename: 'photo.jpg',
  size: 'small',     // optional: 'small', 'medium', 'large'
  token: 'jwt-token' // optional: for private files
});
```

## Error Handling

All methods throw errors that can be caught:

```javascript
try {
  const user = await db.doc('users/user123').get();
} catch (error) {
  console.error('Error:', error.message);
}
```

## Cleanup

Dispose all services when done:

```javascript
import { dispose } from 'flexdocs';

// Clean up all resources
dispose();
```

## TypeScript Support

Full TypeScript support with type definitions:

```typescript
import { getDatabase, Credentials, CollectionRef } from 'flexdocs';

const creds: Credentials = {
  baseUrl: 'https://api.flexdocs.io',
  projectCode: 'your-project-code',
  projectToken: 'your-project-token',
  projectName: 'Your Project'
};

const db = getDatabase(creds);
const usersCol: CollectionRef = db.col('users');
```

## Best Practices

1. **Initialize once**: Use singleton instances (automatically handled)
2. **Error handling**: Always wrap async calls in try-catch
3. **Cleanup subscriptions**: Always call unsubscribe functions
4. **Validate inputs**: SDK validates inputs, but pre-validation is recommended
5. **Connection handling**: Use `socket.isConnected()` to check connection state

## License

MIT

## Support

For issues and feature requests, please visit [GitHub Issues](https://github.com/your-org/flexdocs).
