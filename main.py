import time, ujson, network, socket
from machine import I2C, Pin
from max30102 import MAX30102

# ── Configuración sensor ────────────────────────────────
IR_FINGER_THRESHOLD = 3000
BUFFER_SIZE = 150
MIN_PEAK_DISTANCE = 550
PRINT_INTERVAL = 800
CALIBRATION_TIME_MS = 18000   # 18 segundos

# ── Configuración WiFi AP ────────────────────────────────
AP_SSID = "HRV_PICO"
AP_PASSWORD = "12345678"
TCP_PORT = 8080


class HRVProcessor:
    def __init__(self):
        self.buf = []
        self.peaks_ts = []

    def reset(self):
        self.buf = []
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
            if self.peaks_ts and time.ticks_diff(ts_ms, self.peaks_ts[-1]) < MIN_PEAK_DISTANCE:
                return

            self.peaks_ts.append(ts_ms)

            if len(self.peaks_ts) > 20:
                self.peaks_ts.pop(0)

    def _rr(self):
        if len(self.peaks_ts) < 2:
            return []
        return [
            self.peaks_ts[i + 1] - self.peaks_ts[i]
            for i in range(len(self.peaks_ts) - 1)
        ]

    def bpm(self):
        rr = self._rr()
        avg = self._mean(rr)
        return round(60000 / avg) if avg > 0 else 0

    def rr_interval(self):
        rr = self._rr()
        return round(self._mean(rr)) if rr else 0

    def rmssd(self):
        rr = self._rr()
        if len(rr) < 2:
            return 0

        diffs_sq = [(rr[i + 1] - rr[i]) ** 2 for i in range(len(rr) - 1)]
        return round(self._mean(diffs_sq) ** 0.5)

    def stress_index(self, rmssd_val):
        if rmssd_val >= 80:
            return 1
        if rmssd_val >= 60:
            return 3
        if rmssd_val >= 40:
            return 5
        if rmssd_val >= 20:
            return 7
        return 9

    def ready(self):
        return len(self.peaks_ts) >= 3


def start_access_point():
    ap = network.WLAN(network.AP_IF)
    ap.active(True)
    ap.config(essid=AP_SSID, password=AP_PASSWORD)

    while not ap.active():
        time.sleep_ms(100)

    print("WiFi AP activo")
    print("SSID:", AP_SSID)
    print("Password:", AP_PASSWORD)
    print("IP:", ap.ifconfig()[0])

    return ap


def start_tcp_server():
    addr = socket.getaddrinfo("0.0.0.0", TCP_PORT)[0][-1]

    server = socket.socket()
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(addr)
    server.listen(1)
    server.setblocking(False)

    print("Servidor TCP escuchando en puerto", TCP_PORT)

    return server


def send_json(client, data):
    if client is None:
        return client

    try:
        msg = ujson.dumps(data) + "\n"
        client.send(msg.encode())
        return client

    except:
        try:
            client.close()
        except:
            pass

        print("Cliente desconectado")
        return None


# ── Inicio ───────────────────────────────────────────────
ap = start_access_point()
server = start_tcp_server()
client = None

i2c = I2C(0, sda=Pin(0), scl=Pin(1), freq=100000)
sensor = MAX30102(i2c)
proc = HRVProcessor()

last_print_ms = 0
finger_detected = False
calibration_start_ms = 0

print("=== HRV Monitor WiFi — Microcomputadoras ===")
print("Conecta tu backend a:")
print("IP: 192.168.4.1")
print("Puerto:", TCP_PORT)

while True:
    # Aceptar cliente TCP
    if client is None:
        try:
            client, addr = server.accept()
            client.setblocking(False)
            print("Cliente conectado:", addr)
        except:
            pass

    red, ir = sensor.read_fifo()
    now = time.ticks_ms()

    if ir is None:
        time.sleep_ms(10)
        continue

    has_finger = ir >= IR_FINGER_THRESHOLD

    if has_finger:
        if not finger_detected:
            finger_detected = True
            calibration_start_ms = now
            proc.reset()

        proc.add(ir, now)

    else:
        if finger_detected:
            proc.reset()

        finger_detected = False

    if time.ticks_diff(now, last_print_ms) >= PRINT_INTERVAL:

        if not has_finger:
            data = {
                "sensorStatus": "no_signal",
                "message": "No se está recibiendo señal del sensor",
                "heartRate": 0,
                "rmssd": 0,
                "rrInterval": 0,
                "stressIndex": 0
            }

        elif time.ticks_diff(now, calibration_start_ms) < CALIBRATION_TIME_MS:
            remaining = CALIBRATION_TIME_MS - time.ticks_diff(now, calibration_start_ms)

            data = {
                "sensorStatus": "calibrating",
                "message": "Calibrando sensor",
                "calibrationRemainingMs": remaining,
                "heartRate": 0,
                "rmssd": 0,
                "rrInterval": 0,
                "stressIndex": 0
            }

        elif proc.ready():
            bpm = proc.bpm()
            rmssd = proc.rmssd()

            data = {
                "sensorStatus": "active" if 40 <= bpm <= 180 else "calibrating",
                "message": "Lectura activa",
                "heartRate": bpm,
                "rmssd": rmssd,
                "rrInterval": proc.rr_interval(),
                "stressIndex": proc.stress_index(rmssd)
            }

        else:
            data = {
                "sensorStatus": "calibrating",
                "message": "Buscando latidos estables",
                "heartRate": 0,
                "rmssd": 0,
                "rrInterval": 0,
                "stressIndex": 0
            }

        print(ujson.dumps(data))
        client = send_json(client, data)

        last_print_ms = now

    time.sleep_ms(10)
