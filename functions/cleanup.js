const { onRequest } = require("firebase-functions/v2/https");
const { google } = require("googleapis");

exports.cleanupServiceAccountDrive = onRequest(async (req, res) => {
  try {
    const auth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/drive"],
    });
    const drive = google.drive({ version: "v3", auth });

    // 1. List all files owned by the Service Account (excluding the template if possible)
    // Be CAREFUL: This deletes EVERYTHING owned by the robot not in trash.
    const listRes = await drive.files.list({
      q: "'me' in owners and trashed = false and mimeType != 'application/vnd.google-apps.folder'",
      fields: "files(id, name, createdTime)",
      pageSize: 100, // Do 100 at a time
    });

    const files = listRes.data.files;
    if (!files || files.length === 0) {
      return res.send("No files found to delete.");
    }

    let deletedCount = 0;
    const errors = [];

    // 2. Delete them
    for (const file of files) {
      // OPTIONAL: Skip your specific template ID if you know it, to avoid re-sharing it
      // if (file.id === 'YOUR_TEMPLATE_ID') continue; 

      try {
        console.log(`Deleting file: ${file.name} (${file.id})`);
        await drive.files.delete({ fileId: file.id });
        deletedCount++;
      } catch (err) {
        console.error(`Failed to delete ${file.name}:`, err.message);
        errors.push(file.name);
      }
    }

    res.send({
      message: `Cleanup complete. Deleted ${deletedCount} files.`,
      errors: errors,
      remaining_candidates: files.length - deletedCount
    });

  } catch (error) {
    console.error("Cleanup failed:", error);
    res.status(500).send({ error: error.message });
  }
});