import React, { useState, useEffect } from "react";
import {
  AlertCircle,
  CloudSnow,
  Thermometer,
  Wind,
  Droplets,
  MapPin,
  Sun,
  Cloud,
  CloudRain,
  Snowflake,
  TrendingDown,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle,
  Info,
  RefreshCw,
  Mountain,
  Gauge,
  Eye,
} from "lucide-react";
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
} from "recharts";

const API_BASE = "http://localhost:5000";

const EnhancedFrostPrediction = () => {
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Cargar ubicaciones al inicio
  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/locations`);
      const data = await response.json();
      setLocations(data.locations || []);
      if (data.default) {
        setSelectedLocation(data.default);
      }
    } catch (err) {
      console.error("Error cargando ubicaciones:", err);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedLocation) {
      setError("Selecciona una ubicación");
      return;
    }

    setLoading(true);
    setError("");
    setPrediction(null);

    try {
      const response = await fetch(`${API_BASE}/api/predict-enhanced`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
          location_name: selectedLocation.name,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Error en el análisis");
      }

      const data = await response.json();
      setPrediction(data);
    } catch (err) {
      setError(err.message || "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (level) => {
    switch (level) {
      case "muy_alto":
        return "bg-red-600 text-white";
      case "alto":
        return "bg-red-500 text-white";
      case "medio":
        return "bg-yellow-500 text-white";
      case "bajo":
        return "bg-green-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  const getRiskBorderColor = (level) => {
    switch (level) {
      case "muy_alto":
        return "border-red-600";
      case "alto":
        return "border-red-500";
      case "medio":
        return "border-yellow-500";
      case "bajo":
        return "border-green-500";
      default:
        return "border-gray-400";
    }
  };

  const getWeatherIcon = (code) => {
    if (code === 0 || code === 1) return <Sun className="w-8 h-8 text-yellow-500" />;
    if (code >= 2 && code <= 3) return <Cloud className="w-8 h-8 text-gray-500" />;
    if (code >= 45 && code <= 48) return <Cloud className="w-8 h-8 text-gray-400" />;
    if (code >= 51 && code <= 67) return <CloudRain className="w-8 h-8 text-blue-500" />;
    if (code >= 71 && code <= 86) return <Snowflake className="w-8 h-8 text-cyan-400" />;
    return <Cloud className="w-8 h-8 text-gray-500" />;
  };

  // Preparar datos para el gráfico de temperatura
  const prepareChartData = () => {
    if (!prediction?.hourly_forecast) return [];
    
    return prediction.hourly_forecast.slice(0, 24).map((hour) => {
      const time = hour.time ? new Date(hour.time) : null;
      return {
        hora: time ? time.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) : "",
        temperatura: hour.temperature,
        sensacion: hour.apparent_temperature,
        humedad: hour.humidity,
        punto_rocio: hour.dew_point,
      };
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold flex items-center justify-center gap-3 text-sky-800">
            <CloudSnow className="w-10 h-10 text-sky-600" />
            Sistema Avanzado de Predicción de Heladas
          </h1>
          <p className="text-gray-600 mt-2">
            Análisis con ML + APIs Meteorológicas + Inteligencia Artificial
          </p>
        </div>

        {/* Selector de ubicación */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin className="w-4 h-4 inline mr-1" />
                Seleccionar Ubicación
              </label>
              <select
                value={selectedLocation?.name || ""}
                onChange={(e) => {
                  const loc = locations.find((l) => l.name === e.target.value);
                  setSelectedLocation(loc);
                }}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              >
                <option value="">Selecciona una ubicación...</option>
                {locations.map((loc) => (
                  <option key={loc.name} value={loc.name}>
                    {loc.name} ({loc.elevation}m)
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleAnalyze}
              disabled={loading || !selectedLocation}
              className="px-8 py-3 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Analizando...
                </>
              ) : (
                <>
                  <Thermometer className="w-5 h-5" />
                  Analizar Riesgo de Helada
                </>
              )}
            </button>
          </div>

          {selectedLocation && (
            <div className="mt-4 flex items-center gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <Mountain className="w-4 h-4" />
                Elevación: {selectedLocation.elevation}m
              </span>
              <span>
                Lat: {selectedLocation.latitude.toFixed(4)}°, 
                Lon: {selectedLocation.longitude.toFixed(4)}°
              </span>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 rounded-lg border border-red-300 bg-red-50 text-red-800 flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        {/* Resultados */}
        {prediction && (
          <div className="space-y-6">
            {/* Resumen Principal */}
            <div
              className={`rounded-xl shadow-lg p-6 border-l-4 ${getRiskBorderColor(
                prediction.ai_analysis?.nivel_riesgo_combinado
              )} bg-white`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-center gap-4">
                  {getWeatherIcon(prediction.current_conditions?.weather_code)}
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">
                      {prediction.location?.name}
                    </h2>
                    <p className="text-gray-600">
                      {prediction.current_conditions?.weather_description}
                    </p>
                  </div>
                </div>
                <div
                  className={`px-6 py-3 rounded-lg ${getRiskColor(
                    prediction.ai_analysis?.nivel_riesgo_combinado
                  )} text-center`}
                >
                  <p className="text-sm opacity-90">Nivel de Riesgo</p>
                  <p className="text-2xl font-bold uppercase">
                    {prediction.ai_analysis?.nivel_riesgo_combinado || "N/A"}
                  </p>
                  <p className="text-sm opacity-90">
                    {prediction.ai_analysis?.probabilidad_estimada?.toFixed(0)}% probabilidad
                  </p>
                </div>
              </div>

              {/* Resumen ejecutivo */}
              {prediction.ai_analysis?.resumen_ejecutivo && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <p className="text-gray-700">{prediction.ai_analysis.resumen_ejecutivo}</p>
                </div>
              )}
            </div>

            {/* Condiciones Actuales */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Thermometer className="w-5 h-5 text-sky-600" />
                Condiciones Actuales
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                  <div className="flex items-center gap-2 text-blue-600 mb-1">
                    <Thermometer className="w-4 h-4" />
                    <span className="text-sm">Temperatura</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-800">
                    {prediction.current_conditions?.temperature?.toFixed(1)}°C
                  </p>
                  <p className="text-xs text-blue-600">
                    Sensación: {prediction.current_conditions?.apparent_temperature?.toFixed(1)}°C
                  </p>
                </div>

                <div className="p-4 bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-lg">
                  <div className="flex items-center gap-2 text-cyan-600 mb-1">
                    <Droplets className="w-4 h-4" />
                    <span className="text-sm">Humedad</span>
                  </div>
                  <p className="text-2xl font-bold text-cyan-800">
                    {prediction.current_conditions?.humidity}%
                  </p>
                </div>

                <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg">
                  <div className="flex items-center gap-2 text-gray-600 mb-1">
                    <Wind className="w-4 h-4" />
                    <span className="text-sm">Viento</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-800">
                    {prediction.current_conditions?.wind_speed?.toFixed(1)} km/h
                  </p>
                  <p className="text-xs text-gray-600">
                    Dir: {prediction.current_conditions?.wind_direction}°
                  </p>
                </div>

                <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
                  <div className="flex items-center gap-2 text-purple-600 mb-1">
                    <Cloud className="w-4 h-4" />
                    <span className="text-sm">Nubes</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-800">
                    {prediction.current_conditions?.cloud_cover}%
                  </p>
                </div>

                <div className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg">
                  <div className="flex items-center gap-2 text-amber-600 mb-1">
                    <Gauge className="w-4 h-4" />
                    <span className="text-sm">Presión</span>
                  </div>
                  <p className="text-2xl font-bold text-amber-800">
                    {prediction.current_conditions?.pressure?.toFixed(0)} hPa
                  </p>
                </div>

                <div className="p-4 bg-gradient-to-br from-sky-50 to-sky-100 rounded-lg">
                  <div className="flex items-center gap-2 text-sky-600 mb-1">
                    <CloudRain className="w-4 h-4" />
                    <span className="text-sm">Precipitación</span>
                  </div>
                  <p className="text-2xl font-bold text-sky-800">
                    {prediction.current_conditions?.precipitation?.toFixed(1)} mm
                  </p>
                </div>

                <div className="p-4 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg">
                  <div className="flex items-center gap-2 text-indigo-600 mb-1">
                    <Mountain className="w-4 h-4" />
                    <span className="text-sm">Elevación</span>
                  </div>
                  <p className="text-2xl font-bold text-indigo-800">
                    {prediction.location?.elevation?.toFixed(0)} m
                  </p>
                </div>

                <div className="p-4 bg-gradient-to-br from-teal-50 to-teal-100 rounded-lg">
                  <div className="flex items-center gap-2 text-teal-600 mb-1">
                    <Snowflake className="w-4 h-4" />
                    <span className="text-sm">Nevada</span>
                  </div>
                  <p className="text-2xl font-bold text-teal-800">
                    {prediction.current_conditions?.snowfall?.toFixed(1)} cm
                  </p>
                </div>
              </div>
            </div>

            {/* Gráfico de Temperatura */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-sky-600" />
                Pronóstico de Temperatura (24 horas)
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={prepareChartData()}>
                    <defs>
                      <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="hora" tick={{ fontSize: 12 }} />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      domain={["auto", "auto"]}
                      label={{ value: "°C", angle: -90, position: "insideLeft" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                      }}
                      formatter={(value, name) => [
                        `${value?.toFixed(1)}°C`,
                        name === "temperatura" ? "Temperatura" : name,
                      ]}
                    />
                    <ReferenceLine
                      y={0}
                      stroke="#ef4444"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      label={{ value: "0°C Helada", position: "right", fill: "#ef4444" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="temperatura"
                      stroke="#0ea5e9"
                      strokeWidth={2}
                      fill="url(#tempGradient)"
                    />
                    <Line
                      type="monotone"
                      dataKey="punto_rocio"
                      stroke="#06b6d4"
                      strokeWidth={1}
                      strokeDasharray="5 5"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-2 text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-4 h-1 bg-sky-500 rounded"></span>
                  Temperatura
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-4 h-1 bg-cyan-400 rounded" style={{ borderStyle: "dashed" }}></span>
                  Punto de rocío
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-4 h-1 bg-red-500 rounded" style={{ borderStyle: "dashed" }}></span>
                  Umbral helada (0°C)
                </span>
              </div>
            </div>

            {/* Factores de Riesgo y Protección */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Factores de Riesgo */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-red-700 mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Factores de Riesgo
                </h3>
                <div className="space-y-3">
                  {prediction.ai_analysis?.factores_riesgo?.map((factor, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border-l-4 ${
                        factor.impacto === "alto"
                          ? "border-red-500 bg-red-50"
                          : factor.impacto === "medio"
                          ? "border-yellow-500 bg-yellow-50"
                          : "border-gray-400 bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-800">{factor.factor}</span>
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            factor.impacto === "alto"
                              ? "bg-red-200 text-red-800"
                              : factor.impacto === "medio"
                              ? "bg-yellow-200 text-yellow-800"
                              : "bg-gray-200 text-gray-800"
                          }`}
                        >
                          {factor.impacto}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{factor.descripcion}</p>
                    </div>
                  ))}
                  {(!prediction.ai_analysis?.factores_riesgo || 
                    prediction.ai_analysis.factores_riesgo.length === 0) && (
                    <p className="text-gray-500 text-center py-4">
                      No se identificaron factores de riesgo significativos
                    </p>
                  )}
                </div>
              </div>

              {/* Factores de Protección */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-green-700 mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Factores de Protección
                </h3>
                <div className="space-y-3">
                  {prediction.ai_analysis?.factores_proteccion?.map((factor, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border-l-4 ${
                        factor.impacto === "alto"
                          ? "border-green-500 bg-green-50"
                          : factor.impacto === "medio"
                          ? "border-teal-500 bg-teal-50"
                          : "border-gray-400 bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-800">{factor.factor}</span>
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            factor.impacto === "alto"
                              ? "bg-green-200 text-green-800"
                              : factor.impacto === "medio"
                              ? "bg-teal-200 text-teal-800"
                              : "bg-gray-200 text-gray-800"
                          }`}
                        >
                          {factor.impacto}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{factor.descripcion}</p>
                    </div>
                  ))}
                  {(!prediction.ai_analysis?.factores_proteccion ||
                    prediction.ai_analysis.factores_proteccion.length === 0) && (
                    <p className="text-gray-500 text-center py-4">
                      No se identificaron factores de protección
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Horas Críticas */}
            {prediction.ai_analysis?.horas_criticas?.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-sky-600" />
                  Horas Críticas
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {prediction.ai_analysis.horas_criticas.map((hora, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg text-center ${
                        hora.riesgo === "alto"
                          ? "bg-red-100 border border-red-300"
                          : hora.riesgo === "medio"
                          ? "bg-yellow-100 border border-yellow-300"
                          : "bg-green-100 border border-green-300"
                      }`}
                    >
                      <p className="font-mono font-bold text-lg">{hora.hora}</p>
                      <p
                        className={`text-2xl font-bold ${
                          hora.temperatura_esperada < 0 ? "text-red-600" : "text-gray-800"
                        }`}
                      >
                        {hora.temperatura_esperada?.toFixed(1)}°C
                      </p>
                      <p className="text-xs text-gray-600 capitalize">{hora.riesgo}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recomendaciones */}
            {prediction.ai_analysis?.recomendaciones?.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Info className="w-5 h-5 text-sky-600" />
                  Recomendaciones
                </h3>
                <div className="space-y-3">
                  {prediction.ai_analysis.recomendaciones.map((rec, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-lg border flex items-start gap-3 ${
                        rec.urgencia === "inmediata"
                          ? "bg-red-50 border-red-200"
                          : rec.urgencia === "próximas_horas"
                          ? "bg-yellow-50 border-yellow-200"
                          : "bg-blue-50 border-blue-200"
                      }`}
                    >
                      <span
                        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                          rec.urgencia === "inmediata"
                            ? "bg-red-500 text-white"
                            : rec.urgencia === "próximas_horas"
                            ? "bg-yellow-500 text-white"
                            : "bg-blue-500 text-white"
                        }`}
                      >
                        {rec.prioridad}
                      </span>
                      <div>
                        <p className="text-gray-800">{rec.accion}</p>
                        <span
                          className={`text-xs mt-1 inline-block px-2 py-0.5 rounded ${
                            rec.urgencia === "inmediata"
                              ? "bg-red-200 text-red-800"
                              : rec.urgencia === "próximas_horas"
                              ? "bg-yellow-200 text-yellow-800"
                              : "bg-blue-200 text-blue-800"
                          }`}
                        >
                          {rec.urgencia}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Análisis Meteorológico Detallado */}
            {prediction.ai_analysis?.analisis_meteorologico && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Eye className="w-5 h-5 text-sky-600" />
                  Análisis Meteorológico
                </h3>
                <p className="text-gray-700 leading-relaxed">
                  {prediction.ai_analysis.analisis_meteorologico}
                </p>
                {prediction.ai_analysis?.tipo_helada_probable && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">Tipo de helada probable: </span>
                    <span className="font-semibold text-gray-800 capitalize">
                      {prediction.ai_analysis.tipo_helada_probable}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Predicción del Modelo ML */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-sky-600" />
                Predicción del Modelo ML
              </h3>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg text-center">
                  <p className="text-sm text-gray-600">Probabilidad</p>
                  <p className="text-3xl font-bold text-gray-800">
                    {(prediction.ml_prediction?.prediction?.probability * 100)?.toFixed(1)}%
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg text-center">
                  <p className="text-sm text-gray-600">Confianza</p>
                  <p className="text-3xl font-bold text-gray-800">
                    {(prediction.ml_prediction?.prediction?.confidence * 100)?.toFixed(1)}%
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg text-center">
                  <p className="text-sm text-gray-600">Predicción</p>
                  <p
                    className={`text-xl font-bold ${
                      prediction.ml_prediction?.prediction?.frost ? "text-red-600" : "text-green-600"
                    }`}
                  >
                    {prediction.ml_prediction?.prediction?.frost ? "CON HELADA" : "SIN HELADA"}
                  </p>
                </div>
              </div>
            </div>

            {/* Fuentes de Datos */}
            <div className="bg-gray-100 rounded-xl p-4 text-center text-sm text-gray-600">
              <p className="font-medium">Fuentes de Datos:</p>
              <p>
                Clima: {prediction.data_sources?.weather} | 
                ML: {prediction.data_sources?.ml_model} | 
                IA: {prediction.data_sources?.ai_analysis}
              </p>
              <p className="text-xs mt-1">
                Última actualización: {new Date(prediction.timestamp).toLocaleString("es-PE")}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedFrostPrediction;
