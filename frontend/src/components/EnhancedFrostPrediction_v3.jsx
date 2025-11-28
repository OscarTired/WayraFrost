import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  CheckCircle,
  TrendingDown,
  Clock,
  Shield,
  AlertTriangle,
  Sun,
  Moon,
  Activity,
  Sparkles,
  Heart,
  Wheat,
  Baby,
  Users,
  Milk,
  Brain
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
import PhoneInputOptional from './PhoneInputOptional';

const API_BASE = "http://localhost:5000";

// Configuración de animaciones
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

const scaleIn = {
  initial: { scale: 0.9, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0.9, opacity: 0 }
};

const pulseAnimation = {
  scale: [1, 1.02, 1],
  transition: { duration: 2, repeat: Infinity }
};

// Componente de Tarjeta Animada
const AnimatedCard = ({ children, className = "", delay = 0 }) => (
  <motion.div
    variants={fadeInUp}
    initial="initial"
    animate="animate"
    transition={{ duration: 0.5, delay }}
    className={`bg-white rounded-2xl shadow-lg ${className}`}
  >
    {children}
  </motion.div>
);

// Componente de Indicador de Riesgo Visual
const RiskIndicator = ({ level, className }) => {
  const config = {
    "Sin Riesgo": { color: "bg-emerald-500", icon: CheckCircle, text: "Sin Riesgo de Helada", desc: "Condiciones favorables" },
    "Riesgo": { color: "bg-amber-500", icon: AlertTriangle, text: "Riesgo de Helada", desc: "Se recomienda precaución" },
    "Moderada": { color: "bg-orange-500", icon: AlertCircle, text: "Helada Moderada", desc: "Tomar medidas preventivas" },
    "Severa": { color: "bg-red-600", icon: XCircle, text: "Helada Severa", desc: "Acción inmediata requerida" }
  };
  
  const { color, icon: Icon, text, desc } = config[level] || config["Sin Riesgo"];
  
  return (
    <motion.div 
      className={`flex items-center gap-3 ${className}`}
      animate={level !== "Sin Riesgo" ? pulseAnimation : {}}
    >
      <div className={`p-3 rounded-full ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="font-bold text-lg">{text}</p>
        <p className="text-sm text-gray-500">{desc}</p>
      </div>
    </motion.div>
  );
};

// Función para verificar si ML y API coinciden en su evaluación
const checkAgreement = (mlPrediction, aiAnalysis) => {
  const mlClass = mlPrediction?.prediction?.class_name || "Sin Riesgo";
  const apiClass = aiAnalysis?.clasificacion_final;
  
  if (!apiClass) return { agree: true, message: null };
  
  if (mlClass === apiClass) {
    return { agree: true, message: "ML y API coinciden en la evaluación" };
  }
  
  return { 
    agree: false, 
    message: `Discrepancia: ML predice "${mlClass}" pero API indica "${apiClass}"`
  };
};

// Función para calcular confianza del sistema
const calculateSystemConfidence = (mlPrediction, aiAnalysis) => {
  const mlConfidence = (mlPrediction?.prediction?.confidence || 0) * 100;
  const apiConfianza = aiAnalysis?.confianza_analisis;
  const agreement = checkAgreement(mlPrediction, aiAnalysis);
  
  // Mapear confianza de API (texto a número)
  const apiConfMap = { "alta": 90, "media": 70, "baja": 50 };
  const apiConfNum = apiConfMap[apiConfianza] || 70;
  
  if (agreement.agree) {
    // Si coinciden, la confianza es el promedio de ambas confianzas
    return Math.round((mlConfidence + apiConfNum) / 2);
  } else {
    // Si discrepan, la confianza del sistema es menor (hay incertidumbre)
    return Math.round(Math.min(mlConfidence, apiConfNum) * 0.7);
  }
};

// Función para obtener la clasificación final combinada
const getCombinedClassification = (mlPrediction, aiAnalysis) => {
  const mlClass = mlPrediction?.prediction?.class_name || "Sin Riesgo";
  const apiClass = aiAnalysis?.clasificacion_final;
  
  if (!apiClass) return mlClass;
  
  // Usar la clasificación más conservadora (mayor riesgo)
  const riskOrder = { "Sin Riesgo": 0, "Riesgo": 1, "Moderada": 2, "Severa": 3 };
  return riskOrder[apiClass] >= riskOrder[mlClass] ? apiClass : mlClass;
};

// Función para obtener la probabilidad de helada
const getFrostProbability = (mlPrediction, aiAnalysis) => {
  // La probabilidad de helada viene de API (probabilidad_estimada)
  // ML da confianza en su clasificación, no probabilidad de helada directamente
  const apiProb = aiAnalysis?.probabilidad_estimada;
  
  if (apiProb !== undefined) {
    return apiProb;
  }
  
  // Fallback: calcular desde ML si no hay API
  const mlProbs = mlPrediction?.prediction?.probabilities || {};
  
  // Probabilidad de helada = 100% - probabilidad de "Sin Riesgo"
  const noFrostProb = (mlProbs["Sin Riesgo"] || 0) * 100;
  return Math.round(100 - noFrostProb);
};

// Componente de Métrica con Icono
const MetricCard = ({ icon: Icon, label, value, unit, gradient, delay = 0 }) => (
  <motion.div
    className={`p-5 rounded-xl ${gradient} relative overflow-hidden`}
    variants={scaleIn}
    initial="initial"
    animate="animate"
    transition={{ delay }}
    whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
  >
    <div className="relative z-10">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-5 h-5 opacity-80" />
        <span className="text-sm font-medium opacity-90">{label}</span>
      </div>
      <p className="text-3xl font-bold">
        {value}
        <span className="text-lg font-normal ml-1">{unit}</span>
      </p>
    </div>
    <div className="absolute -right-4 -bottom-4 opacity-10">
      <Icon className="w-24 h-24" />
    </div>
  </motion.div>
);

// Tooltip personalizado para gráficos
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-sm p-4 rounded-xl shadow-xl border border-gray-100">
        <p className="font-bold text-gray-800 mb-2">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: <span className="font-semibold">{entry.value?.toFixed(1)}{entry.name === 'Temperatura' ? '°C' : '%'}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const EnhancedFrostPrediction_V3 = () => {
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [stationInfo, setStationInfo] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [outOfCoverage, setOutOfCoverage] = useState(null);
  const [viewMode, setViewMode] = useState('map');
  const [phoneNumber, setPhoneNumber] = useState(null);
  const [sendingSMS, setSendingSMS] = useState(false);
  const [smsResult, setSmsResult] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Actualizar hora cada minuto
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

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
    setSmsResult(null);

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
    if (!phoneNumber) return;

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

      setSmsResult({
        success: response.ok && data.success,
        message: data.success ? `SMS enviado a +51${phoneNumber}` : (data.error || "Error al enviar SMS")
      });

    } catch (err) {
      setSmsResult({ success: false, message: `Error: ${err.message}` });
    } finally {
      setSendingSMS(false);
    }
  };

  const getRiskConfig = (className) => {
    const configs = {
      "Sin Riesgo": { 
        bg: "bg-gradient-to-br from-emerald-500 to-green-600", 
        border: "border-emerald-400",
        light: "bg-emerald-50",
        text: "text-emerald-700"
      },
      "Riesgo": { 
        bg: "bg-gradient-to-br from-amber-500 to-yellow-600", 
        border: "border-amber-400",
        light: "bg-amber-50",
        text: "text-amber-700"
      },
      "Moderada": { 
        bg: "bg-gradient-to-br from-orange-500 to-red-500", 
        border: "border-orange-400",
        light: "bg-orange-50",
        text: "text-orange-700"
      },
      "Severa": { 
        bg: "bg-gradient-to-br from-red-600 to-red-800", 
        border: "border-red-500",
        light: "bg-red-50",
        text: "text-red-700"
      }
    };
    return configs[className] || configs["Sin Riesgo"];
  };

  const prepareChartData = () => {
    if (!prediction?.hourly_forecast) return [];
    
    return prediction.hourly_forecast.slice(0, 24).map((hour) => {
      const time = hour.time ? new Date(hour.time) : null;
      return {
        hora: time ? time.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) : "",
        Temperatura: hour.temperature,
        Humedad: hour.humidity,
      };
    });
  };

  const isNightTime = () => {
    const hour = currentTime.getHours();
    return hour < 6 || hour >= 19;
  };

  return (
    <div className={`min-h-screen transition-colors duration-500 ${isNightTime() ? 'bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900' : 'bg-gradient-to-b from-sky-50 via-white to-sky-50'}`}>
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        
        {/* Header con Animación */}
        <motion.header 
          className="mb-8 text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center justify-center gap-4 mb-4">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
            >
              {isNightTime() ? (
                <Moon className="w-12 h-12 text-indigo-400" />
              ) : (
                <Sun className="w-12 h-12 text-amber-500" />
              )}
            </motion.div>
            <div>
              <h1 className={`text-4xl font-bold ${isNightTime() ? 'text-white' : 'text-slate-800'}`}>
                WayraFrost
              </h1>
              <p className={`text-lg ${isNightTime() ? 'text-slate-300' : 'text-slate-600'}`}>
                Sistema Inteligente de Predicción de Heladas
              </p>
            </div>
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <CloudSnow className={`w-12 h-12 ${isNightTime() ? 'text-blue-400' : 'text-sky-600'}`} />
            </motion.div>
          </div>
          
          {/* Hora actual y ubicación */}
          <motion.div 
            className={`inline-flex items-center gap-6 px-6 py-3 rounded-full ${isNightTime() ? 'bg-slate-800/50' : 'bg-white/80'} backdrop-blur-sm shadow-lg`}
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
          >
            <div className="flex items-center gap-2">
              <Clock className={`w-5 h-5 ${isNightTime() ? 'text-slate-400' : 'text-slate-500'}`} />
              <span className={`font-mono text-lg ${isNightTime() ? 'text-white' : 'text-slate-700'}`}>
                {currentTime.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <div className="w-px h-6 bg-slate-300" />
            <div className="flex items-center gap-2">
              <MapPin className={`w-5 h-5 ${isNightTime() ? 'text-slate-400' : 'text-slate-500'}`} />
              <span className={`${isNightTime() ? 'text-slate-300' : 'text-slate-600'}`}>
                Región Junín, Perú
              </span>
            </div>
          </motion.div>
        </motion.header>

        {/* Info Banner */}
        {stationInfo && (
          <AnimatedCard className="p-5 mb-6 border-l-4 border-blue-500" delay={0.2}>
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Info className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg text-slate-800 mb-1">
                  Datos de {stationInfo.institution}
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  Modelo entrenado con datos históricos (2018-2025) de la{" "}
                  <strong>{stationInfo.name}</strong> a {stationInfo.elevation} msnm.
                  Cobertura válida: <strong>{stationInfo.valid_radius_km} km</strong> de radio.
                </p>
              </div>
            </div>
          </AnimatedCard>
        )}

        {/* Teléfono para SMS - ENCIMA del mapa */}
        <AnimatedCard className="p-5 mb-6" delay={0.25}>
          <PhoneInputOptional onPhoneChange={setPhoneNumber} />
        </AnimatedCard>

        {/* Selector de Vista */}
        <AnimatedCard className="p-6 mb-6" delay={0.3}>
          <div className="flex justify-center gap-3 mb-6">
            <motion.button
              onClick={() => setViewMode('map')}
              className={`px-6 py-3 rounded-xl flex items-center gap-2 font-medium transition-all ${
                viewMode === 'map' 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <MapIcon className="w-5 h-5" />
              Mapa Interactivo
            </motion.button>
            <motion.button
              onClick={() => setViewMode('list')}
              className={`px-6 py-3 rounded-xl flex items-center gap-2 font-medium transition-all ${
                viewMode === 'list' 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <List className="w-5 h-5" />
              Lista de Ubicaciones
            </motion.button>
          </div>

          <AnimatePresence mode="wait">
            {viewMode === 'map' ? (
              <motion.div
                key="map"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <LocationMapSelector 
                  onLocationConfirm={handleLocationFromMap}
                  stationInfo={stationInfo}
                  phoneNumber={phoneNumber}
                />
              </motion.div>
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="flex flex-col md:flex-row gap-4 items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      <MapPin className="w-4 h-4 inline mr-1" />
                      Seleccionar Ubicación en Junín
                    </label>
                    <select
                      value={selectedLocation?.name || ""}
                      onChange={(e) => {
                        const loc = locations.find((l) => l.name === e.target.value);
                        setSelectedLocation(loc);
                      }}
                      className="w-full border border-slate-300 rounded-xl px-4 py-3 text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
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
                  </div>
                  <motion.button
                    onClick={() => handleAnalyze()}
                    disabled={loading || !selectedLocation}
                    className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Analizando...
                      </>
                    ) : (
                      <>
                        <Activity className="w-5 h-5" />
                        Analizar Riesgo
                      </>
                    )}
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </AnimatedCard>

        {/* Notificaciones */}
        <AnimatePresence>
          {smsResult && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className={`mb-6 p-4 rounded-xl border flex items-center gap-3 ${
                smsResult.success 
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-red-50 border-red-300 text-red-800'
              }`}
            >
              {smsResult.success ? (
                <CheckCircle className="w-6 h-6" />
              ) : (
                <AlertCircle className="w-6 h-6" />
              )}
              <span className="font-medium">{smsResult.message}</span>
            </motion.div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-6 p-4 rounded-xl border border-red-300 bg-red-50 text-red-800 flex items-center gap-3"
            >
              <AlertCircle className="w-6 h-6" />
              <span>{error}</span>
            </motion.div>
          )}

          {sendingSMS && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3"
            >
              <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
              <span className="text-blue-800">Enviando alerta por SMS...</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fuera de Cobertura */}
        <AnimatePresence>
          {outOfCoverage && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mb-6 bg-amber-50 border-l-4 border-amber-500 rounded-2xl shadow-lg p-6"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-amber-100 rounded-full">
                  <XCircle className="w-8 h-8 text-amber-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-amber-900 mb-2">
                    Ubicación Fuera de Cobertura
                  </h3>
                  <p className="text-amber-800 mb-4">{outOfCoverage.message}</p>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl p-4 border border-amber-200">
                      <p className="text-sm font-bold text-slate-700 mb-2">📍 Ubicación Solicitada</p>
                      <p className="text-slate-600">{outOfCoverage.requested_location.name}</p>
                      <p className="text-red-600 font-semibold mt-2">
                        {outOfCoverage.distance_from_station_km} km de la estación
                      </p>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-emerald-200">
                      <p className="text-sm font-bold text-slate-700 mb-2">🔬 Estación de Referencia</p>
                      <p className="text-slate-600">{outOfCoverage.station_info.name}</p>
                      <p className="text-emerald-600 font-semibold mt-2">
                        Radio válido: {outOfCoverage.station_info.valid_radius_km} km
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Resultados de Predicción */}
        <AnimatePresence>
          {prediction && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* Tarjeta Principal de Predicción */}
              <motion.div
                className={`rounded-2xl shadow-xl overflow-hidden ${getRiskConfig(getCombinedClassification(prediction.ml_prediction_v2, prediction.ai_analysis)).border} border-2`}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
              >
                {/* Header con Gradiente */}
                <div className={`${getRiskConfig(getCombinedClassification(prediction.ml_prediction_v2, prediction.ai_analysis)).bg} text-white p-6`}>
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                    <div>
                      <motion.h2 
                        className="text-3xl font-bold mb-2"
                        initial={{ x: -20 }}
                        animate={{ x: 0 }}
                      >
                        {prediction.location?.name}
                      </motion.h2>
                      <p className="text-white/80 flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        {prediction.validation?.distance_from_station_km} km de la estación • {prediction.location?.elevation} msnm
                      </p>
                    </div>
                    
                    {(() => {
                    const combinedClass = getCombinedClassification(prediction.ml_prediction_v2, prediction.ai_analysis);
                    const systemConf = calculateSystemConfidence(prediction.ml_prediction_v2, prediction.ai_analysis);
                    const frostProb = getFrostProbability(prediction.ml_prediction_v2, prediction.ai_analysis);
                    const agreement = checkAgreement(prediction.ml_prediction_v2, prediction.ai_analysis);
                    const colorConfig = {
                      "Sin Riesgo": "bg-emerald-500/30 border-emerald-300",
                      "Riesgo": "bg-amber-500/30 border-amber-300",
                      "Moderada": "bg-orange-500/30 border-orange-300",
                      "Severa": "bg-red-500/30 border-red-300"
                    };
                    const bgColor = colorConfig[combinedClass] || colorConfig["Sin Riesgo"];
                    
                    return (
                      <motion.div 
                        className={`backdrop-blur-sm rounded-2xl p-6 text-center min-w-[220px] border-2 ${bgColor}`}
                        initial={{ scale: 0.9 }}
                        animate={{ scale: 1 }}
                      >
                        <p className="text-sm text-white/90 mb-1 font-medium">Clasificación del Sistema</p>
                        <p className="text-4xl font-black">
                          {combinedClass}
                        </p>
                        <div className="mt-3 space-y-1">
                          <p className="text-sm text-white/90">
                            Prob. Helada: <span className="font-bold text-lg">{frostProb}%</span>
                          </p>
                          <p className="text-sm text-white/80">
                            Confianza Sistema: <span className="font-bold">{systemConf}%</span>
                          </p>
                        </div>
                        <p className={`text-xs mt-2 px-2 py-1 rounded-full ${agreement.agree ? 'bg-white/20 text-white/80' : 'bg-yellow-400/30 text-yellow-100'}`}>
                          {agreement.agree ? '✓ ML y API coinciden' : '⚠ ML y API discrepan'}
                        </p>
                      </motion.div>
                    );
                  })()}
                  </div>
                </div>

                {/* Cuerpo de la Tarjeta */}
                <div className="bg-white p-6">
                  <RiskIndicator 
                    level={getCombinedClassification(prediction.ml_prediction_v2, prediction.ai_analysis)} 
                    className="mb-6"
                  />
                  
                  {/* Temperatura Actual Destacada */}
                  <div className="flex items-center justify-center gap-8 py-6 border-y border-slate-100">
                    <div className="text-center">
                      <Thermometer className="w-12 h-12 text-blue-500 mx-auto mb-2" />
                      <p className="text-5xl font-bold text-slate-800">
                        {prediction.current_conditions?.temperature?.toFixed(1)}°C
                      </p>
                      <p className="text-slate-500">Temperatura Actual</p>
                    </div>
                    <div className="w-px h-20 bg-slate-200" />
                    <div className="text-center">
                      <TrendingDown className="w-12 h-12 text-cyan-500 mx-auto mb-2" />
                      <p className="text-5xl font-bold text-slate-800">
                        {prediction.forecast_summary?.min_temperature_forecast?.toFixed(1) || "N/A"}°C
                      </p>
                      <p className="text-slate-500">Mínima Pronosticada</p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Comparativa ML vs Análisis Meteorológico */}
              <AnimatedCard className="p-6" delay={0.2}>
                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <Gauge className="w-6 h-6 text-indigo-600" />
                  Comparativa: Modelo ML vs Análisis Meteorológico
                </h3>
                
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Predicción ML */}
                  <motion.div 
                    className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <Brain className="w-5 h-5 text-blue-600" />
                      <h4 className="font-bold text-blue-800">Modelo ML (Random Forest)</h4>
                    </div>
                    <div className={`text-center p-4 rounded-xl mb-3 ${
                      prediction.ml_prediction_v2?.prediction?.class_name === 'Sin Riesgo' ? 'bg-emerald-100 border-2 border-emerald-300' :
                      prediction.ml_prediction_v2?.prediction?.class_name === 'Riesgo' ? 'bg-amber-100 border-2 border-amber-300' :
                      prediction.ml_prediction_v2?.prediction?.class_name === 'Moderada' ? 'bg-orange-100 border-2 border-orange-300' :
                      'bg-red-100 border-2 border-red-300'
                    }`}>
                      <p className={`text-3xl font-black ${
                        prediction.ml_prediction_v2?.prediction?.class_name === 'Sin Riesgo' ? 'text-emerald-700' :
                        prediction.ml_prediction_v2?.prediction?.class_name === 'Riesgo' ? 'text-amber-700' :
                        prediction.ml_prediction_v2?.prediction?.class_name === 'Moderada' ? 'text-orange-700' :
                        'text-red-700'
                      }`}>
                        {prediction.ml_prediction_v2?.prediction?.class_name || "N/A"}
                      </p>
                      <p className="text-sm text-slate-600 mt-1">
                        Confianza: {((prediction.ml_prediction_v2?.prediction?.confidence || 0) * 100).toFixed(0)}%
                      </p>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div className="text-center p-2 bg-white/60 rounded-lg">
                        <p className="font-bold text-emerald-600">{((prediction.ml_prediction_v2?.prediction?.probabilities?.["Sin Riesgo"] || 0) * 100).toFixed(0)}%</p>
                        <p className="text-slate-500">Sin Riesgo</p>
                      </div>
                      <div className="text-center p-2 bg-white/60 rounded-lg">
                        <p className="font-bold text-amber-600">{((prediction.ml_prediction_v2?.prediction?.probabilities?.["Riesgo"] || 0) * 100).toFixed(0)}%</p>
                        <p className="text-slate-500">Riesgo</p>
                      </div>
                      <div className="text-center p-2 bg-white/60 rounded-lg">
                        <p className="font-bold text-orange-600">{((prediction.ml_prediction_v2?.prediction?.probabilities?.["Moderada"] || 0) * 100).toFixed(0)}%</p>
                        <p className="text-slate-500">Moderada</p>
                      </div>
                      <div className="text-center p-2 bg-white/60 rounded-lg">
                        <p className="font-bold text-red-600">{((prediction.ml_prediction_v2?.prediction?.probabilities?.["Severa"] || 0) * 100).toFixed(0)}%</p>
                        <p className="text-slate-500">Severa</p>
                      </div>
                    </div>
                  </motion.div>

                  {/* Predicción API/Gemini */}
                  <motion.div 
                    className="p-5 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-200"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <Sparkles className="w-5 h-5 text-purple-600" />
                      <h4 className="font-bold text-purple-800">Análisis Meteorológico (API + AI)</h4>
                    </div>
                    <div className={`text-center p-4 rounded-xl mb-3 ${
                      prediction.ai_analysis?.clasificacion_final === 'Sin Riesgo' ? 'bg-emerald-100 border-2 border-emerald-300' :
                      prediction.ai_analysis?.clasificacion_final === 'Riesgo' ? 'bg-amber-100 border-2 border-amber-300' :
                      prediction.ai_analysis?.clasificacion_final === 'Moderada' ? 'bg-orange-100 border-2 border-orange-300' :
                      'bg-red-100 border-2 border-red-300'
                    }`}>
                      <p className={`text-3xl font-black ${
                        prediction.ai_analysis?.clasificacion_final === 'Sin Riesgo' ? 'text-emerald-700' :
                        prediction.ai_analysis?.clasificacion_final === 'Riesgo' ? 'text-amber-700' :
                        prediction.ai_analysis?.clasificacion_final === 'Moderada' ? 'text-orange-700' :
                        'text-red-700'
                      }`}>
                        {prediction.ai_analysis?.clasificacion_final || "N/A"}
                      </p>
                      <p className="text-sm text-slate-600 mt-1">
                        Probabilidad: {prediction.ai_analysis?.probabilidad_estimada || 0}%
                      </p>
                    </div>
                    <div className="text-xs space-y-2">
                      <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                        <span className="text-slate-600">Nivel de riesgo:</span>
                        <span className={`font-bold uppercase ${
                          prediction.ai_analysis?.nivel_riesgo_combinado === 'muy_alto' ? 'text-red-600' :
                          prediction.ai_analysis?.nivel_riesgo_combinado === 'alto' ? 'text-orange-600' :
                          prediction.ai_analysis?.nivel_riesgo_combinado === 'medio' ? 'text-amber-600' :
                          'text-emerald-600'
                        }`}>
                          {prediction.ai_analysis?.nivel_riesgo_combinado?.replace('_', ' ') || 'bajo'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                        <span className="text-slate-600">Confianza análisis:</span>
                        <span className="font-bold text-slate-700 capitalize">
                          {prediction.ai_analysis?.confianza_analisis || 'media'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                        <span className="text-slate-600">Tipo helada:</span>
                        <span className="font-bold text-slate-700 capitalize">
                          {prediction.ai_analysis?.tipo_helada_probable || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                </div>
                
                {/* Nota de discrepancia si existe */}
                {prediction.ai_analysis?.discrepancia_ml && (
                  <motion.div 
                    className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <p className="text-sm text-amber-800 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span><strong>Discrepancia detectada:</strong> {prediction.ai_analysis.discrepancia_ml}</span>
                    </p>
                  </motion.div>
                )}
              </AnimatedCard>

              {/* Análisis Inteligente de Gemini AI */}
              {prediction.ai_analysis && (
                <AnimatedCard className="p-6" delay={0.35}>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl">
                      <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-800">Análisis Inteligente</h3>
                      <p className="text-sm text-slate-500">Powered by Gemini AI</p>
                    </div>
                  </div>

                  {/* Resumen Ejecutivo */}
                  {prediction.ai_analysis.resumen_ejecutivo && (
                    <motion.div 
                      className="p-4 bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl mb-6 border-l-4 border-indigo-500"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <p className="text-slate-700 leading-relaxed">
                        {prediction.ai_analysis.resumen_ejecutivo}
                      </p>
                    </motion.div>
                  )}

                  {/* Grid de Impactos Sectoriales - DINÁMICOS */}
                  <div className="grid md:grid-cols-3 gap-4 mb-6">
                    {/* Agricultura - Datos de Gemini */}
                    <motion.div 
                      className={`p-5 rounded-xl border ${
                        prediction.ai_analysis.impacto_agricultura?.nivel_riesgo === 'critico' ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-300' :
                        prediction.ai_analysis.impacto_agricultura?.nivel_riesgo === 'alto' ? 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-300' :
                        prediction.ai_analysis.impacto_agricultura?.nivel_riesgo === 'medio' ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200' :
                        'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200'
                      }`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            prediction.ai_analysis.impacto_agricultura?.nivel_riesgo === 'critico' ? 'bg-red-200' :
                            prediction.ai_analysis.impacto_agricultura?.nivel_riesgo === 'alto' ? 'bg-orange-200' :
                            prediction.ai_analysis.impacto_agricultura?.nivel_riesgo === 'medio' ? 'bg-amber-100' :
                            'bg-green-100'
                          }`}>
                            <Wheat className={`w-5 h-5 ${
                              prediction.ai_analysis.impacto_agricultura?.nivel_riesgo === 'critico' ? 'text-red-600' :
                              prediction.ai_analysis.impacto_agricultura?.nivel_riesgo === 'alto' ? 'text-orange-600' :
                              prediction.ai_analysis.impacto_agricultura?.nivel_riesgo === 'medio' ? 'text-amber-600' :
                              'text-green-600'
                            }`} />
                          </div>
                          <h4 className="font-bold text-slate-800">Agricultura</h4>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${
                          prediction.ai_analysis.impacto_agricultura?.nivel_riesgo === 'critico' ? 'bg-red-200 text-red-800' :
                          prediction.ai_analysis.impacto_agricultura?.nivel_riesgo === 'alto' ? 'bg-orange-200 text-orange-800' :
                          prediction.ai_analysis.impacto_agricultura?.nivel_riesgo === 'medio' ? 'bg-amber-200 text-amber-800' :
                          'bg-green-200 text-green-800'
                        }`}>
                          {prediction.ai_analysis.impacto_agricultura?.nivel_riesgo || 'bajo'}
                        </span>
                      </div>
                      <div className="space-y-3 text-sm">
                        {(prediction.ai_analysis.impacto_agricultura?.cultivos_vulnerables || prediction.ai_analysis.cultivos_vulnerables) && (
                          <div>
                            <p className="font-medium text-slate-700 mb-1">Cultivos en riesgo:</p>
                            <div className="flex flex-wrap gap-1">
                              {(prediction.ai_analysis.impacto_agricultura?.cultivos_vulnerables || prediction.ai_analysis.cultivos_vulnerables || []).slice(0, 5).map((cultivo, idx) => (
                                <span key={idx} className="px-2 py-0.5 bg-white/60 rounded-full text-xs text-slate-700">
                                  {cultivo}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {prediction.ai_analysis.impacto_agricultura?.acciones_recomendadas && (
                          <div className="pt-2 border-t border-slate-200">
                            <p className="font-medium text-slate-700 mb-1">Acciones:</p>
                            <ul className="space-y-1 text-xs text-slate-600">
                              {prediction.ai_analysis.impacto_agricultura.acciones_recomendadas.slice(0, 3).map((accion, idx) => (
                                <li key={idx}>• {accion}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {prediction.ai_analysis.impacto_agricultura?.perdidas_potenciales && (
                          <p className="text-xs text-slate-500 italic pt-1">
                            {prediction.ai_analysis.impacto_agricultura.perdidas_potenciales}
                          </p>
                        )}
                      </div>
                    </motion.div>

                    {/* Ganadería - Datos de Gemini */}
                    <motion.div 
                      className={`p-5 rounded-xl border ${
                        prediction.ai_analysis.impacto_ganaderia?.nivel_riesgo === 'critico' ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-300' :
                        prediction.ai_analysis.impacto_ganaderia?.nivel_riesgo === 'alto' ? 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-300' :
                        prediction.ai_analysis.impacto_ganaderia?.nivel_riesgo === 'medio' ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200' :
                        'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200'
                      }`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            prediction.ai_analysis.impacto_ganaderia?.nivel_riesgo === 'critico' ? 'bg-red-200' :
                            prediction.ai_analysis.impacto_ganaderia?.nivel_riesgo === 'alto' ? 'bg-orange-200' :
                            prediction.ai_analysis.impacto_ganaderia?.nivel_riesgo === 'medio' ? 'bg-amber-100' :
                            'bg-green-100'
                          }`}>
                            <Milk className={`w-5 h-5 ${
                              prediction.ai_analysis.impacto_ganaderia?.nivel_riesgo === 'critico' ? 'text-red-600' :
                              prediction.ai_analysis.impacto_ganaderia?.nivel_riesgo === 'alto' ? 'text-orange-600' :
                              prediction.ai_analysis.impacto_ganaderia?.nivel_riesgo === 'medio' ? 'text-amber-600' :
                              'text-green-600'
                            }`} />
                          </div>
                          <h4 className="font-bold text-slate-800">Ganadería</h4>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${
                          prediction.ai_analysis.impacto_ganaderia?.nivel_riesgo === 'critico' ? 'bg-red-200 text-red-800' :
                          prediction.ai_analysis.impacto_ganaderia?.nivel_riesgo === 'alto' ? 'bg-orange-200 text-orange-800' :
                          prediction.ai_analysis.impacto_ganaderia?.nivel_riesgo === 'medio' ? 'bg-amber-200 text-amber-800' :
                          'bg-green-200 text-green-800'
                        }`}>
                          {prediction.ai_analysis.impacto_ganaderia?.nivel_riesgo || 'bajo'}
                        </span>
                      </div>
                      <div className="space-y-3 text-sm">
                        {prediction.ai_analysis.impacto_ganaderia?.animales_vulnerables && (
                          <div>
                            <p className="font-medium text-slate-700 mb-1">Animales vulnerables:</p>
                            <div className="flex flex-wrap gap-1">
                              {prediction.ai_analysis.impacto_ganaderia.animales_vulnerables.slice(0, 4).map((animal, idx) => (
                                <span key={idx} className="px-2 py-0.5 bg-white/60 rounded-full text-xs text-slate-700">
                                  {animal}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {prediction.ai_analysis.impacto_ganaderia?.acciones_recomendadas && (
                          <div className="pt-2 border-t border-slate-200">
                            <p className="font-medium text-slate-700 mb-1">Acciones:</p>
                            <ul className="space-y-1 text-xs text-slate-600">
                              {prediction.ai_analysis.impacto_ganaderia.acciones_recomendadas.slice(0, 3).map((accion, idx) => (
                                <li key={idx}>• {accion}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {prediction.ai_analysis.impacto_ganaderia?.consideraciones && (
                          <p className="text-xs text-slate-500 italic pt-1">
                            {prediction.ai_analysis.impacto_ganaderia.consideraciones}
                          </p>
                        )}
                      </div>
                    </motion.div>

                    {/* Salud Humana - Datos de Gemini */}
                    <motion.div 
                      className={`p-5 rounded-xl border ${
                        prediction.ai_analysis.impacto_salud?.nivel_riesgo === 'critico' ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-300' :
                        prediction.ai_analysis.impacto_salud?.nivel_riesgo === 'alto' ? 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-300' :
                        prediction.ai_analysis.impacto_salud?.nivel_riesgo === 'medio' ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200' :
                        'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200'
                      }`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            prediction.ai_analysis.impacto_salud?.nivel_riesgo === 'critico' ? 'bg-red-200' :
                            prediction.ai_analysis.impacto_salud?.nivel_riesgo === 'alto' ? 'bg-orange-200' :
                            prediction.ai_analysis.impacto_salud?.nivel_riesgo === 'medio' ? 'bg-amber-100' :
                            'bg-green-100'
                          }`}>
                            <Heart className={`w-5 h-5 ${
                              prediction.ai_analysis.impacto_salud?.nivel_riesgo === 'critico' ? 'text-red-600' :
                              prediction.ai_analysis.impacto_salud?.nivel_riesgo === 'alto' ? 'text-orange-600' :
                              prediction.ai_analysis.impacto_salud?.nivel_riesgo === 'medio' ? 'text-amber-600' :
                              'text-green-600'
                            }`} />
                          </div>
                          <h4 className="font-bold text-slate-800">Salud</h4>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${
                          prediction.ai_analysis.impacto_salud?.nivel_riesgo === 'critico' ? 'bg-red-200 text-red-800' :
                          prediction.ai_analysis.impacto_salud?.nivel_riesgo === 'alto' ? 'bg-orange-200 text-orange-800' :
                          prediction.ai_analysis.impacto_salud?.nivel_riesgo === 'medio' ? 'bg-amber-200 text-amber-800' :
                          'bg-green-200 text-green-800'
                        }`}>
                          {prediction.ai_analysis.impacto_salud?.nivel_riesgo || 'bajo'}
                        </span>
                      </div>
                      <div className="space-y-3 text-sm">
                        {prediction.ai_analysis.impacto_salud?.poblacion_vulnerable && (
                          <div>
                            <p className="font-medium text-slate-700 mb-1">Población vulnerable:</p>
                            <div className="flex flex-wrap gap-1">
                              {prediction.ai_analysis.impacto_salud.poblacion_vulnerable.slice(0, 4).map((grupo, idx) => (
                                <span key={idx} className="px-2 py-0.5 bg-white/60 rounded-full text-xs text-slate-700 flex items-center gap-1">
                                  {grupo.toLowerCase().includes('niño') && <Baby className="w-3 h-3" />}
                                  {grupo.toLowerCase().includes('adulto') && <Users className="w-3 h-3" />}
                                  {grupo}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {prediction.ai_analysis.impacto_salud?.precauciones && (
                          <div className="pt-2 border-t border-slate-200">
                            <p className="font-medium text-slate-700 mb-1">Precauciones:</p>
                            <ul className="space-y-1 text-xs text-slate-600">
                              {prediction.ai_analysis.impacto_salud.precauciones.slice(0, 3).map((precaucion, idx) => (
                                <li key={idx}>• {precaucion}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {prediction.ai_analysis.impacto_salud?.sintomas_vigilar?.length > 0 && (
                          <div className="pt-1">
                            <p className="text-xs text-slate-500">
                              <strong>Vigilar:</strong> {prediction.ai_analysis.impacto_salud.sintomas_vigilar.slice(0, 3).join(", ")}
                            </p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </div>

                  {/* Factores de Riesgo y Protección */}
                  <div className="grid md:grid-cols-2 gap-4 mb-6">
                    {/* Factores de Riesgo */}
                    {prediction.ai_analysis.factores_riesgo?.length > 0 && (
                      <motion.div 
                        className="p-4 bg-red-50 rounded-xl border border-red-200"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                      >
                        <h5 className="font-bold text-red-800 mb-3 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          Factores de Riesgo
                        </h5>
                        <div className="space-y-2">
                          {prediction.ai_analysis.factores_riesgo.slice(0, 4).map((factor, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-sm">
                              <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                                factor.impacto === 'alto' ? 'bg-red-200 text-red-800' :
                                factor.impacto === 'medio' ? 'bg-amber-200 text-amber-800' :
                                'bg-slate-200 text-slate-700'
                              }`}>
                                {factor.impacto?.toUpperCase()}
                              </span>
                              <span className="text-red-700">{factor.factor}</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {/* Factores de Protección */}
                    {prediction.ai_analysis.factores_proteccion?.length > 0 && (
                      <motion.div 
                        className="p-4 bg-emerald-50 rounded-xl border border-emerald-200"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                      >
                        <h5 className="font-bold text-emerald-800 mb-3 flex items-center gap-2">
                          <Shield className="w-4 h-4" />
                          Factores de Protección
                        </h5>
                        <div className="space-y-2">
                          {prediction.ai_analysis.factores_proteccion.slice(0, 4).map((factor, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-sm">
                              <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                                factor.impacto === 'alto' ? 'bg-emerald-200 text-emerald-800' :
                                factor.impacto === 'medio' ? 'bg-teal-200 text-teal-800' :
                                'bg-slate-200 text-slate-700'
                              }`}>
                                {factor.impacto?.toUpperCase()}
                              </span>
                              <span className="text-emerald-700">{factor.factor}</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Horas Críticas */}
                  {prediction.ai_analysis.horas_criticas?.length > 0 && (
                    <motion.div 
                      className="p-4 bg-slate-50 rounded-xl"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <h5 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-600" />
                        Horas Críticas (Mayor Riesgo)
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {prediction.ai_analysis.horas_criticas.slice(0, 8).map((hora, idx) => (
                          <div 
                            key={idx} 
                            className={`px-3 py-2 rounded-lg text-sm font-medium ${
                              hora.riesgo === 'alto' ? 'bg-red-100 text-red-800 border border-red-200' :
                              hora.riesgo === 'medio' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                              'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            <span className="font-bold">{hora.hora}</span>
                            <span className="ml-2 opacity-75">{hora.temperatura_esperada?.toFixed(1)}°C</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Tipo de Helada */}
                  {prediction.ai_analysis.tipo_helada_probable && prediction.ai_analysis.tipo_helada_probable !== 'ninguna' && (
                    <motion.div 
                      className="mt-4 p-4 bg-indigo-50 rounded-xl border border-indigo-200"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <div className="flex items-center gap-3">
                        <Brain className="w-5 h-5 text-indigo-600" />
                        <div>
                          <span className="text-sm text-indigo-600">Tipo de helada probable:</span>
                          <span className="ml-2 font-bold text-indigo-800 capitalize">
                            {prediction.ai_analysis.tipo_helada_probable}
                          </span>
                          <p className="text-xs text-indigo-600 mt-1">
                            {prediction.ai_analysis.tipo_helada_probable === 'radiativa' && 
                              'Se forma por pérdida de calor nocturno con cielo despejado y viento bajo.'}
                            {prediction.ai_analysis.tipo_helada_probable === 'advectiva' && 
                              'Causada por masas de aire frío que ingresan a la zona.'}
                            {prediction.ai_analysis.tipo_helada_probable === 'mixta' && 
                              'Combinación de condiciones radiativas y advectivas.'}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatedCard>
              )}

              {/* Métricas Actuales */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  icon={Thermometer}
                  label="Temperatura"
                  value={prediction.current_conditions?.temperature?.toFixed(1)}
                  unit="°C"
                  gradient="bg-gradient-to-br from-blue-500 to-blue-600 text-white"
                  delay={0.1}
                />
                <MetricCard
                  icon={Droplets}
                  label="Humedad"
                  value={prediction.current_conditions?.humidity}
                  unit="%"
                  gradient="bg-gradient-to-br from-cyan-500 to-teal-500 text-white"
                  delay={0.2}
                />
                <MetricCard
                  icon={Wind}
                  label="Viento"
                  value={prediction.current_conditions?.wind_speed?.toFixed(1)}
                  unit="km/h"
                  gradient="bg-gradient-to-br from-slate-500 to-slate-600 text-white"
                  delay={0.3}
                />
                <MetricCard
                  icon={Mountain}
                  label="Elevación"
                  value={prediction.location?.elevation}
                  unit="m"
                  gradient="bg-gradient-to-br from-indigo-500 to-purple-600 text-white"
                  delay={0.4}
                />
              </div>

              {/* Gráfico de Pronóstico */}
              <AnimatedCard className="p-6" delay={0.5}>
                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <Activity className="w-6 h-6 text-indigo-600" />
                  Pronóstico Próximas 24 Horas
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={prepareChartData()}>
                      <defs>
                        <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="humGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="hora" 
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        axisLine={{ stroke: '#d1d5db' }}
                      />
                      <YAxis 
                        yAxisId="temp"
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        axisLine={{ stroke: '#d1d5db' }}
                        domain={['dataMin - 2', 'dataMax + 2']}
                      />
                      <YAxis 
                        yAxisId="hum"
                        orientation="right"
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        axisLine={{ stroke: '#d1d5db' }}
                        domain={[0, 100]}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <ReferenceLine yAxisId="temp" y={0} stroke="#ef4444" strokeWidth={2} strokeDasharray="8 4" label={{ value: 'Helada', fill: '#ef4444', fontSize: 12 }} />
                      <ReferenceLine yAxisId="temp" y={4} stroke="#f59e0b" strokeWidth={1} strokeDasharray="4 4" label={{ value: 'Riesgo', fill: '#f59e0b', fontSize: 10 }} />
                      <Area 
                        yAxisId="temp"
                        type="monotone" 
                        dataKey="Temperatura" 
                        stroke="#3b82f6" 
                        strokeWidth={3} 
                        fill="url(#tempGradient)"
                        dot={{ fill: '#3b82f6', strokeWidth: 2, r: 3 }}
                        activeDot={{ r: 6, fill: '#3b82f6' }}
                      />
                      <Area 
                        yAxisId="hum"
                        type="monotone" 
                        dataKey="Humedad" 
                        stroke="#06b6d4" 
                        strokeWidth={2} 
                        fill="url(#humGradient)"
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-6 mt-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-1 bg-blue-500 rounded" />
                    <span className="text-slate-600">Temperatura (°C)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-1 bg-cyan-500 rounded" />
                    <span className="text-slate-600">Humedad (%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5 bg-red-500 rounded" style={{ borderStyle: 'dashed' }} />
                    <span className="text-slate-600">Umbral Helada (0°C)</span>
                  </div>
                </div>
              </AnimatedCard>

              {/* Footer de Información */}
              <AnimatedCard className="p-5 bg-slate-50" delay={0.6}>
                <div className="grid md:grid-cols-3 gap-4 text-sm text-slate-600">
                  <div>
                    <p className="font-semibold text-slate-800 mb-1">Modelo ML</p>
                    <p>Random Forest Multiclase v{prediction.model_info?.version}</p>
                    <p>Features con Lags: {prediction.model_info?.lag_hours?.join(", ")}h</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 mb-1">Fuentes de Datos</p>
                    <p>Clima: {prediction.data_sources?.weather}</p>
                    <p>IA: {prediction.data_sources?.ai_analysis}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 mb-1">Cobertura</p>
                    <p>{prediction.model_info?.geographic_coverage}</p>
                    <p>Datos: {prediction.data_sources?.training_data}</p>
                  </div>
                </div>
              </AnimatedCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading State */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            >
              <motion.div
                className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4"
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <CloudSnow className="w-16 h-16 text-blue-600" />
                </motion.div>
                <p className="text-xl font-semibold text-slate-800">Analizando condiciones...</p>
                <p className="text-slate-500">Consultando modelo ML y datos meteorológicos</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default EnhancedFrostPrediction_V3;
