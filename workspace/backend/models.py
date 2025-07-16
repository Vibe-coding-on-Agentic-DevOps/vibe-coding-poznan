from flask_sqlalchemy import SQLAlchemy
import hashlib
import json

db = SQLAlchemy()

class Transcription(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(256), nullable=False)
    __table_args__ = (
        db.UniqueConstraint('filename', 'owner_id', name='uix_filename_owner'),
    )
    transcription = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    file_hash = db.Column(db.String(64), nullable=True)  # SHA256 hash for duplicate detection
    file_size = db.Column(db.Integer, nullable=True)
    segments = db.Column(db.Text, nullable=True)  # JSON string storing word-level timing segments
    thumbnail = db.Column(db.String(256), nullable=True)
    transcription_status = db.Column(db.String(32), nullable=False, default='not_transcribed')
    owner_id = db.Column(db.String(128), nullable=True, index=True)  # Azure AD user id or None for global

    def to_dict(self):
        segments_data = []
        if self.segments:
            try:
                segments_data = json.loads(self.segments)
            except (json.JSONDecodeError, TypeError):
                segments_data = []
        
        return {
            'id': self.id,
            'filename': self.filename,
            'transcription': self.transcription,
            'created_at': self.created_at.isoformat(),
            'file_hash': self.file_hash,
            'file_size': self.file_size,
            'segments': segments_data,
            'thumbnail': self.thumbnail,
            'transcription_status': self.transcription_status,
            'owner_id': self.owner_id
        }
