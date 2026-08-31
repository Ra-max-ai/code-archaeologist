'use client';
import { useState } from 'react';

export default function Home() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setAnswer('');
    const formData = new FormData();
    formData.append('repo', file);

    const res = await fetch('http://localhost:4000/upload', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    setResult(data);
    setLoading(false);
  };

  const handleAsk = async () => {
    if (!question || !result?.extractId) return;
    setAsking(true);
    setAnswer('');

    const res = await fetch('http://localhost:4000/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ extractId: result.extractId, question }),
    });
    const data = await res.json();
    setAnswer(data.answer || data.error || 'Something went wrong.');
    setAsking(false);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-8">
      <h1 className="text-3xl font-bold mb-2">🧑‍💻 Code Archaeologist</h1>
      <p className="text-slate-400 mb-8">Upload a Java codebase to begin analysis</p>

      <div className="border-2 border-dashed border-slate-700 rounded-xl p-10 w-full max-w-md text-center">
        <input
          type="file"
          accept=".zip"
          onChange={(e) => setFile(e.target.files[0])}
          className="mb-4 text-sm"
        />
        <button
          onClick={handleUpload}
          disabled={!file || loading}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 px-4 py-2 rounded-lg font-medium transition"
        >
          {loading ? 'Analyzing...' : 'Upload & Scan'}
        </button>
      </div>

      {result && (
        <>
          <div className="mt-8 w-full max-w-2xl bg-slate-900 rounded-xl p-6">
            <p className="mb-4">✅ Found <strong>{result.totalFiles}</strong> Java files</p>
            <div className="space-y-4 max-h-[20rem] overflow-y-auto">
              {result.files?.map((f, i) => (
                <div key={i} className="bg-slate-800 rounded-lg p-4">
                  <p className="font-mono text-indigo-400 text-sm mb-2">{f.path}</p>
                  {f.classes.length > 0 && (
                    <p className="text-xs text-slate-400 mb-1">
                      <span className="text-emerald-400 font-semibold">Classes:</span> {f.classes.join(', ')}
                    </p>
                  )}
                  {f.methods.length > 0 && (
                    <p className="text-xs text-slate-400 mb-1">
                      <span className="text-amber-400 font-semibold">Methods:</span> {f.methods.join(', ')}
                    </p>
                  )}
                  {f.imports.length > 0 && (
                    <p className="text-xs text-slate-400">
                      <span className="text-sky-400 font-semibold">Imports:</span> {f.imports.join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* NEW: Ask a question section */}
          <div className="mt-6 w-full max-w-2xl bg-slate-900 rounded-xl p-6">
            <p className="mb-3 font-semibold">🤖 Ask about this codebase</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. How does UserService work?"
                className="flex-1 bg-slate-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleAsk}
                disabled={!question || asking}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 px-4 py-2 rounded-lg font-medium text-sm transition"
              >
                {asking ? 'Thinking...' : 'Ask'}
              </button>
            </div>

            {answer && (
              <div className="mt-4 bg-slate-800 rounded-lg p-4 text-sm whitespace-pre-wrap text-slate-200">
                {answer}
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}