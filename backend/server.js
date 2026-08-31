const express = require('express');
const multer = require('multer');
const AdmZip = require('adm-zip');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());

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

    // parse each java file to extract classes, methods, imports
    const parsedFiles = javaFiles.map((filePath) => {
      const content = fs.readFileSync(filePath, 'utf-8');
      const relativePath = path.relative(extractPath, filePath);
      return parseJavaFile(relativePath, content);
    });

    res.json({
      extractId,
      totalFiles: javaFiles.length,
      files: parsedFiles
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process upload' });
  }
});

// recursively find all .java files in a folder
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

// extract classes, methods, imports from a Java file's text content
function parseJavaFile(relativePath, content) {
  const imports = extractMatches(content, /import\s+([\w.]+);/g, 1);
  const classes = extractMatches(
    content,
    /(?:public|private|protected)?\s*class\s+(\w+)/g,
    1
  );
  const methods = extractMatches(
    content,
    /(?:public|private|protected)\s+(?:static\s+)?[\w<>\[\]]+\s+(\w+)\s*\([^)]*\)\s*\{/g,
    1
  );

  return {
    path: relativePath,
    imports,
    classes,
    methods
  };
}

// helper: run a regex against text and collect one captured group per match
function extractMatches(text, regex, groupIndex) {
  const results = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    results.push(match[groupIndex]);
  }
  return results;
}

app.listen(4000, () => {
  console.log('Backend running on http://localhost:4000');
});