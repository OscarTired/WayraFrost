import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, AlertCircle, CheckCircle } from 'lucide-react';

// Fix para iconos de Leaflet en React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Icono personalizado para la estación
const stationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Icono para ubicación seleccionada
const selectedIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Componente interno para manejar clicks en el mapa
function MapClickHandler({ onLocationSelect }) {
  useMapEvents({
    click: (e) => {
      const { lat, lng } = e.latlng;
      onLocationSelect(lat, lng);
    },
  });
  return null;
}

const LocationMapSelector = ({ onLocationConfirm, stationInfo, phoneNumber }) => {
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const mapRef = useRef();

  // Coordenadas de la estación Huayao
  const stationPosition = stationInfo 
    ? [stationInfo.latitude, stationInfo.longitude]
    : [-12.0383, -75.3228];
  
  const coverageRadius = stationInfo?.valid_radius_km || 50;
  // Centro inicial del mapa (Perú - región Junín)
  const peruCenter = [-12.0, -75.5];

  const handleMapClick = async (lat, lng) => {
    setSelectedPosition([lat, lng]);
    setIsValidating(true);
    setValidationResult(null);

    try {
      const response = await fetch('http://localhost:5000/api/validate-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: lat, longitude: lng })
      });

      const data = await response.json();
      setValidationResult(data);
    } catch (error) {
      console.error('Error validando ubicación:', error);
      setValidationResult({
        is_valid: false,
        message: 'Error al validar la ubicación. Intenta nuevamente.'
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleConfirm = () => {
    if (validationResult?.is_valid && selectedPosition) {
      onLocationConfirm({
        latitude: selectedPosition[0],
        longitude: selectedPosition[1],
        name: `Ubicación personalizada (${selectedPosition[0].toFixed(4)}°, ${selectedPosition[1].toFixed(4)}°)`,
        isCustom: true
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Instrucciones */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Navigation className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h4 className="font-semibold text-blue-900 mb-1">Selecciona una ubicación en el mapa</h4>
            <p className="text-sm text-blue-800">
              Haz clic en cualquier punto del mapa. El sistema validará si está dentro del área de cobertura 
              ({coverageRadius} km desde Huayao).
              {phoneNumber && (
                <span className="block mt-1 font-medium">
                  📱 Se enviará SMS a: +51{phoneNumber}
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Mapa */}
      <div className="rounded-xl overflow-hidden shadow-lg border border-gray-200" style={{ height: '500px' }}>
        <MapContainer
          center={peruCenter}
          zoom={7}
          style={{ height: '100%', width: '100%' }}
          ref={mapRef}
        >
          {/* Capa de mapa base */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Círculo de cobertura */}
          <Circle
            center={stationPosition}
            radius={coverageRadius * 1000} // metros
            pathOptions={{
              color: '#3b82f6',
              fillColor: '#3b82f6',
              fillOpacity: 0.1,
              weight: 2,
              dashArray: '5, 5'
            }}
          />

          {/* Marcador de la estación */}
          <Marker position={stationPosition} icon={stationIcon}>
            <Popup>
              <div className="p-2">
                <h4 className="font-bold text-red-700">Estación LAMAR - Huayao</h4>
                <p className="text-sm text-gray-600">Observatorio del IGP</p>
                <p className="text-xs text-gray-500 mt-1">
                  {stationPosition[0].toFixed(4)}°, {stationPosition[1].toFixed(4)}°
                </p>
              </div>
            </Popup>
          </Marker>

          {/* Marcador de ubicación seleccionada */}
          {selectedPosition && (
            <Marker position={selectedPosition} icon={selectedIcon}>
              <Popup>
                <div className="p-2">
                  <h4 className="font-bold text-blue-700">Ubicación Seleccionada</h4>
                  <p className="text-xs text-gray-600 mt-1">
                    {selectedPosition[0].toFixed(4)}°, {selectedPosition[1].toFixed(4)}°
                  </p>
                  {validationResult && (
                    <p className={`text-xs mt-2 ${validationResult.is_valid ? 'text-green-600' : 'text-red-600'}`}>
                      {validationResult.is_valid ? '✓ Dentro de cobertura' : '✗ Fuera de cobertura'}
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          )}

          {/* Handler de clicks */}
          <MapClickHandler onLocationSelect={handleMapClick} />
        </MapContainer>
      </div>

      {/* Resultado de validación */}
      {isValidating && (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          <span className="text-gray-700">Validando ubicación...</span>
        </div>
      )}

      {validationResult && !isValidating && (
        <div className={`p-4 rounded-lg border flex items-start gap-3 ${
          validationResult.is_valid 
            ? 'bg-green-50 border-green-300' 
            : 'bg-amber-50 border-amber-300'
        }`}>
          {validationResult.is_valid ? (
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <h4 className={`font-semibold mb-1 ${
              validationResult.is_valid ? 'text-green-900' : 'text-amber-900'
            }`}>
              {validationResult.is_valid ? 'Ubicación Válida' : 'Ubicación Fuera de Cobertura'}
            </h4>
            <p className={`text-sm ${
              validationResult.is_valid ? 'text-green-800' : 'text-amber-800'
            }`}>
              {validationResult.message}
            </p>
            <p className="text-xs text-gray-600 mt-2">
              Distancia: {validationResult.distance_km} km
            </p>
          </div>
        </div>
      )}

      {/* Botón de confirmación */}
      {selectedPosition && validationResult?.is_valid && (
        <button
          onClick={handleConfirm}
          disabled={!phoneNumber}
          className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          <MapPin className="w-5 h-5" />
          {phoneNumber 
            ? 'Confirmar y Analizar (enviará SMS)' 
            : 'Ingrese un número de teléfono primero'}
        </button>
      )}

      {!phoneNumber && selectedPosition && validationResult?.is_valid && (
        <p className="text-sm text-amber-700 text-center">
          ⚠️ Debe ingresar un número de teléfono válido para recibir alertas por SMS
        </p>
      )}

      {/* Información de la estación */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
          <Navigation className="w-4 h-4 text-gray-600" />
          Información de Referencia
        </h4>
        <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
          <div>
            <span className="font-medium">Estación:</span> {stationInfo?.name || 'Huayao, Junín'}
          </div>
          <div>
            <span className="font-medium">Radio de cobertura:</span> {coverageRadius} km
          </div>
          <div>
            <span className="font-medium">Coordenadas:</span> {stationPosition[0].toFixed(4)}°S, {Math.abs(stationPosition[1]).toFixed(4)}°W
          </div>
          <div>
            <span className="font-medium">Elevación:</span> {stationInfo?.elevation || 3350} msnm
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocationMapSelector;
