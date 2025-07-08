import React, { useEffect, useState } from 'react';
import { Button, Spinner, Form } from 'react-bootstrap';

function getFileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  if (["mp4","mov","avi","mkv","webm","flv","wmv","mpeg","mpg"].includes(ext)) return "🎬";
  if (["mp3","wav","ogg","flac","m4a"].includes(ext)) return "🎵";
  return "📄";
}

export default function DatabaseGallery({ onTranscribeFile, onFileDeleted }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hoveredId, setHoveredId] = useState(null);
  const [hoveredDeleteId, setHoveredDeleteId] = useState(null);
  const [showThumbnails, setShowThumbnails] = useState(() => {
    // Load the setting from localStorage, default to false if not found
    const saved = localStorage.getItem('showThumbnails');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [transcribingId, setTranscribingId] = useState(null);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const fileInputRef = React.useRef();

  useEffect(() => {
    fetchFiles();
  }, []);

  // Save thumbnail setting to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('showThumbnails', JSON.stringify(showThumbnails));
  }, [showThumbnails]);

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
    if (onFileDeleted) onFileDeleted(id);
  }

  async function handleFileClick(fileObj) {
    // Pass the file metadata to the parent for direct transcription display
    if (onTranscribeFile) onTranscribeFile(fileObj);
  }

  async function handleDirectUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/files', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      fetchFiles();
    } catch (err) {
      setUploadError(err.message);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleTranscribeRequest(fileObj) {
    if (!fileObj || !fileObj.id) return;
    setTranscribingId(fileObj.id);
    try {
      const res = await fetch(`/files/${fileObj.id}/transcribe`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Transcription failed');
      fetchFiles();
      // Do not call onTranscribeFile here, so user stays in gallery
    } catch (err) {
      setError(err.message);
    }
    setTranscribingId(null);
  }

  return (
    <div style={{ minHeight: 300, position: 'relative' }}>
      <h3 style={{ color: '#e3e5e8', marginBottom: 24, textAlign: 'center' }}>Files Gallery</h3>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            type="file"
            accept="video/*"
            style={{ display: 'none' }}
            ref={fileInputRef}
            onChange={handleDirectUpload}
          />
          <Button
            variant="primary"
            type="button"
            disabled={uploading}
            style={{ minWidth: 100, fontWeight: 600, borderRadius: 8, marginRight: 16 }}
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
          >
            {uploading ? <Spinner animation="border" size="sm" /> : 'Add Video'}
          </Button>
          <div style={{
            position: 'relative',
            height: 38,
            minWidth: 140,
            width: 180,
            display: 'flex',
            alignItems: 'center',
            background: '#23272b',
            borderRadius: 8,
            border: searchFocused ? '2px solid #1976d2' : '2px solid #23272b',
            boxShadow: searchFocused ? '0 4px 16px #007bff44' : '0 2px 8px #0002',
            transition: 'border 0.15s, box-shadow 0.15s',
            marginLeft: 0,
            marginRight: 0,
          }}>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              style={{
                width: '100%',
                height: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#e3e5e8',
                fontWeight: 500,
                fontSize: 16,
                padding: '0 12px',
                borderRadius: 8,
                zIndex: 2,
              }}
              autoComplete="off"
            />
            {!search && !searchFocused && (
              <span style={{
                position: 'absolute',
                left: 12,
                color: '#888',
                fontSize: 16,
                pointerEvents: 'none',
                zIndex: 1,
                fontWeight: 400,
              }}>
                Search
              </span>
            )}
          </div>
        </div>
        <Form.Check 
          type="switch"
          id="thumbnail-switch"
          label="Show video thumbnails"
          checked={showThumbnails}
          onChange={() => setShowThumbnails(v => !v)}
          style={{ color: '#e3e5e8', fontWeight: 500 }}
        />
      </div>
      {uploadError && <div style={{ color: 'red', marginBottom: 8 }}>{uploadError}</div>}
      {loading ? <Spinner animation="border" /> : (
        showThumbnails ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
            {files.filter(f => !search || f.filename.toLowerCase().includes(search.toLowerCase())).map(f => (
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
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 8,
                  cursor: 'pointer',
                  border: hoveredId === f.id ? '2px solid #1976d2' : '2px solid transparent',
                  transition: 'background 0.15s, box-shadow 0.15s, border 0.15s',
                }}
                onClick={() => handleFileClick(f)}
                onMouseEnter={() => setHoveredId(f.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                  {showThumbnails && f.thumbnail ? (
                    <img 
                      src={`/thumbnails/${f.thumbnail}`} 
                      alt="thumbnail" 
                      style={{ width: 160, height: 120, objectFit: 'cover', borderRadius: 10, boxShadow: '0 4px 16px #0008' }} 
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <span style={{ fontSize: 64, flexShrink: 0 }}>{getFileIcon(f.filename)}</span>
                  )}
                </div>
                {/* Video extension label */}
                <div style={{
                  position: 'absolute',
                  top: 10,
                  left: 10,
                  background: '#e3e5e8', // light gray
                  color: '#23272b', // dark text for contrast
                  fontWeight: 700,
                  fontSize: 13,
                  borderRadius: 6,
                  padding: '2px 10px',
                  letterSpacing: 1,
                  boxShadow: '0 2px 8px #0003',
                  zIndex: 3,
                  textTransform: 'uppercase',
                  opacity: 0.92,
                  pointerEvents: 'none',
                }}>
                  {f.filename.split('.').pop()}
                </div>
                <div
                  style={{
                    color: '#e3e5e8',
                    wordBreak: 'break-all',
                    fontSize: 15,
                    width: '100%',
                    fontWeight: 500,
                    lineHeight: 1.2,
                    overflow: 'hidden',
                    textOverflow: hoveredId === f.id ? 'clip' : 'ellipsis',
                    whiteSpace: hoveredId === f.id ? 'normal' : 'nowrap',
                    marginTop: 8,
                    marginBottom: 8,
                    textAlign: 'center',
                    maxWidth: '100%',
                    cursor: hoveredId === f.id ? 'pointer' : 'default',
                    background: hoveredId === f.id ? '#23272b' : 'transparent',
                    borderRadius: 6,
                    padding: hoveredId === f.id ? '2px 4px' : 0,
                    transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                    maxHeight: hoveredId === f.id ? 80 : 22,
                    display: 'block',
                  }}
                  title={f.filename}
                >
                  {hoveredId === f.id
                    ? f.filename
                    : f.filename.length > 28
                      ? f.filename.slice(0, 25) + '...'
                      : f.filename}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minHeight: 24, justifyContent: hoveredId === f.id && f.transcription_status !== 'transcribed' ? 'center' : 'flex-start' }}>
                  <span style={{ fontSize: 13, color: f.transcription_status === 'transcribed' ? '#4caf50' : '#ff9800', fontWeight: 700, letterSpacing: 0.5 }}>
                    {f.transcription_status === 'transcribed' ? 'Transcribed' : 'Not Transcribed'}
                  </span>
                  {f.transcription_status !== 'transcribed' && (
                    <Button
                      variant="success"
                      type="button"
                      size="sm"
                      style={{ 
                        minWidth: 60,
                        height: 22,
                        fontWeight: 600, 
                        borderRadius: 8, 
                        marginLeft: hoveredId === f.id ? 0 : 8,
                        padding: '0 6px',
                        fontSize: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      onClick={e => { e.stopPropagation(); handleTranscribeRequest(f); }}
                      disabled={transcribingId === f.id}
                    >
                      {transcribingId === f.id ? <Spinner animation="border" size="sm" /> : 'Transcribe'}
                    </Button>
                  )}
                </div>
                <Button 
                  variant="danger" 
                  size="sm" 
                  style={{ 
                    borderRadius: 10,
                    width: '100%',
                    padding: 0,
                    fontWeight: 700, 
                    background: hoveredDeleteId === f.id ? '#a71d2a' : '#c82333',
                    border: hoveredDeleteId === f.id ? '2px solid #ff4d4f' : '2px solid #c82333',
                    boxShadow: hoveredDeleteId === f.id ? '0 4px 16px #ff4d4f44' : 'none',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'center',
                    fontSize: 18,
                    alignSelf: 'stretch',
                    cursor: 'pointer',
                    transition: 'background 0.15s, box-shadow 0.15s, border 0.15s',
                    marginTop: 4,
                    textAlign: 'center',
                    height: 18,
                    lineHeight: '18px',
                  }} 
                  onClick={e => { e.stopPropagation(); handleDelete(f.id); }} 
                  onMouseEnter={() => setHoveredDeleteId(f.id)}
                  onMouseLeave={() => setHoveredDeleteId(null)}
                  title="Delete file"
                >
                  <span style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', width: '100%', height: '100%', marginTop: -2.5 }}>×</span>
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {files.filter(f => !search || f.filename.toLowerCase().includes(search.toLowerCase())).map(f => (
              <div key={f.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: hoveredId === f.id ? '#2a2e33' : '#23272b',
                  borderRadius: 10,
                  padding: '10px 20px',
                  minHeight: 40,
                  boxShadow: hoveredId === f.id ? '0 4px 16px #007bff44' : '0 2px 8px #0002',
                  border: hoveredId === f.id ? '2px solid #1976d2' : '2px solid transparent',
                  transition: 'background 0.15s, box-shadow 0.15s, border 0.15s',
                  cursor: 'pointer',
                  gap: 16,
                  position: 'relative',
                }}
                onMouseEnter={() => setHoveredId(f.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => handleFileClick(f)}
              >
                <span style={{ fontSize: 28, marginRight: 16 }}>{getFileIcon(f.filename)}</span>
                <div style={{
                  flex: 1,
                  color: '#e3e5e8',
                  fontWeight: 500,
                  fontSize: 15,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginRight: 12,
                }} title={f.filename}>
                  {f.filename}
                </div>
                <span style={{ fontSize: 13, color: f.transcription_status === 'transcribed' ? '#4caf50' : '#ff9800', fontWeight: 700, letterSpacing: 0.5, marginRight: 12 }}>
                  {f.transcription_status === 'transcribed' ? 'Transcribed' : 'Not Transcribed'}
                </span>
                {f.transcription_status !== 'transcribed' && (
                  <Button
                    variant="success"
                    type="button"
                    size="sm"
                    style={{
                      minWidth: 60,
                      height: 22,
                      fontWeight: 600,
                      borderRadius: 8,
                      fontSize: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                    onClick={e => { e.stopPropagation(); handleTranscribeRequest(f); }}
                    disabled={transcribingId === f.id}
                  >
                    {transcribingId === f.id ? <Spinner animation="border" size="sm" /> : 'Transcribe'}
                  </Button>
                )}
                <Button
                  variant="danger"
                  size="sm"
                  style={{
                    borderRadius: 8,
                    fontWeight: 700,
                    background: hoveredDeleteId === f.id ? '#a71d2a' : '#c82333',
                    border: hoveredDeleteId === f.id ? '2px solid #ff4d4f' : '2px solid #c82333',
                    boxShadow: hoveredDeleteId === f.id ? '0 4px 16px #ff4d4f44' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    height: 28,
                    width: 32,
                    marginLeft: 8,
                    transition: 'background 0.15s, box-shadow 0.15s, border 0.15s',
                  }}
                  onClick={e => { e.stopPropagation(); handleDelete(f.id); }}
                  onMouseEnter={() => setHoveredDeleteId(f.id)}
                  onMouseLeave={() => setHoveredDeleteId(null)}
                  title="Delete file"
                >
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>×</span>
                </Button>
              </div>
            ))}
          </div>
        )
      )}
      {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
    </div>
  );
}
