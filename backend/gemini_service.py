import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

# Ensure dotenv variables are loaded
load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

def get_gemini_model():
    """
    Returns the Gemini generative model.
    """
    # gemini-1.5-flash is standard, fast, and supports structured JSON outputs
    return genai.GenerativeModel("gemini-1.5-flash")

def analyze_resume(resume_text):
    """
    Sends extracted resume text to Gemini AI to generate:
    - ATS Score
    - Resume Summary
    - Skills Found
    - Missing Skills
    - Strengths
    - Weaknesses
    - AI Suggestions
    - Recommended Technologies
    - Interview Questions based on resume
    
    Returns a parsed JSON dictionary.
    """
    model = get_gemini_model()
    
    prompt = f"""
    You are an expert ATS (Applicant Tracking System) parser and senior technical recruiter.
    Analyze the following resume text and provide a structured JSON response.

    Resume Text:
    ---
    {resume_text}
    ---

    Provide a JSON object containing the following keys:
    - "ats_score": Integer (0 to 100) representing how well formatted, structured, and keyword-rich the resume is.
    - "summary": A concise 2-3 sentence professional summary of the candidate.
    - "skills_found": A list of strings representing the skills identified in the resume.
    - "missing_skills": A list of strings representing key industry-standard skills that are missing based on their profile.
    - "strengths": A list of strings describing key professional strengths.
    - "weaknesses": A list of strings describing areas where the resume or experience lacks depth.
    - "suggestions": A list of actionable suggestions to improve the resume.
    - "tech_recommended": A list of recommended technologies the candidate should learn next.
    - "questions": A list of 5 tailored interview questions based on the candidate's experience.

    Return ONLY a raw JSON string that can be parsed directly with json.loads. Do not wrap the JSON output in markdown fences (like ```json).
    """

    try:
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        data = json.loads(response.text)
        return data
    except Exception as e:
        print(f"Error in analyze_resume: {e}")
        # fallback dictionary
        return {
            "ats_score": 65,
            "summary": "AI parsing temporarily unavailable. Please check your Gemini API configuration.",
            "skills_found": ["Parsed Text Found"],
            "missing_skills": ["Unable to determine"],
            "strengths": ["Clear section headings"],
            "weaknesses": ["Unable to determine detailed gaps"],
            "suggestions": ["Double-check that the GEMINI_API_KEY env variable is set and active."],
            "tech_recommended": ["Cloud Development", "Modern Frameworks"],
            "questions": [
                "Describe a project you worked on recently.",
                "How do you approach solving complex errors?",
                "What skills do you hope to develop in your next role?",
                "Describe a time you had to learn a technology quickly.",
                "Why are you interested in a mock interview today?"
            ]
        }

def generate_interview_questions(interview_type, resume_analysis=None, num_questions=5):
    """
    Generates a set of interview questions dynamically using Gemini.
    Returns a list of question strings.
    """
    model = get_gemini_model()
    
    resume_context = ""
    if resume_analysis:
        resume_context = f"""
        Candidate Summary: {resume_analysis.get('summary', '')}
        Skills Found: {', '.join(resume_analysis.get('skills_found', []))}
        """
    
    prompt = f"""
    You are an interviewer conducting a {interview_type} mock interview.
    Generate a list of {num_questions} interview questions suited for this interview.
    
    {resume_context}
    
    Interview Type: {interview_type}
    If HR, generate behavioral and situational questions (e.g. conflict resolution, motivation, leadership, cultural fit).
    If Technical, generate coding, architecture, system design, or engineering concept questions.
    If Aptitude, generate logical reasoning, puzzle-solving, or problem-solving questions.
    
    Your output MUST be a JSON list of strings (questions). Example format:
    [
      "Question 1...",
      "Question 2..."
    ]
    
    Return ONLY a raw JSON array. Do not include markdown formatting.
    """
    
    try:
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        questions = json.loads(response.text)
        if isinstance(questions, list):
            return questions
        return [str(q) for q in questions.values()]
    except Exception as e:
        print(f"Error generating questions: {e}")
        return [
            f"Describe a challenging {interview_type} problem you solved.",
            f"Explain a key concept related to your background in {interview_type}.",
            f"How do you handle difficult situations or feedback?",
            f"What is your approach to learning new skills?",
            f"Where do you see yourself in five years?"
        ][:num_questions]

def evaluate_answer(question_text, user_answer):
    """
    Evaluates the user's answer against the interview question.
    Returns JSON:
    {
      "score": 92,
      "feedback": "Excellent answer...",
      "strengths": ["...", "..."],
      "improvements": ["...", "..."],
      "correct_answer": "..."
    }
    """
    model = get_gemini_model()
    
    prompt = f"""
    You are a professional mock interview evaluator.
    Evaluate the user's answer to the given question and provide feedback.
    
    Question: {question_text}
    User's Answer: {user_answer}
    
    Return a JSON object with the exact keys:
    - "score": An integer score (0 to 100) based on answer quality, clarity, correctness, and completeness.
    - "feedback": A detailed 2-3 sentence overview of the answer's quality.
    - "strengths": A list of strings identifying strengths in the answer.
    - "improvements": A list of strings suggesting how the answer can be improved.
    - "correct_answer": A high-quality exemplar answer to this question.
    
    Return ONLY raw JSON. Do not include markdown formatting.
    """
    
    try:
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        evaluation = json.loads(response.text)
        return evaluation
    except Exception as e:
        print(f"Error in evaluate_answer: {e}")
        return {
            "score": 60,
            "feedback": "Could not evaluate answer due to API error. Ensure your Gemini API Key is active.",
            "strengths": ["Response was recorded"],
            "improvements": ["Verify backend configuration to retrieve detailed improvements"],
            "correct_answer": "An exemplar response would cover the core technical or behavioral principles relevant to the question."
        }

def summarize_session(questions):
    """
    Sends the user's answers and evaluations to Gemini to generate:
    - Feedback: A detailed overall synthesis of their performance.
    - Strengths: A list of general strengths shown.
    - Weaknesses: A list of areas that need development.
    - Confidence Level: 'High', 'Medium', or 'Low' based on speech/text fluidity and correctness.
    - Recommended Topics: A list of topics they should study.
    
    Returns JSON.
    """
    model = get_gemini_model()
    
    data_for_ai = []
    for q in questions:
        data_for_ai.append({
            "question": q.question_text,
            "answer": q.user_answer,
            "score": q.ai_score,
            "feedback": q.ai_feedback
        })
        
    prompt = f"""
    You are an expert talent evaluator and mock interview lead.
    Review the following questions, answers, and scores from a completed mock interview:
    
    {json.dumps(data_for_ai, indent=2)}
    
    Generate an overall performance summary.
    Return a JSON object with the exact keys:
    - "feedback": A 3-4 sentence comprehensive evaluation of the candidate's interview performance.
    - "strengths": A list of strings showing patterns of strength.
    - "weaknesses": A list of strings showing areas of weakness or topics they struggled with.
    - "confidence_level": A single string, either "High", "Medium", or "Low" representing their estimated confidence.
    - "recommended_topics": A list of strings suggesting specific concepts, frameworks, or soft skills they should study to improve.
    
    Return ONLY raw JSON. Do not include markdown formatting.
    """
    
    try:
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        summary_data = json.loads(response.text)
        return summary_data
    except Exception as e:
        print(f"Error in summarize_session: {e}")
        # fallback
        scores = [q.ai_score for q in questions if q.ai_score is not None]
        avg_score = int(sum(scores) / len(scores)) if scores else 60
        conf = "High" if avg_score >= 80 else ("Medium" if avg_score >= 60 else "Low")
        return {
            "feedback": "Interview completed. The candidate demonstrated basic familiarity with the topics.",
            "strengths": ["Completed all interview questions"],
            "weaknesses": ["Review details in the question-wise feedback"],
            "confidence_level": conf,
            "recommended_topics": ["General Interview Prep"]
        }

