"""
API Flask para servir el modelo de predicción de heladas
Para consumir desde React
"""

from flask import Flask, request, jsonify
from flask_cors import CORS

import joblib
import pandas as pd
import numpy as np

from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app)  # Permitir requests desde React

# Cargar modelo al iniciar
MODEL_PATH = "frost_model.pkl"
model_package = None


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


if __name__ == "__main__":
    # Cargar modelo al inicio
    if load_model_on_startup():
        print("=" * 60)
        print("API DE PREDICCIÓN DE HELADAS")
        print("=" * 60)
        print("\nEndpoints disponibles:")
        print("  GET  /health             - Estado de la API")
        print("  POST /api/predict        - Predicción individual")
        print("  POST /api/predict-batch  - Predicción múltiple")
        print("  GET  /api/model-info     - Información del modelo")
        print("  POST /api/historical-risk - Análisis de riesgo histórico")
        print("\n" + "=" * 60)

        # Ejecutar servidor
        app.run(host="0.0.0.0", port=5000, debug=True)
    else:
        print(
            "Error: No se pudo cargar el modelo. "
            "Verifica que 'frost_model.pkl' existe."
        )
