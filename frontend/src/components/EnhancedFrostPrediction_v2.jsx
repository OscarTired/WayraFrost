import React, { useState, useEffect } from "react";
import {
  AlertCircle,
  CloudSnow,
  Thermometer,
  Wind,
  Droplets,
  MapPin,
  RefreshCw,
  Mountain,
  Gauge,
  Info,
  Map as MapIcon,
  List,
  XCircle,
  CheckCircle
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from "recharts";
import LocationMapSelector from './LocationMapSelector';
import PhoneInput from './PhoneInput';

const API_BASE = "http://localhost:5000";

const EnhancedFrostPrediction_V2 = () => {
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [stationInfo, setStationInfo] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [outOfCoverage, setOutOfCoverage] = useState(null);
  const [viewMode, setViewMode] = useState('map'); // 'map' o 'list'
  const [phoneNumber, setPhoneNumber] = useState(null);
  const [sendingSMS, setSendingSMS] = useState(false);
  const [smsResult, setSmsResult] = useState(null);

  useEffect(() => {
    fetchStationInfo();
    fetchLocations();
  }, []);

  const fetchStationInfo = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/station-info`);
      const data = await response.json();
      setStationInfo(data.station);
    } catch (err) {
      console.error("Error cargando información de estación:", err);
    }
  };

  const fetchLocations = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/locations`);
      const data = await response.json();
      setLocations(data.locations || []);
    } catch (err) {
      console.error("Error cargando ubicaciones:", err);
    }
  };

  const handleLocationFromMap = async (location) => {
    setSelectedLocation(location);
    await handleAnalyze(location);
  };

  const handleAnalyze = async (location = selectedLocation) => {
    if (!location) {
      setError("Selecciona una ubicación");
      return;
    }

    setLoading(true);
    setError("");
    setPrediction(null);
    setOutOfCoverage(null);
    setSmsResult(null);  // Limpiar resultado SMS anterior

    try {
      const response = await fetch(`${API_BASE}/api/predict-enhanced-v2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: location.latitude,
          longitude: location.longitude,
          location_name: location.name,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Error en el análisis");
      }

      const data = await response.json();
      
      if (!data.prediction_available) {
        setOutOfCoverage(data);
      } else {
        setPrediction(data);
      }

      // Enviar SMS automáticamente si hay número registrado
      if (phoneNumber) {
        await sendSMSAlert(data);
      }

    } catch (err) {
      setError(err.message || "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const sendSMSAlert = async (predictionData) => {
    if (!phoneNumber) {
      setSmsResult({
        success: false,
        message: "No hay número de teléfono registrado"
      });
      return;
    }

    setSendingSMS(true);
    setSmsResult(null);

    try {
      const response = await fetch(`${API_BASE}/api/send-alert-sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number: phoneNumber,
          prediction_data: predictionData
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSmsResult({
          success: true,
          message: `SMS enviado exitosamente a +51${phoneNumber}`
        });
      } else {
        setSmsResult({
          success: false,
          message: data.error || "Error al enviar SMS"
        });
      }

    } catch (err) {
      setSmsResult({
        success: false,
        message: `Error: ${err.message}`
      });
    } finally {
      setSendingSMS(false);
    }
  };

  const getFrostClassColor = (className) => {
    const colors = {
      "No Helada": "bg-green-500 text-white",
      "Leve": "bg-yellow-500 text-white",
      "Moderada": "bg-orange-500 text-white",
      "Severa": "bg-red-600 text-white"
    };
    return colors[className] || "bg-gray-500 text-white";
  };

  const getFrostClassBorder = (className) => {
    const borders = {
      "No Helada": "border-green-500",
      "Leve": "border-yellow-500",
      "Moderada": "border-orange-500",
      "Severa": "border-red-600"
    };
    return borders[className] || "border-gray-400";
  };

  const prepareChartData = () => {
    if (!prediction?.hourly_forecast) return [];
    
    return prediction.hourly_forecast.slice(0, 24).map((hour) => {
      const time = hour.time ? new Date(hour.time) : null;
      return {
        hora: time ? time.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) : "",
        temperatura: hour.temperature,
        humedad: hour.humidity,
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
            Sistema de Predicción de Heladas - Región Junín
          </h1>
          <p className="text-gray-600 mt-2">
            Modelo Multiclase entrenado con datos de la Estación LAMAR - Huayao
          </p>
        </div>

        {/* Información de la Estación */}
        {stationInfo && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-md p-4 mb-6 border border-blue-200">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800 mb-1">
                  Modelo entrenado con datos de {stationInfo.institution}
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Este sistema utiliza datos históricos (2018-2025) de la{" "}
                  <strong>{stationInfo.name}</strong> ubicada a {stationInfo.elevation} msnm.
                  Las predicciones son válidas únicamente para ubicaciones en la región de Junín 
                  dentro de un radio de <strong>{stationInfo.valid_radius_km} km</strong>.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Selector de modo de vista */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex justify-center gap-2 mb-6">
            <button
              onClick={() => setViewMode('map')}
              className={`px-6 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                viewMode === 'map' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <MapIcon className="w-5 h-5" />
              Mapa Interactivo
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-6 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                viewMode === 'list' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <List className="w-5 h-5" />
              Lista de Ubicaciones
            </button>
          </div>

          {/* Vista de Mapa */}
          {viewMode === 'map' && (
            <LocationMapSelector 
              onLocationConfirm={handleLocationFromMap}
              stationInfo={stationInfo}
              phoneNumber={phoneNumber}
            />
          )}

          {/* Vista de Lista */}
          {viewMode === 'list' && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Seleccionar Ubicación en Junín
                  </label>
                  <select
                    value={selectedLocation?.name || ""}
                    onChange={(e) => {
                      const loc = locations.find((l) => l.name === e.target.value);
                      setSelectedLocation(loc);
                    }}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="">Selecciona una ubicación...</option>
                    {locations.map((loc) => (
                      <option key={loc.name} value={loc.name}>
                        {loc.name} ({loc.elevation}m) 
                        {loc.is_station && " 🔬 Estación"}
                        {loc.distance_from_station_km > 0 && ` - ${loc.distance_from_station_km} km`}
                      </option>
                    ))}
                  </select>
                  {selectedLocation && !selectedLocation.is_valid && (
                    <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      Esta ubicación está fuera del rango de cobertura
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleAnalyze()}
                  disabled={loading || !selectedLocation}
                  className="px-8 py-3 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Analizando...
                    </>
                  ) : (
                    <>
                      <Thermometer className="w-5 h-5" />
                      Analizar Riesgo
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Campo de teléfono (siempre visible) */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <PhoneInput 
            onPhoneChange={setPhoneNumber}
            initialPhone=""
          />
        </div>

        {/* Resultado de envío de SMS */}
        {smsResult && (
          <div className={`mb-6 p-4 rounded-lg border flex items-center gap-3 ${
            smsResult.success 
              ? 'bg-green-50 border-green-300 text-green-800'
              : 'bg-red-50 border-red-300 text-red-800'
          }`}>
            {smsResult.success ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <div className="flex-1">
              <p className="font-medium">
                {smsResult.success ? '✓ SMS Enviado' : '✗ Error al enviar SMS'}
              </p>
              <p className="text-sm mt-1">{smsResult.message}</p>
            </div>
          </div>
        )}

        {/* Indicador de envío de SMS */}
        {sendingSMS && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <span className="text-blue-800">Enviando alerta por SMS...</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 rounded-lg border border-red-300 bg-red-50 text-red-800 flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        {/* Mensaje de Ubicación Fuera de Cobertura */}
        {outOfCoverage && (
          <div className="mb-6 bg-amber-50 border-l-4 border-amber-500 rounded-lg shadow-lg p-6">
            <div className="flex items-start gap-4">
              <XCircle className="w-8 h-8 text-amber-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-amber-900 mb-2">
                  Predicción No Disponible para Esta Ubicación
                </h3>
                <p className="text-amber-800 mb-3">
                  {outOfCoverage.message}
                </p>
                
                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  <div className="bg-white rounded-lg p-4 border border-amber-200">
                    <p className="text-sm font-medium text-gray-700 mb-2">Ubicación Solicitada:</p>
                    <p className="text-sm text-gray-600">
                      <MapPin className="w-4 h-4 inline mr-1" />
                      {outOfCoverage.requested_location.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Lat: {outOfCoverage.requested_location.latitude.toFixed(4)}°, 
                      Lon: {outOfCoverage.requested_location.longitude.toFixed(4)}°
                    </p>
                    <p className="text-sm text-red-600 mt-2 font-medium">
                      Distancia desde estación: {outOfCoverage.distance_from_station_km} km
                    </p>
                  </div>

                  <div className="bg-white rounded-lg p-4 border border-green-200">
                    <p className="text-sm font-medium text-gray-700 mb-2">Estación de Referencia:</p>
                    <p className="text-sm text-gray-600">
                      <MapPin className="w-4 h-4 inline mr-1 text-green-600" />
                      {outOfCoverage.station_info.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {outOfCoverage.station_info.institution}
                    </p>
                    <p className="text-xs text-gray-500">
                      {outOfCoverage.station_info.elevation} msnm
                    </p>
                    <p className="text-sm text-green-600 mt-2 font-medium">
                      Radio de cobertura: {outOfCoverage.station_info.valid_radius_km} km
                    </p>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <Info className="w-4 h-4 inline mr-1" />
                    <strong>Sugerencia:</strong> {outOfCoverage.suggestion}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Resultados de Predicción */}
        {prediction && (
          <div className="space-y-6">
            {/* Banner de Validación */}
            {prediction.validation && (
              <div className="bg-green-50 border-l-4 border-green-500 rounded-lg p-4 flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900">
                    ✓ Ubicación Válida
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    {prediction.validation.message} • 
                    Datos de: {prediction.station_reference.name}
                  </p>
                </div>
              </div>
            )}

            {/* Predicción Principal */}
            <div
              className={`rounded-xl shadow-lg p-6 border-l-4 ${getFrostClassBorder(
                prediction.ml_prediction_v2?.prediction?.class_name
              )} bg-white`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">
                    {prediction.location?.name}
                  </h2>
                  <p className="text-gray-600">
                    {prediction.current_conditions?.weather_description}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {prediction.validation?.distance_from_station_km} km de la estación
                  </p>
                </div>
                <div
                  className={`px-6 py-3 rounded-lg ${getFrostClassColor(
                    prediction.ml_prediction_v2?.prediction?.class_name
                  )} text-center`}
                >
                  <p className="text-sm opacity-90">Clasificación</p>
                  <p className="text-2xl font-bold uppercase">
                    {prediction.ml_prediction_v2?.prediction?.class_name || "N/A"}
                  </p>
                  <p className="text-sm opacity-90">
                    Confianza: {(prediction.ml_prediction_v2?.prediction?.confidence * 100)?.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>

            {/* Probabilidades por Clase */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Gauge className="w-5 h-5 text-sky-600" />
                Probabilidades por Tipo de Helada
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {prediction.ml_prediction_v2?.prediction?.probabilities &&
                  Object.entries(prediction.ml_prediction_v2.prediction.probabilities).map(([key, value]) => (
                    <div key={key} className="p-4 bg-gray-50 rounded-lg text-center">
                      <p className="text-sm text-gray-600 mb-1">{key}</p>
                      <p className="text-2xl font-bold text-gray-800">
                        {(value * 100).toFixed(1)}%
                      </p>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div
                          className={`h-2 rounded-full ${
                            value > 0.5 ? "bg-red-500" : value > 0.3 ? "bg-yellow-500" : "bg-green-500"
                          }`}
                          style={{ width: `${value * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Condiciones Actuales */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Condiciones Meteorológicas Actuales
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
                </div>

                <div className="p-4 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg">
                  <div className="flex items-center gap-2 text-indigo-600 mb-1">
                    <Mountain className="w-4 h-4" />
                    <span className="text-sm">Elevación</span>
                  </div>
                  <p className="text-2xl font-bold text-indigo-800">
                    {prediction.location?.elevation} m
                  </p>
                </div>
              </div>
            </div>

            {/* Gráfico de Pronóstico */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Pronóstico 24 Horas
              </h3>
              <div className="h-64">
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
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <ReferenceLine y={0} stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" />
                    <Area type="monotone" dataKey="temperatura" stroke="#0ea5e9" strokeWidth={2} fill="url(#tempGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Información del Modelo y Estación */}
            <div className="bg-gray-100 rounded-xl p-4 text-sm text-gray-600">
              <p className="font-medium mb-2">Información del Modelo:</p>
              <p>• Versión: {prediction.model_info?.version} | Tipo: Random Forest Multiclase</p>
              <p>• Datos de Entrenamiento: {prediction.data_sources?.training_data}</p>
              <p>• Features con Lags: {prediction.model_info?.has_lag_features ? "Sí" : "No"} 
                 ({prediction.model_info?.lag_hours?.join(", ")} horas)</p>
              <p>• Cobertura: {prediction.model_info?.geographic_coverage}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedFrostPrediction_V2;
