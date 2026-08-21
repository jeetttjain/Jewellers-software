import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env from root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

export const env = {
  NODE_ENV: process.env['NODE_ENV'] || 'development',
  PORT: parseInt(process.env['PORT'] || process.env['API_PORT'] || '3001', 10),
  HOST: process.env['HOST'] || process.env['API_HOST'] || '0.0.0.0',
  WEB_ORIGIN: process.env['WEB_ORIGIN'] || 'http://localhost:5173',
  DATABASE_URL: process.env['DATABASE_URL'] || 'postgresql://postgres:postgres@localhost:5432/jewellery_pos_db',
  JWT_SECRET: process.env['JWT_SECRET'] || 'dev_jwt_secret_key_super_secure_random_64_bytes_jewellery_pos_erp',
  COOKIE_SECRET: process.env['COOKIE_SECRET'] || 'dev_cookie_secret_key_super_secure_random_64_bytes_jewellery_pos',
  isDev: (process.env['NODE_ENV'] || 'development') === 'development',
  isProd: process.env['NODE_ENV'] === 'production'
};
