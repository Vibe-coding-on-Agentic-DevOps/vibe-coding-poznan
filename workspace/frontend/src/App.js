import React, { useState, useRef } from 'react';
import { Container, Form, Button, Alert, Spinner, InputGroup, Nav } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import DatabaseSearch from './DatabaseSearch';
import DatabaseGallery from './DatabaseGallery';

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
  const fileInputRef = useRef(null);
  const questionInputRef = useRef(null);

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
    setFileGroupFocused(false); // Remove blue backlight after file upload
    setSearchTerm(''); // Clear search input
    setSearchResults([]); // Clear search results
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
      {page === 'database-search' && <DatabaseSearch />}
      {page === 'database' && <DatabaseGallery />}
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
                src={videoUrl}
                controls
                style={{ width: '100%', minHeight: 400, borderRadius: 12, background: '#23272b' }}
                onTimeUpdate={handleTimeUpdate}
              />
            </div>
          )}
          <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', marginTop: 24 }}>
            <div style={{ flex: 3, minWidth: 0 }}>
              {(segments.length > 0 || transcription) && (
                <>
                  <div style={{ display: 'flex', alignItems: 'flex-end', height: 36 }}>
                    <span style={{
                      background: 'linear-gradient(90deg, #343a40 0%, #495057 100%)',
                      color: '#f1f1f1',
                      fontWeight: 600,
                      fontSize: '1.05rem',
                      borderTopLeftRadius: 10,
                      borderTopRightRadius: 10,
                      padding: '6px 18px 2px 18px',
                      border: '1px solid #343a40',
                      borderBottom: 'none',
                      marginLeft: 0,
                      marginBottom: 0,
                      boxShadow: '0 -2px 8px #0002',
                      letterSpacing: '0.5px',
                      zIndex: 2,
                      position: 'relative',
                    }}>Meeting Transcript:</span>
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
                    borderTopRightRadius: 0,
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
                              style={{ background: idx === activeSegment ? '#007bff55' : searchResults.some(r => r.idx === idx) ? '#ffe06699' : 'transparent', borderRadius: 4, transition: 'background 0.2s', cursor: 'pointer' }}
                              onClick={() => {
                                const video = document.querySelector('video');
                                if (video) {
                                  video.currentTime = seg.start;
                                  video.play();
                                }
                              }}
                            >
                              {seg.text + ' '}
                            </span>
                          ))
                        : transcription}
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
                  borderTopRightRadius: 10,
                  borderBottomLeftRadius: 0,
                  borderBottomRightRadius: 0,
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
              <div style={{ borderRadius: 6, boxShadow: qaGroupFocused ? '0 0 0 0.2rem #1976d2' : 'none', transition: 'box-shadow 0.15s' }}>
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
                      boxShadow: 'none',
                      borderTopLeftRadius: 0,
                      borderTopRightRadius: 0,
                      borderBottomLeftRadius: 10,
                      borderBottomRightRadius: 10,
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
                      boxShadow: 'none',
                      borderTopLeftRadius: 0,
                      borderTopRightRadius: 0,
                      borderBottomLeftRadius: 0,
                      borderBottomRightRadius: 10,
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
                  background: 'linear-gradient(90deg, #343a40 0%, #495057 100%)', // match choose file gradient
                  color: '#f1f1f1', // match file input button text
                  fontWeight: 600,
                  fontSize: '1.05rem',
                  borderTopLeftRadius: 10,
                  borderTopRightRadius: 10,
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
                maxHeight: 180, // reduced height
                overflowY: 'auto',
                overflowX: 'hidden',
                whiteSpace: 'pre-wrap',
                fontFamily: 'inherit',
                fontSize: '1.15rem',
                border: '1px solid #343a40',
                borderTopLeftRadius: 0,
                borderTopRightRadius: 0,
                borderBottomLeftRadius: 10,
                borderBottomRightRadius: 10,
                background: '#23272b',
                position: 'relative',
                zIndex: 1,
                marginTop: 0, // remove extra margin
                padding: 10, // less padding
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
