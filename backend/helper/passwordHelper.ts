import bcrypt from "bcryptjs";
import sha256 from "crypto-js/sha256";
import { userModel } from "../models";
import { log } from "../utils/loggers";

const BCRYPT_ROUNDS = 12;

/**
 * Hash a password using bcrypt with adaptive cost factor.
 * OWASP-compliant: uses bcrypt with 12 rounds (~250ms on modern hardware).
 */
export const hashPassword = (plainPassword: string): string => {
  return bcrypt.hashSync(plainPassword, BCRYPT_ROUNDS);
};

/**
 * Verify a password against a stored hash.
 * Supports transparent migration from legacy SHA-256 to bcrypt:
 * 1. Try bcrypt.compareSync first (new hashes start with $2a$ or $2b$)
 * 2. If the stored hash is not bcrypt format, try SHA-256 comparison
 * 3. If SHA-256 matches, rehash with bcrypt and update DB (transparent migration)
 *
 * @returns true if password is valid, false otherwise
 */
export const verifyPassword = async (
  plainPassword: string,
  storedHash: string,
  userId?: number
): Promise<boolean> => {
  // Check if stored hash is bcrypt format ($2a$, $2b$, $2y$)
  const isBcryptHash = /^\$2[aby]?\$/.test(storedHash);

  if (isBcryptHash) {
    return bcrypt.compareSync(plainPassword, storedHash);
  }

  // Legacy SHA-256 comparison (for existing users who haven't logged in since migration)
  const sha256Hash = sha256(plainPassword).toString();
  if (sha256Hash === storedHash) {
    // Transparent migration: rehash with bcrypt and update DB
    if (userId) {
      try {
        const bcryptHash = hashPassword(plainPassword);
        await userModel.update(
          { password: bcryptHash },
          { where: { user_id: userId } }
        );
        log(`[PasswordMigration] User ${userId} migrated from SHA-256 to bcrypt`);
      } catch (err) {
        log(`[PasswordMigration] Failed to migrate user ${userId}: ${err}`, 'error');
        // Don't fail the login even if migration fails
      }
    }
    return true;
  }

  return false;
};

/**
 * Validate password strength (OWASP guidelines).
 * Returns null if valid, or an error message string.
 */
export const validatePasswordStrength = (password: string): string | null => {
  if (!password || password.length < 8) {
    return "Password must be at least 8 characters long";
  }
  if (password.length > 128) {
    return "Password must not exceed 128 characters";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must contain at least one lowercase letter";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must contain at least one number";
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
    return "Password must contain at least one special character";
  }
  return null;
};
