"""
Servicio de integración con Google Gemini AI para análisis
avanzado de predicción de heladas.
"""

import os
import json
from datetime import datetime
from typing import Dict, List, Optional
import logging

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    genai = None

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class GeminiService:
    """Servicio para análisis con Google Gemini AI."""
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.model = None
        self.initialized = False
        
        if GEMINI_AVAILABLE and self.api_key:
            try:
                genai.configure(api_key=self.api_key)
                # Usar gemini-pro o gemini-1.5-flash según disponibilidad
                self.model = genai.GenerativeModel('gemini-2.0-flash')
                self.initialized = True
                logger.info("✓ Gemini AI inicializado correctamente (modelo: gemini-2.0-flash)")
            except Exception as e:
                logger.error(f"Error inicializando Gemini: {e}")
        else:
            if not GEMINI_AVAILABLE:
                logger.warning("google-generativeai no instalado. Instale con: pip install google-generativeai")
            if not self.api_key:
                logger.warning("GEMINI_API_KEY no configurada")
    
    def analyze_frost_risk(self, weather_data: Dict, ml_prediction: Dict, 
                           location_name: str = "ubicación") -> Dict:
        """
        Analiza el riesgo de heladas usando Gemini AI.
        Combina datos meteorológicos con la predicción del modelo ML.
        """
        if not self.initialized:
            return self._generate_fallback_analysis(weather_data, ml_prediction)
        
        try:
            prompt = self._build_frost_analysis_prompt(weather_data, ml_prediction, location_name)
            logger.info("🧠 Enviando prompt a Gemini AI...")
            
            response = self.model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    temperature=0.3,
                    max_output_tokens=2048,
                )
            )
            
            logger.info("✓ Respuesta recibida de Gemini")
            # Parsear respuesta JSON
            response_text = response.text
            
            # Limpiar markdown si existe
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0]
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0]
            
            try:
                analysis = json.loads(response_text.strip())
            except json.JSONDecodeError:
                # Si no es JSON válido, estructurar la respuesta
                analysis = {
                    "resumen": response_text[:500],
                    "analisis_detallado": response_text,
                    "nivel_riesgo": ml_prediction.get("risk", {}).get("level", "medio"),
                    "confianza": "media",
                    "parsed_error": True
                }
            
            return {
                "success": True,
                "source": "gemini",
                "analysis": analysis,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error en análisis Gemini: {e}")
            return self._generate_fallback_analysis(weather_data, ml_prediction)
    
    def _build_frost_analysis_prompt(self, weather_data: Dict, ml_prediction: Dict, 
                                     location_name: str) -> str:
        """Construye el prompt para análisis de heladas."""
        
        current = weather_data.get("current", {})
        forecast_summary = weather_data.get("forecast_summary", {})
        elevation = weather_data.get("elevation", "desconocida")
        
        prompt = f"""Eres un experto agrometeorólogo especializado en predicción de heladas en zonas altoandinas.
Analiza los siguientes datos meteorológicos y la predicción de nuestro modelo de Machine Learning para proporcionar un análisis detallado del riesgo de heladas.

## DATOS DE LA UBICACIÓN: {location_name}
- Elevación: {elevation} metros sobre el nivel del mar
- Coordenadas: {weather_data.get('location', {}).get('latitude', 'N/A')}°, {weather_data.get('location', {}).get('longitude', 'N/A')}°

## CONDICIONES ACTUALES (Fuente: Open-Meteo)
- Temperatura actual: {current.get('temperature', 'N/A')}°C
- Sensación térmica: {current.get('apparent_temperature', 'N/A')}°C
- Humedad relativa: {current.get('humidity', 'N/A')}%
- Presión atmosférica: {current.get('surface_pressure', 'N/A')} hPa
- Velocidad del viento: {current.get('wind_speed', 'N/A')} km/h
- Dirección del viento: {current.get('wind_direction', 'N/A')}°
- Ráfagas de viento: {current.get('wind_gusts', 'N/A')} km/h
- Cobertura de nubes: {current.get('cloud_cover', 'N/A')}%
- Precipitación: {current.get('precipitation', 'N/A')} mm
- Nevada: {current.get('snowfall', 'N/A')} cm

## PRONÓSTICO PRÓXIMAS HORAS
- Horas analizadas (noche/madrugada): {forecast_summary.get('night_hours_count', 'N/A')}
- Horas con riesgo de helada: {forecast_summary.get('frost_risk_hours_count', 'N/A')}
- Temperatura mínima pronosticada: {forecast_summary.get('min_temperature_forecast', 'N/A')}°C
- Temperatura mínima del suelo: {forecast_summary.get('min_soil_temperature', 'N/A')}°C

## PREDICCIÓN DEL MODELO ML
- Probabilidad de helada: {ml_prediction.get('prediction', {}).get('probability', 0) * 100:.1f}%
- Predicción de helada: {"SÍ" if ml_prediction.get('prediction', {}).get('frost', False) else "NO"}
- Nivel de riesgo ML: {ml_prediction.get('risk', {}).get('level', 'N/A')}
- Confianza del modelo: {ml_prediction.get('prediction', {}).get('confidence', 0) * 100:.1f}%

## HORAS CRÍTICAS CON RIESGO DE HELADA
{self._format_frost_hours(forecast_summary.get('frost_risk_hours', []))}

Por favor, proporciona tu análisis en formato JSON con la siguiente estructura exacta:
{{
    "resumen_ejecutivo": "Resumen de 2-3 oraciones sobre el riesgo de helada",
    "nivel_riesgo_combinado": "bajo|medio|alto|muy_alto",
    "probabilidad_estimada": número entre 0 y 100,
    "confianza_analisis": "baja|media|alta",
    "factores_riesgo": [
        {{"factor": "nombre del factor", "impacto": "bajo|medio|alto", "descripcion": "explicación breve"}}
    ],
    "factores_proteccion": [
        {{"factor": "nombre del factor", "impacto": "bajo|medio|alto", "descripcion": "explicación breve"}}
    ],
    "horas_criticas": [
        {{"hora": "HH:MM", "temperatura_esperada": número, "riesgo": "bajo|medio|alto"}}
    ],
    "recomendaciones": [
        {{"prioridad": 1-5, "accion": "descripción de la acción recomendada", "urgencia": "inmediata|próximas_horas|preventiva"}}
    ],
    "analisis_meteorologico": "Análisis detallado de las condiciones que favorecen o protegen de heladas",
    "comparacion_modelo_apis": "Comparación entre la predicción ML y los datos de APIs meteorológicas",
    "tipo_helada_probable": "radiativa|advectiva|mixta|ninguna",
    "cultivos_vulnerables": ["lista de cultivos que serían más afectados"],
    "grafico_temperatura": {{
        "etiquetas": ["lista de horas"],
        "temperaturas": [lista de temperaturas],
        "linea_helada": 0
    }}
}}

Importante:
- Sé preciso y basado en los datos proporcionados
- Considera la elevación para ajustar umbrales
- Los datos de las APIs son de fuentes confiables (Open-Meteo)
- Prioriza la seguridad del agricultor
"""
        return prompt
    
    def _format_frost_hours(self, frost_hours: List[Dict]) -> str:
        """Formatea las horas con riesgo de helada para el prompt."""
        if not frost_hours:
            return "No se detectaron horas con riesgo inmediato de helada en el pronóstico."
        
        lines = []
        for hour in frost_hours[:10]:  # Máximo 10 horas
            time = hour.get("time", "N/A")
            temp = hour.get("temperature", "N/A")
            humidity = hour.get("humidity", "N/A")
            wind = hour.get("wind_speed", "N/A")
            soil_temp = hour.get("soil_temperature_0cm", "N/A")
            
            lines.append(f"- {time}: Temp={temp}°C, Humedad={humidity}%, Viento={wind}km/h, Suelo={soil_temp}°C")
        
        return "\n".join(lines)
    
    def _generate_fallback_analysis(self, weather_data: Dict, ml_prediction: Dict) -> Dict:
        """Genera un análisis básico cuando Gemini no está disponible."""
        
        current = weather_data.get("current", {})
        forecast_summary = weather_data.get("forecast_summary", {})
        ml_risk = ml_prediction.get("risk", {}).get("level", "medio")
        ml_prob = ml_prediction.get("prediction", {}).get("probability", 0.5)
        
        # Análisis básico basado en reglas
        temp = current.get("temperature")
        humidity = current.get("humidity")
        cloud_cover = current.get("cloud_cover")
        wind_speed = current.get("wind_speed")
        
        factores_riesgo = []
        factores_proteccion = []
        
        # Evaluar temperatura
        if temp is not None:
            if temp < 0:
                factores_riesgo.append({
                    "factor": "Temperatura bajo cero",
                    "impacto": "alto",
                    "descripcion": f"Temperatura actual de {temp}°C indica condiciones de helada activa"
                })
            elif temp < 4:
                factores_riesgo.append({
                    "factor": "Temperatura cercana a cero",
                    "impacto": "alto",
                    "descripcion": f"Temperatura de {temp}°C cerca del umbral de helada"
                })
            elif temp < 8:
                factores_riesgo.append({
                    "factor": "Temperatura baja",
                    "impacto": "medio",
                    "descripcion": f"Temperatura de {temp}°C podría descender durante la noche"
                })
            else:
                factores_proteccion.append({
                    "factor": "Temperatura moderada",
                    "impacto": "medio",
                    "descripcion": f"Temperatura de {temp}°C proporciona margen de seguridad"
                })
        
        # Evaluar cobertura de nubes
        if cloud_cover is not None:
            if cloud_cover < 20:
                factores_riesgo.append({
                    "factor": "Cielo despejado",
                    "impacto": "alto",
                    "descripcion": "Pérdida de calor por radiación máxima"
                })
            elif cloud_cover > 70:
                factores_proteccion.append({
                    "factor": "Cobertura de nubes",
                    "impacto": "alto",
                    "descripcion": f"{cloud_cover}% de nubes actúa como aislante térmico"
                })
        
        # Evaluar viento
        if wind_speed is not None:
            if wind_speed < 5:
                factores_riesgo.append({
                    "factor": "Viento muy bajo",
                    "impacto": "medio",
                    "descripcion": "Aire estancado favorece enfriamiento superficial"
                })
            elif wind_speed > 15:
                factores_proteccion.append({
                    "factor": "Viento moderado",
                    "impacto": "medio",
                    "descripcion": "Mezcla de aire previene inversión térmica"
                })
        
        # Evaluar humedad
        if humidity is not None and humidity > 80:
            factores_riesgo.append({
                "factor": "Humedad alta",
                "impacto": "medio",
                "descripcion": f"Humedad de {humidity}% aumenta riesgo de escarcha"
            })
        
        # Determinar nivel de riesgo combinado
        min_temp_forecast = forecast_summary.get("min_temperature_forecast")
        frost_hours_count = forecast_summary.get("frost_risk_hours_count", 0)
        
        if min_temp_forecast is not None and min_temp_forecast < -2:
            nivel_riesgo = "muy_alto"
            prob_estimada = 90
        elif min_temp_forecast is not None and min_temp_forecast < 0:
            nivel_riesgo = "alto"
            prob_estimada = 75
        elif frost_hours_count > 3 or ml_prob > 0.6:
            nivel_riesgo = "alto"
            prob_estimada = int(ml_prob * 100)
        elif frost_hours_count > 0 or ml_prob > 0.3:
            nivel_riesgo = "medio"
            prob_estimada = int(ml_prob * 100)
        else:
            nivel_riesgo = "bajo"
            prob_estimada = int(ml_prob * 100)
        
        # Recomendaciones basadas en nivel de riesgo
        recomendaciones = []
        if nivel_riesgo in ["alto", "muy_alto"]:
            recomendaciones = [
                {"prioridad": 1, "accion": "Activar sistemas de protección antiheladas inmediatamente", "urgencia": "inmediata"},
                {"prioridad": 2, "accion": "Verificar sistemas de riego para posible uso de agua como protección", "urgencia": "próximas_horas"},
                {"prioridad": 3, "accion": "Cubrir cultivos sensibles con mantas térmicas o plásticos", "urgencia": "próximas_horas"},
                {"prioridad": 4, "accion": "Monitorear temperatura cada hora durante la noche", "urgencia": "inmediata"},
            ]
        elif nivel_riesgo == "medio":
            recomendaciones = [
                {"prioridad": 1, "accion": "Preparar sistemas de protección para posible activación", "urgencia": "próximas_horas"},
                {"prioridad": 2, "accion": "Mantener vigilancia durante horas de madrugada (3-6 AM)", "urgencia": "preventiva"},
                {"prioridad": 3, "accion": "Verificar estado de cultivos más sensibles", "urgencia": "próximas_horas"},
            ]
        else:
            recomendaciones = [
                {"prioridad": 1, "accion": "Mantener monitoreo rutinario de condiciones", "urgencia": "preventiva"},
                {"prioridad": 2, "accion": "Revisar pronóstico para días siguientes", "urgencia": "preventiva"},
            ]
        
        # Generar datos para gráfico de temperatura
        forecast = weather_data.get("full_forecast", [])[:24]
        grafico_temp = {
            "etiquetas": [],
            "temperaturas": [],
            "linea_helada": 0
        }
        
        for hour_data in forecast:
            if hour_data.get("time") and hour_data.get("temperature") is not None:
                try:
                    dt = datetime.fromisoformat(hour_data["time"])
                    grafico_temp["etiquetas"].append(dt.strftime("%H:%M"))
                    grafico_temp["temperaturas"].append(hour_data["temperature"])
                except:
                    pass
        
        return {
            "success": True,
            "source": "fallback_rules",
            "analysis": {
                "resumen_ejecutivo": f"Análisis basado en reglas meteorológicas. Nivel de riesgo: {nivel_riesgo}. Se detectaron {frost_hours_count} horas con potencial riesgo de helada en las próximas 48 horas.",
                "nivel_riesgo_combinado": nivel_riesgo,
                "probabilidad_estimada": prob_estimada,
                "confianza_analisis": "media",
                "factores_riesgo": factores_riesgo,
                "factores_proteccion": factores_proteccion,
                "horas_criticas": self._extract_critical_hours(forecast_summary.get("frost_risk_hours", [])),
                "recomendaciones": recomendaciones,
                "analisis_meteorologico": f"Condiciones actuales: Temp {temp}°C, Humedad {humidity}%, Nubes {cloud_cover}%, Viento {wind_speed}km/h. Temperatura mínima pronosticada: {min_temp_forecast}°C.",
                "comparacion_modelo_apis": f"El modelo ML predice {ml_prob*100:.1f}% de probabilidad. Los datos de APIs muestran {frost_hours_count} horas con riesgo.",
                "tipo_helada_probable": self._determine_frost_type(current, forecast_summary),
                "cultivos_vulnerables": ["Papa", "Quinua", "Haba", "Maíz", "Cebada"],
                "grafico_temperatura": grafico_temp
            },
            "timestamp": datetime.now().isoformat()
        }
    
    def _extract_critical_hours(self, frost_hours: List[Dict]) -> List[Dict]:
        """Extrae horas críticas del pronóstico."""
        critical = []
        for hour in frost_hours[:8]:
            try:
                dt = datetime.fromisoformat(hour.get("time", ""))
                temp = hour.get("temperature", 0)
                
                if temp < -2:
                    riesgo = "alto"
                elif temp < 0:
                    riesgo = "alto"
                elif temp < 2:
                    riesgo = "medio"
                else:
                    riesgo = "bajo"
                
                critical.append({
                    "hora": dt.strftime("%H:%M"),
                    "fecha": dt.strftime("%Y-%m-%d"),
                    "temperatura_esperada": temp,
                    "riesgo": riesgo
                })
            except:
                pass
        
        return critical
    
    def _determine_frost_type(self, current: Dict, forecast: Dict) -> str:
        """Determina el tipo probable de helada."""
        cloud_cover = current.get("cloud_cover", 50)
        wind_speed = current.get("wind_speed", 5)
        
        # Helada radiativa: cielo despejado, viento bajo
        if cloud_cover < 30 and wind_speed < 10:
            return "radiativa"
        # Helada advectiva: asociada a masas de aire frío
        elif wind_speed > 20:
            return "advectiva"
        # Mixta: combinación de condiciones
        else:
            return "mixta"
    
    def is_available(self) -> bool:
        """Verifica si el servicio está disponible."""
        return self.initialized


# Instancia global del servicio
gemini_service = GeminiService()
