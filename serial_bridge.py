"""
serial_bridge.py — Corre en Windows (no en WSL2)
Lee el JSON que imprime la Pico por USB y lo manda al servidor HRV.

Requisitos:
    pip install pyserial requests

Uso:
    python serial_bridge.py COM3      <- cambia COM3 por tu puerto
"""
import sys, serial, requests, json, time

PORT    = sys.argv[1] if len(sys.argv) > 1 else 'COM3'
SERVER  = 'http://localhost:3000/data'

print(f"Conectando a {PORT}...")
try:
    ser = serial.Serial(PORT, 115200, timeout=2)
except Exception as e:
    print(f"Error abriendo {PORT}: {e}")
    print("Puertos disponibles:")
    import serial.tools.list_ports
    for p in serial.tools.list_ports.comports():
        print(f"  {p.device} — {p.description}")
    sys.exit(1)

print(f"Leyendo datos → {SERVER}")
print("Ctrl+C para salir\n")

while True:
    try:
        line = ser.readline().decode('utf-8', errors='ignore').strip()
        if not line.startswith('{'):
            if line:
                print(f"[pico] {line}")
            continue

        data = json.loads(line)
        r = requests.post(SERVER, json=data, timeout=2)
        print(f"BPM={data['heartRate']:3d}  RMSSD={data['rmssd']:4d}  stress={data['stressIndex']}  [{r.status_code}]")

    except json.JSONDecodeError:
        pass
    except requests.exceptions.ConnectionError:
        print("Servidor no disponible — ¿está corriendo npm run dev?")
        time.sleep(2)
    except KeyboardInterrupt:
        print("\nCerrando...")
        ser.close()
        sys.exit(0)
    except Exception as e:
        print(f"Error: {e}")
