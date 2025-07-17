import React, { useState } from 'react';
import { Container, Form, Button, Alert, Spinner, InputGroup } from 'react-bootstrap';

// Accept onTranscribeFile as a prop
function DatabaseSearch({ onTranscribeFile, dbMode, userId }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dbQuestion, setDbQuestion] = useState('');
  const [dbAnswer, setDbAnswer] = useState('');
  const [dbSources, setDbSources] = useState([]);
  const [dbQaLoading, setDbQaLoading] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResults([]);
    try {
      const params = new URLSearchParams({
        q: query,
        dbMode: dbMode || 'global',
        userId: userId || ''
      });
      const response = await fetch(`/search?${params.toString()}`);
      const data = await response.json();
      if (response.ok) {
        setResults(data.results);
      } else {
        setError(data.error || 'Search failed.');
      }
    } catch (err) {
      setError('Server error.');
    }
    setLoading(false);
  };

  const handleDbAsk = async (e) => {
    e.preventDefault();
    setDbQaLoading(true);
    setDbAnswer('');
    setDbSources([]);
    setError('');
    try {
      const response = await fetch('/ask-database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: dbQuestion,
          dbMode: dbMode || 'global',
          userId: userId || ''
        })
      });
      const data = await response.json();
      if (response.ok) {
        setDbAnswer(data.answer);
        setDbSources(Array.isArray(data.sources) ? data.sources : []);
      } else {
        setError(data.error || 'Prompt failed.');
      }
    } catch (err) {
      setError('Server error.');
    }
    setDbQaLoading(false);
  };

  return (
    <Container className="mt-5" style={{ maxWidth: 900 }}>
      <h4 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Transcription keyword search</h4>
      <Form onSubmit={handleSearch} className="mb-4">
        <InputGroup>
          <Form.Control
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search all transcriptions..."
          />
          <Button variant="primary" type="submit" disabled={loading} style={{ minWidth: 100 }}>
            {loading ? <Spinner animation="border" size="sm" /> : 'Search'}
          </Button>
        </InputGroup>
      </Form>
      {error && <Alert variant="danger">{error}</Alert>}
      {results.length > 0 && (
        <div style={{ maxHeight: 400, overflowY: 'auto', background: '#23272b', borderRadius: 8, padding: 12, color: '#f1f1f1', fontSize: '1.05rem' }}>
          <b>Results:</b>
          <ul style={{ paddingLeft: 18 }}>
            {results.map((res, i) => (
              <li key={i} style={{ marginBottom: 16 }}>
                <b>{res.filename}</b> <span style={{ color: '#aaa', fontSize: '0.9em' }}>({res.created_at})</span>
                <div style={{ marginTop: 4, marginBottom: 8 }}>{res.transcription.slice(0, 300)}{res.transcription.length > 300 ? '...' : ''}</div>
                {onTranscribeFile && (
                  <Button
                    variant="outline-primary"
                    size="sm"
                    style={{ fontWeight: 600, borderRadius: 8, marginTop: 2 }}
                    onClick={() => {
                      // Try to find the matching text index in the transcription
                      let highlight = null;
                      if (query && res.transcription) {
                        const idx = res.transcription.toLowerCase().indexOf(query.toLowerCase());
                        if (idx !== -1) {
                          highlight = { text: query, index: idx };
                        }
                      }
                      onTranscribeFile(res, highlight);
                    }}
                  >
                    View in Transcribe
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <hr className="my-4" />
      <h4 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Ask a question about the database</h4>
      <Form onSubmit={handleDbAsk} className="mb-3">
        <InputGroup>
          <Form.Control
            type="text"
            value={dbQuestion}
            onChange={e => setDbQuestion(e.target.value)}
            placeholder="e.g. Has there been a meeting on X? What is Y?"
          />
          <Button variant="success" type="submit" disabled={dbQaLoading} style={{ minWidth: 100 }}>
            {dbQaLoading ? <Spinner animation="border" size="sm" /> : 'Ask'}
          </Button>
        </InputGroup>
      </Form>
      {dbAnswer && (
        <div style={{ background: '#23272b', color: '#f1f1f1', borderRadius: 8, padding: 16, marginTop: 12, fontSize: '1.1rem', maxWidth: 800, marginLeft: 'auto', marginRight: 'auto', textAlign: 'center' }}>
          <b>Answer:</b> {dbAnswer}
          {/*
          {dbSources.length > 0 && (
            <div style={{ marginTop: 12, fontSize: '0.98rem', color: '#b0b0b0', display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              <b>Source{dbSources.length > 1 ? 's' : ''}:</b>{' '}
              {dbSources.map((s, i) => (
                <span
                  key={s.id}
                  style={{ cursor: 'pointer', color: '#4da3ff', textDecoration: 'underline', marginRight: 6 }}
                  onClick={async () => {
                    if (!onTranscribeFile) return;
                    try {
                      // Load the file list as in DatabaseGallery, then find the file by id
                      const res = await fetch('/files');
                      const data = await res.json();
                      if (res.ok && Array.isArray(data.files)) {
                        const file = data.files.find(f => f.id === s.id);
                        if (file) {
                          onTranscribeFile(file);
                        } else {
                          alert('File not found in database.');
                        }
                      } else {
                        alert('Could not load file info.');
                      }
                    } catch {
                      alert('Could not load file info.');
                    }
                  }}
                  title={`View transcript for ${s.filename}`}
                >
                  {s.filename}{i < dbSources.length - 1 ? ',' : ''}
                </span>
              ))}
            </div>
          )}
          */}
        </div>
      )}
    </Container>
  );
}

export default DatabaseSearch;
