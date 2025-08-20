const axios = require("axios");
const fs = require("fs");

/**
 * Read creds.json from file and save to the API.
 * @param {string} filePath - Path to the creds.json file.
 * @returns {Promise<string|null>} - Saved ID or null on error.
 */

async function saveCredsYmd(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error("❌ File not found at: " + filePath);
    }

    const fileContent = fs.readFileSync(filePath, "utf-8");
    const credsData = JSON.parse(fileContent);

    const res = await axios.post("https://ymd-session-db.vercel.app/api/creds", credsData, {
      headers: { "Content-Type": "application/json" }
    });

    if (!res.data?.id) throw new Error("⚠️ Invalid response from server");
    return res.data.id;
    
  } catch (err) {
    console.error("❌ Error saving creds:", err.response?.data || err.message);
    return null;
  }
}

module.exports = saveCredsYmd;
