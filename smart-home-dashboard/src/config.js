// App-wide constants. Relay GPIO numbers are for DISPLAY only:
// the ESP32 firmware owns the real pin mapping.
export const RELAYS = [
  // ESP32 #1 (Relays 1-8)
  { id: 'relay1',  number: 1,  name: 'Living Room Light', icon: 'light', gpio: 18 },
  { id: 'relay2',  number: 2,  name: 'Bedroom Light',     icon: 'light', gpio: 19 },
  { id: 'relay3',  number: 3,  name: 'Kitchen Light',     icon: 'light', gpio: 21 },
  { id: 'relay4',  number: 4,  name: 'Bathroom Light',    icon: 'light', gpio: 22 },
  { id: 'relay5',  number: 5,  name: 'Living Room Fan',   icon: 'fan',   gpio: 23 },
  { id: 'relay6',  number: 6,  name: 'Bedroom Fan',       icon: 'fan',   gpio: 27 },
  { id: 'relay7',  number: 7,  name: 'Air Conditioner',   icon: 'ac',    gpio: 25 },
  { id: 'relay8',  number: 8,  name: 'Other Appliance',   icon: 'plug',  gpio: 26 },

  // ESP32 #2 (Relays 9-16)
  { id: 'relay9',  number: 9,  name: 'Balcony Light',     icon: 'light', gpio: 18 },
  { id: 'relay10', number: 10, name: 'Guest Room Light',  icon: 'light', gpio: 19 },
  { id: 'relay11', number: 11, name: 'Guest Room Fan',    icon: 'fan',   gpio: 21 },
  { id: 'relay12', number: 12, name: 'Dining Light',      icon: 'light', gpio: 22 },
  { id: 'relay13', number: 13, name: 'Corridor Light',    icon: 'light', gpio: 23 },
  { id: 'relay14', number: 14, name: 'Garden Light',      icon: 'light', gpio: 27 },
  { id: 'relay15', number: 15, name: 'Water Heater',      icon: 'plug',  gpio: 25 },
  { id: 'relay16', number: 16, name: 'Exhaust Fan',       icon: 'fan',   gpio: 26 },
]

export const DEVICE_OFFLINE_AFTER_SEC = 35   // heartbeat is sent every 10 s
export const COMMAND_TIMEOUT_MS = 10000      // wait this long for the ESP32 to confirm
export const SENSOR_STALE_SEC = 60           // sensors are written every 5 s
export const DEFAULT_THRESHOLDS = { warn: 30, critical: 35 }
export const HISTORY_RANGES = [
  { key: '1h',  label: '1 hour',   points: 60 },
  { key: '6h',  label: '6 hours',  points: 360 },
  { key: '24h', label: '24 hours', points: 1440 },
]

// Offered once, when the user has no rooms yet ("Use suggested rooms").
export const SUGGESTED_ROOMS = [
  { name: 'Living Room', devices: [{ name: 'Light', type: 'light', relay: 'relay1' }, { name: 'Fan', type: 'fan', relay: 'relay5' }] },
  { name: 'Bedroom', devices: [{ name: 'Light', type: 'light', relay: 'relay2' }, { name: 'Fan', type: 'fan', relay: 'relay6' }] },
  { name: 'Kitchen', devices: [{ name: 'Light', type: 'light', relay: 'relay3' }] },
  { name: 'Bathroom', devices: [{ name: 'Light', type: 'light', relay: 'relay4' }] },
  { name: 'Other', devices: [{ name: 'Air Conditioner', type: 'ac', relay: 'relay7' }, { name: 'Appliance', type: 'plug', relay: 'relay8' }] },
]
