# max30102.py — Driver para GY MAX30102 con I2C explícito (sin repeated start)
from machine import I2C
import time

_ADDR          = 0x57
_REG_INTR_EN1  = 0x02
_REG_FIFO_CFG  = 0x08
_REG_MODE_CFG  = 0x09
_REG_SPO2_CFG  = 0x0A
_REG_LED1_PA   = 0x0C
_REG_LED2_PA   = 0x0D
_REG_FIFO_WR   = 0x04
_REG_FIFO_OVF  = 0x05
_REG_FIFO_RD   = 0x06
_REG_FIFO_DATA = 0x07
_REG_PART_ID   = 0xFF

class MAX30102:
    def __init__(self, i2c):
        self.i2c = i2c
        pid = self._r(_REG_PART_ID, 1)[0]
        assert pid == 0x15, f"Part ID incorrecto: {hex(pid)} (esperado 0x15)"
        self._init()

    def _w(self, reg, val):
        # Escribe reg + valor en una sola transacción con STOP
        self.i2c.writeto(_ADDR, bytes([reg, val]))

    def _r(self, reg, n=1):
        # Escribe el registro (con STOP) y luego lee (con STOP)
        self.i2c.writeto(_ADDR, bytes([reg]))
        return self.i2c.readfrom(_ADDR, n)

    def _init(self):
        # 1. Reset completo
        self._w(_REG_MODE_CFG, 0x40)
        time.sleep_ms(200)

        # 2. Esperar a que el bit RESET se limpie solo
        for _ in range(20):
            if not (self._r(_REG_MODE_CFG, 1)[0] & 0x40):
                break
            time.sleep_ms(10)

        # 3. FIFO: sin promediado, rollover habilitado
        self._w(_REG_FIFO_CFG,  0x10)

        # 4. Limpiar FIFO
        self._w(_REG_FIFO_WR,   0x00)
        self._w(_REG_FIFO_OVF,  0x00)
        self._w(_REG_FIFO_RD,   0x00)

        # 5. Modo SpO2 (rojo + IR)
        self._w(_REG_MODE_CFG,  0x03)
        time.sleep_ms(50)

        # 6. SpO2: ADC 4096nA, 100sps, pulso 411µs
        self._w(_REG_SPO2_CFG,  0x27)

        # 7. Potencia LEDs
        self._w(_REG_LED1_PA,   0x0C)   # LED Rojo ~4mA
        self._w(_REG_LED2_PA,   0x0C)   # LED IR  ~4mA

        time.sleep_ms(100)

    def read_fifo(self):
        """Retorna (red, ir) o (None, None) si no hay datos."""
        wr = self._r(_REG_FIFO_WR,  1)[0]
        rd = self._r(_REG_FIFO_RD,  1)[0]
        if wr == rd:
            return None, None
        raw = self._r(_REG_FIFO_DATA, 6)
        red = ((raw[0] & 0x03) << 16) | (raw[1] << 8) | raw[2]
        ir  = ((raw[3] & 0x03) << 16) | (raw[4] << 8) | raw[5]
        return red, ir
