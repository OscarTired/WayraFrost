"""
Script para entrenar modelo de predicción de heladas

Ejecutar: python train_model.py
"""

import pandas as pd
import numpy as np

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    roc_auc_score,
    roc_curve,
)
from sklearn.preprocessing import StandardScaler
from sklearn.utils import resample

import joblib
import warnings
import os
from datetime import datetime

warnings.filterwarnings("ignore")

# ============================================================================
# CONFIGURACIÓN
# ============================================================================

HOURS_AHEAD = 3  # Predecir con X horas de anticipación
FROST_THRESHOLD = 0  # Temperatura considerada como helada (°C)
TEST_SIZE = 0.2  # Porcentaje para testing
MODEL_OUTPUT = "frost_model.pkl"

# ============================================================================
# FUNCIONES
# ============================================================================


def print_header(text: str):
    """Imprime encabezado formateado"""
    print("\n" + "=" * 70)
    print(f" {text}")
    print("=" * 70)


def load_and_merge_data() -> pd.DataFrame:
    """Carga todos los CSVs y los une en un solo DataFrame con columnas aplanadas."""
    print_header("1. CARGANDO DATOS")

    files = {
        "dir": "data/dir_hourly_2018_2025.csv",
        "HR": "data/HR_hourly_2018_2025.csv",
        "pp": "data/pp_hourly_2018_2025.csv",
        "press": "data/press_hourly_2018_2025.csv",
        "radinf": "data/radinf_hourly_2018_2025.csv",
        "tempsup": "data/tempsup_hourly_2018_2025.csv",
        "vel": "data/vel_hourly_2018_2025.csv",
    }

    dfs = []

    for var_name, filepath in files.items():
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"❌ No se encontró: {filepath}")

        print(f"  Cargando {var_name}...", end=" ")

        # Leer con MultiIndex (2 filas de encabezado)
        df = pd.read_csv(filepath, header=[0, 1], index_col=0, parse_dates=True)

        # Aplanar columnas MultiIndex
        df.columns = [f"{var_name}_{col[0]}_{col[1]}" for col in df.columns]

        # Eliminar la primera fila si contiene NaN en el índice (artefacto del CSV)
        if pd.isna(df.index[0]):
            df = df.iloc[1:]

        # Convertir todas las columnas a numérico
        for col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

        dfs.append(df)
        print(f"✓ ({df.shape[0]} registros, {df.shape[1]} columnas)")

    df_combined = pd.concat(dfs, axis=1)

    print(
        f"\n ✓ Datos combinados: {df_combined.shape[0]} registros, "
        f"{df_combined.shape[1]} columnas"
    )
    print(f"  Primeras 10 columnas: {df_combined.columns.tolist()[:10]}")

    return df_combined


def create_target_variable(df: pd.DataFrame, threshold: float = FROST_THRESHOLD) -> pd.DataFrame:
    """Crea la variable objetivo 'frost' en base a la temperatura superficial."""
    print_header("2. CREANDO VARIABLE OBJETIVO")

    df = df.copy()

    # Buscar la columna de temperatura de superficie
    temp_col = None
    possible_names = [
        "tempsup_tempsup_mean",
        "tempsup_mean",
        "tempsup_mean_mean",
    ]

    for col_name in possible_names:
        if col_name in df.columns:
            temp_col = col_name
            break

    # Si no encuentra ninguna, buscar cualquiera que contenga 'tempsup' y 'mean'
    if temp_col is None:
        for col in df.columns:
            if "tempsup" in col.lower() and "mean" in col.lower():
                temp_col = col
                break

    if temp_col is None:
        print("\n ❌ ERROR: No se encontró columna de temperatura")
        print(f"  Columnas disponibles: {df.columns.tolist()}")
        raise ValueError("No se encontró columna de temperatura superficial")

    print(f"  Usando columna de temperatura: {temp_col}")

    df["frost"] = (df[temp_col] <= threshold).astype(int)

    n_frost = df["frost"].sum()
    n_total = len(df)
    pct_frost = (n_frost / n_total) * 100

    print(f"  Total registros: {n_total:,}")
    print(f"  Heladas detectadas: {n_frost:,} ({pct_frost:.2f}%)")
    print(f"  Sin heladas: {n_total - n_frost:,} ({100 - pct_frost:.2f}%)")

    if pct_frost < 1:
        print(f"\n ⚠️ ADVERTENCIA: Muy pocas heladas ({pct_frost:.2f}%)")
        print("  El modelo podría tener dificultades para aprender")

    return df


def create_features(df: pd.DataFrame, hours_ahead: int = HOURS_AHEAD) -> pd.DataFrame:
    """Crea features adicionales para entrenamiento y el target desplazado."""
    print_header("3. CREANDO FEATURES")

    df = df.copy()

    # Features temporales
    print("  Creando features temporales...")
    df["hour"] = df.index.hour
    df["month"] = df.index.month
    df["day_of_year"] = df.index.dayofyear
    df["is_night"] = ((df["hour"] >= 18) | (df["hour"] <= 6)).astype(int)

    # Features de tendencia (diferencias)
    print("  Creando features de tendencia (diferencias)...")
    cols_to_diff = []
    for pattern in ["tempsup", "HR", "press", "vel"]:
        for col in df.columns:
            if pattern in col and "mean" in col and col not in cols_to_diff:
                cols_to_diff.append(col)
                break

    for col in cols_to_diff:
        if col in df.columns:
            df[f"{col}_diff_1h"] = df[col].diff(1)
            df[f"{col}_diff_3h"] = df[col].diff(3)
            print(f"   - {col}")

    # Features de ventanas móviles
    print("  Creando features de ventanas móviles...")
    cols_to_roll = []
    for pattern in ["tempsup", "HR", "radinf"]:
        for col in df.columns:
            if pattern in col and "mean" in col and col not in cols_to_roll:
                cols_to_roll.append(col)
                break

    for col in cols_to_roll:
        if col in df.columns:
            df[f"{col}_rolling_3h"] = df[col].rolling(window=3, min_periods=1).mean()
            df[f"{col}_rolling_6h"] = df[col].rolling(window=6, min_periods=1).mean()
            print(f"   - {col}")

    # Punto de rocío
    print("  Calculando punto de rocío...")
    temp_col = None
    hr_col = None

    for col in df.columns:
        if "tempsup" in col and "mean" in col:
            temp_col = col
        if "HR" in col and "mean" in col:
            hr_col = col

    if temp_col and hr_col:
        T = df[temp_col]
        RH = df[hr_col]
        df["dew_point"] = T - ((100 - RH) / 5)
        print(f"   Usando {temp_col} y {hr_col} para dew_point")

    # Target desplazado
    print(f"  Creando target para predicción {hours_ahead}h adelante...")
    df["frost_target"] = df["frost"].shift(-hours_ahead)

    print(f"\n ✓ Total features (incluyendo target): {df.shape[1]}")
    return df


def prepare_train_test(df: pd.DataFrame, test_size: float = TEST_SIZE):
    """
    Prepara datos para entrenamiento y test.

    Aquí se seleccionan explícitamente las columnas que SÍ estarán disponibles
    en producción (frontend/API) para evitar depender de columnas que luego
    serían imputadas con valores irreales.
    """
    print_header("4. PREPARANDO TRAIN/TEST")

    df_clean = df.dropna()
    print(f"  Registros después de limpiar NaN: {len(df_clean):,}")
    print(f"  Registros eliminados: {len(df) - len(df_clean):,}")

    # Features que vamos a usar tanto en entrenamiento como en la API
    base_features = [
        "tempsup_tempsup_mean",
        "HR_HR_mean",
        "press_patm_mean",
        "vel_vel_mean",
        "radinf_radinf_mean",
        "dir_dir_mean",
        "pp_pp_sum",
        "hour",
        "month",
        "day_of_year",
        "is_night",
        "dew_point",
    ]

    feature_cols = [col for col in base_features if col in df_clean.columns]

    if not feature_cols:
        raise ValueError("No se encontraron columnas de features coincidentes con base_features.")

    X = df_clean[feature_cols]
    y = df_clean["frost_target"]

    # Split temporal: primera parte train, última parte test
    split_idx = int(len(df_clean) * (1 - test_size))
    X_train = X.iloc[:split_idx]
    X_test = X.iloc[split_idx:]
    y_train = y.iloc[:split_idx]
    y_test = y.iloc[split_idx:]

    print(f"\n  Train: {len(X_train):,} ({len(X_train) / len(df_clean) * 100:.1f}%)")
    print(f"  Test:  {len(X_test):,} ({len(X_test) / len(df_clean) * 100:.1f}%)")
    print(f"  Features usadas: {len(feature_cols)} => {feature_cols}")

    print(
        f"\n  Heladas en Train: {y_train.sum():,} "
        f"({y_train.sum() / len(y_train) * 100:.2f}%)"
    )
    print(
        f"  Heladas en Test:  {y_test.sum():,} "
        f"({y_test.sum() / len(y_test) * 100:.2f}%)"
    )

    return X_train, X_test, y_train, y_test, feature_cols


def train_model(X_train: pd.DataFrame, y_train: pd.Series):
    """Entrena Random Forest con normalización y re-balanceo simple de clases."""
    print_header("5. ENTRENANDO MODELO")

    # Normalizar features
    print("  Normalizando features...")
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)

    # Re-balanceo simple: downsampling de la clase mayoritaria
    print("  Re-balanceando clases (undersampling de la clase mayoritaria)...")
    Xy = pd.DataFrame(X_train_scaled, columns=X_train.columns)
    Xy["target"] = y_train.values

    majority = Xy[Xy["target"] == 0]
    minority = Xy[Xy["target"] == 1]

    if len(minority) == 0:
        print("  ⚠️ No hay ejemplos de helada en train, se entrena sin re-balanceo.")
        X_bal = X_train_scaled
        y_bal = y_train.values
    else:
        n_majority = len(majority)
        n_minority = len(minority)
        n_majority_down = min(n_majority, n_minority * 10)

        print(f"   - Clase 0 (no helada): {n_majority:,}")
        print(f"   - Clase 1 (helada):    {n_minority:,}")
        print(f"   - Downsampling clase 0 a: {n_majority_down:,}")

        majority_down = resample(
            majority,
            replace=False,
            n_samples=n_majority_down,
            random_state=42,
        )

        Xy_bal = pd.concat([majority_down, minority], ignore_index=True)
        y_bal = Xy_bal["target"].values
        X_bal = Xy_bal.drop(columns=["target"]).values

    print("  Entrenando Random Forest...")
    print("  (Esto puede tomar varios minutos...)\n")

    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=15,
        min_samples_split=20,
        min_samples_leaf=10,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
        verbose=1,
    )

    model.fit(X_bal, y_bal)

    print("\n ✓ Modelo entrenado exitosamente")
    return model, scaler


def evaluate_model(
    model: RandomForestClassifier,
    scaler: StandardScaler,
    X_test: pd.DataFrame,
    y_test: pd.Series,
):
    """Evalúa el modelo y calcula un umbral de decisión sugerido."""
    print_header("6. EVALUANDO MODELO")

    X_test_scaled = scaler.transform(X_test)
    y_pred = model.predict(X_test_scaled)
    y_pred_proba = model.predict_proba(X_test_scaled)[:, 1]

    print("\n Reporte de Clasificación:")
    print("-" * 70)
    print(
        classification_report(
            y_test,
            y_pred,
            target_names=["No Helada", "Helada"],
            digits=3,
        )
    )

    print("\n Matriz de Confusión:")
    print("-" * 70)
    cm = confusion_matrix(y_test, y_pred)
    tn, fp, fn, tp = cm.ravel()

    print("                Predicho No Helada | Predicho Helada")
    print(f" Real No Helada      {tn:6d}      | {fp:6d}")
    print(f" Real Helada         {fn:6d}      | {tp:6d}")

    print(f"\n Verdaderos Negativos (TN): {tn:,}")
    print(f" Falsos Positivos    (FP): {fp:,} ← Falsa alarma")
    print(f" Falsos Negativos    (FN): {fn:,} ← ¡Peligroso! No detectó helada")
    print(f" Verdaderos Positivos (TP): {tp:,}")

    roc = roc_auc_score(y_test, y_pred_proba)
    print(f"\n ROC-AUC Score: {roc:.4f}")
    if roc > 0.9:
        print(" → Excelente desempeño")
    elif roc > 0.8:
        print(" → Buen desempeño")
    elif roc > 0.7:
        print(" → Desempeño aceptable")
    else:
        print(" → Desempeño bajo, considerar ajustes")

    # Calcular umbral sugerido
    fpr, tpr, thresholds = roc_curve(y_test, y_pred_proba)
    fnr = 1 - tpr
    # Compromiso sencillo entre FNR y FPR
    idx = np.argmin(fnr + fpr)
    best_threshold = thresholds[idx]
    print(f"\n Umbral óptimo sugerido (decision_threshold): {best_threshold:.3f}")

    return y_pred, y_pred_proba, best_threshold


def show_feature_importance(
    model: RandomForestClassifier, feature_cols, top_n: int = 20
) -> pd.DataFrame:
    """Muestra las features más importantes según el Random Forest."""
    print_header("7. IMPORTANCIA DE FEATURES")

    importance_df = (
        pd.DataFrame(
            {
                "feature": feature_cols,
                "importance": model.feature_importances_,
            }
        )
        .sort_values("importance", ascending=False)
        .reset_index(drop=True)
    )

    print(f"\n Top {top_n} features más importantes:\n")
    for _, row in importance_df.head(top_n).iterrows():
        bar_length = int(row["importance"] * 50)
        bar = "█" * bar_length
        print(f"  {row['feature']:35s} {bar} {row['importance']:.4f}")

    return importance_df


def save_model(
    model: RandomForestClassifier,
    scaler: StandardScaler,
    feature_cols,
    decision_threshold: float,
    filepath: str = MODEL_OUTPUT,
):
    """Guarda modelo, scaler, columnas y metadatos en un archivo .pkl."""
    print_header("8. GUARDANDO MODELO")

    model_package = {
        "model": model,
        "scaler": scaler,
        "feature_cols": feature_cols,
        "hours_ahead": HOURS_AHEAD,
        "frost_threshold": FROST_THRESHOLD,
        "decision_threshold": float(decision_threshold),
        "trained_date": datetime.now().isoformat(),
    }

    joblib.dump(model_package, filepath)
    file_size = os.path.getsize(filepath) / (1024 * 1024)

    print(f" ✓ Modelo guardado: {filepath}")
    print(f"   Tamaño: {file_size:.2f} MB")
    print(f"   Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


# ============================================================================
# MAIN
# ============================================================================


def main() -> int:
    """Pipeline principal de entrenamiento."""
    start_time = datetime.now()

    print("\n")
    print("╔" + "═" * 68 + "╗")
    print("║" + " " * 15 + "ENTRENAMIENTO MODELO HELADAS" + " " * 25 + "║")
    print("╚" + "═" * 68 + "╝")

    try:
        # 1. Cargar datos
        df = load_and_merge_data()

        # 2. Crear target
        df = create_target_variable(df)

        # 3. Crear features
        df = create_features(df)

        # 4. Preparar train/test
        X_train, X_test, y_train, y_test, feature_cols = prepare_train_test(df)

        # 5. Entrenar
        model, scaler = train_model(X_train, y_train)

        # 6. Evaluar (y obtener umbral óptimo)
        y_pred, y_pred_proba, best_threshold = evaluate_model(
            model, scaler, X_test, y_test
        )

        # 7. Feature importance
        importance_df = show_feature_importance(model, feature_cols)

        # 8. Guardar
        save_model(model, scaler, feature_cols, best_threshold)

        # Resumen final
        elapsed = (datetime.now() - start_time).total_seconds()
        print_header("✅ ENTRENAMIENTO COMPLETADO")
        print(f"\n Tiempo total: {elapsed:.1f} segundos")
        print(" Modelo listo para usar en API\n")

    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback

        traceback.print_exc()
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
