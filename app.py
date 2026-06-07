import os
import json
from datetime import datetime
from flask import Flask, render_template, request, jsonify, session
from dotenv import load_dotenv
from groq import Groq

# Load environment variables
load_dotenv(override=True)

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "dev-secret-key-1234567890-quiz-app")

# Initialize Groq client
def get_groq_client():
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key or api_key == "your_groq_api_key_here":
        return None
    return Groq(api_key=api_key)

# ----------------- PAGE ROUTES -----------------

@app.route('/')
def index():
    return render_template('index.html')

# ----------------- QUIZ API ENDPOINTS -----------------

@app.route('/generate-quiz', methods=['POST'])
def generate_quiz():
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
        
    return jsonify({
        'score': score,
        'total': len(stored_questions),
        'results': results
    })

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
