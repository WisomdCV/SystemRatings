import bcrypt from 'bcryptjs';

/**
 * Genera un hash de una contraseña en texto plano.
 * @param {string} password - La contraseña a hashear.
 * @returns {Promise<string>} - El hash de la contraseña.
 */
export const hashPassword = async (password: string) => {
  const hashedPassword = await bcrypt.hash(password, 12);
  return hashedPassword;
};

/**
 * Compara una contraseña en texto plano con un hash existente.
 * @param {string} password - La contraseña en texto plano.
 * @param {string} hash - El hash contra el que se compara.
 * @returns {Promise<boolean>} - True si las contraseñas coinciden, false en caso contrario.
 */
export const comparePasswords = async (password: string, hash: string) => {
  const isMatch = await bcrypt.compare(password, hash);
  return isMatch;
};
