import React, { useEffect, useState } from 'react';
import { Button, Spinner } from 'react-bootstrap';

function getFileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  if (["mp4","mov","avi","mkv","webm","flv","wmv","mpeg","mpg"].includes(ext)) return "🎬";
  if (["mp3","wav","ogg","flac","m4a"].includes(ext)) return "🎵";
  return "📄";
}

export default function DatabaseGallery({ onTranscribeFile }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hoveredId, setHoveredId] = useState(null);
  const [hoveredDeleteId, setHoveredDeleteId] = useState(null);

  useEffect(() => {
    fetchFiles();
  }, []);

  async function fetchFiles() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/files");
      const data = await res.json();
      setFiles(data.files || []);
    } catch {
      setError("Failed to load files.");
    }
    setLoading(false);
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this file and its transcription?")) return;
    await fetch(`/files/${id}`, { method: "DELETE" });
    fetchFiles();
  }

  async function handleFileClick(fileObj) {
    // Pass the file metadata to the parent for direct transcription display
    if (onTranscribeFile) onTranscribeFile(fileObj);
  }

  return (
    <div style={{ minHeight: 300 }}>
      <h3 style={{ color: '#e3e5e8', marginBottom: 24 }}>Transcribed Files Gallery</h3>
      {loading ? <Spinner animation="border" /> : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
          {files.map(f => (
            <div key={f.id}
              style={{
                background: hoveredId === f.id ? '#2a2e33' : '#23272b',
                borderRadius: 10,
                padding: 16,
                minWidth: 220,
                maxWidth: 260,
                textAlign: 'left',
                position: 'relative',
                boxShadow: hoveredId === f.id ? '0 4px 16px #007bff44' : '0 2px 8px #0002',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer',
                border: hoveredId === f.id ? '2px solid #1976d2' : '2px solid transparent',
                transition: 'background 0.15s, box-shadow 0.15s, border 0.15s',
              }}
              onClick={() => handleFileClick(f)}
              onMouseEnter={() => setHoveredId(f.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <span style={{ fontSize: 36, flexShrink: 0, marginRight: 8 }}>{getFileIcon(f.filename)}</span>
              <div style={{ color: '#e3e5e8', wordBreak: 'break-all', fontSize: 14, flex: 1, marginRight: 8 }}>{f.filename}</div>
              <Button 
                variant="danger" 
                size="sm" 
                style={{ 
                  borderRadius: 6, // square with slight rounding
                  padding: '2px 12px', 
                  fontWeight: 700, 
                  marginLeft: 8, 
                  background: hoveredDeleteId === f.id ? '#a71d2a' : '#c82333',
                  border: hoveredDeleteId === f.id ? '2px solid #ff4d4f' : 'none',
                  boxShadow: hoveredDeleteId === f.id ? '0 4px 16px #ff4d4f44' : '0 2px 8px #0002',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  height: 32, // match container height
                  alignSelf: 'center', // center vertically
                  cursor: 'pointer',
                  transition: 'background 0.15s, box-shadow 0.15s, border 0.15s',
                }} 
                onClick={e => { e.stopPropagation(); handleDelete(f.id); }} 
                onMouseEnter={() => setHoveredDeleteId(f.id)}
                onMouseLeave={() => setHoveredDeleteId(null)}
                title="Delete file"
              >
                ×
              </Button>
            </div>
          ))}
        </div>
      )}
      {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
    </div>
  );
}
