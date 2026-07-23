import os
import re
import json
from flask import Flask, request, jsonify, session, send_from_directory
from werkzeug.utils import secure_filename
from dotenv import load_dotenv

# Import database and models
from database import db
from models import User, ResumeAnalysis, InterviewSession, InterviewQuestion
import resume_parser
import gemini_service

# Load environment variables
load_dotenv()

app = Flask(__name__, static_folder='../frontend', static_url_path='')

# Configuration
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', 'supersecretkeyforinterviewaceai')

# Ensure instance and uploads directories exist
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INSTANCE_DIR = os.path.join(BASE_DIR, 'instance')
UPLOAD_DIR = os.path.join(BASE_DIR, '../uploads')

os.makedirs(INSTANCE_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Resolve database URL to an absolute path for SQLite stability
db_url = os.getenv('DATABASE_URL', '')
if not db_url or db_url.startswith('sqlite:///instance/'):
    db_path = os.path.join(INSTANCE_DIR, 'interview_ace.db')
    db_path_formatted = db_path.replace('\\', '/')
    app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{db_path_formatted}"
else:
    app.config['SQLALCHEMY_DATABASE_URI'] = db_url

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = UPLOAD_DIR
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB limit
ALLOWED_EXTENSIONS = {'pdf'}

# Initialize database
db.init_app(app)

# Helper function to check if file extension is allowed
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Helper function to validate password complexity
def is_strong_password(password):
    """
    Password requirements:
    - Minimum 8 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one numeric digit
    - At least one special character
    """
    if len(password) < 8:
        return False
    if not re.search(r"[a-z]", password):
        return False
    if not re.search(r"[A-Z]", password):
        return False
    if not re.search(r"[0-9]", password):
        return False
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        return False
    return True

# Helper function to get current user from session
def get_current_user():
    user_id = session.get('user_id')
    if not user_id:
        return None
    return db.session.get(User, user_id)

# Initialize DB tables and seed Admin user on startup
with app.app_context():
    db.create_all()
    # Seed an admin user if not present
    admin_user = User.query.filter_by(username='admin').first()
    if not admin_user:
        admin = User(username='admin', email='admin@interviewace.ai', is_admin=True)
        admin.set_password('Admin@1234')  # Meets strength requirements
        db.session.add(admin)
        db.session.commit()
        print("Admin user seeded: admin / Admin@1234")

# =====================================================================
# Page Routes (serving HTML from frontend)
# =====================================================================
@app.route('/')
def route_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/login')
def route_login():
    return send_from_directory(app.static_folder, 'login.html')

@app.route('/signup')
def route_signup():
    return send_from_directory(app.static_folder, 'signup.html')

@app.route('/dashboard')
def route_dashboard():
    return send_from_directory(app.static_folder, 'dashboard.html')

@app.route('/upload')
def route_upload():
    return send_from_directory(app.static_folder, 'upload.html')

@app.route('/interview')
def route_interview():
    return send_from_directory(app.static_folder, 'interview.html')

@app.route('/result')
def route_result():
    return send_from_directory(app.static_folder, 'result.html')

# =====================================================================
# API Authentication Endpoints
# =====================================================================
@app.route('/api/signup', methods=['POST'])
def api_signup():
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '')

    if not username or not email or not password:
        return jsonify({"error": "All fields are required"}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"error": "Username already exists"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already exists"}), 400

    if not is_strong_password(password):
        return jsonify({
            "error": "Password must be at least 8 characters long, contain an uppercase letter, a lowercase letter, a number, and a special character."
        }), 400

    user = User(username=username, email=email)
    user.set_password(password)
    
    db.session.add(user)
    db.session.commit()

    return jsonify({"message": "User registered successfully"}), 201

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({"error": "All fields are required"}), 400

    user = User.query.filter_by(username=username).first()
    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid username or password"}), 401

    session['user_id'] = user.id
    return jsonify({
        "message": "Login successful",
        "user": user.to_dict()
    }), 200

@app.route('/api/logout', methods=['POST'])
def api_logout():
    session.pop('user_id', None)
    return jsonify({"message": "Logout successful"}), 200

@app.route('/api/current-user', methods=['GET'])
def api_current_user():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    return jsonify({"user": user.to_dict()}), 200

# =====================================================================
# API Resume Upload & Parse Endpoints
# =====================================================================
@app.route('/api/upload-resume', methods=['POST'])
def api_upload_resume():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    if 'resume' not in request.files:
        return jsonify({"error": "No resume file uploaded"}), 400

    file = request.files['resume']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        # Unique filename prefixing user id
        unique_filename = f"{user.id}_{filename}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        file.save(filepath)

        # Parse PDF text
        try:
            resume_text = resume_parser.parse_pdf(filepath)
            if not resume_text:
                return jsonify({"error": "Failed to extract text from PDF. Ensure it is not scanned or empty."}), 400

            # Analyze using Gemini
            analysis_data = gemini_service.analyze_resume(resume_text)

            # Store analysis in Database
            analysis = ResumeAnalysis(
                user_id=user.id,
                filename=filename,
                ats_score=analysis_data.get("ats_score", 70),
                summary=analysis_data.get("summary", ""),
                skills_found=json.dumps(analysis_data.get("skills_found", [])),
                missing_skills=json.dumps(analysis_data.get("missing_skills", [])),
                strengths=json.dumps(analysis_data.get("strengths", [])),
                weaknesses=json.dumps(analysis_data.get("weaknesses", [])),
                suggestions=json.dumps(analysis_data.get("suggestions", [])),
                tech_recommended=json.dumps(analysis_data.get("tech_recommended", [])),
                questions=json.dumps(analysis_data.get("questions", []))
            )

            db.session.add(analysis)
            db.session.commit()

            return jsonify({
                "message": "Resume uploaded and analyzed successfully",
                "analysis": analysis.to_dict()
            }), 200

        except Exception as e:
            db.session.rollback()
            print(f"Upload-resume Exception: {e}")
            return jsonify({"error": f"Internal parsing or service failure: {str(e)}"}), 500
    else:
        return jsonify({"error": "Invalid file type. Only PDFs are allowed."}), 400

# =====================================================================
# API Interview Endpoints
# =====================================================================
@app.route('/api/generate-question', methods=['POST'])
def api_generate_question():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json() or {}
    interview_type = data.get('interview_type', 'Technical') # HR, Technical, Aptitude
    session_id = data.get('session_id')

    # If no session_id, we start a new interview session
    if not session_id:
        # Load user's latest resume analysis if available to tailor the questions
        latest_resume = ResumeAnalysis.query.filter_by(user_id=user.id).order_by(ResumeAnalysis.created_at.desc()).first()
        resume_data = None
        if latest_resume:
            resume_data = latest_resume.to_dict()

        # Generate questions using Gemini
        generated_questions = gemini_service.generate_interview_questions(interview_type, resume_data, num_questions=5)

        # Create session
        new_session = InterviewSession(
            user_id=user.id,
            interview_type=interview_type,
            score=0,
            feedback=""
        )
        db.session.add(new_session)
        db.session.commit() # Get new_session.id

        # Insert question records
        question_records = []
        for q_text in generated_questions:
            q_rec = InterviewQuestion(
                session_id=new_session.id,
                question_text=q_text
            )
            db.session.add(q_rec)
            question_records.append(q_rec)
        db.session.commit()

        # Get first question
        first_q = question_records[0]
        return jsonify({
            "session_id": new_session.id,
            "question": {
                "id": first_q.id,
                "question_text": first_q.question_text
            },
            "current_index": 1,
            "total_questions": len(question_records)
        }), 200

    else:
        # Fetch remaining unanswered questions
        session_rec = db.session.get(InterviewSession, session_id)
        if not session_rec or session_rec.user_id != user.id:
            return jsonify({"error": "Invalid session"}), 404

        questions = InterviewQuestion.query.filter_by(session_id=session_id).order_by(InterviewQuestion.id.asc()).all()
        answered = [q for q in questions if q.user_answer is not None]
        unanswered = [q for q in questions if q.user_answer is None]

        if not unanswered:
            return jsonify({"completed": True, "message": "All questions have been answered."}), 200

        next_q = unanswered[0]
        return jsonify({
            "session_id": session_id,
            "question": {
                "id": next_q.id,
                "question_text": next_q.question_text
            },
            "current_index": len(answered) + 1,
            "total_questions": len(questions)
        }), 200

@app.route('/api/evaluate-answer', methods=['POST'])
def api_evaluate_answer():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json() or {}
    question_id = data.get('question_id')
    user_answer = data.get('user_answer', '').strip()

    if not question_id or not user_answer:
        return jsonify({"error": "Question ID and answer content are required."}), 400

    q_rec = db.session.get(InterviewQuestion, question_id)
    if not q_rec:
        return jsonify({"error": "Question not found"}), 404

    session_rec = db.session.get(InterviewSession, q_rec.session_id)
    if not session_rec or session_rec.user_id != user.id:
        return jsonify({"error": "Unauthorized session access"}), 401

    # Evaluate answer using Gemini
    evaluation = gemini_service.evaluate_answer(q_rec.question_text, user_answer)

    # Update Question
    q_rec.user_answer = user_answer
    q_rec.ai_score = evaluation.get("score", 60)
    q_rec.ai_feedback = evaluation.get("feedback", "")
    q_rec.correct_answer = evaluation.get("correct_answer", "")
    db.session.commit()

    # Check if there are other unanswered questions
    questions = InterviewQuestion.query.filter_by(session_id=session_rec.id).order_by(InterviewQuestion.id.asc()).all()
    unanswered = [q for q in questions if q.user_answer is None]

    is_completed = len(unanswered) == 0

    if is_completed:
        # Sum up session statistics
        scores = [q.ai_score for q in questions if q.ai_score is not None]
        avg_score = int(sum(scores) / len(scores)) if scores else 0
        
        # Call gemini to summarize the full interview details
        summary = gemini_service.summarize_session(questions)

        session_rec.score = avg_score
        session_rec.feedback = summary.get("feedback", "Excellent effort in completing the mock interview.")
        session_rec.strengths = json.dumps(summary.get("strengths", []))
        session_rec.weaknesses = json.dumps(summary.get("weaknesses", []))
        session_rec.confidence_level = summary.get("confidence_level", "Medium")
        session_rec.recommended_topics = json.dumps(summary.get("recommended_topics", []))
        
        # Build score dict for performance graph
        graph_data = {}
        for index, q in enumerate(questions, 1):
            graph_data[f"Q{index}"] = q.ai_score
        session_rec.performance_graph_data = json.dumps(graph_data)
        
        db.session.commit()

    return jsonify({
        "message": "Answer evaluated",
        "evaluation": {
            "score": q_rec.ai_score,
            "feedback": q_rec.ai_feedback,
            "correct_answer": q_rec.correct_answer,
            "strengths": evaluation.get("strengths", []),
            "improvements": evaluation.get("improvements", [])
        },
        "is_completed": is_completed
    }), 200

# =====================================================================
# API User Portal & Stats Endpoints
# =====================================================================
@app.route('/api/dashboard', methods=['GET'])
def api_dashboard():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    sessions = InterviewSession.query.filter_by(user_id=user.id).filter(InterviewSession.score.isnot(None)).all()
    latest_resume = ResumeAnalysis.query.filter_by(user_id=user.id).order_by(ResumeAnalysis.created_at.desc()).first()

    total_interviews = len(sessions)
    avg_score = int(sum(s.score for s in sessions) / total_interviews) if total_interviews > 0 else 0

    # Recent 5 interviews
    recent_performance = [
        {
            "id": s.id,
            "interview_type": s.interview_type,
            "score": s.score,
            "date": s.created_at.strftime("%Y-%m-%d %H:%M")
        } for s in sorted(sessions, key=lambda x: x.created_at, reverse=True)[:5]
    ]

    resume_history = []
    analyses = ResumeAnalysis.query.filter_by(user_id=user.id).order_by(ResumeAnalysis.created_at.desc()).all()
    for a in analyses:
        resume_history.append({
            "id": a.id,
            "filename": a.filename,
            "ats_score": a.ats_score,
            "date": a.created_at.strftime("%Y-%m-%d %H:%M")
        })

    return jsonify({
        "username": user.username,
        "is_admin": user.is_admin,
        "total_interviews": total_interviews,
        "avg_score": avg_score,
        "resume_analyzed": latest_resume is not None,
        "latest_resume_score": latest_resume.ats_score if latest_resume else None,
        "recent_performance": recent_performance,
        "resume_history": resume_history
    }), 200

@app.route('/api/history', methods=['GET'])
def api_history():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    sessions = InterviewSession.query.filter_by(user_id=user.id).order_by(InterviewSession.created_at.desc()).all()
    return jsonify([s.to_dict() for s in sessions]), 200

@app.route('/api/result', methods=['GET'])
def api_result():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    session_id = request.args.get('session_id')
    if not session_id:
        return jsonify({"error": "Session ID required"}), 400

    session_rec = db.session.get(InterviewSession, session_id)
    if not session_rec or session_rec.user_id != user.id:
        return jsonify({"error": "Interview session not found"}), 404

    questions = InterviewQuestion.query.filter_by(session_id=session_id).order_by(InterviewQuestion.id.asc()).all()

    return jsonify({
        "session": session_rec.to_dict(),
        "questions": [q.to_dict() for q in questions]
    }), 200

# =====================================================================
# API Admin Endpoints
# =====================================================================
@app.route('/api/admin/users', methods=['GET'])
def api_admin_users():
    user = get_current_user()
    if not user or not user.is_admin:
        return jsonify({"error": "Forbidden"}), 403

    users = User.query.all()
    users_list = []
    for u in users:
        # Count interviews for user
        interview_count = InterviewSession.query.filter_by(user_id=u.id).filter(InterviewSession.score.isnot(None)).count()
        resume_count = ResumeAnalysis.query.filter_by(user_id=u.id).count()
        users_list.append({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "is_admin": u.is_admin,
            "interviews_taken": interview_count,
            "resumes_uploaded": resume_count,
            "created_at": u.created_at.strftime("%Y-%m-%d")
        })

    return jsonify(users_list), 200

@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
def api_admin_delete_user(user_id):
    user = get_current_user()
    if not user or not user.is_admin:
        return jsonify({"error": "Forbidden"}), 403

    target_user = db.session.get(User, user_id)
    if not target_user:
        return jsonify({"error": "User not found"}), 404

    if target_user.is_admin and target_user.username == 'admin':
        return jsonify({"error": "Cannot delete primary admin user"}), 400

    db.session.delete(target_user)
    db.session.commit()
    return jsonify({"message": f"User {target_user.username} deleted successfully."}), 200

@app.route('/api/admin/stats', methods=['GET'])
def api_admin_stats():
    user = get_current_user()
    if not user or not user.is_admin:
        return jsonify({"error": "Forbidden"}), 403

    total_users = User.query.count()
    completed_sessions = InterviewSession.query.filter(InterviewSession.score.isnot(None)).all()
    total_interviews = len(completed_sessions)
    avg_score = int(sum(s.score for s in completed_sessions) / total_interviews) if total_interviews > 0 else 0

    # Interview breakdown by type
    breakdown = {"HR": 0, "Technical": 0, "Aptitude": 0}
    for s in completed_sessions:
        if s.interview_type in breakdown:
            breakdown[s.interview_type] += 1
        else:
            breakdown[s.interview_type] = breakdown.get(s.interview_type, 0) + 1

    # Recent global activities
    recent_sessions = InterviewSession.query.filter(InterviewSession.score.isnot(None)).order_by(InterviewSession.created_at.desc()).limit(10).all()
    activities = []
    for s in recent_sessions:
        u = db.session.get(User, s.user_id)
        username = u.username if u else "Deleted User"
        activities.append({
            "username": username,
            "interview_type": s.interview_type,
            "score": s.score,
            "date": s.created_at.strftime("%Y-%m-%d %H:%M")
        })

    return jsonify({
        "total_users": total_users,
        "total_interviews": total_interviews,
        "avg_score": avg_score,
        "type_breakdown": breakdown,
        "recent_activities": activities
    }), 200

if __name__ == '__main__':
    # Start the app locally on port 5000
    app.run(host='0.0.0.0', port=5000, debug=True)
