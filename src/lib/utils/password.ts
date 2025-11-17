import bcrypt from 'bcryptjs';

/**
 * Generates a hash from a plain text password.
 *
 * @param {string} password - The password to hash.
 * @returns {Promise<string>} - The hashed password.
 */
export const hashPassword = async (password: string): Promise<string> => {
  const hashedPassword = await bcrypt.hash(password, 12);
  return hashedPassword;
};

/**
 * Compares a plain text password with an existing hash.
 *
 * @param {string} password - The plain text password.
 * @param {string} hash - The hash to compare against.
 * @returns {Promise<boolean>} - True if the passwords match, false otherwise.
 */
export const comparePasswords = async (password: string, hash: string): Promise<boolean> => {
  const isMatch = await bcrypt.compare(password, hash);
  return isMatch;
};
