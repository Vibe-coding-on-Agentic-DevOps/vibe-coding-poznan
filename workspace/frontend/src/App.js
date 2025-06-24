import React, { useState, useRef } from 'react';
import { Container, Form, Button, Alert, Spinner, InputGroup, Nav } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import DatabaseSearch from './DatabaseSearch';

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

  if (page === 'database') {
    return (
      <Container className="mt-5" style={{ maxWidth: 1200 }}>
        <Nav variant="tabs" activeKey={page} onSelect={setPage} className="mb-4">
          <Nav.Item>
            <Nav.Link eventKey="transcribe">Transcribe</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="database">Database</Nav.Link>
          </Nav.Item>
        </Nav>
        <DatabaseSearch />
      </Container>
    );
  }

  return (
    <Container className="mt-5" style={{ maxWidth: 1200 }}>
      <Nav variant="tabs" activeKey={page} onSelect={setPage} className="mb-4">
        <Nav.Item>
          <Nav.Link eventKey="transcribe">Transcribe</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="database">Database</Nav.Link>
        </Nav.Item>
      </Nav>
      <h2>Meeting Assistant</h2>
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
            <div className="transcript-box" style={{maxHeight: 350, overflowY: 'auto', overflowX: 'hidden', whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '1.15rem'}}>
              <h5>Meeting Transcript:</h5>
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
          )}
        </div>
        <div style={{ flex: 1, minWidth: 260 }}>
          <Form.Group controlId="searchKeyword" className="mb-3">
            <Form.Label>Search meeting transcript</Form.Label>
            <Form.Control
              type="text"
              value={searchTerm}
              onChange={handleSearch}
              placeholder="Type keyword..."
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
          <div style={{ borderRadius: 6, boxShadow: qaGroupFocused ? '0 0 0 0.2rem #1976d2' : 'none', transition: 'box-shadow 0.15s' }}>
            <InputGroup>
              <Form.Control
                type="text"
                value={question}
                ref={questionInputRef}
                onChange={e => setQuestion(e.target.value)}
                placeholder="Ask a question about the meeting..."
                disabled={qaLoading}
                style={{ background: '#23272b', color: '#f1f1f1', boxShadow: 'none' }}
                onFocus={() => setQaGroupFocused(true)}
                onBlur={() => setQaGroupFocused(false)}
              />
              <Button 
                variant="primary" 
                type="submit" 
                disabled={qaLoading} 
                style={{ minWidth: 80, boxShadow: 'none' }}
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
        <div className="answer-box mt-3" style={{maxHeight: 350, overflowY: 'auto', overflowX: 'hidden', whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '1.15rem'}}>
          <h5>Answer:</h5>
          <div className="m-0" style={{whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', fontSize: '1.15rem'}}>{answer}</div>
        </div>
      )}
    </Container>
  );
}

export default App;
