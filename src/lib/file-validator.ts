export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// Magic bytes for known executable/dangerous file types
const DANGEROUS_SIGNATURES: { bytes: number[]; label: string }[] = [
  { bytes: [0x4d, 0x5a], label: 'Windows executable (EXE/DLL)' },
  { bytes: [0x7f, 0x45, 0x4c, 0x46], label: 'Linux executable (ELF)' },
  { bytes: [0xca, 0xfe, 0xba, 0xbe], label: 'macOS executable (Mach-O)' },
  { bytes: [0x50, 0x4b, 0x03, 0x04], label: 'ZIP archive' }, // Could be JAR/APK
  { bytes: [0x52, 0x61, 0x72, 0x21], label: 'RAR archive' },
];


const SUSPICIOUS_PATTERNS = [
  /<script[\s>]/i,
  /javascript:/i,
  /vbscript:/i,
  /on\w+\s*=\s*["']/i,
  /eval\s*\(/i,
  /document\.write/i,
  /ActiveXObject/i,
  /WScript\.Shell/i,
  /powershell/i,
  /cmd\.exe/i,
];

export async function validateFile(file: File): Promise<ValidationResult> {
  const ext = ('.' + file.name.split('.').pop()?.toLowerCase()) || '';
  const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt', '.md'];

  // Check extension
  if (!allowedExtensions.includes(ext)) {
    return { valid: false, error: `Unsupported file format "${ext}". Accepted: ${allowedExtensions.join(', ')}` };
  }

  // Check size
  if (file.size > 10 * 1024 * 1024) {
    return { valid: false, error: 'File size exceeds the 10 MB limit.' };
  }

  // Check for empty files
  if (file.size === 0) {
    return { valid: false, error: 'File is empty.' };
  }

  // Read first bytes for magic number validation
  const headerBuffer = await file.slice(0, 16).arrayBuffer();
  const headerBytes = new Uint8Array(headerBuffer);

  // For binary formats, check magic bytes
  if (['.pdf', '.doc', '.docx'].includes(ext)) {
    // Check for dangerous signatures (EXE, ELF, etc.)
    for (const sig of DANGEROUS_SIGNATURES) {
      // Skip ZIP check for .docx (DOCX files are ZIP-based)
      if (sig.label === 'ZIP archive' && ext === '.docx') continue;

      const matches = sig.bytes.every((byte, i) => headerBytes[i] === byte);
      if (matches) {
        return { valid: false, error: `File rejected: detected as ${sig.label}. This file type is not allowed.` };
      }
    }

    // Verify the file matches expected format
    if (ext === '.pdf' && headerBytes[0] !== 0x25) {
      return { valid: false, error: 'File content does not match PDF format. The file may be corrupted or mislabeled.' };
    }
    if (ext === '.doc' && headerBytes[0] !== 0xd0 && headerBytes[0] !== 0x50) {
      return { valid: false, error: 'File content does not match DOC format. The file may be corrupted or mislabeled.' };
    }
    if (ext === '.docx' && headerBytes[0] !== 0x50) {
      return { valid: false, error: 'File content does not match DOCX format. The file may be corrupted or mislabeled.' };
    }
  }

  // For text-based formats, scan for suspicious content
  if (['.txt', '.md'].includes(ext)) {
    const textContent = await file.text();

    for (const pattern of SUSPICIOUS_PATTERNS) {
      if (pattern.test(textContent)) {
        return { valid: false, error: 'File rejected: contains potentially executable or malicious content.' };
      }
    }

    // Check for null bytes (indicates binary content disguised as text)
    if (textContent.includes('\0')) {
      return { valid: false, error: 'File rejected: contains binary content. Please upload a valid text file.' };
    }
  }

  return { valid: true };
}
