const fs = require('fs');
const path = require('path');

function encodeFileToBase64(filePath) {
  try {
    const fileData = fs.readFileSync(filePath); // Read file as buffer
    return fileData.toString('base64'); // Convert buffer to base64
  } catch (err) {
    console.error("❌ Error reading file:", err.message);
    return null;
  }
}

module.exports = { encodeFileToBase64 };
