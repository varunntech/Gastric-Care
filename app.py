# app.py

import joblib
import pandas as pd
import datetime
import os
from flask import Flask, request, jsonify, render_template, make_response, send_from_directory, redirect, url_for
from flask_cors import CORS
from fpdf import FPDF
from io import BytesIO 
import smtplib
from email.message import EmailMessage
import threading
import razorpay
import json
import requests
import base64

DONATIONS_FILE = 'donations_data.json'

def get_total_donations():
    if not os.path.exists(DONATIONS_FILE):
        return 5000
    try:
        with open(DONATIONS_FILE, 'r') as f:
            data = json.load(f)
            return data.get('total_donated', 5000)
    except:
        return 5000

def add_donation(amount):
    total = get_total_donations()
    total += amount
    try:
        with open(DONATIONS_FILE, 'w') as f:
            json.dump({'total_donated': total}, f)
    except Exception as e:
        print("Failed to save donation data", e)

RAZORPAY_KEY_ID = os.environ.get('RAZORPAY_KEY_ID', '')
RAZORPAY_KEY_SECRET = os.environ.get('RAZORPAY_KEY_SECRET', '')
razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

SECRET_KEY = os.environ.get('FLASK_SECRET_KEY', 'supersecretkey')  # Change this in production! 

# --- Configuration ---
try:
    # Load the trained detection model and features
    model = joblib.load("gastric_detection_model.joblib")
    with open("gastric_detection_features.txt", "r") as f:
        MODEL_FEATURES = [line.strip() for line in f]
except FileNotFoundError:
    print("FATAL ERROR: Detection model or feature file not found. Run 'train_and_save.py' first.")
    # exit() # Allow running even if model is missing for dev purposes



app = Flask(__name__, template_folder="templates")
CORS(app)

# Columns treated as categorical during training (must match train_and_save.py)
CATEGORICAL_COLS = [
    "gender",
    "ethnicity",
    "geographical_location",
    "dietary_habits",
    "existing_conditions",
    "dysphagia",
    "weight_loss",
    "abdominal_pain",
    "nausea",
    "satiety",
    "blood",
    "fatigue",
    "blood_type"
]

NUMERIC_COLS = [
    "age",
    "family_history",
    "smoking_habits",
    "alcohol_consumption",
    "helicobacter_pylori_infection",
    "bmi"
]

BREVO_API_KEY = os.environ.get('BREVO_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', '')

def send_brevo_email(recipient_email, subject, html_content, attachment_bytes=None, attachment_name=None):
    url = "https://api.brevo.com/v3/smtp/email"
    headers = {
        "accept": "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json"
    }
    
    payload = {
        "sender": {"name": "GastricCare", "email": SENDER_EMAIL},
        "to": [{"email": recipient_email}],
        "subject": subject,
        "htmlContent": html_content
    }
    
    if attachment_bytes and attachment_name:
        b64_content = base64.b64encode(attachment_bytes).decode('utf-8')
        payload["attachment"] = [{"content": b64_content, "name": attachment_name}]
        
    try:
        response = requests.post(url, json=payload, headers=headers)
        if response.status_code in [201, 200]:
            print(f"Email sent successfully to {recipient_email}")
        else:
            print(f"Email failure: {response.text}")
    except Exception as e:
        print(f"Failed to call Brevo API: {e}")

def send_report_email(pdf_bytes, filename, recipient_email):
    html_content = '''<html><body>
        <h3>Your Gastric Cancer Risk Assessment Report</h3>
        <p>Hello,</p>
        <p>Please find attached your Gastric Cancer Risk Assessment Report.</p>
        <p><strong>Note:</strong> This is an AI-generated assessment and not a medical diagnosis.</p>
        <p>Stay healthy,<br>GastricCare Team</p>
    </body></html>'''
    send_brevo_email(recipient_email, "Your Gastric Cancer Risk Assessment Report", html_content, pdf_bytes, filename)

# --- Routes ---

# DB Migration for Surname


# --- Hybrid Auth Logic ---

@app.route('/api/otp/request', methods=['POST'])
def request_otp():
    data = request.json
    email = data.get('email')
    if not email:
        return jsonify({'error': 'Email is required'}), 400
    
    import random
    otp = str(random.randint(100000, 999999))
    
    # In a real app, you'd store this in Firestore with an expiration
    # For now, we'll use a simplified check or just email it.
    # To keep it "Zero Key", we will just send it and the user confirms.
    
    html_content = f'''<html><body style="font-family: Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 16px;">
            <h2 style="color: #2563eb;">GastricCare Security Code</h2>
            <p>Your password reset code is:</p>
            <div style="font-size: 32px; font-weight: 800; letter-spacing: 5px; color: #1e40af; padding: 20px; background: #eff6ff; border-radius: 12px; text-align: center; margin: 20px 0;">
                {otp}
            </div>
            <p>This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
        </div>
    </body></html>'''
    
    try:
        send_brevo_email(email, f"{otp} is your GastricCare reset code", html_content)
        # Store OTP temporarily (Simplified for this task)
        # In production: db.collection('otps').document(email).set({'otp': otp, 'expires': ...})
        return jsonify({'message': 'OTP sent successfully', 'otp_check': otp}) # Returning OTP for client-side demo if no DB access
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/otp/reset', methods=['POST'])
def reset_custom_password():
    data = request.json
    email = data.get('email')
    name = data.get('name') or 'User'
    new_password = data.get('newPassword')
    
    if not email or not new_password:
        return jsonify({'error': 'Missing data'}), 400
        
    try:
        with open('custom_auth_data.json', 'a+') as f:
            f.seek(0)
            try:
                auth_data = json.load(f)
            except:
                auth_data = {}
            
            auth_data[email] = {'password': new_password, 'name': name}
            f.seek(0)
            f.truncate()
            json.dump(auth_data, f)
            
        return jsonify({'message': 'Password and Name updated successfully!'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/custom_login', methods=['POST'])
def custom_login():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    
    try:
        if os.path.exists('custom_auth_data.json'):
            with open('custom_auth_data.json', 'r') as f:
                auth_data = json.load(f)
                user_info = auth_data.get(email)
                if user_info and (user_info == password or (isinstance(user_info, dict) and user_info.get('password') == password)):
                    # Get display name
                    display_name = user_info.get('name') if isinstance(user_info, dict) else email.split('@')[0].capitalize()
                    return jsonify({
                        'success': True,
                        'user': {
                            'email': email,
                            'displayName': display_name,
                            'uid': 'custom_' + email.replace('@', '_').replace('.', '_')
                        }
                    })
        return jsonify({'error': 'Invalid credentials'}), 401
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/')
def root():
    """Redirect root to home page."""
    import urllib.parse
    
    # Deep Decode from Args and Cookies
    raw_name = request.args.get('name') or request.cookies.get('username')
    raw_email = request.args.get('email') or request.cookies.get('useremail')
    
    name = urllib.parse.unquote(raw_name) if raw_name else None
    email = urllib.parse.unquote(raw_email) if raw_email else None
    is_admin = request.args.get('isadmin') or request.cookies.get('isadmin')
    
    # Force clean cookies
    resp = make_response(render_template('home.html', name=name, is_admin=(is_admin == 'true' or is_admin == True)))
    if name:
        resp.set_cookie('username', name)
    if email:
        resp.set_cookie('useremail', email)
    if request.args.get('isadmin'):
        resp.set_cookie('isadmin', request.args.get('isadmin'))
    return resp

@app.route('/home')
def home():
    """Landing/home page."""
    name = request.args.get('name') or request.cookies.get('username')
    is_admin = request.cookies.get('isadmin') == 'true'
    return render_template('home.html', name=name, is_admin=is_admin)

@app.route('/about')
def about():
    """About Us page."""
    name = request.cookies.get('username')
    is_admin = request.cookies.get('isadmin') == 'true'
    return render_template('about.html', name=name, is_admin=is_admin)

@app.route('/risk')
def risk():
    """Risk assessment page."""
    import urllib.parse
    raw_name = request.cookies.get('username')
    raw_email = request.cookies.get('useremail')
    
    name = urllib.parse.unquote(raw_name) if raw_name else None
    email = urllib.parse.unquote(raw_email) if raw_email else None
    is_admin = request.cookies.get('isadmin') == 'true'
    
    if not name:
        return redirect('/login')
    
    # Pass Firebase Config for History Persistence
    firebase_config = {
        'apiKey': os.environ.get('VITE_FIREBASE_API_KEY', 'AIzaSyBFqQd-quDrhriBFsF2CpOVttuekzK_QGY'),
        'authDomain': os.environ.get('VITE_FIREBASE_AUTH_DOMAIN', 'gastric-care.firebaseapp.com'),
        'projectId': os.environ.get('VITE_FIREBASE_PROJECT_ID', 'gastric-care'),
        'storageBucket': os.environ.get('VITE_FIREBASE_STORAGE_BUCKET', 'gastric-care.firebasestorage.app'),
        'messagingSenderId': os.environ.get('VITE_FIREBASE_MESSAGING_SENDER_ID', '542420375187'),
        'appId': os.environ.get('VITE_FIREBASE_APP_ID', '1:542420375187:web:db77e9f0b3f5da1e959f66')
    }
    
    return render_template('index.html', name=name, email=email, is_admin=is_admin, firebase_config=firebase_config)

@app.route('/login')
@app.route('/signup')
@app.route('/forgot-password')
@app.route('/dashboard')
@app.route('/admin')
def serve_react():
    """Serve React frontend build directory."""
    return send_from_directory('frontend/dist', 'index.html')

@app.route('/assets/<path:path>')
def serve_react_assets(path):
    """Serve React frontend assets."""
    return send_from_directory('frontend/dist/assets', path)
    
@app.route('/logout')
def logout():
    resp = redirect('/login')
    resp.set_cookie('username', '', expires=0)
    resp.set_cookie('useremail', '', expires=0)
    resp.set_cookie('isadmin', '', expires=0)
    return resp

@app.route('/api/welcome_email', methods=['POST'])
def welcome_email():
    data = request.json
    email = data.get('email')
    name = data.get('name', 'User')
    if not email:
        return jsonify({'error': 'No email provided'}), 400
        
    html_content = f'''<html><body>
        <h2>Welcome to GastricCare, {name}!</h2>
        <p>We are glad to have you on board. Your health journey begins here.</p>
        <p>GastricCare provides free and accessible Gastric Cancer risk assessments powered by AI. 
        Feel free to run assessments and explore our health guidelines.</p>
        <p>Stay healthy,<br>GastricCare Team</p>
    </body></html>'''
    
    send_brevo_email(email, "Welcome to GastricCare!", html_content)
    return jsonify({'message': 'Welcome email triggered'}), 200

@app.route('/donate')
def donate():
    """Donation page using Razorpay."""
    import urllib.parse
    total = get_total_donations()
    raw_name = request.cookies.get('username')
    raw_email = request.cookies.get('useremail')
    
    name = urllib.parse.unquote(raw_name) if raw_name else None
    email = urllib.parse.unquote(raw_email) if raw_email else None
    
    if not name:
        return redirect('/login')
    return render_template('donate.html', key_id=RAZORPAY_KEY_ID, total_donated=total, name=name, email=email)

@app.route('/api/create-order', methods=['POST'])
def create_order():
    try:
        data = request.json
        amount = int(data.get('amount', 500)) * 100 # Razorpay accepts amount in paise
        
        order_params = {
            'amount': amount,
            'currency': 'INR',
            'receipt': 'receipt_donation',
            'payment_capture': 1
        }
        order = razorpay_client.order.create(data=order_params)
        return jsonify(order)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/verify-payment', methods=['POST'])
def verify_payment():
    data = request.json
    try:
        razorpay_client.utility.verify_payment_signature({
            'razorpay_order_id': data['razorpay_order_id'],
            'razorpay_payment_id': data['razorpay_payment_id'],
            'razorpay_signature': data['razorpay_signature']
        })
        
        # Verify success, track amount
        order_details = razorpay_client.order.fetch(data['razorpay_order_id'])
        donated_amount_inr = int(order_details['amount']) // 100
        add_donation(donated_amount_inr)
        
        donor_email = data.get('donor_email')
        if donor_email:
            html_content = f'''<html><body>
                <h2>Thank you for your generous donation!</h2>
                <p>We have successfully received your donation of <strong>₹{donated_amount_inr}</strong>.</p>
                <p>Your contribution directly helps us provide free risk assessments to underserved communities and further our AI-driven gastric cancer research. Together, we are saving lives through early detection!</p>
                <p>With massive gratitude,<br>The GastricCare Team</p>
            </body></html>'''
            send_brevo_email(donor_email, "Thank You for Your Donation to GastricCare", html_content)
        
        return jsonify({'message': 'Payment successful'})
    except Exception as e:
        return jsonify({'error': 'Invalid Signature'}), 400

@app.route('/api/download_report', methods=['POST'])
def download_report():
    data = request.json
    if not data:
        return jsonify({'message': 'No data provided'}), 400

    # Extract data
    user_email = data.get('user_email')
    skip_email = data.get('skip_email', False)
    send_email_only = data.get('send_email_only', False)
    risk_level = data.get('risk_level', 'Unknown').upper()
    probability = data.get('probability_of_cancer', 0)
    drivers = data.get('risk_drivers', [])
    recommendations = data.get('recommendations', [])
    date_str = data.get('date', datetime.datetime.now().strftime("%Y-%m-%d"))
    prob_percent = f"{float(probability) * 100:.2f}%"
    patient_name = data.get('patient_name', 'Guest').encode('latin-1', 'replace').decode('latin-1')

    import random
    
    
    # Extract extra fields if available for the grid
    gender = data.get("gender", "Unknown")
    age_val = data.get("age", "Unknown")
    age = str(age_val) + "Y" if age_val != "Unknown" else "Unknown"
    
    # Create PDF
    pdf = FPDF()
    pdf.add_page()
    
    # 1. Header (Gastric Care)
    pdf.set_y(10)
    pdf.set_font('Arial', 'B', 18)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(0, 10, "Gastric Care", ln=True, align='C')
    pdf.ln(5)
    
    # 2. Patient Details Grid
    pdf.set_draw_color(0, 0, 0)
    pdf.rect(10, 25, 190, 45)
    
    labels_left = ["Patient ID", "Gender", "Encounter ID", "Admission Date", "Speciality"]
    pid = f"GC{random.randint(100000, 999999)}"
    eid = str(random.randint(1000000, 9999999))
    full_date = datetime.datetime.now().strftime("%d/%m/%Y %H:%M")
    vals_left = [pid, gender, eid, full_date, "Oncology / Gastro"]
    
    labels_right = ["Patient Name", "Age", "Encounter Type", "Attending Practitioner"]
    vals_right = [patient_name, age, "Assessment", "AI System Evaluator"]
    
    pdf.set_text_color(0, 0, 0)
    y_start = 28
    for i in range(5):
        y_curr = y_start + (i * 8)
        # Left
        pdf.set_xy(12, y_curr)
        pdf.set_font('Arial', 'B', 10)
        pdf.cell(30, 5, labels_left[i])
        pdf.set_xy(43, y_curr)
        pdf.set_font('Arial', '', 10)
        pdf.cell(5, 5, ":")
        pdf.set_xy(48, y_curr)
        pdf.cell(50, 5, vals_left[i])
        # Right
        if i < len(labels_right):
            pdf.set_xy(105, y_curr)
            pdf.set_font('Arial', 'B', 10)
            pdf.cell(40, 5, labels_right[i])
            pdf.set_xy(150, y_curr)
            pdf.set_font('Arial', '', 10)
            pdf.cell(5, 5, ":")
            pdf.set_xy(155, y_curr)
            pdf.cell(50, 5, vals_right[i])
        
    pdf.line(10, 75, 200, 75)
    pdf.set_y(80)

    # 3. Assessment Summary Box
    pdf.set_fill_color(245, 247, 250)
    pdf.rect(10, 80, 190, 22, 'F')
    pdf.set_xy(12, 82)
    pdf.set_font('Arial', 'B', 10)
    pdf.cell(45, 5, "Clinical Assessment Summary")
    pdf.set_xy(12, 88)
    pdf.set_font('Arial', 'B', 9)
    pdf.cell(45, 5, "Aggregated Risk Tier")
    pdf.set_xy(55, 88)
    pdf.cell(5, 5, ":")
    
    if risk_level == 'HIGH':
        pdf.set_text_color(220, 20, 20)
    elif risk_level == 'MODERATE':
        pdf.set_text_color(220, 130, 0)
    else:
        pdf.set_text_color(10, 150, 50)
    pdf.set_xy(60, 88)
    pdf.set_font('Arial', 'B', 11)
    pdf.cell(50, 5, f"{risk_level} RISK")
    pdf.set_text_color(0,0,0)
    pdf.set_xy(12, 94)
    pdf.set_font('Arial', 'B', 9)
    pdf.cell(45, 5, "Calculated Probability")
    pdf.set_xy(55, 94)
    pdf.set_font('Arial', '', 9)
    pdf.cell(5, 5, ":")
    pdf.set_xy(60, 94)
    pdf.set_font('Arial', 'B', 11)
    pdf.cell(50, 5, f"{prob_percent}")
    
    # 4. Risk Drivers Section
    y = 110
    pdf.set_fill_color(190, 190, 190)
    pdf.rect(10, y, 190, 6, 'F')
    pdf.set_font('Arial', 'B', 10)
    pdf.set_xy(10, y)
    pdf.cell(190, 6, "  Significant Risk Factors Identified", ln=True)
    y += 8
    if drivers:
        for driver in drivers:
            name_d = driver.get('name', '').encode('latin-1', 'replace').decode('latin-1')
            impact = driver.get('impact', '').encode('latin-1', 'replace').decode('latin-1')
            pdf.set_xy(12, y)
            pdf.set_font('Arial', 'B', 9)
            pdf.cell(45, 5, name_d)
            pdf.set_xy(55, y)
            pdf.set_font('Arial', '', 9)
            pdf.cell(5, 5, ":")
            pdf.set_xy(60, y)
            pdf.cell(50, 5, f"{impact} Impact on overall risk profile.")
            y += 6
    else:
        pdf.set_xy(12, y)
        pdf.cell(0, 5, "None identified")
        y += 6
        
    # 5. Full Patient Symptom Profile
    y += 6
    if y > 240: 
        pdf.add_page(); y = 20
    pdf.set_fill_color(190, 190, 190)
    pdf.rect(10, y, 190, 6, 'F')
    pdf.set_font('Arial', 'B', 10)
    pdf.set_xy(10, y)
    pdf.cell(190, 6, "  Comprehensive Patient Symptom Profile", ln=True)
    y += 8
    
    LABEL_MAPPING = {
        "age": "Patient Age", "gender": "Gender", "ethnicity": "Ethnicity",
        "geographical_location": "Location", "family_history": "Family History",
        "smoking_habits": "Smoking Status", "alcohol_consumption": "Alcohol Intake",
        "dietary_habits": "Dietary Preference", "existing_conditions": "Health Conditions",
        "helicobacter_pylori_infection": "H. Pylori Status", "bmi": "Body Mass Index",
        "dysphagia": "Swallowing Ease", "weight_loss": "Weight Changes",
        "abdominal_pain": "Abdominal Pain", "nausea": "Nausea Level",
        "satiety": "Early Satiety", "blood": "Internal Bleeding",
        "fatigue": "Fatigue Level", "blood_type": "Blood Group"
    }

    pdf.set_font('Arial', '', 8)
    all_symptoms = [c for c in (NUMERIC_COLS + CATEGORICAL_COLS) if c in data]
    
    col1_x = 12
    col2_x = 105
    rowCount = 0
    
    for key in all_symptoms:
        val = str(data.get(key, "N/A")).encode('latin-1', 'replace').decode('latin-1')
        label = LABEL_MAPPING.get(key, key.replace('_', ' ').title())
        
        curr_x = col1_x if rowCount % 2 == 0 else col2_x
        pdf.set_xy(curr_x, y)
        pdf.set_font('Arial', 'B', 8)
        pdf.cell(40, 4, f"{label}")
        pdf.set_font('Arial', '', 8)
        pdf.cell(5, 4, ":")
        pdf.cell(45, 4, f"{val}")
        
        if rowCount % 2 != 0:
            y += 5
        rowCount += 1
        
        if y > 270:
            pdf.add_page()
            y = 20

    # 6. Recommendations Section
    y += 6
    if y > 250:
        pdf.add_page()
        y = 20
        
    pdf.set_fill_color(190, 190, 190)
    pdf.rect(10, y, 190, 6, 'F')
    pdf.set_font('Arial', 'B', 10)
    pdf.set_xy(10, y)
    pdf.cell(190, 6, "  Advice & Clinical Next Steps", ln=True)
    
    y += 8
    pdf.set_font('Arial', '', 9)
    if recommendations:
        for step in recommendations:
            step_clean = step.encode('latin-1', 'replace').decode('latin-1')
            pdf.set_xy(12, y)
            pdf.multi_cell(180, 5, f"{step_clean}")
            y = pdf.get_y() + 2
    else:
        pdf.set_xy(12, y)
        pdf.cell(0, 5, "Consult Healthcare Provider")
        y += 6
        
    y += 10
    pdf.set_font('Arial', '', 8)
    pdf.set_text_color(50, 50, 50)
    pdf.set_xy(10, y)
    pdf.cell(0, 5, "Authorized by Gastric Care Systems on " + full_date, ln=True)
    pdf.cell(0, 5, "This is a computer generated AI report. Signature is not required.", ln=True)

    # Output - FPDF 1.7.2 way
    response_string = pdf.output(dest='S')
    
    # Handle response depending on FPDF version/environment
    if isinstance(response_string, str):
        response_bytes = response_string.encode('latin-1')
    else:
        response_bytes = response_string

    filename = f'Gastric_Risk_Report_{date_str}.pdf'
    
    # ONLY send email if requested and skip_email is false
    if user_email and not skip_email:
        print(f"DEBUG: Triggering report email for {user_email}")
        send_report_email(response_bytes, filename, user_email)
    else:
        print(f"DEBUG: Skipping report email. Email: {user_email}, skip_email: {skip_email}")

    if send_email_only:
        return jsonify({"message": "Email sent successfully"}), 200

    return make_response(response_bytes, 200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': f'attachment; filename={filename}'
    })

# --- Chatbot Logic ---
from pypdf import PdfReader
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import re

PDF_CONTENT = []
VECTORIZER = None
TFIDF_MATRIX = None

def load_pdf_content():
    global PDF_CONTENT, VECTORIZER, TFIDF_MATRIX
    try:
        reader = PdfReader("Gastric Cancer Chatbot Handbook.pdf")
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        
        # Split into overlapping chunks of lines to preserve context between headings and answers
        lines = [line.strip() for line in text.split('\n') if len(line.strip()) > 10]
        
        chunk_size = 5
        overlap = 2
        chunks = []
        for i in range(0, len(lines), chunk_size - overlap):
            chunk_text = " ".join(lines[i:i + chunk_size])
            if len(chunk_text) > 30 and not chunk_text.lower().startswith("all greeting variations"):
                chunks.append(chunk_text)
                
        # Remove exact duplicates while preserving order
        PDF_CONTENT = list(dict.fromkeys(chunks))
        
        if PDF_CONTENT:
            VECTORIZER = TfidfVectorizer(stop_words='english')
            TFIDF_MATRIX = VECTORIZER.fit_transform(PDF_CONTENT)
            print(f"Chatbot: Loaded {len(PDF_CONTENT)} text chunks from PDF.")
        else:
            print("Chatbot: PDF content is empty.")
            
    except Exception as e:
        print(f"Chatbot Error: Failed to load PDF - {e}")

# Load on startup
load_pdf_content()

@app.route('/api/chat', methods=['POST'])
def chat_api():
    data = request.json
    user_query = data.get('message', '')
    import re
    
    if not user_query:
        return jsonify({'response': "I didn't catch that. Could you please repeat?"})
        
    user_query_clean = user_query.strip().lower()
    
    # Explicitly catch greetings to prevent pulling meta-instructions from PDF
    greetings = r"^(hi|hello|hey|heyy|hii|hiii|hlo|hola|greetings|good morning|good afternoon|good evening)[!?]*$"
    if re.match(greetings, user_query_clean):
        return jsonify({'response': "Hey there! I am your GastricCare AI Assistant. How can I help you regarding gastric cancer risks and dietary information today?"})
        
    # Explicit conversational responses
    how_are_you = r"^(how are you|how are u|how r u|how r you|whats up|how do you do)[!?]*$"
    if re.match(how_are_you, user_query_clean):
        return jsonify({'response': "I'm doing great, thank you! I am here to answer your questions about gastric health or the risk assessment form."})
        
    emotions = r"^(i am scared|i'm scared|im scared|i am afraid|i'm afraid)[!?]*$"
    if re.match(emotions, user_query_clean):
        return jsonify({'response': "It's completely understandable to feel this way. You're not alone. I'm here to guide you, and a doctor can give you the best care."})
        
    do_i_have = r"^(do i have cancer|do you think i have cancer)[!?]*$"
    if re.match(do_i_have, user_query_clean):
        return jsonify({'response': "I cannot confirm that, but I can help assess your risk using the clinical form. A doctor is the best person to diagnose this."})

    # Hardcoded medical FAQ derived from handbook
    q_what_is = r".*(what is gastric cancer|what is stomach cancer|explain gastric cancer).*"
    if re.match(q_what_is, user_query_clean):
        return jsonify({'response': "Gastric cancer, also known as stomach cancer, is a disease where abnormal cells grow in the stomach lining and form tumors. The most common type is Adenocarcinoma."})

    q_symptoms = r".*(what are the symptoms|symptoms of gastric cancer|signs of stomach cancer|what symptoms).*"
    if re.match(q_symptoms, user_query_clean):
        return jsonify({'response': "Early stage symptoms include indigestion, mild discomfort, and loss of appetite. Advanced symptoms may include severe abdominal pain, vomiting blood, black stool, rapid weight loss, and difficulty swallowing."})

    q_causes = r".*(what are the causes|causes of gastric cancer|why does gastric cancer happen).*"
    if re.match(q_causes, user_query_clean):
        return jsonify({'response': "The main causes include Helicobacter pylori (H. pylori) infection, a diet high in salt or processed meat, smoking, genetic factors, and chronic inflammation."})

    q_prevention = r".*(how to prevent|prevention of gastric cancer|how can i prevent|stop gastric cancer).*"
    if re.match(q_prevention, user_query_clean):
        return jsonify({'response': "You can help prevent gastric cancer by maintaining a healthy diet, avoiding smoking, reducing your salt intake, and ensuring you treat infections like H. pylori early."})

    q_treatment = r".*(how is it treated|treatment of gastric cancer|how to cure|treatment options).*"
    if re.match(q_treatment, user_query_clean):
        return jsonify({'response': "Treatment options depend on the stage but may include surgery (partial or total gastrectomy), chemotherapy, radiation therapy, targeted therapy, or immunotherapy."})

    q_emergency = r".*(vomiting blood|severe pain|black stool).*"
    if re.match(q_emergency, user_query_clean):
        return jsonify({'response': "This may be serious. Please go to the nearest hospital or emergency room immediately."})
        
    # Also ignore very short inputs to avoid random artifact pulling
    if len(user_query_clean) <= 2 and user_query_clean not in ['hi', 'ok', 'no']:
        return jsonify({'response': "I couldn't understand. Could you please provide more details?"})
        
    if not VECTORIZER or TFIDF_MATRIX is None:
        return jsonify({'response': "I'm sorry, my knowledge base is still loading or unavailable."})

    try:
        # Transform query and find best match
        query_vec = VECTORIZER.transform([user_query])
        similarities = cosine_similarity(query_vec, TFIDF_MATRIX).flatten()
        best_idx = similarities.argmax()
        best_score = similarities[best_idx]
        
        if best_score > 0.1: # Threshold for relevance
            response = PDF_CONTENT[best_idx]
            return jsonify({'response': response})
        else:
            return jsonify({'response': "I couldn't find specific information about that in the guide. Please consult a doctor."})
            
    except Exception as e:
        print(f"Chatbot Query Error: {e}")
        return jsonify({'response': "Sorry, I ran into an error processing your question."})

@app.route('/predict', methods=['POST'])
def predict():
    """Handles the prediction request."""
    try:
        data = request.get_json(force=True) or {}

        # 1. Build a single-row DataFrame with expected columns
        all_cols = NUMERIC_COLS + CATEGORICAL_COLS
        row = {}
        for col in all_cols:
            value = data.get(col, None)
            row[col] = value

        input_df = pd.DataFrame([row])

        # 2. Simple imputation to avoid failures on missing values
        for col in NUMERIC_COLS:
            if col in input_df.columns:
                input_df[col] = pd.to_numeric(input_df[col], errors="coerce")
                median_val = input_df[col].median() if not pd.isna(input_df[col].median()) else 0
                input_df[col] = input_df[col].fillna(median_val)

        for col in CATEGORICAL_COLS:
            if col in input_df.columns:
                input_df[col] = input_df[col].fillna("Unknown")

        # 3. One-Hot Encode categorical variables (same as training)
        input_encoded = pd.get_dummies(input_df, columns=CATEGORICAL_COLS, drop_first=False)

        # 4. Align features with the training data
        final_input = input_encoded.reindex(columns=MODEL_FEATURES, fill_value=0)

        # 5. Make prediction – continuous probability of gastric cancer (regression)
        if hasattr(model, 'predict_proba'):
            prob_cancer = float(model.predict_proba(final_input)[:, 1][0])
        else:
            prob_cancer = float(model.predict(final_input)[0])

        # 5a. Extract individual risk factors for balanced assessment
        row_clean = final_input.copy()
        # Work from original (pre-encoded) input_df for interpretability
        fh = int(round(float(input_df.get("family_history", 0).iloc[0] or 0)))
        hp = int(round(float(input_df.get("helicobacter_pylori_infection", 0).iloc[0] or 0)))
        smoke = int(round(float(input_df.get("smoking_habits", 0).iloc[0] or 0)))
        diet = str(input_df.get("dietary_habits", pd.Series(["Low_Salt"])).iloc[0] or "Low_Salt")
        cond = str(input_df.get("existing_conditions", pd.Series(["None"])).iloc[0] or "None")

        # Individual risk factor flags
        has_family_history = fh == 1
        has_h_pylori = hp == 1
        has_smoking = smoke == 1
        has_high_salt = diet == "High_Salt"
        has_chronic_gastritis = cond == "Chronic Gastritis"
        
        # New Symptom Check
        dys = str(input_df.get("dysphagia", pd.Series(["none"])).iloc[0] or "none").lower()
        wl = str(input_df.get("weight_loss", pd.Series(["none"])).iloc[0] or "none").lower()
        bld = str(input_df.get("blood", pd.Series(["no"])).iloc[0] or "no").lower()
        pain = str(input_df.get("abdominal_pain", pd.Series(["none"])).iloc[0] or "none").lower()

        has_dysphagia_severe = dys in ["moderate", "severe"]
        has_weight_loss_severe = wl in ["5_10kg", "more_10kg"]
        has_blood = bld == "yes"
        has_pain_severe = pain == "severe"
        
        has_critical_symptom = has_blood or has_weight_loss_severe or has_dysphagia_severe
        
        major_flags = [
            has_family_history,
            has_h_pylori,
            has_high_salt,
            has_chronic_gastritis,
            has_smoking,
            has_dysphagia_severe,
            has_weight_loss_severe,
            has_blood,
            has_pain_severe
        ]
        n_major = sum(major_flags)

        # 6. Convert probability into risk tier (initial assessment)
        if prob_cancer < 0.3:
            risk_level = "low"
            risk_text = "Low estimated chance of gastric cancer based on your answers."
        elif prob_cancer < 0.6:
            risk_level = "moderate"
            risk_text = "Moderate (borderline) risk – you should consider consulting a doctor for proper evaluation."
        else:
            risk_level = "high"
            risk_text = "High estimated chance – you should consult a doctor or gastroenterologist as soon as possible."



        # 7. Identify Risk Drivers for Clinical Report
        all_drivers = []
        if has_blood:
            all_drivers.append({"name": "Blood in Stool/Vomit", "impact": "Critical"})
        if has_dysphagia_severe:
            all_drivers.append({"name": "Difficulty Swallowing", "impact": "Critical"})
        if has_weight_loss_severe:
            all_drivers.append({"name": "Unexplained Weight Loss", "impact": "High"})
        if has_pain_severe:
            all_drivers.append({"name": "Severe Abdominal Pain", "impact": "High"})
        if has_h_pylori:
            all_drivers.append({"name": "H. Pylori Infection", "impact": "High"})
        if has_family_history:
            all_drivers.append({"name": "Family History", "impact": "High"})
        if has_chronic_gastritis:
            all_drivers.append({"name": "Chronic Gastritis", "impact": "High"})
        if has_smoking:
            all_drivers.append({"name": "Smoking", "impact": "Medium"})
        if has_high_salt:
            all_drivers.append({"name": "High Salt Diet", "impact": "Medium"})
        if int(input_df.get("alcohol_consumption", 0).iloc[0] or 0) == 1:
            all_drivers.append({"name": "Alcohol Consumption", "impact": "Medium"})
        if int(input_df.get("age", 0).iloc[0] or 0) > 60:
            all_drivers.append({"name": "Age > 60", "impact": "Medium"})

        # Select Top 3
        top_drivers = all_drivers[:3]
        if not top_drivers:
            top_drivers = [{"name": "General Health Factors", "impact": "Low"}]

        # 8. Generate Recommended Next Steps
        recommendations = []
        if risk_level == "high":
            recommendations.append("Immediate consultation with a gastroenterologist.")
            recommendations.append("Schedule an Endoscopy (EGD) for detailed visualization.")
        elif risk_level == "moderate":
            recommendations.append("Consult a doctor for a physical examination.")
            recommendations.append("Consider non-invasive screening tests.")
        else: # Low
            recommendations.append("Continue regular health checkups.")
            recommendations.append("Maintain a healthy lifestyle.")

        # Specific recommendations based on drivers
        if has_h_pylori:
            recommendations.append("Discuss H. Pylori eradication therapy with your doctor.")
        if has_high_salt:
            recommendations.append("Reduce salt intake and avoid processed foods.")
        if has_smoking:
            recommendations.append("Join a smoking cessation program.")
        if has_chronic_gastritis:
            recommendations.append("Monitor for symptoms of dyspepsia or pain.")
        
        # Limit recommendations to top 4 to avoid clutter
        recommendations = recommendations[:4]

        result = {
            "probability_of_cancer": prob_cancer,
            "risk_level": risk_level,
            "message": risk_text,
            "risk_drivers": top_drivers,
            "recommendations": recommendations,
            "date": datetime.datetime.now().strftime("%Y-%m-%d")
        }

        return jsonify(result)

    except Exception as e:
        # Generic error handling
        return jsonify({'error': str(e), 'message': 'Prediction failed.'}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)