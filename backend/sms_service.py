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
    
    def _build_prediction_message_minimal(self, data: Dict) -> str:
        """Versión MÍNIMA con emojis (intento < 160 chars)."""
        risk_class = data.get("ml_prediction_v2", {}).get("prediction", {}).get("class_name", "?")
        temp = data.get("current_conditions", {}).get("temperature", "?")
        forecast = data.get("hourly_forecast", [])
        
        # Emojis minimalistas
        emoji = {"No Helada": "✓", "Leve": "!", "Moderada": "!!", "Severa": "!!!"}[risk_class] if risk_class in ["No Helada", "Leve", "Moderada", "Severa"] else "?"
        
        # Pronósticos ultra-cortos
        f12 = self._get_temp_at_hour(forecast, 12)
        f24 = self._get_temp_at_hour(forecast, 24)
        
        now = datetime.now()
        message = f"""WayraFrost {emoji}
{risk_class}
Ahora:{temp}C
12h:{f12}C 24h:{f24}C
{now.strftime('%d/%m %H:%M')}"""
        
        return message.strip()
    
    def _build_prediction_message_no_emoji(self, data: Dict) -> str:
        """Versión SIN emojis para máxima compatibilidad."""
        risk_class = data.get("ml_prediction_v2", {}).get("prediction", {}).get("class_name", "Desconocido")
        temp = data.get("current_conditions", {}).get("temperature", "N/A")
        forecast = data.get("hourly_forecast", [])
        
        f12 = self._get_temp_at_hour(forecast, 12)
        f24 = self._get_temp_at_hour(forecast, 24)
        
        now = datetime.now()
        
        # Formato ultra-compacto sin emojis
        message = f"""WayraFrost Alerta
RIESGO: {risk_class}
Temp: {temp}C
12h: {f12}C
24h: {f24}C
{now.strftime('%d/%m %H:%M')}
wayrafrost.app"""
        
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
