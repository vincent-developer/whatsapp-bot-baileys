import { Document, Packer, Paragraph, TextRun } from 'docx';
import fs from 'fs';
import path from 'path';

export async function generateDocx(text, filename = 'converted_document') {
  try {
    // Split text by newlines
    const lines = text.split('\n');
    
    // Buat paragraphs untuk setiap baris
    const paragraphs = lines.map(line => {
      // Jika baris kosong, tetap buat paragraph kosong untuk spacing
      return new Paragraph({
        children: [
          new TextRun({
            text: line || '', // Baris kosong tetap valid
            size: 24, // 12pt font
          }),
        ],
        spacing: {
          after: 120, // Spacing after paragraph (optional, buat lebih rapi)
        },
      });
    });

    // Buat dokumen Word
    const doc = new Document({
      sections: [{
        properties: {},
        children: paragraphs,
      }],
    });

    // Generate buffer
    const buffer = await Packer.toBuffer(doc);
    
    // Simpan sementara ke temp folder
    const tempDir = './temp';
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const filepath = path.join(tempDir, `${filename}_${Date.now()}.docx`);
    fs.writeFileSync(filepath, buffer);
    
    return {
      success: true,
      filepath,
      buffer
    };
  } catch (error) {
    console.error('❌ Error generating docx:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export function cleanupTempFile(filepath) {
  try {
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      console.log('🗑️  Temp file deleted:', filepath);
    }
  } catch (error) {
    console.error('⚠️  Failed to delete temp file:', error);
  }
}