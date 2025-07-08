import React, { useState, useRef } from 'react';
import { Container, Form, Button, Alert, Spinner, InputGroup, Nav } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import DatabaseSearch from './DatabaseSearch';
import DatabaseGallery from './DatabaseGallery';
import { saveAs } from 'file-saver';

function App() {
  const [file, setFile] = useState(null);
  const [transcription, setTranscription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [qaLoading, setQaLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);
  const [activeSegment, setActiveSegment] = useState(null);
  const [segments, setSegments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [fileGroupFocused, setFileGroupFocused] = useState(false);
  const [qaGroupFocused, setQaGroupFocused] = useState(false);
  const [page, setPage] = useState('transcribe');
  const [fileInputKey, setFileInputKey] = useState(0);
  const fileInputRef = useRef(null);
  const questionInputRef = useRef(null);
  const videoRef = useRef(null);
  const [hoveredSegment, setHoveredSegment] = useState(null);
  const [segmentWordCounts, setSegmentWordCounts] = useState([]); // NEW: store word count per segment
  const totalWordsRef = useRef(0); // NEW: store total word count
  const [fileId, setFileId] = useState(null); // Track fileId for download
  const [selectedDbFile, setSelectedDbFile] = useState(null); // Track selected DB file

  // ...existing code...

  // Add handler for when a file is deleted in the gallery
  const handleFileDeleted = (deletedId) => {
    if (selectedDbFile && selectedDbFile.id === deletedId) {
      setSelectedDbFile(null);
      setFileId(null);
      setTranscription('');
      setSegments([]);
      setVideoUrl(null);
      setError('');
      setAnswer('');
      setQuestion('');
    }
  };

  // ...existing code...

  return (
    <Container className="mt-5" style={{ maxWidth: 1200 }}>
      <Nav variant="tabs" activeKey={page} onSelect={setPage} className="mb-4" style={{
        background: 'linear-gradient(90deg, #343a40 0%, #495057 100%)',
        borderRadius: 10,
        border: '1px solid #343a40',
        padding: '2px 8px',
        boxShadow: '0 2px 8px #0002',
      }}>
        <Nav.Item>
          <Nav.Link eventKey="transcribe" style={{
            color: '#f1f1f1',
            fontWeight: 600,
            fontSize: '1.05rem',
            borderRadius: 8,
            margin: '2px 4px',
            background: page === 'transcribe' ? 'rgba(0,123,255,0.18)' : 'transparent',
            border: page === 'transcribe' ? '1.5px solid #007bff' : 'none',
            boxShadow: page === 'transcribe' ? '0 2px 8px #007bff33' : 'none',
            transition: 'background 0.2s, border 0.2s',
          }}>Transcribe</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="database-search" style={{
            color: '#f1f1f1',
            fontWeight: 600,
            fontSize: '1.05rem',
            borderRadius: 8,
            margin: '2px 4px',
            background: page === 'database-search' ? 'rgba(0,123,255,0.18)' : 'transparent',
            border: page === 'database-search' ? '1.5px solid #007bff' : 'none',
            boxShadow: page === 'database-search' ? '0 2px 8px #007bff33' : 'none',
            transition: 'background 0.2s, border 0.2s',
          }}>Database Search</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="database" style={{
            color: '#f1f1f1',
            fontWeight: 600,
            fontSize: '1.05rem',
            borderRadius: 8,
            margin: '2px 4px',
            background: page === 'database' ? 'rgba(0,123,255,0.18)' : 'transparent',
            border: page === 'database' ? '1.5px solid #007bff' : 'none',
            boxShadow: page === 'database' ? '0 2px 8px #007bff33' : 'none',
            transition: 'background 0.2s, border 0.2s',
          }}>Database</Nav.Link>
        </Nav.Item>
      </Nav>
      {page === 'database-search' && <DatabaseSearch onTranscribeFile={handleTranscribeFileFromGallery} />}
      {page === 'database' && <DatabaseGallery onTranscribeFile={handleTranscribeFileFromGallery} onFileDeleted={handleFileDeleted} />}
      {page === 'transcribe' && (
        <>
          {/* ...existing code... */}
        </>
      )}
    </Container>
  );
}

export default App;
