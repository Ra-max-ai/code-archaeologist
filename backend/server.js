const express = require('express');
const multer = require('multer');
const AdmZip = require('adm-zip');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());

// where uploaded ZIP files get temporarily stored
const upload = multer({ dest: 'uploads/' });

app.get('/', (req, res) => {
  res.send('Code Archaeologist backend is running!');
});

app.post('/upload', upload.single('repo'), (req, res) => {
  try {
    const zipPath = req.file.path;
    const extractId = Date.now().toString();
    const extractPath = path.join('uploads', extractId);

    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractPath, true);

    const javaFiles = [];
    walkDir(extractPath, javaFiles);

    res.json({
      extractId,
      totalFiles: javaFiles.length,
      files: javaFiles.map(f => path.relative(extractPath, f))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process upload' });
  }
});

function walkDir(dir, results) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      walkDir(fullPath, results);
    } else if (entry.name.endsWith('.java')) {
      results.push(fullPath);
    }
  }
}

app.listen(4000, () => {
  console.log('Backend running on http://localhost:4000');
});
