import React, { useState } from 'react';
import { Container, Form, Button, Alert, Spinner } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';

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
  const videoRef = React.useRef(null);
  const [hoveredSegment, setHoveredSegment] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);

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
    <Container className="mt-5" style={{ maxWidth: 900 }}>
      <h2>Video to Text Transcription</h2>
      <div style={{ display: 'flex', gap: 32 }}>
        <div style={{ flex: 2, minWidth: 0 }}>
          <Form onSubmit={handleSubmit}>
            <Form.Group controlId="formFile" className="mb-3">
              <Form.Label>Upload your meeting video</Form.Label>
              <Form.Control type="file" accept="video/*" onChange={handleFileChange} />
            </Form.Group>
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? <Spinner animation="border" size="sm" /> : 'Transcribe'}
            </Button>
          </Form>
          {videoUrl && (
            <div className="mt-4">
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                style={{ width: '100%', borderRadius: 12, background: '#23272b' }}
                onTimeUpdate={handleTimeUpdate}
              />
            </div>
          )}
          {error && <Alert variant="danger" className="mt-3">{error}</Alert>}
          {(segments.length > 0 || transcription) && (
            <div className="transcript-box mt-3" style={{maxHeight: 350, overflowY: 'auto', overflowX: 'hidden', whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '1.15rem'}}>
              <h5>Transcription:</h5>
              <div className="m-0" style={{whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', fontSize: '1.15rem'}}>
                {segments.length > 0
                  ? segments.map((seg, idx) => (
                      <span
                        key={idx}
                        style={{
                          background:
                            idx === activeSegment
                              ? '#007bff55'
                              : idx === hoveredSegment
                              ? '#00bfff55'
                              : searchResults.some(r => r.idx === idx)
                              ? '#ffe06699'
                              : 'transparent',
                          borderRadius: 4,
                          transition: 'background 0.2s',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={() => setHoveredSegment(idx)}
                        onMouseLeave={() => setHoveredSegment(null)}
                        onClick={() => {
                          if (videoRef.current) {
                            videoRef.current.currentTime = seg.start;
                            videoRef.current.play();
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
          {transcription && (
            <Form onSubmit={handleAsk} className="mt-4">
              <Form.Group controlId="formQuestion" className="mb-3">
                <Form.Label>Ask a question about the transcript</Form.Label>
                <Form.Control
                  type="text"
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  placeholder="Type your question here..."
                  disabled={qaLoading}
                />
              </Form.Group>
              <Button variant="info" type="submit" disabled={qaLoading}>
                {qaLoading ? <Spinner animation="border" size="sm" /> : 'Ask'}
              </Button>
            </Form>
          )}
          {answer && (
            <div className="answer-box mt-3" style={{maxHeight: 350, overflowY: 'auto', overflowX: 'hidden', whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '1.15rem'}}>
              <h5>Answer:</h5>
              <div className="m-0" style={{whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', fontSize: '1.15rem'}}>{answer}</div>
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <Form.Group controlId="searchKeyword" className="mb-3">
            <Form.Label>Search by keyword</Form.Label>
            <Form.Control
              type="text"
              value={searchTerm}
              onChange={handleSearch}
              placeholder="Type keyword..."
            />
          </Form.Group>
          {searchResults.length > 0 && (
            <div style={{ maxHeight: 350, overflowY: 'auto', background: '#23272b', borderRadius: 8, padding: 12, color: '#f1f1f1', fontSize: '1.05rem' }}>
              <b>Results:</b>
              <ul style={{ paddingLeft: 18 }}>
                {searchResults.map((res, i) => (
                  <li key={i} style={{ cursor: res.idx !== null ? 'pointer' : 'default' }}
                    onClick={() => {
                      if (res.idx !== null && videoRef.current) {
                        videoRef.current.currentTime = segments[res.idx].start;
                        videoRef.current.play();
                        setActiveSegment(res.idx);
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
    </Container>
  );
}

export default App;
