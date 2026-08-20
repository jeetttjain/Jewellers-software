import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { ITEM_IMAGE_DIR, ensureItemImageDir } from '../services/item_images.service.js';
import fs from 'fs';
import path from 'path';

export const itemAssetRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  ensureItemImageDir();

  app.get<{ Params: { '*': string } }>('/product-images/*', async (request, reply) => {
    const filename = request.params['*'];
    if (!filename || !/^[\w\-]+\.(png|jpg|jpeg|webp)$/i.test(filename)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_FILENAME', message: 'Invalid asset filename format' }
      });
    }

    const resolvedPath = path.resolve(ITEM_IMAGE_DIR, filename);
    const normalizedDir = path.normalize(ITEM_IMAGE_DIR).toLowerCase();
    const normalizedPath = path.normalize(resolvedPath).toLowerCase();

    if (!normalizedPath.startsWith(normalizedDir) || !fs.existsSync(resolvedPath)) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Product image asset not found' }
      });
    }

    const ext = path.extname(filename).toLowerCase();
    const contentTypeMap: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp'
    };

    const contentType = contentTypeMap[ext] || 'application/octet-stream';
    reply.header('Cache-Control', 'private, max-age=86400');
    const buffer = fs.readFileSync(resolvedPath);
    return reply.type(contentType).send(buffer);
  });
};
