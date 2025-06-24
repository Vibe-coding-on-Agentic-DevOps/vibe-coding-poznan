from flask_sqlalchemy import SQLAlchemy
import hashlib

db = SQLAlchemy()

class Transcription(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(256), nullable=False, unique=True)
    transcription = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    file_hash = db.Column(db.String(64), nullable=True)  # SHA256 hash for duplicate detection
    file_size = db.Column(db.Integer, nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'filename': self.filename,
            'transcription': self.transcription,
            'created_at': self.created_at.isoformat(),
            'file_hash': self.file_hash,
            'file_size': self.file_size
        }
