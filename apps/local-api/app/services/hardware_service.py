import time
import logging
import os

logger = logging.getLogger("smart_locker.hardware")

# Import serial with fallback to simulation mode
SERIAL_AVAILABLE = False
try:
    import serial
    import serial.tools.list_ports
    SERIAL_AVAILABLE = True
except ImportError:
    logger.warning("pyserial is not installed.")

# Explicit simulation mode setting (defaults to false for production safety)
SIMULATION_MODE = os.getenv("SIMULATION_MODE", "false").lower() == "true"
if SIMULATION_MODE:
    logger.info("HARDWARE SERVICE: Running in development SIMULATION mode.")

class HardwareService:
    def __init__(self):
        # Map controller_id (e.g. "CTRL-001") to their Serial connection object
        self.connections = {}
        self.port = os.getenv("SERIAL_PORT", None)
        
        if SERIAL_AVAILABLE:
            self._connect_serial()

    def _connect_serial(self):
        """Attempts to discover and connect to all connected ESP32 controllers."""
        # Close any active connections first
        for ctrl_id, conn in list(self.connections.items()):
            try:
                if conn and conn.is_open:
                    conn.close()
            except Exception:
                pass
        self.connections.clear()

        if not SERIAL_AVAILABLE:
            return

        if self.port:
            try:
                conn = serial.Serial(self.port, 115200, timeout=1.0)
                # Assume CTRL-001 for configured single port
                self.connections["CTRL-001"] = conn
                logger.info(f"HARDWARE: Connected to configured serial port {self.port} as CTRL-001")
                return
            except Exception as e:
                logger.error(f"HARDWARE ERROR: Failed to connect to configured port {self.port}: {e}")

        # Auto-discovery fallback
        ports = serial.tools.list_ports.comports()
        discovered_conns = []
        
        for p in ports:
            # Look for typical USB Serial chipsets (Silicon Labs, CH340, FTDI, Arduino)
            if any(x in p.device.lower() for x in ["usb", "acm", "ttyusb", "ch340", "cp210"]):
                try:
                    conn = serial.Serial(p.device, 115200, timeout=1.0)
                    time.sleep(0.1) # Wait for serial device warm up
                    
                    # Test connection by sending PING
                    conn.write(b"PING\n")
                    time.sleep(0.1)
                    response = conn.readline().decode('utf-8', errors='ignore').strip()
                    
                    if "PONG" in response:
                        # If response is "PONG CTRL-001", we extract the controller ID
                        if " " in response:
                            parts = response.split(" ")
                            if len(parts) > 1:
                                ctrl_id = parts[1].strip()
                                self.connections[ctrl_id] = conn
                                logger.info(f"HARDWARE: Connected to ESP32 {ctrl_id} on {p.device}")
                                continue
                        # Else store as generic discovered controller
                        discovered_conns.append(conn)
                    else:
                        # If no response, store as generic anyway for sequential assignment fallback
                        discovered_conns.append(conn)
                except Exception as e:
                    logger.warning(f"HARDWARE: Found USB device {p.device} but failed to open: {e}")
                    
        # Assign generic PONG controllers sequentially to CTRL-001, CTRL-002, etc.
        for i, conn in enumerate(discovered_conns):
            ctrl_id = f"CTRL-{i+1:03d}"
            if ctrl_id not in self.connections:
                self.connections[ctrl_id] = conn
                logger.info(f"HARDWARE: Assigned generic USB Serial device {conn.port} to {ctrl_id}")

        if not self.connections:
            logger.warning("HARDWARE: No active ESP32 USB Serial ports found. Falling back to SIMULATION mode.")

    def check_controller_status(self, controller_id: str) -> bool:
        """
        Polls the physical locker controller unit to ensure it is online.
        """
        conn = self.connections.get(controller_id)
        if SERIAL_AVAILABLE and conn and conn.is_open:
            try:
                # Clear read buffer
                conn.reset_input_buffer()
                
                # Send a status inquiry pin command
                conn.write(b"PING\n")
                conn.flush()
                
                response = conn.readline().decode('utf-8', errors='ignore').strip()
                if "PONG" in response or "OK" in response:
                    return True
            except Exception as e:
                logger.error(f"HARDWARE ERROR: Failed to ping ESP32 controller {controller_id}: {e}")
                # Try to reconnect
                self._connect_serial()
                
        # If in explicit simulation mode, mock as online
        if SIMULATION_MODE:
            logger.info(f"Polling hardware controller {controller_id} status (Simulated Online)...")
            return True
            
        logger.warning(f"HARDWARE: Controller {controller_id} is OFFLINE (no response / disconnected).")
        return False

    def unlock_locker_door(self, controller_id: str, locker_number: int) -> bool:
        """
        Sends an electrical pulse command to unlock the physical locker door solenoid.
        """
        try:
            logger.info(f"TRIGGER SIGNAL: Sending unlock pulse to Controller: {controller_id}, Locker Number (Local Channel): {locker_number}")
            
            conn = self.connections.get(controller_id)
            if SERIAL_AVAILABLE and conn and conn.is_open:
                # Clear read buffer
                conn.reset_input_buffer()
                
                # Format: "UNLOCK <locker_number>\n"
                command = f"UNLOCK {locker_number}\n"
                conn.write(command.encode('utf-8'))
                conn.flush()
                logger.info(f"HARDWARE: Sent serial command: {command.strip()} to {controller_id}")
                
                # Check feedback from ESP32
                time.sleep(0.1)
                response = conn.readline().decode('utf-8', errors='ignore').strip()
                logger.info(f"HARDWARE: ESP32 response: {response}")
                
                if "OK" in response or "UNLOCKED" in response:
                    return True
                return False
                
            # If in explicit simulation mode, mock as unlocked
            if SIMULATION_MODE:
                time.sleep(0.05)
                logger.info(f"SUCCESS: Physical solenoid coil activated for locker {controller_id}-{locker_number} (Simulated).")
                return True
                
            logger.error(f"HARDWARE ERROR: Locker unlock failed because controller {controller_id} is offline/disconnected.")
            return False
        except Exception as e:
            logger.error(f"HARDWARE ERROR: Failed to unlock locker {controller_id}-{locker_number}: {e}")
            return False

hardware_service = HardwareService()

