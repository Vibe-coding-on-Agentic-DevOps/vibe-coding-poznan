import React, { useState, useRef } from 'react';
import { Container, Form, Button, Alert, Spinner, InputGroup } from 'react-bootstrap';

function DatabaseSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dbQuestion, setDbQuestion] = useState('');
  const [dbAnswer, setDbAnswer] = useState('');
  const [dbQaLoading, setDbQaLoading] = useState(false);
  const [searchGroupFocused, setSearchGroupFocused] = useState(false);
  const [qaGroupFocused, setQaGroupFocused] = useState(false);
  const [askHover, setAskHover] = useState(false);
  const searchBlurTimeout = useRef(null);
  const qaBlurTimeout = useRef(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResults([]);
    try {
      const response = await fetch(`/search?q=${encodeURIComponent(query)}`);
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
    setError('');
    try {
      const response = await fetch('/ask-database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: dbQuestion })
      });
      const data = await response.json();
      if (response.ok) {
        setDbAnswer(data.answer);
      } else {
        setError(data.error || 'Prompt failed.');
      }
    } catch (err) {
      setError('Server error.');
    }
    setDbQaLoading(false);
  };

  // Focus/blur handlers for search input group
  const handleSearchFocus = () => {
    if (searchBlurTimeout.current) clearTimeout(searchBlurTimeout.current);
    setSearchGroupFocused(true);
  };
  const handleSearchBlur = () => {
    searchBlurTimeout.current = setTimeout(() => setSearchGroupFocused(false), 100);
  };

  // Focus/blur handlers for Q&A input group
  const handleQaFocus = () => {
    if (qaBlurTimeout.current) clearTimeout(qaBlurTimeout.current);
    setQaGroupFocused(true);
  };
  const handleQaBlur = () => {
    qaBlurTimeout.current = setTimeout(() => setQaGroupFocused(false), 100);
  };

  return (
    <Container className="mt-5" style={{ maxWidth: 900 }}>
      <h4 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Transcription keyword Search</h4>
      <Form onSubmit={handleSearch} className="mb-4">
        <InputGroup
          style={searchGroupFocused ? {
            boxShadow: '0 0 0 0.2rem #1976d2',
            borderRadius: 8,
            transition: 'box-shadow 0.15s',
          } : { borderRadius: 8, transition: 'box-shadow 0.15s' }}
        >
          <Form.Control
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search all transcriptions..."
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
            style={searchGroupFocused ? { borderColor: '#1976d2', zIndex: 2 } : {}}
          />
          <Button
            variant="primary"
            type="submit"
            disabled={loading}
            style={searchGroupFocused ? { minWidth: 100, borderColor: '#1976d2', zIndex: 2 } : { minWidth: 100 }}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
          >
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
              <li key={i}>
                <b>{res.filename}</b> <span style={{ color: '#aaa', fontSize: '0.9em' }}>({res.created_at})</span>
                <div style={{ marginTop: 4, marginBottom: 8 }}>{res.transcription.slice(0, 300)}{res.transcription.length > 300 ? '...' : ''}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <hr className="my-4" />
      <h4 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Ask a question about the database</h4>
      <Form onSubmit={handleDbAsk} className="mb-3">
        <InputGroup
          style={qaGroupFocused ? {
            boxShadow: '0 0 0 0.2rem #1976d2',
            borderRadius: 8,
            transition: 'box-shadow 0.15s',
          } : { borderRadius: 8, transition: 'box-shadow 0.15s' }}
        >
          <Form.Control
            type="text"
            value={dbQuestion}
            onChange={e => setDbQuestion(e.target.value)}
            placeholder="e.g. Has there been a meeting on X? What is Y?"
            onFocus={handleQaFocus}
            onBlur={handleQaBlur}
            style={qaGroupFocused ? { borderColor: '#1976d2', zIndex: 2 } : {}}
          />
          <Button
            variant="success"
            type="submit"
            disabled={dbQaLoading}
            style={{
              minWidth: 100,
              fontWeight: 600,
              fontFamily: 'inherit',
              background: askHover
                ? 'linear-gradient(90deg, #218838 0%, #28a745 100%)'
                : 'linear-gradient(90deg, #28a745 0%, #218838 100%)',
              border: qaGroupFocused ? '2px solid #1976d2' : 'none',
              color: '#f1f1f1',
              boxShadow: askHover ? '0 4px 16px #0004' : '0 2px 8px #0002',
              transition: 'background 0.2s, box-shadow 0.2s',
              zIndex: qaGroupFocused ? 2 : undefined
            }}
            onFocus={handleQaFocus}
            onBlur={handleQaBlur}
            onMouseEnter={() => setAskHover(true)}
            onMouseLeave={() => setAskHover(false)}
          >
            {dbQaLoading ? <Spinner animation="border" size="sm" /> : 'Ask'}
          </Button>
        </InputGroup>
      </Form>
      {dbAnswer && (
        <div style={{ background: '#23272b', color: '#f1f1f1', borderRadius: 8, padding: 16, marginTop: 12, fontSize: '1.1rem', maxWidth: 800, marginLeft: 'auto', marginRight: 'auto', textAlign: 'center' }}>
          <b>Answer:</b> {dbAnswer}
        </div>
      )}
    </Container>
  );
}

export default DatabaseSearch;
