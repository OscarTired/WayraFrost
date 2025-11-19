# Frost Prediction – ML Heladas

Sistema completo para predicción de heladas con un backend en Flask (Python) y un frontend en React con TailwindCSS.

## Estructura del Repositorio

```
frost-prediction/
├── backend/
│   ├── api.py                 # API Flask (puerto 5000)
│   ├── train_model.py         # Entrenamiento y empaquetado del modelo
│   ├── frost_model.pkl        # Modelo entrenado (Joblib)
│   ├── requirements.txt       # Dependencias de Python
│   └── data/                  # Datos horarios históricos (CSV)
│       ├── HR_hourly_2018_2025.csv
│       ├── dir_hourly_2018_2025.csv
│       ├── pp_hourly_2018_2025.csv
│       ├── press_hourly_2018_2025.csv
│       ├── radinf_hourly_2018_2025.csv
│       └── tempsup_hourly_2018_2025.csv
└── frontend/
    ├── public/
    ├── src/
    │   ├── components/
    │   │   └── FrostPrediction.jsx
    │   ├── App.js
    │   ├── index.js
    │   └── index.css           # Directivas @tailwind
    ├── craco.config.js         # Configuración para CRA + PostCSS
    ├── postcss.config.js       # Plugins TailwindCSS y Autoprefixer
    ├── tailwind.config.js      # Paths de contenido Tailwind
    ├── package.json            # Scripts y dependencias
    └── package-lock.json
```

## Requisitos Previos

- `Git`
- `Python 3.10+` y `pip`
- `Node.js 18+` y `npm`

## Clonación del Proyecto

1. Clonar el repositorio:

   ```bash
   git clone <URL_DEL_REPOSITORIO>
   cd frost-prediction
   ```

2. Opcional: si ya tienes los directorios por separado, confirma rutas en Windows:

   - Backend: `d:\Python\ML HELADAS\frost-prediction\backend`
   - Frontend: `d:\Python\ML HELADAS\frost-prediction\frontend`

## Backend (Flask)

1. Entrar al directorio y crear entorno virtual:

   ```powershell
   cd backend
   python -m venv venv
   .\venv\Scripts\activate
   ```

2. Instalar dependencias:

   ```powershell
   pip install -r requirements.txt
   ```

3. (Opcional) Entrenar el modelo si `frost_model.pkl` no existe:

   ```powershell
   python train_model.py
   ```

4. Ejecutar la API:

   ```powershell
   python api.py
   ```

   - Salud: `GET http://localhost:5000/health`
   - Predicción: `POST http://localhost:5000/api/predict`

   Ejemplo de cuerpo mínimo para `/api/predict`:

   ```json
   {
     "tempsup_tempsup_mean": 2.5,
     "HR_HR_mean": 85.0,
     "timestamp": "2025-11-17T22:00:00"
   }
   ```

5. Pruebas rápidas de la API (opcional):

   ```powershell
   python test_api.py
   ```

### Endpoints Principales

- `GET /health` – Estado de la API y carga del modelo
- `POST /api/predict` – Predicción individual
- `POST /api/predict-batch` – Predicciones múltiples
- `GET /api/model-info` – Información del modelo y features
- `POST /api/historical-risk` – Resumen de riesgo en timeline

## Frontend (React + TailwindCSS)

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