import os
import json
from datetime import datetime
from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from dotenv import load_dotenv
from groq import Groq
from pymongo import MongoClient
from werkzeug.security import generate_password_hash, check_password_hash

# Load environment variables
load_dotenv(override=True)

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "dev-secret-key-1234567890-quiz-app")

# MongoDB connection configuration
mongo_uri = os.environ.get("MONGO_URI", "mongodb://localhost:27017/quiz_db")
db_name = 'quiz_db'

# Extract database name from connection URI if present (useful for Atlas URIs)
try:
    if '/' in mongo_uri.split('//')[-1]:
        path = mongo_uri.split('//')[-1].split('/', 1)[-1]
        if '?' in path:
            path = path.split('?', 1)[0]
        if path:
            db_name = path
except Exception:
    pass

mongo_client = MongoClient(mongo_uri)
db = mongo_client[db_name]

# Helper to check if a user is logged in
def is_logged_in():
    return 'user_id' in session

# Initialize Groq client
def get_groq_client():
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key or api_key == "your_groq_api_key_here":
        return None
    return Groq(api_key=api_key)

# ----------------- PAGE ROUTES -----------------

@app.route('/')
def index():
    if not is_logged_in():
        return redirect(url_for('auth_page'))
    return render_template('index.html')

@app.route('/auth')
def auth_page():
    if is_logged_in():
        return redirect(url_for('index'))
    return render_template('auth.html')

# ----------------- AUTHENTICATION API ENDPOINTS -----------------

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Please provide a username and password.'}), 400

    username = data.get('username').strip()
    password = data.get('password')

    if len(username) < 3:
        return jsonify({'error': 'Username must be at least 3 characters long.'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters long.'}), 400

    # Check if username already exists
    existing_user = db.users.find_one({"username": {"$regex": f"^{username}$", "$options": "i"}})
    if existing_user:
        return jsonify({'error': 'Username is already taken.'}), 400

    # Insert new user with hashed password
    hashed_password = generate_password_hash(password)
    user_doc = {
        "username": username,
        "password": hashed_password,
        "created_at": datetime.utcnow()
    }
    
    try:
        result = db.users.insert_one(user_doc)
        # Log the user in automatically
        session['user_id'] = str(result.inserted_id)
        session['username'] = username
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': f'Failed to create account: {str(e)}'}), 500

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Please enter both username and password.'}), 400

    username = data.get('username').strip()
    password = data.get('password')

    user = db.users.find_one({"username": {"$regex": f"^{username}$", "$options": "i"}})
    if not user or not check_password_hash(user['password'], password):
        return jsonify({'error': 'Invalid username or password.'}), 401

    session['user_id'] = str(user['_id'])
    session['username'] = user['username']
    return jsonify({'success': True})

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('auth_page'))

# ----------------- QUIZ API ENDPOINTS -----------------

@app.route('/generate-quiz', methods=['POST'])
def generate_quiz():
    if not is_logged_in():
        return jsonify({'error': 'Unauthorized. Please log in first.'}), 401

    client = get_groq_client()
    if not client:
        return jsonify({
            'error': 'Groq API Key is not configured. Please set GROQ_API_KEY in the .env file.'
        }), 500

    data = request.get_json()
    if not data or not data.get('subject') or not data.get('topic'):
        return jsonify({'error': 'Please enter both a Subject and a Topic.'}), 400

    subject = data.get('subject').strip()
    topic = data.get('topic').strip()
    
    # Parse level, default to Intermediate
    level = data.get('level', 'Intermediate').strip()
    if level not in ['Beginner', 'Intermediate', 'Advanced']:
        level = 'Intermediate'

    # Parse number of questions, default to 5
    num_questions = data.get('num_questions', 5)
    try:
        num_questions = int(num_questions)
        if num_questions not in [5, 10, 15]:
            num_questions = 5
    except (ValueError, TypeError):
        num_questions = 5
    
    system_prompt = (
        f"You are an expert quiz generator. Generate exactly {num_questions} multiple-choice questions "
        f"at a '{level}' difficulty level on the subject '{subject}' and topic '{topic}' provided by the user.\n"
        "You MUST return the output as a valid JSON object matching the following structure:\n"
        "{\n"
        "  \"questions\": [\n"
        "    {\n"
        "      \"question\": \"Question text here\",\n"
        "      \"options\": [\"Option 1\", \"Option 2\", \"Option 3\", \"Option 4\"],\n"
        "      \"correct_answer\": \"Option 1\"\n"
        "    }\n"
        "  ]\n"
        "}\n"
        "Requirements:\n"
        f"1. Include exactly {num_questions} questions.\n"
        "2. Provide exactly 4 options for each question.\n"
        "3. The 'correct_answer' value MUST match one of the items in the 'options' list EXACTLY.\n"
        "4. Your response must be valid raw JSON. Do not wrap the JSON output in markdown formatting."
    )

    try:
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Generate a {level} difficulty quiz with {num_questions} questions on the Subject: '{subject}' and Topic: '{topic}'"}
            ],
            response_format={"type": "json_object"},
            temperature=0.7
        )
        
        response_content = completion.choices[0].message.content
        quiz_data = json.loads(response_content)
        questions = quiz_data.get('questions', [])
        
        if not questions or len(questions) == 0:
            return jsonify({'error': 'Failed to generate questions. Please try again.'}), 500
            
        formatted_topic = f"{subject} - {topic} ({level})"
        session['quiz_questions'] = questions
        session['quiz_topic'] = formatted_topic
        
        sanitized_questions = []
        for q in questions:
            sanitized_questions.append({
                'question': q.get('question'),
                'options': q.get('options')
            })
            
        return jsonify({
            'topic': formatted_topic,
            'questions': sanitized_questions
        })
        
    except json.JSONDecodeError:
        return jsonify({'error': 'Failed to parse quiz data from AI response. Please try again.'}), 500
    except Exception as e:
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500

@app.route('/submit-quiz', methods=['POST'])
def submit_quiz():
    if not is_logged_in():
        return jsonify({'error': 'Unauthorized. Please log in first.'}), 401

    data = request.get_json()
    if not data or 'answers' not in data:
        return jsonify({'error': 'No answers provided.'}), 400
        
    user_answers = data.get('answers')
    stored_questions = session.get('quiz_questions')
    topic = session.get('quiz_topic', 'AI Generated Quiz')
    
    if not stored_questions:
        return jsonify({'error': 'No active quiz session found. Please generate a new quiz.'}), 400
        
    score = 0
    results = []
    
    for i, q in enumerate(stored_questions):
        user_ans = user_answers[i] if i < len(user_answers) else None
        correct_ans = q.get('correct_answer')
        is_correct = (user_ans == correct_ans)
        
        if is_correct:
            score += 1
            
        results.append({
            'question': q.get('question'),
            'options': q.get('options'),
            'user_answer': user_ans,
            'correct_answer': correct_ans,
            'is_correct': is_correct
        })
        
    # Save the score history record to MongoDB
    history_record = {
        "user_id": session['user_id'],
        "username": session['username'],
        "topic": topic,
        "score": score,
        "total": len(stored_questions),
        "timestamp": datetime.utcnow()
    }
    
    try:
        db.history.insert_one(history_record)
    except Exception as e:
        print(f"Database insertion failed: {e}")
        
    return jsonify({
        'score': score,
        'total': len(stored_questions),
        'results': results
    })

@app.route('/quiz-history', methods=['GET'])
def get_quiz_history():
    if not is_logged_in():
        return jsonify({'error': 'Unauthorized. Please log in first.'}), 401

    try:
        records = db.history.find({"user_id": session['user_id']}).sort("timestamp", -1)
        history_list = []
        for rec in records:
            history_list.append({
                "topic": rec.get("topic", "Unknown"),
                "score": rec.get("score", 0),
                "total": rec.get("total", 5),
                "timestamp": rec.get("timestamp").strftime("%b %d, %Y - %I:%M %p") if rec.get("timestamp") else "N/A"
            })
        return jsonify({'history': history_list})
    except Exception as e:
        return jsonify({'error': f'Failed to retrieve history: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
