# Plan: Mejora de Detección de Picos (HRVProcessor)

## Problema observado

Con `MIN_PEAK_DISTANCE=320` las lecturas se vuelven muy inestables a BPM alto: saltos abruptos entre ~40 y ~130 bpm dentro de segundos. El algoritmo detecta falsos positivos (ruido de la señal PPG, muesca dicrótica) que se cuelan cuando se reduce la distancia mínima entre picos.

Con `MIN_PEAK_DISTANCE=550` el sistema es estable pero tapa latidos reales por encima de ~109 bpm.

---

## Estrategia propuesta

### Fase 1 — Filtro de mediana sobre intervalos RR

Antes de calcular BPM y RMSSD, aplicar un filtro de mediana a los intervalos RR para eliminar outliers sin afectar la tendencia real.

```python
def _rr_filtered(self):
    rr = self._rr()
    if len(rr) < 3:
        return rr
    sorted_rr = sorted(rr)
    median = sorted_rr[len(sorted_rr) // 2]
    # Descartar intervalos que se alejen más del 40% de la mediana
    return [x for x in rr if abs(x - median) / median < 0.40]
```

Usar `_rr_filtered()` en lugar de `_rr()` dentro de `bpm()`, `rr_interval()` y `rmssd()`.

**Ventaja:** simple, sin parámetros adicionales, robusto ante picos espurios aislados.

### Fase 2 — MIN_PEAK_DISTANCE adaptivo

En lugar de un umbral fijo, calcularlo dinámicamente a partir del BPM estimado en tiempo real:

```python
def _adaptive_min_distance(self):
    rr = self._rr_filtered()
    if not rr:
        return 550  # fallback conservador
    avg_rr = self._mean(rr)
    # Permitir picos hasta un 25% más rápidos que el promedio actual
    return int(avg_rr * 0.75)
```

Reemplazar la constante `MIN_PEAK_DISTANCE` en `_detect_peak` por `self._adaptive_min_distance()`.

**Ventaja:** se adapta automáticamente si el BPM sube o baja durante la sesión.

### Fase 3 — Umbral dinámico de amplitud

El umbral actual es la media del buffer completo. Con señal débil (dedo mal posicionado) la media sube y enmascara picos reales. Usar un percentil bajo en vez de la media:

```python
def _threshold(self):
    if not self.buf:
        return 0
    sorted_buf = sorted(self.buf)
    # Percentil 60 como umbral (más estable que la media ante ruido)
    idx = int(len(sorted_buf) * 0.60)
    return sorted_buf[idx]
```

Reemplazar `self._mean(self.buf)` en `_detect_peak` por `self._threshold()`.

---

## Parámetros a ajustar con el sensor en mano

| Parámetro | Valor actual | Rango a probar | Criterio |
|---|---|---|---|
| `MIN_PEAK_DISTANCE` (fallback) | 550 ms | 400–550 ms | Estabilidad a BPM normal |
| Factor rechazo outliers RR | — | 30%–50% | Sin falsos descartes en estrés |
| Factor adaptivo | — | 0.70–0.80 | Sin doble conteo a BPM alto |
| Percentil umbral amplitud | media (≈50%) | 55%–65% | Señal limpia con dedo seco |

---

## Procedimiento de prueba recomendado

1. Colocar dedo en reposo → verificar BPM estable 60–80 bpm durante 30s.
2. Hacer ejercicio leve (sentadillas) → subir a ~100–130 bpm → verificar sin saltos.
3. Retirar dedo parcialmente (señal débil) → verificar que no se disparen falsos picos.
4. Comparar RMSSD antes/después del ejercicio — debe bajar al aumentar el estrés.

---

## Estado

- [ ] Implementar filtro de mediana (Fase 1)
- [ ] Implementar MIN_PEAK_DISTANCE adaptivo (Fase 2)
- [ ] Implementar umbral dinámico (Fase 3)
- [ ] Pruebas con sensor en mano
