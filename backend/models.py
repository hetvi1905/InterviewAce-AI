from datetime import datetime
from database import db
from werkzeug.security import generate_password_hash, check_password_hash

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "is_admin": self.is_admin,
            "created_at": self.created_at.isoformat()
        }

class ResumeAnalysis(db.Model):
    __tablename__ = 'resume_analyses'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    ats_score = db.Column(db.Integer, nullable=False)
    summary = db.Column(db.Text, nullable=True)
    skills_found = db.Column(db.Text, nullable=True)     # JSON string array
    missing_skills = db.Column(db.Text, nullable=True)    # JSON string array
    strengths = db.Column(db.Text, nullable=True)         # JSON string array
    weaknesses = db.Column(db.Text, nullable=True)        # JSON string array
    suggestions = db.Column(db.Text, nullable=True)       # JSON string array
    tech_recommended = db.Column(db.Text, nullable=True)  # JSON string array
    questions = db.Column(db.Text, nullable=True)         # JSON string array of sample questions
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        import json
        def safe_json_load(val):
            try:
                return json.loads(val) if val else []
            except Exception:
                return []
        return {
            "id": self.id,
            "user_id": self.user_id,
            "filename": self.filename,
            "ats_score": self.ats_score,
            "summary": self.summary,
            "skills_found": safe_json_load(self.skills_found),
            "missing_skills": safe_json_load(self.missing_skills),
            "strengths": safe_json_load(self.strengths),
            "weaknesses": safe_json_load(self.weaknesses),
            "suggestions": safe_json_load(self.suggestions),
            "tech_recommended": safe_json_load(self.tech_recommended),
            "questions": safe_json_load(self.questions),
            "created_at": self.created_at.isoformat()
        }

class InterviewSession(db.Model):
    __tablename__ = 'interview_sessions'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    interview_type = db.Column(db.String(50), nullable=False)   # HR, Technical, Aptitude
    score = db.Column(db.Integer, nullable=True)                # Overall score
    feedback = db.Column(db.Text, nullable=True)                # Summary feedback
    strengths = db.Column(db.Text, nullable=True)               # JSON string array
    weaknesses = db.Column(db.Text, nullable=True)              # JSON string array
    confidence_level = db.Column(db.String(50), nullable=True)   # High, Medium, Low
    recommended_topics = db.Column(db.Text, nullable=True)       # JSON string array
    performance_graph_data = db.Column(db.Text, nullable=True)   # JSON structure (dict of question scores)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        import json
        def safe_json_load(val, default_type=list):
            try:
                return json.loads(val) if val else (default_type() if default_type else None)
            except Exception:
                return default_type() if default_type else None
        return {
            "id": self.id,
            "user_id": self.user_id,
            "interview_type": self.interview_type,
            "score": self.score,
            "feedback": self.feedback,
            "strengths": safe_json_load(self.strengths),
            "weaknesses": safe_json_load(self.weaknesses),
            "confidence_level": self.confidence_level,
            "recommended_topics": safe_json_load(self.recommended_topics),
            "performance_graph_data": safe_json_load(self.performance_graph_data, default_type=dict),
            "created_at": self.created_at.isoformat()
        }

class InterviewQuestion(db.Model):
    __tablename__ = 'interview_questions'
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('interview_sessions.id', ondelete='CASCADE'), nullable=False)
    question_text = db.Column(db.Text, nullable=False)
    user_answer = db.Column(db.Text, nullable=True)
    ai_score = db.Column(db.Integer, nullable=True)
    ai_feedback = db.Column(db.Text, nullable=True)
    correct_answer = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "session_id": self.session_id,
            "question_text": self.question_text,
            "user_answer": self.user_answer,
            "ai_score": self.ai_score,
            "ai_feedback": self.ai_feedback,
            "correct_answer": self.correct_answer,
            "created_at": self.created_at.isoformat()
        }
