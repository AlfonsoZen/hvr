import time, ujson
from machine import I2C, Pin
from max30102 import MAX30102

# ── Configuración ────────────────────────────────────────
IR_FINGER_THRESHOLD = 3_000
BUFFER_SIZE         = 150
MIN_PEAK_DISTANCE   = 550    # ms mínimo entre latidos (~133 bpm máx)
PRINT_INTERVAL      = 800    # ms entre lecturas impresas
# ────────────────────────────────────────────────────────

class HRVProcessor:
    def __init__(self):
        self.buf      = []
        self.peaks_ts = []

    def add(self, ir_val, ts_ms):
        self.buf.append(ir_val)
        if len(self.buf) > BUFFER_SIZE:
            self.buf.pop(0)
        self._detect_peak(ts_ms)

    def _mean(self, data):
        return sum(data) / len(data) if data else 0

    def _detect_peak(self, ts_ms):
        if len(self.buf) < 5:
            return
        w = self.buf[-5:]
        center = w[3]
        if center == max(w) and center > self._mean(self.buf):
            if self.peaks_ts and (ts_ms - self.peaks_ts[-1]) < MIN_PEAK_DISTANCE:
                return
            self.peaks_ts.append(ts_ms)
            if len(self.peaks_ts) > 20:
                self.peaks_ts.pop(0)

    def _rr(self):
        if len(self.peaks_ts) < 2:
            return []
        return [self.peaks_ts[i+1] - self.peaks_ts[i]
                for i in range(len(self.peaks_ts) - 1)]

    def bpm(self):
        rr = self._rr()
        avg = self._mean(rr)
        return round(60_000 / avg) if avg > 0 else 0

    def rr_interval(self):
        rr = self._rr()
        return round(self._mean(rr)) if rr else 0

    def rmssd(self):
        rr = self._rr()
        if len(rr) < 2:
            return 0
        diffs_sq = [(rr[i+1] - rr[i]) ** 2 for i in range(len(rr) - 1)]
        return round(self._mean(diffs_sq) ** 0.5)

    def stress_index(self, rmssd_val):
        if rmssd_val >= 80: return 1
        if rmssd_val >= 60: return 3
        if rmssd_val >= 40: return 5
        if rmssd_val >= 20: return 7
        return 9

    def ready(self):
        return len(self.peaks_ts) >= 3


# ── Inicio ───────────────────────────────────────────────
i2c    = I2C(0, sda=Pin(0), scl=Pin(1), freq=100_000)
sensor = MAX30102(i2c)
proc   = HRVProcessor()

last_print_ms = 0
print("=== HRV Monitor — Microcomputadoras ===")
print("Coloca el dedo sobre el sensor GY MAX30102...")

while True:
    red, ir = sensor.read_fifo()
    now = time.ticks_ms()

    if ir is None:
        time.sleep_ms(10)
        continue

    if ir >= IR_FINGER_THRESHOLD:
        proc.add(ir, now)

    if time.ticks_diff(now, last_print_ms) >= PRINT_INTERVAL:
        if ir < IR_FINGER_THRESHOLD:
            print("[ sin dedo ]")
        elif proc.ready():
            bpm   = proc.bpm()
            rmssd = proc.rmssd()
            data  = {
                "heartRate":    bpm,
                "rmssd":        rmssd,
                "rrInterval":   proc.rr_interval(),
                "sensorStatus": "active" if 40 <= bpm <= 180 else "calibrating",
                "stressIndex":  proc.stress_index(rmssd),
            }
            print(ujson.dumps(data))
        else:
            print("[ calibrando... ]")

        last_print_ms = now

    time.sleep_ms(10)
