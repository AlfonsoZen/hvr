# Pico 2W + GY MAX30102 → Servidor HRV

## 1. Cableado

```
GY MAX30102          Pico 2W
───────────          ────────────────
VIN          ──►     3.3V  (pin 36)
GND          ──►     GND   (pin 38)
SDA          ──►     GP0   (pin 1)
SCL          ──►     GP1   (pin 2)
```

> INT y RD no se usan en esta implementación.

---

## 2. Verificar firmware de la Pico

La Pico 2W necesita firmware MicroPython con soporte WiFi.

1. Descarga el firmware desde: https://micropython.org/download/RPI_PICO2_W/
   - Archivo: `RPI_PICO2_W-*.uf2` (la versión más reciente)
2. Mantén presionado **BOOTSEL** en la Pico mientras la conectas por USB
3. Aparece como unidad USB — arrastra el `.uf2` ahí
4. La Pico se reinicia sola con el nuevo firmware

---

## 3. Configurar Thonny

1. Abre Thonny
2. **Herramientas → Opciones → Intérprete**
3. Selecciona: `MicroPython (Raspberry Pi Pico)`
4. Puerto: el que aparezca (ej. `COM3` en Windows)
5. Clic en **OK** — la consola inferior debe mostrar el prompt `>>>`

---

## 4. Copiar el driver del sensor a la Pico

Crea un archivo nuevo en Thonny, pega el siguiente código y guárdalo
**en la Pico** como `max30102.py` (Archivo → Guardar como → MicroPython device).

```python
# max30102.py — Driver mínimo para GY MAX30102
from machine import I2C
import time

_ADDR           = 0x57
_REG_FIFO_CFG   = 0x08
_REG_MODE_CFG   = 0x09
_REG_SPO2_CFG   = 0x0A
_REG_LED1_PA    = 0x0C   # LED Rojo
_REG_LED2_PA    = 0x0D   # LED IR
_REG_PILOT_PA   = 0x10
_REG_MULTI_LED  = 0x11
_REG_FIFO_WR    = 0x04
_REG_FIFO_OVF   = 0x05
_REG_FIFO_RD    = 0x06
_REG_FIFO_DATA  = 0x07
_REG_PART_ID    = 0xFF

class MAX30102:
    def __init__(self, i2c):
        self.i2c = i2c
        assert self._r(_REG_PART_ID)[0] == 0x15, "Sensor no encontrado en I2C 0x57"
        self._init()

    def _r(self, reg, n=1):
        return self.i2c.readfrom_mem(_ADDR, reg, n)

    def _w(self, reg, val):
        self.i2c.writeto_mem(_ADDR, reg, bytes([val]))

    def _init(self):
        self._w(_REG_MODE_CFG,  0x40)   # reset
        time.sleep_ms(100)
        self._w(_REG_FIFO_CFG,  0x4F)   # avg=4, rollover off, almost-full=15
        self._w(_REG_MODE_CFG,  0x03)   # modo SpO2 (rojo + IR)
        self._w(_REG_SPO2_CFG,  0x27)   # ADC 4096nA, 100 sps, pulso 411µs
        self._w(_REG_LED1_PA,   0x5F)   # potencia LED rojo ~24mA
        self._w(_REG_LED2_PA,   0x5F)   # potencia LED IR  ~24mA
        self._w(_REG_PILOT_PA,  0x7F)
        self._w(_REG_MULTI_LED, 0x21)   # slot1=rojo, slot2=IR
        self._clear_fifo()

    def _clear_fifo(self):
        self._w(_REG_FIFO_WR,  0x00)
        self._w(_REG_FIFO_OVF, 0x00)
        self._w(_REG_FIFO_RD,  0x00)

    def read_fifo(self):
        """Retorna (red, ir). Retorna (None, None) si no hay datos nuevos."""
        wr = self._r(_REG_FIFO_WR)[0]
        rd = self._r(_REG_FIFO_RD)[0]
        if wr == rd:
            return None, None
        raw = self._r(_REG_FIFO_DATA, 6)
        red = ((raw[0] & 0x03) << 16) | (raw[1] << 8) | raw[2]
        ir  = ((raw[3] & 0x03) << 16) | (raw[4] << 8) | raw[5]
        return red, ir
```

---

## 5. Script de prueba rápida

Antes de todo, verifica que el sensor responde. Corre esto en la consola de Thonny:

```python
from machine import I2C, Pin
from max30102 import MAX30102
import time

i2c    = I2C(0, sda=Pin(0), scl=Pin(1), freq=400_000)
sensor = MAX30102(i2c)
print("Sensor OK — pon el dedo y espera...")

for _ in range(50):
    red, ir = sensor.read_fifo()
    if ir:
        print(f"IR={ir}  RED={red}")
    time.sleep_ms(100)
```

**Valores esperados con dedo:**   IR > 50 000  
**Sin dedo o mal cableado:**      IR < 5 000 (o error de assert)

---

## 6. Script principal — `main.py`

Guarda este archivo en la Pico como `main.py`.  
La Pico lo ejecuta automáticamente al encender.

```python
import network, urequests, time
from machine import I2C, Pin
from max30102 import MAX30102

# ── Configura aquí ──────────────────────────────────────
WIFI_SSID  = "TU_RED"
WIFI_PASS  = "TU_CONTRASEÑA"
SERVER_URL = "http://TU_IP_WINDOWS:3000/data"
# ────────────────────────────────────────────────────────

# ── Procesamiento de señal ───────────────────────────────
IR_FINGER_THRESHOLD = 50_000   # por debajo = sin dedo
BUFFER_SIZE         = 150      # ~1.5s a 100Hz
MIN_PEAK_DISTANCE   = 300      # ms entre latidos (máx ~200 bpm)

class HRVProcessor:
    def __init__(self):
        self.buf      = []
        self.peaks_ts = []   # timestamps de picos (ms)

    def add(self, ir_val, ts_ms):
        self.buf.append(ir_val)
        if len(self.buf) > BUFFER_SIZE:
            self.buf.pop(0)
        self._detect_peak(ts_ms)

    def _mean(self, data):
        return sum(data) / len(data) if data else 0

    def _detect_peak(self, ts_ms):
        n = len(self.buf)
        if n < 5:
            return
        # Ventana de 5 muestras centrada en la penúltima
        w = self.buf[-5:]
        center = w[3]
        mean_val = self._mean(self.buf)
        # Pico: centro es el mayor de la ventana y supera la media
        if center == max(w) and center > mean_val:
            # Respetar distancia mínima entre picos
            if self.peaks_ts and (ts_ms - self.peaks_ts[-1]) < MIN_PEAK_DISTANCE:
                return
            self.peaks_ts.append(ts_ms)
            if len(self.peaks_ts) > 20:
                self.peaks_ts.pop(0)

    def _rr_intervals(self):
        if len(self.peaks_ts) < 2:
            return []
        return [self.peaks_ts[i+1] - self.peaks_ts[i]
                for i in range(len(self.peaks_ts) - 1)]

    def bpm(self):
        rr = self._rr_intervals()
        if not rr:
            return 0
        avg = self._mean(rr)
        return round(60_000 / avg) if avg > 0 else 0

    def rr_interval(self):
        rr = self._rr_intervals()
        return round(self._mean(rr)) if rr else 0

    def rmssd(self):
        rr = self._rr_intervals()
        if len(rr) < 2:
            return 0
        diffs_sq = [(rr[i+1] - rr[i]) ** 2 for i in range(len(rr) - 1)]
        return round((self._mean(diffs_sq)) ** 0.5)

    def stress_index(self, rmssd_val):
        # RMSSD alto = más variabilidad = menos estrés (relación inversa)
        if rmssd_val >= 80: return 1
        if rmssd_val >= 60: return 3
        if rmssd_val >= 40: return 5
        if rmssd_val >= 20: return 7
        return 9

    def ready(self):
        return len(self.peaks_ts) >= 3


# ── WiFi ─────────────────────────────────────────────────
def conectar_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    if wlan.isconnected():
        return wlan
    print(f"Conectando a {WIFI_SSID}...")
    wlan.connect(WIFI_SSID, WIFI_PASS)
    for _ in range(20):
        if wlan.isconnected():
            print("WiFi OK:", wlan.ifconfig())
            return wlan
        time.sleep(1)
    raise RuntimeError("No se pudo conectar al WiFi")


# ── Main ─────────────────────────────────────────────────
i2c    = I2C(0, sda=Pin(0), scl=Pin(1), freq=400_000)
sensor = MAX30102(i2c)
proc   = HRVProcessor()
wlan   = conectar_wifi()

last_post_ms  = 0
POST_INTERVAL = 800   # ms entre envíos al servidor

print("Pon el dedo en el sensor...")

while True:
    red, ir = sensor.read_fifo()
    now = time.ticks_ms()

    if ir is None:
        time.sleep_ms(10)
        continue

    # Sin dedo detectado
    if ir < IR_FINGER_THRESHOLD:
        if time.ticks_diff(now, last_post_ms) >= POST_INTERVAL:
            payload = {
                "heartRate":   0,
                "rmssd":       0,
                "rrInterval":  0,
                "sensorStatus": "calibrating",
                "stressIndex": 0,
            }
            try:
                r = urequests.post(SERVER_URL, json=payload)
                r.close()
            except Exception as e:
                print("POST error:", e)
            last_post_ms = now
        time.sleep_ms(10)
        continue

    # Procesar muestra
    proc.add(ir, now)

    # Enviar cada POST_INTERVAL ms (si ya hay datos suficientes)
    if time.ticks_diff(now, last_post_ms) >= POST_INTERVAL:
        if proc.ready():
            bpm    = proc.bpm()
            rmssd  = proc.rmssd()
            rr     = proc.rr_interval()
            stress = proc.stress_index(rmssd)
            status = "active" if 40 <= bpm <= 180 else "calibrating"

            payload = {
                "heartRate":    bpm,
                "rmssd":        rmssd,
                "rrInterval":   rr,
                "sensorStatus": status,
                "stressIndex":  stress,
            }
        else:
            payload = {
                "heartRate":   0,
                "rmssd":       0,
                "rrInterval":  0,
                "sensorStatus": "calibrating",
                "stressIndex": 0,
            }

        try:
            r = urequests.post(SERVER_URL, json=payload)
            r.close()
            print(f"BPM={payload['heartRate']}  RMSSD={payload['rmssd']}  stress={payload['stressIndex']}")
        except Exception as e:
            print("POST error:", e)
            # Intentar reconectar WiFi
            if not wlan.isconnected():
                try:
                    wlan = conectar_wifi()
                except:
                    pass

        last_post_ms = now

    time.sleep_ms(10)
```

---

## 7. Variables a cambiar antes de cargar

| Variable | Valor de ejemplo |
|---|---|
| `WIFI_SSID` | `"izzigo.tv"` o `"MiHotspot"` |
| `WIFI_PASS` | tu contraseña |
| `SERVER_URL` | `"http://192.168.0.60:3000/data"` (IP de tu laptop en esa red) |

---

## 8. Flujo de carga en Thonny

1. Abre `main.py` en Thonny
2. Edita las 3 variables de configuración
3. **Archivo → Guardar como → MicroPython device → `main.py`**
4. Presiona el botón **Run** (▶) o reinicia la Pico
5. Observa la consola: debe mostrar "WiFi OK" y luego valores de BPM

---

## 9. Verificación end-to-end

Con `npm run dev` corriendo en tu laptop:

1. Pico conectada y con dedo en sensor → consola Thonny muestra BPM
2. Dashboard en `http://localhost:3000` → los valores cambian en tiempo real
3. Log del servidor: `[pico] {"heartRate":72, ...}`

Si el dashboard sigue mostrando datos mock (muy variables) y no los de la Pico,
revisa que el IP en `SERVER_URL` sea el correcto para la red actual.
