require('dotenv').config();
const express = require('express');
const multer = require('multer');
const AdmZip = require('adm-zip');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { GoogleGenAI } = require('@google/genai');

const app = express();
app.use(cors());
app.use(express.json()); // allows reading JSON request bodies

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const upload = multer({ dest: 'uploads/' });

// keep track of parsed files per upload, in memory, so /ask can use them later
const projectStore = {};

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

    const parsedFiles = javaFiles.map((filePath) => {
      const content = fs.readFileSync(filePath, 'utf-8');
      const relativePath = path.relative(extractPath, filePath);
      return { ...parseJavaFile(relativePath, content), content };
    });

    // save this project's data in memory so /ask can reference it
    projectStore[extractId] = parsedFiles;

    res.json({
      extractId,
      totalFiles: javaFiles.length,
      files: parsedFiles.map(({ content, ...rest }) => rest) // don't send full content to frontend, just metadata
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process upload' });
  }
});

// NEW: build a dependency graph for a previously uploaded project
app.get('/dependencies/:extractId', (req, res) => {
  try {
    const { extractId } = req.params;
    const files = projectStore[extractId];

    if (!files) {
      return res.status(404).json({ error: 'Project not found. Please upload again.' });
    }

    const graph = buildDependencyGraph(files);
    res.json({ graph });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to build dependency graph' });
  }
});

// NEW: given all parsed files, figure out which classes reference which other classes
function buildDependencyGraph(files) {
  // collect every class name in the whole project
  const allClassNames = files.flatMap((f) => f.classes);

  // for each file, check its content for mentions of OTHER classes
  return files.map((file) => {
    const dependsOn = new Set();

    for (const className of allClassNames) {
      // skip checking a class against itself
      if (file.classes.includes(className)) continue;

      // use a word-boundary regex so "User" doesn't match inside "UserService"
      const pattern = new RegExp(`\\b${className}\\b`);
      if (pattern.test(file.content)) {
        dependsOn.add(className);
      }
    }

    return {
      file: file.path,
      classes: file.classes,
      dependsOn: Array.from(dependsOn)
    };
  });
}

// NEW: ask a question about a previously uploaded project
app.post('/ask', async (req, res) => {
  try {
    const { extractId, question } = req.body;
    const files = projectStore[extractId];

    if (!files) {
      return res.status(404).json({ error: 'Project not found. Please upload again.' });
    }

    // build a simple context string from all files (fine for small test projects;
    // a real RAG system would only pick relevant files instead of sending everything)
    const codeContext = files
      .map((f) => `--- File: ${f.path} ---\n${f.content}`)
      .join('\n\n');

    const prompt = `You are a code analysis assistant. Below is the source code of a small Java project.

${codeContext}

Question: ${question}

Answer clearly and reference specific file names, classes, or methods where relevant.`;

        const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
    });

    res.json({ answer: response.text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get answer from AI' });
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

function parseJavaFile(relativePath, content) {
  const imports = extractMatches(content, /import\s+([\w.]+);/g, 1);
  const classes = extractMatches(content, /(?:public|private|protected)?\s*class\s+(\w+)/g, 1);
  const methods = extractMatches(
    content,
    /(?:public|private|protected)\s+(?:static\s+)?[\w<>\[\]]+\s+(\w+)\s*\([^)]*\)\s*\{/g,
    1
  );
  return { path: relativePath, imports, classes, methods };
}

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