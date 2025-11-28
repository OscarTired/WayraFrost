import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix
import joblib
import os

# Configuración
DATA_PATH = "data/df_clean_v2.csv"
MODEL_OUTPUT = "frost_model_v2.pkl"

# Definición de predictores base (sin lags)
BASE_FEATURES = ['HR', 'radinf', 'vel', 'dir_sin', 'dir_cos']
LAGS = [6, 12, 24]

def load_data():
    """Carga el dataset limpio."""
    if not os.path.exists(DATA_PATH):
        raise FileNotFoundError(f"No se encontró el archivo: {DATA_PATH}")
    
    print(f"Cargando datos desde {DATA_PATH}...")
    df = pd.read_csv(DATA_PATH)
    
    # Asegurar que time es datetime
    df['time'] = pd.to_datetime(df['time'])
    df = df.sort_values('time').reset_index(drop=True)
    return df

def create_features(df):
    """Genera lags temporales para las variables predictoras."""
    print("Generando features (Lags)...")
    df_features = df.copy()
    
    feature_cols = []
    
    # Agregar variables base y sus lags
    for col in BASE_FEATURES:
        # Variable actual (t)
        feature_cols.append(col)
        
        # Lags (t-6, t-12, t-24)
        for lag in LAGS:
            lag_col_name = f"{col}_lag_{lag}h"
            df_features[lag_col_name] = df_features[col].shift(lag)
            feature_cols.append(lag_col_name)
            
    return df_features, feature_cols

def create_target(df):
    """
    Crea la variable objetivo multiclase basada en temp2m.
    Clasificación agroclimática estándar para heladas en la sierra peruana:
    
    0: Sin Riesgo (T > 4°C) - Condiciones normales, sin riesgo de helada
    1: Riesgo de Helada (0°C < T <= 4°C) - Condiciones críticas, posible helada
    2: Helada Moderada (-4°C < T <= 0°C) - Helada con daño parcial a cultivos
    3: Helada Severa (T <= -4°C) - Helada intensa, daño severo a cultivos
    
    Nota: En zonas altoandinas como Huayao (3350 msnm), heladas por debajo de -4°C
    son consideradas severas ya que causan daño irreversible en la mayoría de cultivos.
    """
    print("Creando variable objetivo (Clasificación)...")
    print("Umbrales: Sin Riesgo (>4°C), Riesgo (0-4°C], Moderada (-4,0°C], Severa (≤-4°C)")
    
    conditions = [
        (df['temp2m'] > 4),                           # 0: Sin Riesgo
        (df['temp2m'] > 0) & (df['temp2m'] <= 4),     # 1: Riesgo de Helada  
        (df['temp2m'] > -4) & (df['temp2m'] <= 0),    # 2: Helada Moderada
        (df['temp2m'] <= -4)                          # 3: Helada Severa
    ]
    
    choices = [0, 1, 2, 3]
    
    df['target'] = np.select(conditions, choices, default=0)
    
    print("\nDistribución de clases:")
    class_names = {0: 'Sin Riesgo', 1: 'Riesgo', 2: 'Moderada', 3: 'Severa'}
    for idx, count in df['target'].value_counts().sort_index().items():
        pct = count / len(df) * 100
        print(f"  {idx} ({class_names[idx]}): {count} ({pct:.1f}%)")
    
    return df

def main():
    # 1. Cargar
    df = load_data()
    
    # 2. Feature Engineering
    df, feature_cols = create_features(df)
    
    # 3. Target Engineering
    df = create_target(df)
    
    # 4. Limpiar NaNs generados por lags
    df_clean = df.dropna(subset=feature_cols + ['target'])
    print(f"Registros totales después de limpieza: {len(df_clean)}")
    
    # 5. Split por fechas
    # Train: 2018 al 30-08-2024
    # Test: 31-08-2024 al 31-08-2025
    train_mask = (df_clean['time'] >= '2018-01-01') & (df_clean['time'] <= '2024-08-30 23:59:59')
    test_mask = (df_clean['time'] >= '2024-08-31') & (df_clean['time'] <= '2025-08-31 23:59:59')
    
    X_train = df_clean.loc[train_mask, feature_cols]
    y_train = df_clean.loc[train_mask, 'target']
    
    X_test = df_clean.loc[test_mask, feature_cols]
    y_test = df_clean.loc[test_mask, 'target']
    
    print(f"Train set: {X_train.shape}")
    print(f"Test set: {X_test.shape}")
    
    # 6. Entrenar Modelo (Random Forest Classifier)
    print("Entrenando Random Forest Classifier...")
    rf = RandomForestClassifier(
        n_estimators=200,
        max_depth=15,
        class_weight='balanced', # Importante para clases desbalanceadas (Severa)
        random_state=42,
        n_jobs=-1
    )
    rf.fit(X_train, y_train)
    
    # 7. Evaluar
    print("\nEvaluación en Test Set:")
    y_pred = rf.predict(X_test)
    
    # Especificar todas las clases posibles (0-3) aunque no aparezcan en test
    all_labels = [0, 1, 2, 3]
    target_names = ['Sin Riesgo', 'Riesgo', 'Moderada', 'Severa']
    
    print(classification_report(
        y_test, 
        y_pred, 
        labels=all_labels,  # <-- SOLUCIÓN: especificar todas las clases
        target_names=target_names,
        zero_division=0  # Evita warnings si alguna clase no tiene predicciones
    ))
    
    print("\nMatriz de Confusión:")
    print(confusion_matrix(y_test, y_pred, labels=all_labels))
    
    # 8. Guardar
    model_package = {
        "model": rf,
        "feature_cols": feature_cols,
        "target_mapping": {0: "Sin Riesgo", 1: "Riesgo", 2: "Moderada", 3: "Severa"},
        "model_type": "RandomForestClassifier_MultiClass",
        "version": "2.0"
    }
    
    joblib.dump(model_package, MODEL_OUTPUT)
    print(f"\n✓ Modelo guardado en {MODEL_OUTPUT}")

if __name__ == "__main__":
    main()
