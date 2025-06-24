from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Transcription(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(256), nullable=False)
    transcription = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    def to_dict(self):
        return {
            'id': self.id,
            'filename': self.filename,
            'transcription': self.transcription,
            'created_at': self.created_at.isoformat()
        }
