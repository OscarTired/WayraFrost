import React, { useState } from "react";
import {
  AlertCircle,
  CloudSnow,
  Thermometer,
  Wind,
  Droplets,
} from "lucide-react";

const FrostPrediction = () => {
  const [formData, setFormData] = useState({
    tempsup_tempsup_mean: "",
    HR_HR_mean: "",
    press_patm_mean: "",
    vel_vel_mean: "",
    radinf_radinf_mean: "",
    dir_dir_mean: "",
    pp_pp_sum: "",
  });

  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const API_URL = "http://localhost:5000/api/predict";

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value === "" ? "" : parseFloat(value),
    }));
  };

  const validateInputs = () => {
    const t = formData.tempsup_tempsup_mean;
    const hr = formData.HR_HR_mean;
    const p = formData.press_patm_mean;
    const v = formData.vel_vel_mean;

    if (t === "" || hr === "") {
      return "Temperatura y humedad son obligatorias.";
    }
    if (hr < 0 || hr > 100) {
      return "La humedad relativa debe estar entre 0 y 100%.";
    }
    if (t < -20 || t > 40) {
      return "La temperatura superficial debe estar en un rango razonable (-20 a 40 °C).";
    }
    if (p !== "" && (p < 500 || p > 800)) {
      return "La presión atmosférica debe estar en hPa (típicamente 600–750 hPa en zonas altoandinas).";
    }
    if (v !== "" && (v < 0 || v > 40)) {
      return "La velocidad del viento debe estar entre 0 y 40 m/s.";
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setPrediction(null);

    const validationError = validateInputs();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const body = {
        ...formData,
        timestamp: new Date().toISOString(),
      };

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error("Error en la predicción");
      }

      const data = await response.json();
      setPrediction(data);
    } catch (err) {
      setError(err.message || "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const getRiskBadgeColor = (level) => {
    switch (level) {
      case "alto":
        return "bg-red-100 text-red-800 border-red-200";
      case "medio":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "bajo":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const renderResult = () => {
    if (!prediction) return null;

    const { prediction: pred, risk, input_data } = prediction;
    const hasFrost = pred?.frost;
    const prob = (pred?.probability ?? 0) * 100;

    return (
      <div className="mt-6 space-y-4">
        <div
          className={`p-4 rounded-lg border flex items-center gap-3 ${
            hasFrost
              ? "bg-red-50 border-red-200 text-red-800"
              : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}
        >
          <CloudSnow className="w-6 h-6" />
          <div>
            <p className="font-semibold">
              {hasFrost ? "Con riesgo de helada" : "Sin riesgo de helada"}
            </p>
            <p className="text-sm">
              Probabilidad estimada: {prob.toFixed(1)}%
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <span
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-medium ${getRiskBadgeColor(
              risk?.level
            )}`}
          >
            <AlertCircle className="w-4 h-4" />
            Nivel de riesgo: {risk?.level?.toUpperCase() || "N/A"} (
            {(risk?.percentage ?? 0).toFixed(1)}%)
          </span>

          <span className="text-xs text-gray-500">
            Umbral de decisión del modelo:{" "}
            {(pred?.decision_threshold ?? 0.5).toFixed(3)}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="p-3 rounded-lg border bg-white flex items-center gap-2">
            <Thermometer className="w-4 h-4 text-blue-600" />
            <div>
              <p className="font-medium">
                Temperatura superficial: {input_data?.temperature} °C
              </p>
              <p className="text-xs text-gray-500">
                Umbral de helada del modelo: 0 °C
              </p>
            </div>
          </div>

          <div className="p-3 rounded-lg border bg-white flex items-center gap-2">
            <Droplets className="w-4 h-4 text-sky-600" />
            <div>
              <p className="font-medium">
                Humedad relativa: {input_data?.humidity} %
              </p>
            </div>
          </div>

          <div className="p-3 rounded-lg border bg-white flex items-center gap-2">
            <Wind className="w-4 h-4 text-gray-600" />
            <div>
              <p className="font-medium">
                Velocidad viento:{" "}
                {input_data?.wind_speed !== undefined &&
                input_data?.wind_speed !== null
                  ? `${input_data.wind_speed} m/s`
                  : "N/A"}
              </p>
              <p className="text-xs text-gray-500">
                Dirección:{" "}
                {input_data?.wind_dir !== undefined &&
                input_data?.wind_dir !== null
                  ? `${input_data.wind_dir}°`
                  : "N/A"}
              </p>
            </div>
          </div>

          <div className="p-3 rounded-lg border bg-white text-xs text-gray-600">
            <p>
              Presión:{" "}
              {input_data?.pressure !== undefined &&
              input_data?.pressure !== null
                ? `${input_data.pressure} hPa`
                : "N/A"}
            </p>
            <p>
              Radiación infrarroja:{" "}
              {input_data?.radiation !== undefined &&
              input_data?.radiation !== null
                ? `${input_data.radiation} W/m²`
                : "N/A"}
            </p>
            <p>
              Precipitación última hora:{" "}
              {input_data?.precipitation !== undefined &&
              input_data?.precipitation !== null
                ? `${input_data.precipitation} mm`
                : "N/A"}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CloudSnow className="w-7 h-7 text-sky-600" />
          Sistema de predicción de heladas
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Modelo de Machine Learning entrenado con datos horarios locales.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md border border-red-200 bg-red-50 text-red-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white border rounded-lg p-4 shadow-sm"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Temperatura superficial (°C)
          </label>
          <input
            type="number"
            step="0.1"
            name="tempsup_tempsup_mean"
            value={formData.tempsup_tempsup_mean}
            onChange={handleChange}
            className="mt-1 block w-full border rounded-md px-3 py-2 text-sm"
            placeholder="-5.0"
            required
          />
          <p className="mt-1 text-xs text-gray-500">
            Temperatura de la superficie del cultivo.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Humedad relativa (%)
          </label>
          <input
            type="number"
            step="0.1"
            name="HR_HR_mean"
            value={formData.HR_HR_mean}
            onChange={handleChange}
            className="mt-1 block w-full border rounded-md px-3 py-2 text-sm"
            placeholder="85"
            required
          />
          <p className="mt-1 text-xs text-gray-500">
            Valores típicos: 50–100 % en noches frías.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Presión atmosférica (hPa)
          </label>
          <input
            type="number"
            step="0.1"
            name="press_patm_mean"
            value={formData.press_patm_mean}
            onChange={handleChange}
            className="mt-1 block w-full border rounded-md px-3 py-2 text-sm"
            placeholder="687"
          />
          <p className="mt-1 text-xs text-gray-500">
            Usa hPa, no metros de altitud (ejemplo: 680–700 hPa).
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Velocidad del viento (m/s)
          </label>
          <input
            type="number"
            step="0.1"
            name="vel_vel_mean"
            value={formData.vel_vel_mean}
            onChange={handleChange}
            className="mt-1 block w-full border rounded-md px-3 py-2 text-sm"
            placeholder="1.2"
          />
          <p className="mt-1 text-xs text-gray-500">
            Vientos muy bajos favorecen la helada.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Radiación infrarroja (W/m²)
          </label>
          <input
            type="number"
            step="0.1"
            name="radinf_radinf_mean"
            value={formData.radinf_radinf_mean}
            onChange={handleChange}
            className="mt-1 block w-full border rounded-md px-3 py-2 text-sm"
            placeholder="340"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Dirección del viento (°)
          </label>
          <input
            type="number"
            step="0.1"
            name="dir_dir_mean"
            value={formData.dir_dir_mean}
            onChange={handleChange}
            className="mt-1 block w-full border rounded-md px-3 py-2 text-sm"
            placeholder="180"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Precipitación última hora (mm)
          </label>
          <input
            type="number"
            step="0.01"
            name="pp_pp_sum"
            value={formData.pp_pp_sum}
            onChange={handleChange}
            className="mt-1 block w-full border rounded-md px-3 py-2 text-sm"
            placeholder="0.0"
          />
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-60"
          >
            {loading ? "Procesando..." : "Predecir helada"}
          </button>
        </div>
      </form>

      {loading && (
        <p className="mt-4 text-sm text-gray-500">Procesando datos...</p>
      )}

      {renderResult()}
    </div>
  );
};

export default FrostPrediction;
