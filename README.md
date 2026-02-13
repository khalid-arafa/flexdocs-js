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
  name: 'John Doe',
  email: 'john@example.com',
  password: 'password123'
});
```

### Login
```javascript
const result = await auth.loginWithEmail({
  email: 'john@example.com',
  password: 'password123'
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

### Collections

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
    if (u.status === 'completed') {
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

### Delete File
```javascript
await storage.delete({
  url: 'https://api.flexdocs.io/storage/file123.jpg'
});
```

### Get File Info
```javascript
const info = await storage.getFileInfo({
  url: 'https://api.flexdocs.io/storage/file123.jpg'
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

## Examples

See `/examples` directory for complete working examples:
- Authentication flow
- Real-time chat
- File upload with progress
- CRUD operations

## License

MIT

## Support

For issues and feature requests, please visit [GitHub Issues](https://github.com/your-org/flexdocs).
