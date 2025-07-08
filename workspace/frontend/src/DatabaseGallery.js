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

  // ...existing code...
}
