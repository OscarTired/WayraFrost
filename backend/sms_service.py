"""
Servicio de envío de SMS con Twilio para alertas de heladas.
Versión ULTRA-OPTIMIZADA para Twilio Trial (máx 3 segmentos SMS = 210 chars).
"""

import os
from typing import Dict, Optional
import logging
from datetime import datetime

try:
    from twilio.rest import Client
    TWILIO_AVAILABLE = True
except ImportError:
    TWILIO_AVAILABLE = False
    Client = None

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SMSService:
    """Servicio para envío de alertas SMS con Twilio."""
    
    def __init__(self):
        self.account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        self.auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        self.twilio_number = os.getenv("TWILIO_PHONE_NUMBER")
        self.client = None
        self.initialized = False
        
        if TWILIO_AVAILABLE and self.account_sid and self.auth_token and self.twilio_number:
            try:
                self.client = Client(self.account_sid, self.auth_token)
                self.initialized = True
                logger.info("✓ Servicio SMS Twilio inicializado correctamente")
            except Exception as e:
                logger.error(f"Error inicializando Twilio: {e}")
        else:
            if not TWILIO_AVAILABLE:
                logger.warning("Twilio SDK no instalado. Instale con: pip install twilio")
            else:
                logger.warning("Credenciales de Twilio no configuradas en .env")
    
    def send_frost_alert(self, phone_number: str, prediction_data: Dict) -> Dict:
        """
        Envía alerta de helada por SMS (ULTRA-COMPACTO para Trial: máx 210 chars).
        """
        if not self.initialized:
            return {
                "success": False,
                "error": "Servicio SMS no disponible",
                "message": "Twilio no está configurado correctamente"
            }
        
        try:
            # Validar número
            if not phone_number.startswith("+51"):
                phone_number = f"+51{phone_number.lstrip('+')}"
            
            # Construir mensaje según disponibilidad
            is_available = prediction_data.get("prediction_available", False)
            
            if is_available:
                message = self._build_prediction_message_minimal(prediction_data)
            else:
                message = self._build_unavailable_message_minimal(prediction_data)
            
            # Verificar longitud REAL con emojis
            # Cada emoji cuenta como ~3-4 caracteres en SMS
            # Límite Trial: 3 segmentos = 210 caracteres con emojis
            if len(message) > 160:  # Límite conservador
                logger.warning(f"Mensaje largo ({len(message)} chars), usando versión sin emojis")
                if is_available:
                    message = self._build_prediction_message_no_emoji(prediction_data)
                else:
                    message = self._build_unavailable_message_no_emoji(prediction_data)
            
            # Log de debugging
            logger.info(f"📱 Enviando SMS:")
            logger.info(f"   Desde: {self.twilio_number}")
            logger.info(f"   Hacia: {phone_number}")
            logger.info(f"   Longitud: {len(message)} caracteres")
            logger.info(f"   Preview: {message[:80]}...")
            
            # Enviar SMS
            sms = self.client.messages.create(
                body=message,
                from_=self.twilio_number,
                to=phone_number
            )
            
            logger.info(f"✓ SMS enviado exitosamente")
            logger.info(f"   SID: {sms.sid}")
            logger.info(f"   Status: {sms.status}")
            
            return {
                "success": True,
                "message_sid": sms.sid,
                "phone_number": phone_number,
                "message_length": len(message),
                "status": sms.status,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"❌ Error enviando SMS: {e}")
            logger.error(f"   Tipo de error: {type(e).__name__}")
            import traceback
            logger.error(traceback.format_exc())
            
            return {
                "success": False,
                "error": str(e),
                "phone_number": phone_number
            }
    
    def _get_combined_classification(self, data: Dict) -> str:
        """Obtiene la clasificación combinada (más conservadora entre ML y API)."""
        ml_class = data.get("ml_prediction_v2", {}).get("prediction", {}).get("class_name", "Sin Riesgo")
        api_class = data.get("ai_analysis", {}).get("clasificacion_final")
        
        if not api_class:
            return ml_class
        
        # Usar la más conservadora (mayor riesgo)
        risk_order = {"Sin Riesgo": 0, "Riesgo": 1, "Moderada": 2, "Severa": 3}
        return api_class if risk_order.get(api_class, 0) >= risk_order.get(ml_class, 0) else ml_class
    
    def _get_min_temp_forecast(self, forecast: list) -> tuple:
        """Obtiene temperatura mínima y hora del pronóstico."""
        if not forecast:
            return None, None
        
        min_temp = float('inf')
        min_hour = None
        
        for i, hour_data in enumerate(forecast[:24]):  # Próximas 24h
            temp = hour_data.get("temperature")
            if temp is not None and temp < min_temp:
                min_temp = temp
                min_hour = hour_data.get("time", "")
        
        if min_temp == float('inf'):
            return None, None
        
        # Extraer solo la hora
        if min_hour and "T" in min_hour:
            min_hour = min_hour.split("T")[1][:5]  # "HH:MM"
        
        return min_temp, min_hour
    
    def _build_prediction_message_minimal(self, data: Dict) -> str:
        """Versión MÍNIMA con emojis (< 160 chars) - Clasificación COMBINADA."""
        # Clasificación combinada del sistema
        risk_class = self._get_combined_classification(data)
        temp = data.get("current_conditions", {}).get("temperature", "?")
        forecast = data.get("hourly_forecast", [])
        ai_analysis = data.get("ai_analysis", {})
        
        # Emojis según riesgo
        emoji_map = {"Sin Riesgo": "✓", "Riesgo": "⚠", "Moderada": "🧊", "Severa": "❄"}
        emoji = emoji_map.get(risk_class, "?")
        
        # Temperatura mínima esperada
        min_temp, min_hour = self._get_min_temp_forecast(forecast)
        
        # Probabilidad de helada
        prob = ai_analysis.get("probabilidad_estimada", "")
        
        now = datetime.now()
        
        # Formatear temperatura mínima
        min_temp_str = f"{min_temp:.1f}" if min_temp is not None else "?"
        min_hour_str = min_hour if min_hour else "?"
        
        # Construir mensaje según nivel de riesgo (~150 chars)
        if risk_class == "Sin Riesgo":
            message = f"""WayraFrost {emoji}
{risk_class}
Ahora:{temp}C
Min:{min_temp_str}C
{now.strftime('%d/%m %H:%M')}"""
        else:
            # Con riesgo: agregar probabilidad y hora crítica
            message = f"""WayraFrost {emoji}
{risk_class}
Prob:{prob}%
Ahora:{temp}C Min:{min_temp_str}C
Riesgo:{min_hour_str}
{now.strftime('%d/%m %H:%M')}"""
        
        return message.strip()
    
    def _build_prediction_message_no_emoji(self, data: Dict) -> str:
        """Versión SIN emojis - Clasificación COMBINADA."""
        # Clasificación combinada del sistema
        risk_class = self._get_combined_classification(data)
        temp = data.get("current_conditions", {}).get("temperature", "N/A")
        forecast = data.get("hourly_forecast", [])
        ai_analysis = data.get("ai_analysis", {})
        
        # Temperatura mínima esperada
        min_temp, min_hour = self._get_min_temp_forecast(forecast)
        min_temp_str = f"{min_temp:.1f}" if min_temp is not None else "?"
        
        # Probabilidad de helada
        prob = ai_analysis.get("probabilidad_estimada", "")
        
        now = datetime.now()
        
        # Formato sin emojis (~140 chars)
        if risk_class == "Sin Riesgo":
            message = f"""WayraFrost
{risk_class}
Ahora:{temp}C Min:{min_temp_str}C
{now.strftime('%d/%m %H:%M')}"""
        else:
            message = f"""WayraFrost ALERTA
{risk_class} Prob:{prob}%
Ahora:{temp}C Min:{min_temp_str}C
Critico:{min_hour}
{now.strftime('%d/%m %H:%M')}"""
        
        return message.strip()
    
    def _build_unavailable_message_minimal(self, data: Dict) -> str:
        """Mensaje corto para ubicación fuera de cobertura (con emojis)."""
        try:
            from weather_service import weather_service
            lat = data.get("requested_location", {}).get("latitude")
            lon = data.get("requested_location", {}).get("longitude")
            if lat and lon:
                weather = weather_service.get_current_weather(lat, lon)
                temp = weather.get("temperature", "?")
            else:
                temp = "?"
        except:
            temp = "?"
        
        dist = data.get("distance_from_station_km", 0)
        now = datetime.now()
        
        message = f"""WayraFrost
Temp:{temp}C
Fuera de cobertura
{dist:.0f}km de estacion
{now.strftime('%d/%m %H:%M')}"""
        
        return message.strip()
    
    def _build_unavailable_message_no_emoji(self, data: Dict) -> str:
        """Versión SIN emojis para ubicación fuera de cobertura."""
        try:
            from weather_service import weather_service
            lat = data.get("requested_location", {}).get("latitude")
            lon = data.get("requested_location", {}).get("longitude")
            if lat and lon:
                weather = weather_service.get_current_weather(lat, lon)
                temp = weather.get("temperature", "?")
            else:
                temp = "?"
        except:
            temp = "?"
        
        dist = data.get("distance_from_station_km", 0)
        now = datetime.now()
        
        message = f"""WayraFrost
Temp: {temp}C
FUERA DE COBERTURA
{dist:.0f}km de estacion
Solo valido en Junin
{now.strftime('%d/%m %H:%M')}"""
        
        return message.strip()
    
    def _get_temp_at_hour(self, forecast: list, hours: int) -> str:
        """Obtiene temperatura en X horas (formato corto)."""
        if not forecast or len(forecast) < hours:
            return "?"
        
        temp = forecast[hours - 1].get("temperature", "?")
        
        if isinstance(temp, (int, float)):
            return f"{temp:.1f}"
        return "?"
    
    def is_available(self) -> bool:
        """Verifica si el servicio está disponible."""
        return self.initialized


# Instancia global del servicio
sms_service = SMSService()
