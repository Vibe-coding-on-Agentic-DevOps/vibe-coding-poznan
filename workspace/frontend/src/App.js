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

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setTranscription('');
    setError('');
    setAnswer('');
    setQuestion('');
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
        setTranscription(data.transcription);
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

  return (
    <Container className="mt-5">
      <h2>Video to Text Transcription</h2>
      <Form onSubmit={handleSubmit}>
        <Form.Group controlId="formFile" className="mb-3">
          <Form.Label>Upload your meeting video</Form.Label>
          <Form.Control type="file" accept="video/*" onChange={handleFileChange} />
        </Form.Group>
        <Button variant="primary" type="submit" disabled={loading}>
          {loading ? <Spinner animation="border" size="sm" /> : 'Transcribe'}
        </Button>
      </Form>
      {error && <Alert variant="danger" className="mt-3">{error}</Alert>}
      {transcription && (
        <Alert variant="success" className="mt-3">
          <h5>Transcription:</h5>
          <pre>{transcription}</pre>
        </Alert>
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
        <Alert variant="primary" className="mt-3">
          <h5>Answer:</h5>
          <pre>{answer}</pre>
        </Alert>
      )}
    </Container>
  );
}

export default App;
