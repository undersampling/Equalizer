# How to Run the Backend

## Setup and Run

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies (if not already installed):**
   ```bash
   pip install django djangorestframework django-cors-headers numpy librosa
   ```

3. **Run migrations (if needed):**
   ```bash
   python manage.py migrate
   ```

4. **Start the Django development server:**
   ```bash
   python manage.py runserver 8000
   ```

   Or if you prefer port 5000:
   ```bash
   python manage.py runserver 5000
   ```
   
   If using port 5000, make sure to set the environment variable in frontend:
   ```bash
   # In frontend directory, create .env file with:
   VITE_API_URL=http://localhost:5000
   ```

5. **The backend will be available at:**
   - Default: `http://localhost:8000`
   - Or custom: `http://localhost:5000`

## API Endpoints

- `POST /api/fft` - Compute FFT of signal
- `POST /api/spectrogram` - Compute spectrogram of signal  
- `POST /api/equalize` - Apply equalization to signal

## Troubleshooting

- **Port mismatch**: Frontend defaults to port 8000. If backend runs on different port, set `VITE_API_URL` environment variable
- **CORS errors**: Make sure `django-cors-headers` is installed and `CorsMiddleware` is in `MIDDLEWARE`
- **Module not found**: Install librosa for spectrogram: `pip install librosa`



