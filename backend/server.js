const express = require('express');
const app = express();
const pool = require('../backend/database/postgre'); 
const cors = require('cors');

app.use(express.json());
app.use(cors({
  origin: '*', // Allow all origins for testing
  credentials: true,
}));

app.get('/doctors', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM doctors');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.post('/doctors', async (req, res) => {
  const { name, email, department } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO doctors (name, email, department, created_on) 
       VALUES ($1, $2, $3, NOW()) RETURNING *`,
      [name, email, department]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error inserting doctor:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.put('/doctors/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, department } = req.body;
  try {
    const result = await pool.query(
      `UPDATE doctors 
       SET name = $1, email = $2, department = $3, last_login = NOW()
       WHERE doctor_id = $4 RETURNING *`,
      [name, email, department, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Doctor not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating doctor:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.delete('/doctors/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM doctors WHERE doctor_id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Doctor not found' });
    }
    res.json({ message: 'Doctor deleted successfully' });
  } catch (error) {
    console.error('Error deleting doctor:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.get('/articles', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM articles ORDER BY created_on DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching articles:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.get('/smartwatch-data', (req, res) => {
  const data = {
    heartRate: Math.floor(Math.random() * (120 - 60) + 60), // 60-120 bpm
    bloodPressure: `${Math.floor(Math.random() * (140 - 90) + 90)}/${Math.floor(Math.random() * (90 - 60) + 60)}`, // 90/60 - 140/90
    spo2: Math.floor(Math.random() * (100 - 90) + 90), // 90-100% SpO2
    stressLevel: Math.floor(Math.random() * 100), // 0-100 stress level
    sleepDuration: (Math.random() * 9).toFixed(1), // 0-9 hours sleep
  };
  res.json(data);
});




let lastConsultationResult = [];


const doctorSuggestions = {
  "Cardiologist": [
    "Tachycardia",
    "Cardiac Risk (Hypertension)",
    "Arrhythmia",
    "Bradycardia",
    "Hypertension",
    "Cardiovascular Disease Risk",
    "High Stress (Heart Disease)"
  ],
  "Psychologist / Psychiatrist": [
    "Chronic Stress",
    "Anxiety",
    "Depression Risk",
    "Anxiety Disorder Risk",
    "High Stress (Heart Disease)"
  ],
  "Sleep Specialist / Neurologist": [
    "Sleep Deprivation",
    "Insomnia",
    "Poor Sleep (Sleep Apnea)"
  ],
  "Pulmonologist": [
    "Sleep Apnea"
  ],
  "Endocrinologist": [
    "Diabetes Risk",
    "Metabolic Syndrome Risk"
  ],
  "Nutritionist": [
    "Obesity-related diseases (Diabetes)"
  ],
  "General Physician": [
    "Hypotension"
  ]
};


const specialtyToDepartment = {
  "Cardiologist": "Cardiologist",
  "Psychologist / Psychiatrist": "Psychologist / Psychiatrist",
  "Sleep Specialist / Neurologist": "Sleep Specialist / Neurologist",
  "Pulmonologist": "Pulmonologist",
  "Endocrinologist": "Endocrinologist",
  "Nutritionist": "Nutritionist",
  "General Physician": "General Physician"
};


function getDoctorSuggestion(prediction) {
  if (!prediction) return [];
  
  const diseases = [];
  if (prediction.ADDITIONAL_DISEASES && prediction.ADDITIONAL_DISEASES !== "nan") {
    diseases.push(...prediction.ADDITIONAL_DISEASES.split(";").map(item => item.trim()));
  }
  if (prediction.DETECTED_DISEASES && prediction.DETECTED_DISEASES !== "nan") {
    diseases.push(...prediction.DETECTED_DISEASES.split(";").map(item => item.trim()));
  }
  if (prediction.SLEEP_DISORDERS && prediction.SLEEP_DISORDERS !== "nan") {
    diseases.push(...prediction.SLEEP_DISORDERS.split(";").map(item => item.trim()));
  }
  
  let suggestedSpecialties = new Set();
  diseases.forEach(disease => {
    Object.entries(doctorSuggestions).forEach(([specialty, conditions]) => {
      conditions.forEach(condition => {
        const conditionKey = condition.split("(")[0].trim().toLowerCase();
        if (disease.toLowerCase().includes(conditionKey)) {
          suggestedSpecialties.add(specialty);
        }
      });
    });
  });
  return Array.from(suggestedSpecialties);
}


app.post('/consultation', async (req, res) => {
  try {
    const prediction = req.body;
    const recommendedSpecialties = getDoctorSuggestion(prediction);
    const recommendedDepartments = recommendedSpecialties
      .map(specialty => specialtyToDepartment[specialty])
      .filter(Boolean);
    
    let query = 'SELECT * FROM doctors';
    if (recommendedDepartments.length > 0) {
      const placeholders = recommendedDepartments.map((_, index) => `$${index + 1}`).join(', ');
      query += ` WHERE department IN (${placeholders})`;
      
      const result = await pool.query(query, recommendedDepartments);
      lastConsultationResult = result.rows; // Store for GET endpoint
      res.json(result.rows);
    } else {
      lastConsultationResult = [];
      res.json([]);
    }
  } catch (error) {
    console.error('Error processing consultation data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.get('/consultation', async (req, res) => {
  try {
    res.json(lastConsultationResult);
  } catch (error) {
    console.error('Error fetching consultation data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = result.rows[0];
    // For simplicity, using plain-text passwords; in production, hash passwords!
    if (user.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    res.json({ user });
  } catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const result = await pool.query(
      `INSERT INTO users (username, email, password, created_on) VALUES ($1, $2, $3, NOW()) RETURNING *`,
      [username, email, password]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error in registration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { gender, age, bmi } = req.body;
    const result = await pool.query(
      `UPDATE users SET gender = $1, age = $2, bmi = $3 WHERE user_id = $4 RETURNING *`,
      [gender, age, bmi, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating user info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.listen(4000, () => {
  console.log('Server running on port 4000');
});
