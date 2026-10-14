/**
 * DL-2: the former shared Multer middleware is now the secure upload pipeline.
 *
 * Historically this module configured a single `multer.diskStorage` that wrote
 * directly into the permanent private root with no content validation or
 * cleanup. It now delegates to the DL-2 secure upload lifecycle
 * (private temp -> byte validation -> checksum -> managed promotion -> cleanup)
 * while preserving the `upload.single/fields/any` surface for existing routes.
 */
export {
  createSecureUpload,
  secureUpload,
  upload,
} from "../storage/secure-upload";
export type {
  SecureMulterFile,
  SecureUpload,
  SecureUploadFactory,
} from "../storage/secure-upload";
