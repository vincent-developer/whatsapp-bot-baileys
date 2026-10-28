import fs from 'fs';
import path from 'path';
import {
  downloadScribd,
  convertScribdLink,
  getFilenameFromUrl,
} from '../../download.js';

const TEMP_DIR = './temp';

/**
 * Validate a Scribd document URL.
 * @param {string} url
 * @returns {string|null} embed URL or null if invalid
 */
export function validateScribdUrl(url) {
  return convertScribdLink(url);
}

/**
 * Download a Scribd document into ./temp and return the local PDF path.
 * @param {string} url
 * @returns {Promise<{success: true, filepath: string, fileName: string} | {success: false, error: string}>}
 */
export async function downloadScribdToTemp(url) {
  let filepath;

  try {
    if (!validateScribdUrl(url)) {
      return { success: false, error: 'Invalid Scribd URL' };
    }

    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }

    const fileName = getFilenameFromUrl(url).replace(/[^\w.\-() ]+/g, '_');
    filepath = path.join(TEMP_DIR, `scribd_${Date.now()}_${fileName}`);

    await downloadScribd(url, filepath);

    if (!fs.existsSync(filepath)) {
      return { success: false, error: 'PDF file was not created' };
    }

    return { success: true, filepath, fileName };
  } catch (error) {
    console.error('❌ Error downloading Scribd document:', error.message);
    return {
      success: false,
      error: error.message,
      filepath: filepath && fs.existsSync(filepath) ? filepath : undefined,
    };
  }
}
