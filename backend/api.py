"""
API Flask para servir el modelo de predicción de heladas
Para consumir desde React

Integra:
- Modelo ML entrenado localmente
- APIs meteorológicas (Open-Meteo)
- Google Gemini AI para análisis avanzado
"""

# Cargar variables de entorno ANTES de importar servicios
from dotenv import load_dotenv
load_dotenv()  # Carga .env del directorio actual

from flask import Flask, request, jsonify
from flask_cors import CORS

import joblib
import pandas as pd
import numpy as np
import os

from datetime import datetime, timedelta

# Servicios locales (después de cargar .env)
from weather_service import weather_service, WeatherCodeInterpreter
from gemini_service import gemini_service

app = Flask(__name__)
CORS(app)  # Permitir requests desde React

# Cargar modelo al iniciar
MODEL_PATH = "frost_model.pkl"
model_package = None

# Localidad por defecto (puede configurarse)
DEFAULT_LOCATION = {
    "name": "Puno, Perú",
    "latitude": -15.8402,
    "longitude": -70.0219
}


def load_model_on_startup():
    """Carga el modelo al iniciar la aplicación."""
    global model_package
    try:
        model_package = joblib.load(MODEL_PATH)
        print("✓ Modelo cargado exitosamente")
        print(f"  Features usadas: {model_package.get('feature_cols', [])}")
        print(
            f"  decision_threshold: {model_package.get('decision_threshold', 0.5):.3f}"
        )
        return True
    except Exception as e:
        print(f"✗ Error cargando modelo: {e}")
        return False


def prepare_features(data: dict, feature_cols):
    """
    Prepara las features desde los datos recibidos.
    Calcula features derivadas si es necesario y solo devuelve
    las columnas que realmente existen, sin imputar ceros a ciegas.
    """
    df = pd.DataFrame([data])

    # Calcular features temporales si no vienen
    if "hour" not in df.columns:
        if "timestamp" in data:
            try:
                dt = datetime.fromisoformat(data["timestamp"])
            except Exception:
                # Fallback si viene con 'Z'
                ts = data["timestamp"].replace("Z", "+00:00")
                dt = datetime.fromisoformat(ts)
        else:
            dt = datetime.now()

        df["hour"] = dt.hour
        df["month"] = dt.month
        df["day_of_year"] = dt.timetuple().tm_yday
        df["is_night"] = int((dt.hour >= 18) or (dt.hour <= 6))

    # Calcular punto de rocío si no viene
    if "dew_point" not in df.columns:
        temp_col = None
        hr_col = None

        # Buscar columnas de temperatura y humedad
        for col in df.columns:
            if "tempsup" in col and "mean" in col and temp_col is None:
                temp_col = col
            if "HR" in col and "mean" in col and hr_col is None:
                hr_col = col

        if temp_col and hr_col:
            T = df[temp_col].values[0]
            RH = df[hr_col].values[0]
            df["dew_point"] = T - ((100 - RH) / 5)

    # Seleccionar solo las columnas que existan en este request
    existing_cols = [c for c in feature_cols if c in df.columns]
    missing_cols = [c for c in feature_cols if c not in df.columns]

    if missing_cols:
        print(f"⚠️ Advertencia: faltan columnas en request: {missing_cols}")

    if not existing_cols:
        raise ValueError("Ninguna de las columnas esperadas está presente en el request.")

    return df[existing_cols]


@app.route("/health", methods=["GET"])
def health_check():
    """Endpoint para verificar que la API está funcionando."""
    return jsonify(
        {
            "status": "ok",
            "model_loaded": model_package is not None,
            "timestamp": datetime.now().isoformat(),
        }
    )


@app.route("/api/predict", methods=["POST"])
def predict():
    """
    Endpoint principal para predecir heladas.

    Body JSON esperado (MÍNIMO):

    {
      "tempsup_tempsup_mean": 2.5,   // REQUERIDO (°C)
      "HR_HR_mean": 85.0,           // REQUERIDO (%)
      "press_patm_mean": 687.0,     // Opcional (hPa)
      "vel_vel_mean": 1.2,          // Opcional (m/s)
      "radinf_radinf_mean": 320.0,  // Opcional (W/m^2)
      "dir_dir_mean": 180.0,        // Opcional (°)
      "pp_pp_sum": 0.0,             // Opcional (mm)
      "timestamp": "2025-11-17T22:00:00" // Opcional (ISO8601)
    }
    """
    if model_package is None:
        return jsonify({"error": "Modelo no disponible"}), 500

    try:
        # Obtener datos del request
        data = request.get_json()
        if not data:
            return jsonify({"error": "No se recibieron datos"}), 400

        # Validar campos requeridos básicos
        required_fields = ["tempsup_tempsup_mean", "HR_HR_mean"]
        missing_fields = [f for f in required_fields if f not in data]
        if missing_fields:
            return jsonify(
                {"error": f"Campos requeridos faltantes: {missing_fields}"}
            ), 400

        # Preparar features
        feature_cols = model_package["feature_cols"]
        X = prepare_features(data, feature_cols)

        # Normalizar
        scaler = model_package["scaler"]
        X_scaled = scaler.transform(X)

        # Predecir
        model = model_package["model"]
        probabilities = model.predict_proba(X_scaled)[0]
        frost_prob = float(probabilities[1])

        # Umbral de decisión (configurado en entrenamiento)
        decision_threshold = float(model_package.get("decision_threshold", 0.5))
        frost_flag = frost_prob >= decision_threshold

        # Determinar nivel de riesgo (cortes ajustados)
        if frost_prob > 0.6:
            risk_level = "alto"
            risk_color = "#ef4444"  # rojo
        elif frost_prob > 0.3:
            risk_level = "medio"
            risk_color = "#f59e0b"  # amarillo
        else:
            risk_level = "bajo"
            risk_color = "#10b981"  # verde

        # Preparar respuesta
        response = {
            "prediction": {
                "frost": bool(frost_flag),
                "probability": frost_prob,
                "confidence": float(max(probabilities)),
                "decision_threshold": decision_threshold,
            },
            "risk": {
                "level": risk_level,
                "color": risk_color,
                "percentage": frost_prob * 100.0,
            },
            "input_data": {
                "temperature": data.get("tempsup_tempsup_mean"),
                "humidity": data.get("HR_HR_mean"),
                "pressure": data.get("press_patm_mean"),
                "wind_speed": data.get("vel_vel_mean"),
                "radiation": data.get("radinf_radinf_mean"),
                "wind_dir": data.get("dir_dir_mean"),
                "precipitation": data.get("pp_pp_sum"),
            },
            "timestamp": data.get("timestamp", datetime.now().isoformat()),
            "model_version": "1.1",
            "hours_ahead": model_package.get("hours_ahead", 3),
        }

        return jsonify(response)

    except Exception as e:
        return jsonify({"error": f"Error en predicción: {str(e)}"}), 500


@app.route("/api/predict-batch", methods=["POST"])
def predict_batch():
    """
    Endpoint para predecir múltiples registros a la vez.

    Body JSON esperado:

    {
      "data": [
        { ...datos registro 1... },
        { ...datos registro 2... },
        ...
      ]
    }
    """
    if model_package is None:
        return jsonify({"error": "Modelo no disponible"}), 500

    try:
        body = request.get_json()
        data_list = body.get("data", [])

        if not data_list:
            return jsonify({"error": "No se recibieron datos"}), 400

        feature_cols = model_package["feature_cols"]
        scaler = model_package["scaler"]
        model = model_package["model"]

        predictions = []
        for data in data_list:
            X = prepare_features(data, feature_cols)
            X_scaled = scaler.transform(X)

            probabilities = model.predict_proba(X_scaled)[0]
            frost_prob = float(probabilities[1])

            predictions.append(
                {
                    "timestamp": data.get("timestamp", ""),
                    "frost_probability": frost_prob,
                }
            )

        return jsonify({"predictions": predictions, "count": len(predictions)})

    except Exception as e:
        return jsonify({"error": f"Error: {str(e)}"}), 500


@app.route("/api/model-info", methods=["GET"])
def model_info():
    """Endpoint para obtener información sobre el modelo."""
    if model_package is None:
        return jsonify({"error": "Modelo no disponible"}), 500

    try:
        feature_importance = None
        model = model_package["model"]
        feature_cols = model_package["feature_cols"]

        if hasattr(model, "feature_importances_"):
            importances = model.feature_importances_
            features = feature_cols
            # Top 10 features
            top_indices = np.argsort(importances)[-10:][::-1]
            feature_importance = [
                {
                    "feature": features[i],
                    "importance": float(importances[i]),
                }
                for i in top_indices
            ]

        return jsonify(
            {
                "model_type": type(model).__name__,
                "n_features": len(feature_cols),
                "features": feature_cols,
                "feature_importance": feature_importance,
                "version": "1.1",
                "decision_threshold": float(
                    model_package.get("decision_threshold", 0.5)
                ),
                "hours_ahead": model_package.get("hours_ahead", 3),
            }
        )

    except Exception as e:
        return jsonify({"error": f"Error: {str(e)}"}), 500


@app.route("/api/historical-risk", methods=["POST"])
def historical_risk():
    """
    Endpoint para analizar riesgo histórico en un rango de fechas.
    Útil para visualizaciones en React.
    """
    if model_package is None:
        return jsonify({"error": "Modelo no disponible"}), 500

    try:
        data = request.get_json()
        records = data.get("records", [])

        if not records:
            return jsonify({"error": "No se recibieron registros"}), 400

        feature_cols = model_package["feature_cols"]
        scaler = model_package["scaler"]
        model = model_package["model"]

        risk_analysis = {
            "high_risk_count": 0,
            "medium_risk_count": 0,
            "low_risk_count": 0,
            "average_probability": 0.0,
            "timeline": [],
        }

        total_prob = 0.0

        for record in records:
            X = prepare_features(record, feature_cols)
            X_scaled = scaler.transform(X)

            probabilities = model.predict_proba(X_scaled)[0]
            frost_prob = float(probabilities[1])
            total_prob += frost_prob

            if frost_prob > 0.6:
                risk_analysis["high_risk_count"] += 1
                risk_level = "alto"
            elif frost_prob > 0.3:
                risk_analysis["medium_risk_count"] += 1
                risk_level = "medio"
            else:
                risk_analysis["low_risk_count"] += 1
                risk_level = "bajo"

            risk_analysis["timeline"].append(
                {
                    "timestamp": record.get("timestamp", ""),
                    "probability": frost_prob,
                    "risk_level": risk_level,
                    "temperature": record.get("tempsup_tempsup_mean"),
                }
            )

        risk_analysis["average_probability"] = (
            total_prob / len(records) if records else 0.0
        )

        return jsonify(risk_analysis)

    except Exception as e:
        return jsonify({"error": f"Error: {str(e)}"}), 500


@app.route("/api/predict-enhanced", methods=["POST"])
def predict_enhanced():
    """
    Endpoint mejorado que combina:
    1. Datos de APIs meteorológicas (Open-Meteo)
    2. Modelo ML entrenado localmente
    3. Análisis con Google Gemini AI
    
    Body JSON esperado:
    {
        "latitude": -15.8402,
        "longitude": -70.0219,
        "location_name": "Puno, Perú"
    }
    
    O sin body para usar ubicación por defecto.
    """
    try:
        data = request.get_json() or {}
        
        # Obtener coordenadas (usar defaults si no se proporcionan)
        latitude = data.get("latitude", DEFAULT_LOCATION["latitude"])
        longitude = data.get("longitude", DEFAULT_LOCATION["longitude"])
        location_name = data.get("location_name", DEFAULT_LOCATION["name"])
        
        # 1. Obtener datos meteorológicos de APIs
        print(f"📡 Obteniendo datos meteorológicos para {location_name}...")
        weather_data = weather_service.get_frost_risk_data(latitude, longitude)
        
        if "error" in weather_data and not weather_data.get("partial_data"):
            return jsonify({
                "error": f"Error obteniendo datos meteorológicos: {weather_data['error']}"
            }), 500
        
        current_weather = weather_data.get("current", {})
        
        # 2. Preparar datos para el modelo ML
        # Convertir datos de API al formato del modelo
        ml_input = {
            "tempsup_tempsup_mean": current_weather.get("temperature", 0),
            "HR_HR_mean": current_weather.get("humidity", 50),
            "press_patm_mean": current_weather.get("surface_pressure", 700),
            "vel_vel_mean": (current_weather.get("wind_speed", 0) / 3.6),  # km/h a m/s
            "radinf_radinf_mean": 320,  # Valor aproximado si no hay radiación
            "dir_dir_mean": current_weather.get("wind_direction", 180),
            "pp_pp_sum": current_weather.get("precipitation", 0),
            "timestamp": datetime.now().isoformat()
        }
        
        # 3. Obtener predicción del modelo ML
        ml_prediction = None
        if model_package is not None:
            try:
                feature_cols = model_package["feature_cols"]
                X = prepare_features(ml_input, feature_cols)
                scaler = model_package["scaler"]
                X_scaled = scaler.transform(X)
                model = model_package["model"]
                
                probabilities = model.predict_proba(X_scaled)[0]
                frost_prob = float(probabilities[1])
                decision_threshold = float(model_package.get("decision_threshold", 0.5))
                frost_flag = frost_prob >= decision_threshold
                
                if frost_prob > 0.6:
                    risk_level = "alto"
                    risk_color = "#ef4444"
                elif frost_prob > 0.3:
                    risk_level = "medio"
                    risk_color = "#f59e0b"
                else:
                    risk_level = "bajo"
                    risk_color = "#10b981"
                
                ml_prediction = {
                    "prediction": {
                        "frost": bool(frost_flag),
                        "probability": frost_prob,
                        "confidence": float(max(probabilities)),
                        "decision_threshold": decision_threshold,
                    },
                    "risk": {
                        "level": risk_level,
                        "color": risk_color,
                        "percentage": frost_prob * 100.0,
                    }
                }
                print(f"🤖 Predicción ML: {frost_prob*100:.1f}% probabilidad de helada")
                
            except Exception as e:
                print(f"⚠️ Error en predicción ML: {e}")
                ml_prediction = {
                    "prediction": {"frost": False, "probability": 0.5, "confidence": 0.5},
                    "risk": {"level": "medio", "color": "#f59e0b", "percentage": 50}
                }
        else:
            ml_prediction = {
                "prediction": {"frost": False, "probability": 0.5, "confidence": 0.5},
                "risk": {"level": "medio", "color": "#f59e0b", "percentage": 50},
                "error": "Modelo ML no disponible"
            }
        
        # 4. Análisis con Gemini AI
        print("🧠 Analizando con IA...")
        gemini_analysis = gemini_service.analyze_frost_risk(
            weather_data, 
            ml_prediction, 
            location_name
        )
        
        # 5. Interpretar código de clima
        weather_code = current_weather.get("weather_code")
        weather_description = WeatherCodeInterpreter.get_description(weather_code) if weather_code else "Desconocido"
        frost_favorable = WeatherCodeInterpreter.is_frost_favorable(weather_code) if weather_code else False
        
        # 6. Preparar respuesta completa
        response = {
            "location": {
                "name": location_name,
                "latitude": latitude,
                "longitude": longitude,
                "elevation": weather_data.get("elevation"),
                "timezone": weather_data.get("timezone")
            },
            "current_conditions": {
                "temperature": current_weather.get("temperature"),
                "apparent_temperature": current_weather.get("apparent_temperature"),
                "humidity": current_weather.get("humidity"),
                "pressure": current_weather.get("surface_pressure"),
                "wind_speed": current_weather.get("wind_speed"),
                "wind_direction": current_weather.get("wind_direction"),
                "wind_gusts": current_weather.get("wind_gusts"),
                "cloud_cover": current_weather.get("cloud_cover"),
                "precipitation": current_weather.get("precipitation"),
                "snowfall": current_weather.get("snowfall"),
                "weather_code": weather_code,
                "weather_description": weather_description,
                "frost_favorable_conditions": frost_favorable,
                "timestamp": current_weather.get("timestamp")
            },
            "ml_prediction": ml_prediction,
            "ai_analysis": gemini_analysis.get("analysis", {}),
            "ai_source": gemini_analysis.get("source", "unknown"),
            "forecast_summary": weather_data.get("forecast_summary", {}),
            "hourly_forecast": weather_data.get("full_forecast", [])[:24],
            "data_sources": {
                "weather": "Open-Meteo API",
                "ml_model": "Local Random Forest" if model_package else "No disponible",
                "ai_analysis": "Google Gemini" if gemini_service.is_available() else "Reglas locales"
            },
            "timestamp": datetime.now().isoformat()
        }
        
        print("✅ Análisis completo generado")
        return jsonify(response)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Error en análisis: {str(e)}"}), 500


@app.route("/api/locations", methods=["GET"])
def get_locations():
    """
    Retorna lista de ubicaciones predefinidas para el altiplano peruano.
    """
    locations = [
        {"name": "Puno", "latitude": -15.8402, "longitude": -70.0219, "elevation": 3827},
        {"name": "Juliaca", "latitude": -15.5000, "longitude": -70.1333, "elevation": 3825},
        {"name": "Ayaviri", "latitude": -14.8833, "longitude": -70.5833, "elevation": 3920},
        {"name": "Ilave", "latitude": -16.0833, "longitude": -69.6500, "elevation": 3850},
        {"name": "Juli", "latitude": -16.2167, "longitude": -69.4500, "elevation": 3869},
        {"name": "Desaguadero", "latitude": -16.5667, "longitude": -69.0333, "elevation": 3808},
        {"name": "Lampa", "latitude": -15.3500, "longitude": -70.3667, "elevation": 3892},
        {"name": "Azángaro", "latitude": -14.9167, "longitude": -70.2000, "elevation": 3859},
        {"name": "Huancané", "latitude": -15.2000, "longitude": -69.7667, "elevation": 3841},
        {"name": "Moho", "latitude": -15.3500, "longitude": -69.5000, "elevation": 3812},
    ]
    return jsonify({"locations": locations, "default": DEFAULT_LOCATION})


@app.route("/api/weather-current", methods=["GET"])
def get_current_weather():
    """
    Obtiene solo los datos meteorológicos actuales.
    Query params: latitude, longitude
    """
    try:
        latitude = float(request.args.get("latitude", DEFAULT_LOCATION["latitude"]))
        longitude = float(request.args.get("longitude", DEFAULT_LOCATION["longitude"]))
        
        weather = weather_service.get_current_weather(latitude, longitude)
        return jsonify(weather)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/forecast", methods=["GET"])
def get_forecast():
    """
    Obtiene pronóstico horario.
    Query params: latitude, longitude, hours (default 48)
    """
    try:
        latitude = float(request.args.get("latitude", DEFAULT_LOCATION["latitude"]))
        longitude = float(request.args.get("longitude", DEFAULT_LOCATION["longitude"]))
        hours = int(request.args.get("hours", 48))
        
        forecast = weather_service.get_hourly_forecast(latitude, longitude, hours)
        return jsonify(forecast)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    # Cargar modelo al inicio
    model_loaded = load_model_on_startup()
    
    print("=" * 60)
    print("API DE PREDICCIÓN DE HELADAS - v2.0")
    print("=" * 60)
    print(f"\n✓ Modelo ML: {'Cargado' if model_loaded else 'No disponible'}")
    print(f"✓ Gemini AI: {'Disponible' if gemini_service.is_available() else 'No configurado (usar GEMINI_API_KEY)'}")
    print(f"✓ APIs Meteorológicas: Open-Meteo (sin API key)")
    print("\nEndpoints disponibles:")
    print("  GET  /health              - Estado de la API")
    print("  POST /api/predict         - Predicción individual (modelo ML)")
    print("  POST /api/predict-enhanced - Predicción mejorada (ML + APIs + IA)")
    print("  GET  /api/locations       - Ubicaciones predefinidas")
    print("  GET  /api/weather-current - Datos meteorológicos actuales")
    print("  GET  /api/forecast        - Pronóstico horario")
    print("  POST /api/predict-batch   - Predicción múltiple")
    print("  GET  /api/model-info      - Información del modelo")
    print("  POST /api/historical-risk - Análisis de riesgo histórico")
    print("\n" + "=" * 60)

    # Ejecutar servidor (el modelo no es obligatorio para predict-enhanced)
    app.run(host="0.0.0.0", port=5000, debug=True)
