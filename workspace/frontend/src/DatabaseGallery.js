import React, { useEffect, useState, useRef } from 'react';
import { Button, Spinner, Modal, Form } from 'react-bootstrap';

function getFileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  if (["mp4","mov","avi","mkv","webm","flv","wmv","mpeg","mpg"].includes(ext)) return "🎬";
  if (["mp3","wav","ogg","flac","m4a"].includes(ext)) return "🎵";
  return "📄";
}

export default function DatabaseGallery() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addFile, setAddFile] = useState(null);
  const [addLoading, setAddLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef();

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

  async function handleAdd(e) {
    e.preventDefault();
    if (!addFile) return;
    setAddLoading(true);
    setError("");
    const formData = new FormData();
    formData.append("file", addFile);
    try {
      const res = await fetch("/files", { method: "POST", body: formData });
      if (!res.ok) {
        if (res.status === 409) {
          setError("File already exists.");
        } else {
          setError("Failed to add file.");
        }
        setAddLoading(false);
        return;
      }
      setShowAdd(false);
      setAddFile(null);
      fetchFiles();
    } catch {
      setError("Failed to add file.");
    }
    setAddLoading(false);
  }

  return (
    <div style={{ minHeight: 300 }}>
      <h3 style={{ color: '#e3e5e8', marginBottom: 24 }}>Transcribed Files Gallery</h3>
      {loading ? <Spinner animation="border" /> : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
          {files.map(f => (
            <div key={f.id} style={{ background: '#23272b', borderRadius: 10, padding: 16, minWidth: 120, textAlign: 'center', position: 'relative', boxShadow: '0 2px 8px #0002' }}>
              <span style={{ fontSize: 36 }}>{getFileIcon(f.filename)}</span>
              <div style={{ color: '#e3e5e8', marginTop: 8, wordBreak: 'break-all', fontSize: 14 }}>{f.filename}</div>
              <Button variant="danger" size="sm" style={{ position: 'absolute', top: 6, right: 6, borderRadius: '50%', padding: '2px 7px', fontWeight: 700 }} onClick={() => handleDelete(f.id)} title="Delete file">-</Button>
            </div>
          ))}
          <div style={{ background: '#23272b', borderRadius: 10, padding: 16, minWidth: 120, textAlign: 'center', position: 'relative', boxShadow: '0 2px 8px #0002', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowAdd(true)}>
            <span style={{ fontSize: 36, color: '#1976d2' }}>+</span>
            <div style={{ color: '#e3e5e8', marginTop: 8, fontSize: 14 }}>Add file</div>
          </div>
        </div>
      )}
      <Modal show={showAdd} onHide={() => setShowAdd(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Add File to Database</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleAdd}>
            <Form.Group>
              <Form.Label>Select file</Form.Label>
              <Form.Control type="file" ref={fileInputRef} onChange={e => setAddFile(e.target.files[0])} />
            </Form.Group>
            {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
            <Button type="submit" variant="primary" disabled={addLoading} style={{ marginTop: 16 }}>
              {addLoading ? <Spinner animation="border" size="sm" /> : 'Add File'}
            </Button>
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
}
