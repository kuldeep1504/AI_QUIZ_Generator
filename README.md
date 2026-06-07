# Flask AI Quiz App

A dynamic, AI-powered multiple-choice quiz application built with Flask and the Groq API. It allows users to generate custom quizzes on any topic at various difficulty levels and take the quizzes.

## Features

- **AI Quiz Generation:** Uses the Groq API (Llama 3 model) to instantly generate multiple-choice questions based on user-provided subjects and topics.
- **Customizable Quizzes:** Choose the difficulty level (Beginner, Intermediate, Advanced) and the number of questions (5, 10, or 15).
- **Session Management:** Secure user sessions using Flask's built-in session capabilities to store generated quiz data.

## Technologies Used

- **Backend:** Python, Flask
- **AI Integration:** Groq API
- **Environment Management:** python-dotenv

## Prerequisites

Before running the application, ensure you have the following:

- [Python 3.8+](https://www.python.org/downloads/)
- A [Groq API Key](https://console.groq.com/keys) for generating the quizzes.

## Installation & Setup

1. **Navigate to the project directory:**
   ```bash
   cd flask-quiz-app
   ```

2. **Create a virtual environment (optional but recommended):**
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```

3. **Install the dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure Environment Variables:**
   Create a `.env` file in the root directory of the project and add the following variables:
   ```env
   FLASK_SECRET_KEY=your_super_secret_flask_key
   GROQ_API_KEY=your_groq_api_key_here
   ```
   *Note: Replace the placeholders with your actual secret key and Groq API key.*

5. **Run the Application:**
   ```bash
   python app.py
   ```
   The application will be accessible at `http://127.0.0.1:5000/`.

## Project Structure

- `app.py`: Main application file containing all Flask routes (Quiz Generation, Quiz Submission).
- `requirements.txt`: Python package dependencies.
- `templates/`: Directory containing HTML templates (`index.html`).
- `static/`: Directory containing static assets like CSS and JS files.
- `.env`: Environment configuration file (to be created by the user).
