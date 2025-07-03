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

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setFile(file);
    setTranscription('');
    setError('');
    setAnswer('');
    setQuestion('');
    setVideoUrl(file ? URL.createObjectURL(file) : null);
    setSegments([]);
    setActiveSegment(null);
    setFileGroupFocused(false);
    setSearchTerm('');
    setSearchResults([]);
    setFileId(null); // Reset fileId
  };

  const handleTimeUpdate = (e) => {
    const currentTime = e.target.currentTime;
    if (segments.length > 0) {
      const idx = segments.findIndex(seg => currentTime >= seg.start && currentTime <= seg.end);
      setActiveSegment(idx);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a video file.');
      return;
    }
    setLoading(true);
    setError('');
    setTranscription('');
    setAnswer('');
    setQuestion('');
    if (fileInputRef.current) fileInputRef.current.blur();
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch('/transcribe', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (response.ok) {
        // If backend returns segments with timestamps
        if (Array.isArray(data.segments)) {
          setSegments(data.segments);
          setTranscription(data.segments.map(s => s.text).join(' '));
        } else {
          setTranscription(data.transcription);
        }
      } else {
        setError(data.error || 'Transcription failed.');
      }
    } catch (err) {
      setError('Server error.');
    }
    setLoading(false);
  };

  const handleAsk = async (e) => {
    e.preventDefault();
    if (!question.trim()) {
      setError('Please enter a question.');
      return;
    }
    setQaLoading(true);
    setError('');
    setAnswer('');
    if (questionInputRef.current) questionInputRef.current.blur();
    try {
      const response = await fetch('/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: transcription, question }),
      });
      const data = await response.json();
      if (response.ok) {
        setAnswer(data.answer);
      } else {
        setError(data.error || 'Q&A failed.');
      }
    } catch (err) {
      setError('Server error.');
    }
    setQaLoading(false);
  };

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (!value.trim()) {
      setSearchResults([]);
      return;
    }
    if (segments.length > 0) {
      const results = segments
        .map((seg, idx) => ({ ...seg, idx }))
        .filter(seg => seg.text.toLowerCase().includes(value.toLowerCase()));
      setSearchResults(results);
    } else if (transcription) {
      // fallback: search in plain transcription
      const regex = new RegExp(value, 'gi');
      let match;
      const results = [];
      while ((match = regex.exec(transcription))) {
        results.push({
          text: match[0],
          start: null,
          end: null,
          idx: null,
          index: match.index
        });
      }
      setSearchResults(results);
    }
  };

  // Accept optional highlight info: { text, index }
  // Highlight state for search redirection
  const [highlightInfo, setHighlightInfo] = useState(null);

  async function handleTranscribeFileFromGallery(fileObj, highlight) {
    if (fileObj && fileObj.id) {
      setLoading(true);
      setError('');
      setTranscription('');
      setAnswer('');
      setQuestion('');
      setSegments([]);
      setActiveSegment(null);
      setSearchTerm('');
      setSearchResults([]);
      setFile(null);
      setPage('transcribe');
      setHighlightInfo(null); // Reset highlight
      try {
        setVideoUrl(`/files/${fileObj.id}/download`);
        setTranscription(fileObj.transcription || '');
        let segs = [];
        setFileId(fileObj.id || null); // Set fileId for download
        setSelectedDbFile(fileObj); // NEW: track selected DB file
        if (fileObj.segments && Array.isArray(fileObj.segments) && fileObj.segments.length > 0) {
          setSegments(fileObj.segments);
          setSegmentWordCounts([]);
          totalWordsRef.current = 0;
          segs = fileObj.segments;
        } else if (fileObj.transcription) {
          const words = fileObj.transcription.split(/\s+/).filter(Boolean);
          const chunkSize = 3;
          const duration = (fileObj.duration && !isNaN(fileObj.duration)) ? fileObj.duration : null;
          let wordSegments = [];
          let wordCounts = [];
          for (let i = 0; i < words.length; i += chunkSize) {
            const chunkWords = words.slice(i, i + chunkSize);
            wordSegments.push({
              text: chunkWords.join(' '),
              start: i, // index-based for now
              end: i + chunkWords.length
            });
            wordCounts.push(chunkWords.length);
          }
          setSegments(wordSegments);
          setSegmentWordCounts(wordCounts);
          totalWordsRef.current = words.length;
          segs = wordSegments;
        } else {
          setSegments([]);
          setSegmentWordCounts([]);
          totalWordsRef.current = 0;
        }
        setFileId(fileObj.id || null);
        // Show info if not transcribed
        if (fileObj.transcription_status !== 'transcribed') {
          setError('This video has not been transcribed yet. Please transcribe it to enable transcript features.');
        }
        // Set highlight info for rendering
        if (highlight && highlight.index !== undefined && highlight.index !== null) {
          setTimeout(() => {
            setHighlightInfo({ ...highlight, ts: Date.now() });
            // Seek to the segment containing the match
            if (segs && segs.length > 0) {
              // Find the segment whose text contains the match, or whose text range covers the match index
              let charCount = 0;
              let foundIdx = null;
              for (let i = 0; i < segs.length; ++i) {
                const segText = segs[i].text;
                const segStart = charCount;
                const segEnd = charCount + segText.length;
                if (highlight.index >= segStart && highlight.index < segEnd) {
                  foundIdx = i;
                  break;
                }
                charCount = segEnd + 1; // +1 for space
              }
              if (foundIdx !== null && segs[foundIdx].start !== undefined) {
                // Wait for video to be ready
                setTimeout(() => {
                  const video = document.querySelector('video');
                  if (video && typeof segs[foundIdx].start === 'number') {
                    video.currentTime = segs[foundIdx].start;
                  }
                }, 400);
              }
            }
          }, 600); // Wait for render
        }
      } catch {
        setError('Failed to fetch transcription.');
      }
      setLoading(false);
    }
  }

  // Helper to check if segments are index-based (not time-based)
  function segmentsAreIndexBased(segments) {
    return segments.length > 0 && typeof segments[0].start === 'number' && typeof segments[0].end === 'number' && segments[0].end <= totalWordsRef.current + 3;
  }

  // Handler for when video metadata is loaded (duration available)
  const handleVideoLoadedMetadata = () => {
    if (videoRef.current && segments.length > 0 && segmentsAreIndexBased(segments) && totalWordsRef.current > 0 && segmentWordCounts.length === segments.length) {
      const duration = videoRef.current.duration;
      let wordIdx = 0;
      const newSegments = segments.map((seg, i) => {
        const segWordCount = segmentWordCounts[i];
        const start = (wordIdx / totalWordsRef.current) * duration;
        const end = ((wordIdx + segWordCount) / totalWordsRef.current) * duration;
        wordIdx += segWordCount;
        return { ...seg, start, end };
      });
      setSegments(newSegments);
    }
  };

  // Download transcription as TXT
  const handleDownloadTxt = async () => {
    let defaultName = 'transcription.txt';
    if (file && file.name) {
      defaultName = file.name.replace(/\.[^/.]+$/, '') + '.txt';
    }
    if (!fileId) {
      // fallback: download current transcription as txt
      const blob = new Blob([transcription], { type: 'text/plain;charset=utf-8' });
      saveAs(blob, defaultName);
      return;
    }
    try {
      const res = await fetch(`/files/${fileId}/download-txt`);
      if (!res.ok) throw new Error('Failed to download TXT');
      const blob = await res.blob();
      // Try to get filename from Content-Disposition
      let filename = defaultName;
      const disposition = res.headers.get('Content-Disposition');
      if (disposition && disposition.indexOf('filename=') !== -1) {
        filename = disposition.split('filename=')[1].replace(/['"]/g, '');
      }
      saveAs(blob, filename);
    } catch {
      const blob = new Blob([transcription], { type: 'text/plain;charset=utf-8' });
      saveAs(blob, defaultName);
    }
  };

  // Add handler for transcribing selected DB file
  async function handleTranscribeSelectedDbFile() {
    if (!selectedDbFile || !selectedDbFile.id) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/files/${selectedDbFile.id}/transcribe`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Transcription failed');
      // Update UI with new transcription
      setTranscription(data.file.transcription || '');
      setSegments(Array.isArray(data.file.segments) ? data.file.segments : []);
      setFileId(selectedDbFile.id);
      setSelectedDbFile({ ...selectedDbFile, ...data.file });
      setError('');
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

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
      {page === 'database' && <DatabaseGallery onTranscribeFile={handleTranscribeFileFromGallery} />}
      {page === 'transcribe' && (
        <>
          <h2
            style={{
              textAlign: 'center',
              fontWeight: 700,
              fontSize: '2.4rem',
              letterSpacing: '2px',
              background: 'none',
              color: '#e3e5e8',
              WebkitBackgroundClip: undefined,
              WebkitTextFillColor: undefined,
              backgroundClip: undefined,
              textFillColor: undefined,
              fontFamily: 'inherit',
              textShadow: '0 0 16px rgba(0, 17, 255, 0.12), 0 4px 24px #222b, 0 1px 0 #fff2',
              borderRadius: '8px',
              boxShadow: '0 2px 8px #0002',
              padding: '0.5rem 0',
              marginBottom: '2.2rem',
              textTransform: 'uppercase',
            }}
          >
            <span role="img" aria-label="camera" style={{fontSize: '2.1rem', verticalAlign: '0.3rem', marginRight: 10}}>🎥</span>
            MEETING ASSISTANT
            <span role="img" aria-label="assistant" style={{fontSize: '2.1rem', verticalAlign: '0.2rem', marginLeft: 10}}>🤖</span>
          </h2>
          <Form onSubmit={handleSubmit} style={{ marginBottom: 0 }}>
            <div style={{ borderRadius: 8, boxShadow: fileGroupFocused ? '0 0 0 0.2rem #1976d2' : 'none', transition: 'box-shadow 1s' }}>
              <InputGroup className="mb-3" style={{ alignItems: 'stretch' }}>
                <Form.Control 
                  key={fileInputKey}
                  type="file" 
                  accept="video/*" 
                  ref={fileInputRef}
                  onChange={handleFileChange} 
                  style={{ background: '#23272b', color: '#f1f1f1', borderRight: 0, borderTopRightRadius: 0, borderBottomRightRadius: 0, boxShadow: 'none' }}
                  onFocus={() => setFileGroupFocused(true)}
                  onBlur={() => setFileGroupFocused(false)}
                />
                <Button 
                  variant="primary" 
                  type="submit" 
                  disabled={loading} 
                  style={{ minWidth: 120, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, boxShadow: 'none' }}
                  onFocus={() => setFileGroupFocused(true)}
                  onBlur={() => setFileGroupFocused(false)}
                  onClick={e => e.target.blur()}
                >
                  {loading ? <Spinner animation="border" size="sm" /> : 'Transcribe'}
                </Button>
              </InputGroup>
            </div>
          </Form>
          {videoUrl && (
            <div className="mt-4" style={{ width: '100%' }}>
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                style={{ width: '100%', minHeight: 400, borderRadius: 12, background: '#23272b' }}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleVideoLoadedMetadata}
              />
            </div>
          )}
          <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', marginTop: 24 }}>
            <div style={{ flex: 3, minWidth: 0 }}>
              {(segments.length > 0 || transcription) && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', height: 40, gap: 0 }}>
                    <span style={{
                      background: 'linear-gradient(90deg, #343a40 0%, #495057 100%)',
                      color: '#f1f1f1',
                      fontWeight: 600,
                      fontSize: '1.05rem',
                      borderTopLeftRadius: 10,
                      borderTopRightRadius: 10, // Rounded upper right corner
                      padding: '6px 18px 2px 18px',
                      border: '1px solid #343a40',
                      borderBottom: 'none',
                      marginLeft: 0,
                      marginBottom: 0,
                      boxShadow: '0 -2px 8px #0002',
                      letterSpacing: '0.5px',
                      zIndex: 2,
                      position: 'relative',
                      height: 40,
                      display: 'flex',
                      alignItems: 'center',
                    }}>Meeting Transcript:</span>
                    {transcription && (
                      <Button
                        variant="primary"
                        size="sm"
                        style={{
                          marginLeft: 0,
                          minWidth: 32,
                          width: 30,
                          height: 40, // Match height to Meeting Transcript
                          fontWeight: 600,
                          borderTopRightRadius: 10, // Rounded upper right corner
                          borderBottomLeftRadius: 0,
                          borderBottomRightRadius: 0,
                          boxShadow: '0 2px 8px #0002',
                          color: '#fff',
                          fontFamily: 'inherit',
                          fontSize: '1.15rem',
                          padding: 0,
                          border: '1px solid #343a40',
                          borderBottom: 'none',
                          display: 'flex',
                          alignItems: 'center', // align icon to center
                          justifyContent: 'center',
                          position: 'relative',
                          top: 0, // align with text field
                        }}
                        onClick={handleDownloadTxt}
                        title="Download as TXT"
                      >
                        <svg width="18" height="60" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M10 3V14M10 14L5 9M10 14L15 9" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <rect x="4" y="16" width="12" height="2" rx="1" fill="#fff"/>
                        </svg>
                      </Button>
                    )}
                  </div>
                  <div className="transcript-box" style={{
                    maxHeight: 350,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'inherit',
                    fontSize: '1.15rem',
                    marginTop: 0,
                    border: '1px solid #343a40',
                    borderTopLeftRadius: 0,
                    borderTopRightRadius: 10,
                    borderBottomLeftRadius: 10,
                    borderBottomRightRadius: 10,
                    background: '#23272b',
                    position: 'relative',
                    zIndex: 1,
                  }}>
                    <div className="m-0" style={{whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', fontSize: '1.15rem'}}>
                      {segments.length > 0
                        ? segments.map((seg, idx) => (
                            <span
                              key={idx}
                              style={{
                                background: idx === activeSegment
                                  ? '#007bff55'
                                  : hoveredSegment === idx
                                  ? '#ffe06699'
                                  : searchResults.some(r => r.idx === idx)
                                  ? '#ffe06655'
                                  : 'transparent',
                                borderRadius: 4,
                                transition: 'background 0.2s',
                                cursor: 'pointer',
                              }}
                              onClick={() => {
                                const video = document.querySelector('video');
                                if (video) {
                                  video.currentTime = seg.start;
                                  video.play();
                                }
                              }}
                              onMouseEnter={() => setHoveredSegment(idx)}
                              onMouseLeave={() => setHoveredSegment(null)}
                            >
                              {seg.text + ' '}
                            </span>
                          ))
                        : (() => {
                            if (highlightInfo && highlightInfo.index !== undefined && highlightInfo.text) {
                              // Render with highlight
                              const before = transcription.slice(0, highlightInfo.index);
                              const match = transcription.slice(highlightInfo.index, highlightInfo.index + highlightInfo.text.length);
                              const after = transcription.slice(highlightInfo.index + highlightInfo.text.length);
                              // Remove highlight after 1.8s
                              setTimeout(() => setHighlightInfo(null), 1800);
                              return <>
                                {before}
                                <span id="highlighted-search" style={{ background: '#ffe066', color: '#23272b', borderRadius: 4, padding: '2px 4px' }}>{match}</span>
                                {after}
                              </>;
                            } else {
                              return transcription;
                            }
                          })()}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 260 }}>
              <Form.Group controlId="searchKeyword" className="mb-3">
                <div style={{ display: 'flex', alignItems: 'flex-end', height: 36 }}>
                  <span style={{
                    display: 'block',
                    width: '100%',
                    background: 'linear-gradient(90deg, #343a40 0%, #495057 100%)', // match choose file gradient
                    color: '#f1f1f1', // match file input button text
                    fontWeight: 600,
                    fontSize: '1.05rem',
                    borderTopLeftRadius: 10,
                    borderTopRightRadius: 10,
                    padding: '6px 12px 2px 12px', // match input padding
                    border: '1px solid #343a40',
                    borderBottom: 'none',
                    marginLeft: 0, // align perfectly with output field
                    marginBottom: 0, // flush top
                    boxShadow: '0 -2px 8px #0002',
                    letterSpacing: '0.5px',
                    zIndex: 2,
                    position: 'relative',
                    boxSizing: 'border-box',
                  }}>Search meeting transcript</span>
                </div>
                <Form.Control
                  type="text"
                  value={searchTerm}
                  onChange={handleSearch}
                  placeholder="Type keyword..."
                  style={{
                    border: '1px solid #343a40',
                    borderTopLeftRadius: 0, // remove top left radius
                    borderTopRightRadius: 0, // remove top right radius
                    borderBottomLeftRadius: 10,
                    borderBottomRightRadius: 10,
                    background: '#23272b',
                    color: '#f1f1f1',
                    marginTop: 0,
                    zIndex: 1,
                    position: 'relative',
                  }}
                />
              </Form.Group>
              {searchResults.length > 0 && (
                <div style={{ maxHeight: 200, overflowY: 'auto', background: '#23272b', borderRadius: 8, padding: 12, color: '#f1f1f1', fontSize: '1.05rem' }}>
                  <b>Results:</b>
                  <ul style={{ paddingLeft: 18 }}>
                    {searchResults.map((res, i) => (
                      <li key={i} style={{ cursor: res.idx !== null ? 'pointer' : 'default' }}
                        onClick={() => {
                          if (res.idx !== null && segments[res.idx] && videoUrl) {
                            const video = document.querySelector('video');
                            if (video) {
                              video.currentTime = segments[res.idx].start;
                              video.play();
                            }
                          }
                        }}
                      >
                        {res.text}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
          {error && <Alert variant="danger" className="mt-3">{error}</Alert>}
          {transcription && (
            <Form onSubmit={handleAsk} className="mt-4" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', height: 36, marginBottom: 0 }}>
                <span style={{
                  background: 'linear-gradient(90deg, #343a40 0%, #495057 100%)',
                  color: '#f1f1f1',
                  fontWeight: 600,
                  fontSize: '1.05rem',
                  borderTopLeftRadius: 10,
                  borderTopRightRadius: 10, // Rounded upper right corner
                  borderBottomLeftRadius: 0,
                  borderBottomRightRadius: 0, // Not rounded
                  padding: '6px 18px 2px 18px',
                  border: '1px solid #343a40',
                  borderBottom: 'none',
                  marginLeft: 0,
                  marginBottom: 0,
                  boxShadow: '0 -2px 8px #0002',
                  letterSpacing: '0.5px',
                  zIndex: 2,
                  position: 'relative',
                }}>Ask a question about the meeting</span>
              </div>
              <div style={{ borderRadius: 4, boxShadow: qaGroupFocused ? '0 0 0 0.2rem #1976d2' : 'none', transition: 'box-shadow 0.15s' }}>
                <InputGroup>
                  <Form.Control
                    type="text"
                    value={question}
                    ref={questionInputRef}
                    onChange={e => setQuestion(e.target.value)}
                    placeholder="Ask a question about the meeting..."
                    disabled={qaLoading}
                    style={{
                      background: '#23272b',
                      color: '#f1f1f1',
                      boxShadow: qaGroupFocused ? '0 0 0 0.2rem #1976d2' : 'none',
                      borderTopLeftRadius: 0,
                      borderTopRightRadius: 0,
                      borderBottomLeftRadius: 6,
                      borderBottomRightRadius: 0,
                      outline: 'none',
                      transition: 'box-shadow 0.15s',
                    }}
                    onFocus={() => setQaGroupFocused(true)}
                    onBlur={() => setQaGroupFocused(false)}
                  />
                  <Button 
                    variant="primary" 
                    type="submit" 
                    disabled={qaLoading} 
                    style={{
                      minWidth: 80,
                      boxShadow: qaGroupFocused ? '0 0 0 0.2rem #1976d2' : 'none',
                      borderTopLeftRadius: 0,
                      borderTopRightRadius: 6,
                      borderBottomLeftRadius: 0,
                      borderBottomRightRadius: 6,
                      outline: 'none',
                      transition: 'box-shadow 0.15s',
                    }}
                    onFocus={() => setQaGroupFocused(true)}
                    onBlur={() => setQaGroupFocused(false)}
                    onClick={e => e.target.blur()}
                  >
                    {qaLoading ? <Spinner animation="border" size="sm" /> : 'Ask'}
                  </Button>
                </InputGroup>
              </div>
            </Form>
          )}
          {answer && (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-end', height: 36, marginTop: 24 }}>
                <span style={{
                  background: 'linear-gradient(90deg, #343a40 0%, #495057 100%)',
                  color: '#f1f1f1',
                  fontWeight: 600,
                  fontSize: '1.05rem',
                  borderTopLeftRadius: 10,
                  borderTopRightRadius: 10, // Rounded upper right corner
                  padding: '6px 18px 2px 18px',
                  border: '1px solid #343a40',
                  borderBottom: 'none',
                  marginLeft: 0, // nudge left for alignment
                  marginBottom: 0,
                  boxShadow: '0 -2px 8px #0002',
                  letterSpacing: '0.5px',
                  zIndex: 2,
                  position: 'relative',
                }}>Answer:</span>
              </div>
              <div className="answer-box mt-0" style={{
                maxHeight: 120, // similar to transcript-box
                minHeight: 32, // a bit more space for single-line answers
                overflowY: 'auto',
                overflowX: 'hidden',
                whiteSpace: 'pre-wrap',
                fontFamily: 'inherit',
                fontSize: '1.15rem',
                border: '1px solid #343a40',
                borderTopLeftRadius: 0,
                borderTopRightRadius: 10, // Rounded upper right corner
                borderBottomLeftRadius: 10,
                borderBottomRightRadius: 10,
                background: '#23272b',
                position: 'relative',
                zIndex: 1,
                marginTop: 0, // remove extra margin
                padding: '1rem 1rem 1rem 1rem', // match transcript-box
                boxShadow: '0 2px 8px #0002',
                display: 'flex',
                alignItems: 'flex-start',
              }}>
                <div className="m-0" style={{whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', fontSize: '1.15rem'}}>{answer}</div>
              </div>
            </>
          )}
        </>
      )}
    </Container>
  );
}

export default App;
