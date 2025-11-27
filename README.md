# WayraFrost - Sistema de Predicción de Heladas

Sistema inteligente de predicción de heladas multiclase para la región de Junín, Perú. Integra **Machine Learning**, **APIs meteorológicas**, **IA generativa (Gemini)** y **alertas SMS (Twilio)**.

## Estructura del Repositorio

```.txt
WayraFrost/
├── .env # Variables de entorno (NO versionar)
├── .gitignore # Archivos excluidos de Git
├── README.md # Este archivo
│
├── backend/
│ ├── api_v2.py # API Flask principal (v2 - multiclase)
│ ├── train_model_v2.py # Entrenamiento del modelo v2
│ ├── sms_service.py # Servicio de SMS con Twilio
│ ├── weather_service.py # Integración Open-Meteo API
│ ├── gemini_service.py # Integración Google Gemini AI
│ ├── requirements.txt # Dependencias Python
│ ├── frost_model_v2.pkl # Modelo entrenado (NO versionar)
│ │
│ └── data/ # Datos históricos (NO versionados)
│ ├── README.md # Documentación de datos
│ ├── .gitkeep # Mantiene directorio en Git
│ ├── HR_hourly_2018_2025.csv
│ ├── dir_hourly_2018_2025.csv
│ ├── pp_hourly_2018_2025.csv
│ ├── press_hourly_2018_2025.csv
│ ├── radinf_hourly_2018_2025.csv
│ ├── tempsup_hourly_2018_2025.csv
│ └── vel_hourly_2018_2025.csv
│
└── frontend/
├── public/
│ ├── index.html
│ ├── manifest.json
│ └── favicon.svg
│
├── src/
│ ├── components/
│ │ ├── EnhancedFrostPrediction_v2.jsx # Componente principal
│ │ ├── LocationMapSelector.jsx # Selector con mapa Leaflet
│ │ └── PhoneInput.jsx # Input de teléfono validado
│ │
│ ├── App.js # Punto de entrada React
│ ├── index.js # Render principal
│ └── index.css # Estilos globales + Leaflet
│
├── craco.config.js # Configuración CRACO
├── postcss.config.js # PostCSS + TailwindCSS
├── tailwind.config.js # Configuración Tailwind
├── package.json # Dependencias y scripts
└── package-lock.json # Lock de dependencias
```

## Requisitos Previos

- **Python** `3.10+` con `pip`
- **Node.js** `18+` con `npm`
- **Git**
- **Cuentas API** (opcionales pero recomendadas):
- [Google AI Studio](https://aistudio.google.com/) → Gemini API Key
- [Twilio](https://www.twilio.com/) → Account SID, Auth Token, Phone Number

## Clonación del Proyecto

1. Clonar el repositorio:

   ```bash
   git clone <URL_DEL_REPOSITORIO>
   cd WayraFrost
   ```

## Backend (Flask API)

1. Entrar al directorio y crear entorno virtual:

cd backend
python -m venv venv

### Windows

.\venv\Scripts\activate

### Linux/Mac

source venv/bin/activate

2. Instalar dependencias:

   ```powershell
   pip install -r requirements.txt
   ```

3. (Opcional) Entrenar el modelo si `frost_model.pkl` no existe:

   ```powershell
   python train_model_v2.py
   ```

4. Crear archiv .env en la raíz del proyecto:

### Google Gemini AI

GEMINI_API_KEY=tu_api_key_de_gemini

### Twilio SMS

TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=tu_auth_token_de_twilio
TWILIO_PHONE_NUMBER=+1234567890


5. Ejecutar la API:

   ```powershell
   python api_v2.py
   ```

   - Salud: `GET http://localhost:5000/health`
   - Predicción: `POST http://localhost:5000/api/predict`

   Ejemplo de cuerpo mínimo para `/api/predict`:

   ```json
   {
     "tempsup_tem2m_mean": 2.5,
     "HR_HR_mean": 85.0,
     "timestamp": "2025-11-17T22:00:00"
   }
   ```

6. Pruebas rápidas de la API (opcional):

   ```powershell
   python test_api.py
   ```

### Endpoints Principales

- `GET /health` – Estado de la API y carga del modelo
- `POST /api/validate-location` – Validar ubicación
- `POST /api/predict-enhanced-v2` – Predicción individual con validación
- `GET  /api/station-info` – Información de la estación
- `GET  /api/locations` – Ubicaciones válidas
- `POST /api/send-alert-sms` – Enviar alerta por SMS

## Frontend (React + TailwindCSS + Leaflet)

1. Entrar al directorio e instalar dependencias:

   ```powershell
   cd ..\frontend
   npm install
   ```

2. Desarrollo (CRACO + CRA):

   ```powershell
   npm run dev
   ```

   o

   ```powershell
   npm start
   ```

   - Abre `http://localhost:3000/`
   - El frontend consume `http://localhost:5000/api/predict` (ver `src/components/FrostPrediction.jsx:19`). Asegúrate de tener el backend corriendo.

3. Build de producción:

   ```powershell
   npm run build
   ```

   Servir estáticamente el `build/`:

   ```powershell
   npm install -g serve
   serve -s build
   ```

## Scripts Útiles (frontend/package.json)

- `dev`: `craco start`
- `start`: `craco start`
- `build`: `craco build`
- `test`: `craco test`

## Notas

- TailwindCSS está integrado mediante PostCSS y CRACO sin eyectar de CRA.
- Si se cambia la URL del backend, ajusta `API_URL` en `src/components/FrostPrediction.jsx`.
- Se recomienda no versionar entornos virtuales (`venv/`) y mantenerlos fuera del control de versiones.

## Agradecimientos

**Instituto Geofísico del Perú (IGP)** por los datos históricos
Open-Meteo por su API meteorológica gratuita

## ⭐ Si este proyecto te fue útil, considera darle una estrella en GitHub

Si te interesa una colaboración o tienes planeado un proyecto similar contáctanos:

**EMAIL:** oscarwork77@gmail.com, ylopevia@gmail.com
