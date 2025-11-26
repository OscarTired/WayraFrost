"""
Servicio para obtener datos meteorológicos de múltiples APIs gratuitas.
APIs utilizadas:
- Open-Meteo (principal, gratuita, sin API key)
- Weatherbit (backup, requiere API key gratuita)
"""

import requests
from datetime import datetime, timedelta
from typing import Dict, Optional, List
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class WeatherService:
    """Servicio unificado para obtener datos meteorológicos de múltiples fuentes."""
    
    def __init__(self):
        self.open_meteo_base = "https://api.open-meteo.com/v1"
        self.cache = {}
        self.cache_duration = timedelta(minutes=10)
    
    def get_current_weather(self, latitude: float, longitude: float) -> Dict:
        """
        Obtiene datos meteorológicos actuales de Open-Meteo.
        Esta API es completamente gratuita y no requiere API key.
        """
        cache_key = f"current_{latitude}_{longitude}"
        cached = self._get_from_cache(cache_key)
        if cached:
            return cached
        
        try:
            url = f"{self.open_meteo_base}/forecast"
            params = {
                "latitude": latitude,
                "longitude": longitude,
                "current": [
                    "temperature_2m",
                    "relative_humidity_2m", 
                    "apparent_temperature",
                    "precipitation",
                    "rain",
                    "snowfall",
                    "weather_code",
                    "cloud_cover",
                    "pressure_msl",
                    "surface_pressure",
                    "wind_speed_10m",
                    "wind_direction_10m",
                    "wind_gusts_10m"
                ],
                "timezone": "auto"
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            current = data.get("current", {})
            result = {
                "source": "open-meteo",
                "timestamp": current.get("time"),
                "temperature": current.get("temperature_2m"),
                "apparent_temperature": current.get("apparent_temperature"),
                "humidity": current.get("relative_humidity_2m"),
                "pressure_msl": current.get("pressure_msl"),
                "surface_pressure": current.get("surface_pressure"),
                "wind_speed": current.get("wind_speed_10m"),
                "wind_direction": current.get("wind_direction_10m"),
                "wind_gusts": current.get("wind_gusts_10m"),
                "precipitation": current.get("precipitation"),
                "rain": current.get("rain"),
                "snowfall": current.get("snowfall"),
                "cloud_cover": current.get("cloud_cover"),
                "weather_code": current.get("weather_code"),
                "timezone": data.get("timezone"),
                "elevation": data.get("elevation")
            }
            
            self._save_to_cache(cache_key, result)
            return result
            
        except Exception as e:
            logger.error(f"Error obteniendo datos actuales de Open-Meteo: {e}")
            return {"error": str(e), "source": "open-meteo"}
    
    def get_hourly_forecast(self, latitude: float, longitude: float, hours: int = 48) -> Dict:
        """
        Obtiene pronóstico horario de Open-Meteo.
        Incluye datos específicos para predicción de heladas.
        """
        cache_key = f"hourly_{latitude}_{longitude}_{hours}"
        cached = self._get_from_cache(cache_key)
        if cached:
            return cached
            
        try:
            url = f"{self.open_meteo_base}/forecast"
            params = {
                "latitude": latitude,
                "longitude": longitude,
                "hourly": [
                    "temperature_2m",
                    "relative_humidity_2m",
                    "dew_point_2m",
                    "apparent_temperature",
                    "precipitation_probability",
                    "precipitation",
                    "rain",
                    "snowfall",
                    "snow_depth",
                    "weather_code",
                    "pressure_msl",
                    "surface_pressure",
                    "cloud_cover",
                    "cloud_cover_low",
                    "cloud_cover_mid",
                    "cloud_cover_high",
                    "visibility",
                    "wind_speed_10m",
                    "wind_direction_10m",
                    "wind_gusts_10m",
                    "soil_temperature_0cm",
                    "soil_temperature_6cm",
                    "soil_moisture_0_to_1cm",
                    "freezing_level_height",
                    "shortwave_radiation",
                    "direct_radiation",
                    "diffuse_radiation",
                    "direct_normal_irradiance",
                    "terrestrial_radiation"
                ],
                "forecast_hours": hours,
                "timezone": "auto"
            }
            
            response = requests.get(url, params=params, timeout=15)
            response.raise_for_status()
            data = response.json()
            
            hourly = data.get("hourly", {})
            times = hourly.get("time", [])
            
            # Estructurar datos horarios
            forecast_data = []
            for i, time in enumerate(times):
                hour_data = {
                    "time": time,
                    "temperature": hourly.get("temperature_2m", [None])[i] if i < len(hourly.get("temperature_2m", [])) else None,
                    "humidity": hourly.get("relative_humidity_2m", [None])[i] if i < len(hourly.get("relative_humidity_2m", [])) else None,
                    "dew_point": hourly.get("dew_point_2m", [None])[i] if i < len(hourly.get("dew_point_2m", [])) else None,
                    "apparent_temperature": hourly.get("apparent_temperature", [None])[i] if i < len(hourly.get("apparent_temperature", [])) else None,
                    "precipitation_probability": hourly.get("precipitation_probability", [None])[i] if i < len(hourly.get("precipitation_probability", [])) else None,
                    "precipitation": hourly.get("precipitation", [None])[i] if i < len(hourly.get("precipitation", [])) else None,
                    "snowfall": hourly.get("snowfall", [None])[i] if i < len(hourly.get("snowfall", [])) else None,
                    "snow_depth": hourly.get("snow_depth", [None])[i] if i < len(hourly.get("snow_depth", [])) else None,
                    "pressure_msl": hourly.get("pressure_msl", [None])[i] if i < len(hourly.get("pressure_msl", [])) else None,
                    "surface_pressure": hourly.get("surface_pressure", [None])[i] if i < len(hourly.get("surface_pressure", [])) else None,
                    "cloud_cover": hourly.get("cloud_cover", [None])[i] if i < len(hourly.get("cloud_cover", [])) else None,
                    "cloud_cover_low": hourly.get("cloud_cover_low", [None])[i] if i < len(hourly.get("cloud_cover_low", [])) else None,
                    "visibility": hourly.get("visibility", [None])[i] if i < len(hourly.get("visibility", [])) else None,
                    "wind_speed": hourly.get("wind_speed_10m", [None])[i] if i < len(hourly.get("wind_speed_10m", [])) else None,
                    "wind_direction": hourly.get("wind_direction_10m", [None])[i] if i < len(hourly.get("wind_direction_10m", [])) else None,
                    "wind_gusts": hourly.get("wind_gusts_10m", [None])[i] if i < len(hourly.get("wind_gusts_10m", [])) else None,
                    "soil_temperature_0cm": hourly.get("soil_temperature_0cm", [None])[i] if i < len(hourly.get("soil_temperature_0cm", [])) else None,
                    "soil_temperature_6cm": hourly.get("soil_temperature_6cm", [None])[i] if i < len(hourly.get("soil_temperature_6cm", [])) else None,
                    "soil_moisture": hourly.get("soil_moisture_0_to_1cm", [None])[i] if i < len(hourly.get("soil_moisture_0_to_1cm", [])) else None,
                    "freezing_level": hourly.get("freezing_level_height", [None])[i] if i < len(hourly.get("freezing_level_height", [])) else None,
                    "shortwave_radiation": hourly.get("shortwave_radiation", [None])[i] if i < len(hourly.get("shortwave_radiation", [])) else None,
                    "direct_radiation": hourly.get("direct_radiation", [None])[i] if i < len(hourly.get("direct_radiation", [])) else None,
                    "terrestrial_radiation": hourly.get("terrestrial_radiation", [None])[i] if i < len(hourly.get("terrestrial_radiation", [])) else None,
                    "weather_code": hourly.get("weather_code", [None])[i] if i < len(hourly.get("weather_code", [])) else None,
                }
                forecast_data.append(hour_data)
            
            result = {
                "source": "open-meteo",
                "latitude": data.get("latitude"),
                "longitude": data.get("longitude"),
                "elevation": data.get("elevation"),
                "timezone": data.get("timezone"),
                "forecast": forecast_data
            }
            
            self._save_to_cache(cache_key, result)
            return result
            
        except Exception as e:
            logger.error(f"Error obteniendo pronóstico horario: {e}")
            return {"error": str(e), "source": "open-meteo"}
    
    def get_historical_weather(self, latitude: float, longitude: float, 
                               start_date: str, end_date: str) -> Dict:
        """
        Obtiene datos históricos de Open-Meteo Archive.
        Útil para análisis de patrones de heladas.
        
        Args:
            start_date: Fecha inicio en formato YYYY-MM-DD
            end_date: Fecha fin en formato YYYY-MM-DD
        """
        try:
            url = "https://archive-api.open-meteo.com/v1/archive"
            params = {
                "latitude": latitude,
                "longitude": longitude,
                "start_date": start_date,
                "end_date": end_date,
                "hourly": [
                    "temperature_2m",
                    "relative_humidity_2m",
                    "dew_point_2m",
                    "precipitation",
                    "snowfall",
                    "surface_pressure",
                    "cloud_cover",
                    "wind_speed_10m",
                    "wind_direction_10m",
                    "soil_temperature_0_to_7cm",
                    "shortwave_radiation"
                ],
                "timezone": "auto"
            }
            
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            return response.json()
            
        except Exception as e:
            logger.error(f"Error obteniendo datos históricos: {e}")
            return {"error": str(e)}
    
    def get_frost_risk_data(self, latitude: float, longitude: float) -> Dict:
        """
        Obtiene datos específicos para análisis de riesgo de heladas.
        Combina datos actuales con pronóstico de las próximas horas críticas (noche/madrugada).
        """
        try:
            # Obtener datos actuales
            current = self.get_current_weather(latitude, longitude)
            
            # Obtener pronóstico de 48 horas
            forecast = self.get_hourly_forecast(latitude, longitude, hours=48)
            
            if "error" in current or "error" in forecast:
                return {
                    "error": current.get("error") or forecast.get("error"),
                    "partial_data": True
                }
            
            # Identificar horas de mayor riesgo (noche: 18:00 - 08:00)
            night_hours = []
            if "forecast" in forecast:
                for hour_data in forecast["forecast"]:
                    if hour_data.get("time"):
                        try:
                            dt = datetime.fromisoformat(hour_data["time"])
                            if dt.hour >= 18 or dt.hour <= 8:
                                night_hours.append(hour_data)
                        except:
                            pass
            
            # Calcular estadísticas de riesgo
            temps = [h.get("temperature") for h in night_hours if h.get("temperature") is not None]
            soil_temps = [h.get("soil_temperature_0cm") for h in night_hours if h.get("soil_temperature_0cm") is not None]
            dew_points = [h.get("dew_point") for h in night_hours if h.get("dew_point") is not None]
            
            min_temp = min(temps) if temps else None
            min_soil_temp = min(soil_temps) if soil_temps else None
            
            # Determinar horas con riesgo de helada (temp < 2°C)
            frost_risk_hours = [h for h in night_hours if h.get("temperature") is not None and h.get("temperature") < 2]
            
            return {
                "current": current,
                "forecast_summary": {
                    "total_hours": len(forecast.get("forecast", [])),
                    "night_hours_count": len(night_hours),
                    "frost_risk_hours_count": len(frost_risk_hours),
                    "min_temperature_forecast": min_temp,
                    "min_soil_temperature": min_soil_temp,
                    "frost_risk_hours": frost_risk_hours[:12]  # Primeras 12 horas con riesgo
                },
                "elevation": forecast.get("elevation"),
                "timezone": forecast.get("timezone"),
                "location": {
                    "latitude": latitude,
                    "longitude": longitude
                },
                "full_forecast": forecast.get("forecast", [])[:48]  # 48 horas
            }
            
        except Exception as e:
            logger.error(f"Error en análisis de riesgo de heladas: {e}")
            return {"error": str(e)}
    
    def _get_from_cache(self, key: str) -> Optional[Dict]:
        """Obtiene datos del caché si no han expirado."""
        if key in self.cache:
            cached_time, data = self.cache[key]
            if datetime.now() - cached_time < self.cache_duration:
                return data
        return None
    
    def _save_to_cache(self, key: str, data: Dict):
        """Guarda datos en caché."""
        self.cache[key] = (datetime.now(), data)


class WeatherCodeInterpreter:
    """Interpreta códigos de clima WMO a texto descriptivo."""
    
    WMO_CODES = {
        0: "Cielo despejado",
        1: "Principalmente despejado",
        2: "Parcialmente nublado",
        3: "Nublado",
        45: "Neblina",
        48: "Neblina con escarcha",
        51: "Llovizna ligera",
        53: "Llovizna moderada",
        55: "Llovizna densa",
        56: "Llovizna helada ligera",
        57: "Llovizna helada densa",
        61: "Lluvia ligera",
        63: "Lluvia moderada",
        65: "Lluvia fuerte",
        66: "Lluvia helada ligera",
        67: "Lluvia helada fuerte",
        71: "Nevada ligera",
        73: "Nevada moderada",
        75: "Nevada fuerte",
        77: "Granos de nieve",
        80: "Chubascos ligeros",
        81: "Chubascos moderados",
        82: "Chubascos violentos",
        85: "Chubascos de nieve ligeros",
        86: "Chubascos de nieve fuertes",
        95: "Tormenta eléctrica",
        96: "Tormenta con granizo ligero",
        99: "Tormenta con granizo fuerte"
    }
    
    @classmethod
    def get_description(cls, code: int) -> str:
        return cls.WMO_CODES.get(code, f"Código desconocido: {code}")
    
    @classmethod
    def is_frost_favorable(cls, code: int) -> bool:
        """Determina si las condiciones favorecen heladas."""
        # Cielo despejado = mayor pérdida de calor por radiación
        favorable_codes = [0, 1]  # Despejado
        return code in favorable_codes


# Instancia global del servicio
weather_service = WeatherService()
