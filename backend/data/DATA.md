# **Datos de Entrenamiento**

El modelo v2 fue entrenado con datos horarios (2018-2025) de:

## Estación: LAMAR - Huayao, Junín

**Institución: Instituto Geofísico del Perú (IGP)**

- Ubicación: -12.0383°S, -75.3228°W
- Elevación: 3350 msnm

Variables utilizadas:

- Temperatura a 2 m.
- Humedad relativa
- Presión atmosférica
- Velocidad y dirección del viento
- Radiación infrarroja
- Precipitación

## ⚠️ Importante - Archivos NO Versionados

El .gitignore excluye:

❌ Modelos entrenados (*.pkl)
❌ Datos históricos (*.csv)

Para usar el proyecto, necesitarás:

Entrenar el modelo con tus propios datos históricos:

# Entrenar modelo
python train_model_v2.py

# Ejecutar API
python api_v2.py
