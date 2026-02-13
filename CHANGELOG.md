# Changelog

## Version 1.0.0 (Improved) - 2026-02-11

### Breaking Changes
- TypeScript definitions now match actual implementation
- `StorageService.uploadFiles()` renamed to `upload()`
- All methods now throw errors instead of returning error objects
- Removed platform-specific code (getUserToken) - now uses callback pattern

### Added

#### Core Features
- **Singleton disposal**: Added `dispose()` function to cleanup all resources
- **Connection lifecycle**: Socket now has `isConnected()` and `waitForConnection()`
- **Configuration options**: API and Socket services accept configuration objects
- **Retry logic**: API client automatically retries failed requests with exponential backoff
- **Upload cancellation**: Can now cancel individual uploads via `upload.cancel()`
- **Additional auth methods**: `getCurrentUser()` and `logout()`
- **Storage methods**: `delete()` and `getFileInfo()`
- **Document delete method**: `doc().delete()` now available

#### Validation
- Credentials validation on initialization
- Input validation for all public methods
- Email format validation
- Password strength validation (min 6 characters)
- File validation for uploads
- Path validation for collections/documents

#### Error Handling
- Proper error throwing with descriptive messages
- Try-catch blocks in all async operations
- Error propagation with context
- Cleanup on upload failures
- Socket error callbacks

#### Logging
- Log levels (DEBUG, INFO, WARN, ERROR, NONE)
- Configurable logger with prefix
- Logger exports for custom instances

### Changed

#### API Improvements
- `getUserToken` now accepts callback via options
- Consistent method naming (`delete()` instead of `del()`)
- Better TypeScript types with strict mode compliance
- Improved JSDoc comments
- Socket listeners properly tracked and cleaned up

#### Performance
- Configurable chunk size for uploads
- Configurable timeouts and retry attempts
- Better memory management in uploads
- Proper cleanup of event listeners

#### Developer Experience
- Comprehensive README with examples
- TypeScript definitions match implementation
- Better error messages
- Removed all `console.log` debug statements

### Removed
- Platform-specific cookie handling (moved to callback)
- Unused code and commented sections
- Debug console.log statements

### Fixed
- Memory leaks in upload tracking
- Socket listener cleanup
- Type mismatches between .d.ts and .js
- Missing error handling in singleton creation
- Upload progress tracking edge cases
- Socket connection state management

### Documentation
- Complete README with examples
- API documentation in TypeScript definitions
- JSDoc comments for all public methods
- Configuration options documented
- Best practices section added

## Migration Guide

### From Original to Improved Version

1. **Credentials validation**: Ensure all required fields are present
   ```javascript
   // Before: Would fail silently
   const db = getDatabase({});
   
   // After: Throws descriptive error
   const db = getDatabase({
     baseUrl: 'https://...',
     projectCode: 'xxx',
     projectToken: 'yyy'
   });
   ```

2. **Error handling**: Wrap calls in try-catch
   ```javascript
   // Before: Check result.ok
   const result = await auth.loginWithEmail({...});
   if (result.ok) { ... }
   
   // After: Use try-catch
   try {
     await auth.loginWithEmail({...});
   } catch (error) {
     console.error(error.message);
   }
   ```

3. **Storage upload**: Method renamed
   ```javascript
   // Before
   storage.uploadFiles({ files, bucketId, options })
   
   // After
   storage.upload({ files, options: { bucketId } })
   ```

4. **Token provider**: Use callback pattern
   ```javascript
   // Before: Hard-coded cookie handling
   
   // After: Custom callback
   const db = getDatabase(creds, {
     api: {
       getToken: async () => {
         return yourCustomTokenGetter();
       }
     }
   });
   ```

5. **Document delete**: Use delete() method
   ```javascript
   // Before
   db.doc('users/123').del()
   
   // After
   db.doc('users/123').delete()
   ```

6. **Cleanup**: Call dispose when done
   ```javascript
   import { dispose } from 'flexdocs';
   
   // When shutting down
   dispose();
   ```
