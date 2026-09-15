const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

/**
 * Upload image to Cloudinary
 * @param {string} filePath - Path to the image file
 * @param {string} folder - Folder name in Cloudinary
 * @returns {Promise<Object>} Upload result
 */
async function uploadImage(filePath, folder = 'dailybloom/products') {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [
        { quality: 'auto', fetch_format: 'auto' },
        { width: 800, height: 800, crop: 'limit' }
      ],
      eager: [
        { quality: 'auto', fetch_format: 'auto', width: 400, height: 400, crop: 'limit' }
      ]
    });
    return result;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error('Failed to upload image');
  }
}

/**
 * Upload image from buffer
 * @param {Buffer} buffer - Image buffer
 * @param {string} folder - Folder name in Cloudinary
 * @returns {Promise<Object>} Upload result
 */
async function uploadImageFromBuffer(buffer, folder = 'dailybloom/products') {
  try {
    const result = await cloudinary.uploader.upload_stream(
      {
        folder,
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [
          { quality: 'auto', fetch_format: 'auto' },
          { width: 800, height: 800, crop: 'limit' }
        ],
        eager: [
          { quality: 'auto', fetch_format: 'auto', width: 400, height: 400, crop: 'limit' }
        ]
      },
      (error, result) => {
        if (error) throw error;
        return result;
      }
    );

    return new Promise((resolve, reject) => {
      buffer.pipe(result);
      result.on('end', resolve);
      result.on('error', reject);
    });
  } catch (error) {
    console.error('Cloudinary upload from buffer error:', error);
    throw new Error('Failed to upload image');
  }
}

/**
 * Delete image from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<Object>} Delete result
 */
async function deleteImage(publicId) {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw new Error('Failed to delete image');
  }
}

/**
 * Extract public ID from Cloudinary URL
 * @param {string} url - Cloudinary URL
 * @returns {string} Public ID
 */
function extractPublicId(url) {
  if (!url) return null;
  const matches = url.match(/\/v\d+\/(.+)\.\w+$/);
  return matches ? matches[1] : null;
}

module.exports = {
  uploadImage,
  uploadImageFromBuffer,
  deleteImage,
  extractPublicId,
  cloudinary
};
