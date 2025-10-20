declare module 'word-extractor';

// Provide minimal Multer namespace typing to use Express.Multer.File in our code
// This is only to unblock type checking where full @types/multer may be missing in the editor
// Actual types are provided by @types/multer devDependency during build
declare namespace Express {
  namespace Multer {
    interface File {
      /** Name of the form field associated with this file. */
      fieldname: string;
      /** Name of the file on the user's computer. */
      originalname: string;
      /** Value of the `Content-Transfer-Encoding` header for this file. */
      encoding: string;
      /** Value of the `Content-Type` header for this file. */
      mimetype: string;
      /** Size of the file in bytes. */
      size: number;
      /** The folder to which the file has been saved (DiskStorage). */
      destination: string;
      /** The full path to the uploaded file (DiskStorage). */
      path: string;
      /** A Buffer of the entire file (MemoryStorage). */
      buffer: Buffer;
      /** File name within destination (DiskStorage). */
      filename: string;
    }
  }
}
