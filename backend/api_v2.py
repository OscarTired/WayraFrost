"""
API Flask v2 - Compatible con frost_model_v2.pkl (Clasificador Multiclase)
Validación geográfica: Solo válido para región de Huayao, Junín
"""

from dotenv import load_dotenv
load_dotenv()

from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
import numpy as np
import os
from datetime import datetime, timedelta
from collections import deque
import math
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Servicios
from weather_service import weather_service, WeatherCodeInterpreter
from gemini_service import gemini_service
from sms_service import sms_service  # Agregar esta línea después de otros imports

app = Flask(__name__)
CORS(app)

MODEL_PATH = "frost_model_v2.pkl"
model_package = None

# Caché de histórico para lags (en producción usar Redis/DB)
weather_history = {}  # {location_key: deque(maxlen=24)}

# ============================================================================
# CONFIGURACIÓN GEOGRÁFICA - ESTACIÓN HUAYAO, JUNÍN
# ============================================================================
STATION_INFO = {
    "name": "Estación LAMAR - Huayao, Junín",
    "institution": "Observatorio Geofísico del IGP",
    "latitude": -12.0383,  # 12°02'18''S
    "longitude": -75.3228,  # 75°19'22''W
    "elevation": 3350,
    "valid_radius_km": 50,  # Radio de validez del modelo (50 km)
}

def calculate_distance(lat1, lon1, lat2, lon2):
    """
    Calcula distancia en km entre dos puntos usando fórmula de Haversine.
    """
    R = 6371  # Radio de la Tierra en km
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

def validate_location(latitude, longitude):
    """
    Valida si las coordenadas están dentro del rango geográfico válido.
    Retorna: (is_valid: bool, distance_km: float, message: str)
    """
    distance = calculate_distance(
        STATION_INFO["latitude"],
        STATION_INFO["longitude"],
        latitude,
        longitude
    )
    
    is_valid = distance <= STATION_INFO["valid_radius_km"]
    
    if is_valid:
        message = f"Ubicación válida ({distance:.1f} km de la estación)"
    else:
        message = (
            f"Predicción no disponible para esta ubicación. "
            f"El modelo está entrenado con datos de {STATION_INFO['name']} "
            f"(distancia: {distance:.1f} km). "
            f"Solo es válido dentro de un radio de {STATION_INFO['valid_radius_km']} km."
        )
    
    return is_valid, distance, message

def load_model_on_startup():
    global model_package
    try:
        model_package = joblib.load(MODEL_PATH)
        print("✓ Modelo V2 cargado exitosamente")
        print(f"  Tipo: {model_package.get('model_type')}")
        print(f"  Región válida: {STATION_INFO['name']}")
        print(f"  Radio de cobertura: {STATION_INFO['valid_radius_km']} km")
        return True
    except Exception as e:
        print(f"✗ Error cargando modelo V2: {e}")
        return False

def get_location_key(lat, lon):
    """Genera clave única para caché de histórico."""
    return f"{lat:.4f}_{lon:.4f}"

def store_weather_data(location_key, weather_data):
    """Almacena dato en histórico (máximo 24 horas)."""
    if location_key not in weather_history:
        weather_history[location_key] = deque(maxlen=24)
    
    entry = {
        'timestamp': datetime.now(),
        'HR': weather_data.get('humidity', 50),
        'radinf': weather_data.get('radiation', 300),
        'vel': weather_data.get('wind_speed', 0) / 3.6,  # km/h -> m/s
        'dir_sin': np.sin(np.radians(weather_data.get('wind_direction', 180))),
        'dir_cos': np.cos(np.radians(weather_data.get('wind_direction', 180)))
    }
    weather_history[location_key].append(entry)

def prepare_features_with_lags(current_data, location_key):
    """Crea features incluyendo lags de 6, 12 y 24 horas."""
    features = {}
    
    # Variables actuales (t)
    for var in ['HR', 'radinf', 'vel', 'dir_sin', 'dir_cos']:
        features[var] = current_data.get(var, 0)
    
    # Obtener histórico
    history = weather_history.get(location_key, [])
    
    # Calcular lags
    for lag_hours in [6, 12, 24]:
        lag_idx = -lag_hours if len(history) >= lag_hours else -len(history) if history else None
        
        if lag_idx is not None and history:
            lag_data = history[lag_idx]
            for var in ['HR', 'radinf', 'vel', 'dir_sin', 'dir_cos']:
                features[f"{var}_lag_{lag_hours}h"] = lag_data.get(var, features[var])
        else:
            # Fallback: usar valor actual
            for var in ['HR', 'radinf', 'vel', 'dir_sin', 'dir_cos']:
                features[f"{var}_lag_{lag_hours}h"] = features[var]
    
    return pd.DataFrame([features])

@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({
        "status": "ok",
        "model_loaded": model_package is not None,
        "model_version": "2.0_multiclass",
        "station": STATION_INFO,
        "timestamp": datetime.now().isoformat()
    })

@app.route("/api/station-info", methods=["GET"])
def get_station_info():
    """Endpoint para obtener información de la estación y región válida."""
    return jsonify({
        "station": STATION_INFO,
        "coverage_area": {
            "type": "circle",
            "center": {
                "latitude": STATION_INFO["latitude"],
                "longitude": STATION_INFO["longitude"]
            },
            "radius_km": STATION_INFO["valid_radius_km"]
        },
        "message": f"Este modelo de predicción de heladas está entrenado con datos de {STATION_INFO['name']} y es válido únicamente para la región de Junín dentro de un radio de {STATION_INFO['valid_radius_km']} km."
    })

@app.route("/api/validate-location", methods=["POST"])
def validate_location_endpoint():
    """Valida si una ubicación está dentro del rango geográfico válido."""
    try:
        data = request.get_json()
        latitude = data.get("latitude")
        longitude = data.get("longitude")
        
        if not latitude or not longitude:
            return jsonify({"error": "Latitud y longitud requeridas"}), 400
        
        is_valid, distance, message = validate_location(latitude, longitude)
        
        return jsonify({
            "is_valid": is_valid,
            "distance_km": round(distance, 2),
            "message": message,
            "station": {
                "name": STATION_INFO["name"],
                "coordinates": {
                    "latitude": STATION_INFO["latitude"],
                    "longitude": STATION_INFO["longitude"]
                }
            }
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/predict-enhanced-v2", methods=["POST"])
def predict_enhanced_v2():
    """Predicción mejorada con modelo V2 (multiclase) con validación geográfica."""
    try:
        data = request.get_json()
        latitude = data.get("latitude")
        longitude = data.get("longitude")
        location_name = data.get("location_name", "Ubicación")
        
        if not latitude or not longitude:
            return jsonify({"error": "Latitud y longitud requeridas"}), 400
        
        # 1. VALIDACIÓN GEOGRÁFICA
        is_valid, distance, validation_message = validate_location(latitude, longitude)
        
        if not is_valid:
            return jsonify({
                "prediction_available": False,
                "reason": "out_of_coverage",
                "message": validation_message,
                "distance_from_station_km": round(distance, 2),
                "station_info": STATION_INFO,
                "requested_location": {
                    "name": location_name,
                    "latitude": latitude,
                    "longitude": longitude
                },
                "suggestion": f"Para predicciones válidas, seleccione una ubicación en la región de Junín (dentro de {STATION_INFO['valid_radius_km']} km de {STATION_INFO['name']})."
            }), 200
        
        location_key = get_location_key(latitude, longitude)
        
        # 2. Obtener datos meteorológicos
        print(f"🌍 Obteniendo datos para {location_name} ({distance:.1f} km de estación)...")
        weather_data = weather_service.get_frost_risk_data(latitude, longitude)
        
        if "error" in weather_data and not weather_data.get("partial_data"):
            return jsonify({"error": weather_data["error"]}), 500
        
        current_weather = weather_data.get("current", {})
        
        # 3. Almacenar en histórico
        store_weather_data(location_key, current_weather)
        
        # 4. Preparar features con lags
        current_data = {
            'HR': current_weather.get('humidity', 50),
            'radinf': 320,  # Valor típico nocturno
            'vel': (current_weather.get('wind_speed', 0) / 3.6),
            'dir_sin': np.sin(np.radians(current_weather.get('wind_direction', 180))),
            'dir_cos': np.cos(np.radians(current_weather.get('wind_direction', 180)))
        }
        
        X = prepare_features_with_lags(current_data, location_key)
        
        # 5. Predicción con modelo V2
        ml_prediction = None
        if model_package is not None:
            try:
                model = model_package["model"]
                feature_cols = model_package["feature_cols"]
                
                # Asegurar orden de columnas
                X = X[feature_cols]
                
                # Predicción
                y_pred_class = model.predict(X)[0]
                y_pred_proba = model.predict_proba(X)[0]
                
                target_mapping = model_package["target_mapping"]
                frost_class = target_mapping.get(y_pred_class, "Desconocido")
                
                # Mapeo a nivel de riesgo
                risk_mapping = {
                    0: {"level": "bajo", "color": "#10b981"},
                    1: {"level": "medio", "color": "#f59e0b"},
                    2: {"level": "alto", "color": "#ef4444"},
                    3: {"level": "muy_alto", "color": "#dc2626"}
                }
                
                risk_info = risk_mapping.get(y_pred_class, risk_mapping[0])
                
                ml_prediction = {
                    "prediction": {
                        "class": int(y_pred_class),
                        "class_name": frost_class,
                        "probabilities": {
                            "Sin Riesgo": float(y_pred_proba[0]),
                            "Riesgo": float(y_pred_proba[1]),
                            "Moderada": float(y_pred_proba[2]),
                            "Severa": float(y_pred_proba[3]) if len(y_pred_proba) > 3 else 0.0
                        },
                        "confidence": float(max(y_pred_proba))
                    },
                    "risk": {
                        "level": risk_info["level"],
                        "color": risk_info["color"],
                        "percentage": float(max(y_pred_proba) * 100)
                    }
                }
                
                print(f"🤖 Predicción ML V2: Clase {y_pred_class} ({frost_class})")
                
            except Exception as e:
                print(f"⚠️ Error en predicción ML V2: {e}")
                ml_prediction = {
                    "prediction": {"class": 0, "class_name": "No Helada", "confidence": 0.5},
                    "risk": {"level": "medio", "color": "#f59e0b", "percentage": 50},
                    "error": str(e)
                }
        
        # 6. Análisis con Gemini (adaptado)
        gemini_analysis = gemini_service.analyze_frost_risk(
            weather_data,
            ml_prediction,
            location_name
        )
        
        # 7. Respuesta
        weather_code = current_weather.get("weather_code")
        weather_description = WeatherCodeInterpreter.get_description(weather_code) if weather_code else "Desconocido"
        
        response = {
            "prediction_available": True,
            "validation": {
                "is_valid": True,
                "distance_from_station_km": round(distance, 2),
                "message": validation_message
            },
            "location": {
                "name": location_name,
                "latitude": latitude,
                "longitude": longitude,
                "elevation": weather_data.get("elevation"),
                "timezone": weather_data.get("timezone")
            },
            "station_reference": {
                "name": STATION_INFO["name"],
                "institution": STATION_INFO["institution"],
                "coordinates": {
                    "latitude": STATION_INFO["latitude"],
                    "longitude": STATION_INFO["longitude"]
                },
                "elevation": STATION_INFO["elevation"]
            },
            "current_conditions": {
                "temperature": current_weather.get("temperature"),
                "apparent_temperature": current_weather.get("apparent_temperature"),
                "humidity": current_weather.get("humidity"),
                "wind_speed": current_weather.get("wind_speed"),
                "wind_direction": current_weather.get("wind_direction"),
                "cloud_cover": current_weather.get("cloud_cover"),
                "weather_code": weather_code,
                "weather_description": weather_description,
                "timestamp": current_weather.get("timestamp")
            },
            "ml_prediction_v2": ml_prediction,
            "ai_analysis": gemini_analysis.get("analysis", {}),
            "forecast_summary": weather_data.get("forecast_summary", {}),
            "hourly_forecast": weather_data.get("full_forecast", [])[:24],
            "data_sources": {
                "weather": "Open-Meteo API",
                "ml_model": "Random Forest Classifier V2 (Multiclase)",
                "training_data": f"Estación {STATION_INFO['name']} (2018-2025)",
                "ai_analysis": "Google Gemini" if gemini_service.is_available() else "Reglas locales"
            },
            "model_info": {
                "version": "2.0",
                "features_used": len(feature_cols) if model_package else 0,
                "has_lag_features": True,
                "lag_hours": [6, 12, 24],
                "geographic_coverage": f"Radio de {STATION_INFO['valid_radius_km']} km desde {STATION_INFO['name']}"
            },
            "timestamp": datetime.now().isoformat()
        }
        
        return jsonify(response)
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/api/locations", methods=["GET"])
def get_locations():
    """Ubicaciones de la región de Junín (dentro del rango válido)."""
    # Solo incluir ubicaciones dentro del radio válido de Huayao
    locations = [
        {"name": "Huayao (Estación LAMAR)", "latitude": -12.0383, "longitude": -75.3228, "elevation": 3350, "is_station": True},
        {"name": "Huancayo", "latitude": -12.0653, "longitude": -75.2049, "elevation": 3271},
        {"name": "Chupaca", "latitude": -12.0583, "longitude": -75.2900, "elevation": 3280},
        {"name": "Concepción", "latitude": -11.9167, "longitude": -75.3167, "elevation": 3250},
        {"name": "Jauja", "latitude": -11.7756, "longitude": -75.4961, "elevation": 3352},
    ]
    
    # Validar cada ubicación
    validated_locations = []
    for loc in locations:
        is_valid, distance, _ = validate_location(loc["latitude"], loc["longitude"])
        loc["is_valid"] = is_valid
        loc["distance_from_station_km"] = round(distance, 2)
        validated_locations.append(loc)
    
    return jsonify({
        "locations": validated_locations,
        "default": validated_locations[0],  # Huayao como default
        "station": STATION_INFO,
        "note": f"Solo se muestran ubicaciones dentro del radio de {STATION_INFO['valid_radius_km']} km de la estación"
    })

@app.route("/api/send-alert-sms", methods=["POST"])
def send_alert_sms():
    """
    Endpoint para enviar alerta SMS después de una predicción.
    
    Body JSON esperado:
    {
        "phone_number": "987654321",
        "prediction_data": { ... datos completos de la predicción ... }
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No se recibieron datos"}), 400
        
        phone = data.get("phone_number", "").strip()
        prediction_data = data.get("prediction_data")
        
        if not phone:
            return jsonify({"error": "Número de teléfono requerido"}), 400
        
        if not prediction_data:
            return jsonify({"error": "Datos de predicción requeridos"}), 400
        
        # Validar formato de teléfono peruano (9 dígitos)
        phone_digits = ''.join(filter(str.isdigit, phone))
        
        if len(phone_digits) != 9:
            return jsonify({
                "error": "Número inválido. Debe tener 9 dígitos (ej: 987654321)"
            }), 400
        
        # Agregar prefijo +51
        phone_with_prefix = f"+51{phone_digits}"
        
        # Verificar si servicio SMS está disponible
        if not sms_service.is_available():
            return jsonify({
                "error": "Servicio de SMS no disponible",
                "message": "Twilio no está configurado. Contacte al administrador."
            }), 503
        
        # Enviar SMS
        result = sms_service.send_frost_alert(phone_with_prefix, prediction_data)
        
        if result.get("success"):
            return jsonify({
                "success": True,
                "message": "SMS enviado exitosamente",
                "phone_number": phone_with_prefix,
                "message_sid": result.get("message_sid"),
                "timestamp": result.get("timestamp")
            })
        else:
            return jsonify({
                "success": False,
                "error": result.get("error", "Error desconocido al enviar SMS")
            }), 500
            
    except Exception as e:
        logger.error(f"Error en endpoint send-alert-sms: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/api/test-sms-length", methods=["POST"])
def test_sms_length():
    """Endpoint para probar longitud de SMS sin enviar."""
    try:
        data = request.get_json()
        phone = data.get("phone_number", "987654321")
        prediction_data = data.get("prediction_data")
        
        is_available = prediction_data.get("prediction_available", False)
        
        if is_available:
            message = sms_service._build_prediction_message_short(prediction_data)
        else:
            message = sms_service._build_unavailable_message_short(prediction_data)
        
        return jsonify({
            "message": message,
            "length": len(message),
            "within_limit": len(message) <= 1600,
            "estimated_segments": (len(message) // 160) + 1
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    model_loaded = load_model_on_startup()
    
    print("=" * 70)
    print("API DE PREDICCIÓN DE HELADAS - v2.0 (MULTICLASE - REGIÓN JUNÍN)")
    print("=" * 70)
    print(f"\n✓ Modelo ML V2: {'Cargado' if model_loaded else 'No disponible'}")
    print(f"✓ Estación de Referencia: {STATION_INFO['name']}")
    print(f"✓ Cobertura Geográfica: {STATION_INFO['valid_radius_km']} km de radio")
    print(f"✓ Gemini AI: {'Disponible' if gemini_service.is_available() else 'No configurado'}")
    print(f"✓ SMS Twilio: {'Disponible' if sms_service.is_available() else 'No configurado'}")  # Nueva línea
    print("\nEndpoints:")
    print("  GET  /api/station-info           - Información de la estación")
    print("  POST /api/validate-location      - Validar ubicación")
    print("  POST /api/predict-enhanced-v2    - Predicción con validación")
    print("  GET  /api/locations              - Ubicaciones válidas")
    print("  POST /api/send-alert-sms         - Enviar alerta por SMS")  # Nueva línea
    print("\n" + "=" * 70)
    
    app.run(host="0.0.0.0", port=5000, debug=True)
