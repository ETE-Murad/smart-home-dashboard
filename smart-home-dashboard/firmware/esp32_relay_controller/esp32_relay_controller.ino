/*
  Smart Home relay controller - ESP32 DevKit V1 + 8-channel relay module +
  Firebase Realtime Database

  Dual-Control:
    1. Control via Website (Firebase commands)
    2. Control via Physical Manual Wall Switches (instant local toggle + cloud
  sync)

  Data flow:   Website -> /relays (desired) -> ESP32 -> GPIO -> relay
               Manual Switch -> ESP32 -> GPIO -> relay (instant) -> sync /relays
  & /relayStatus ESP32 -> /relayStatus (actual), /device (heartbeat), /sensors,
  /sensorStatus, /history

  Library needed (Arduino IDE -> Library Manager):
    - "Firebase Arduino Client Library for ESP8266 and ESP32" by Mobizt (v4.x)
    - "DHT sensor library" by Adafruit (+ "Adafruit Unified Sensor")
*/
#include "soc/rtc_cntl_reg.h"
#include "soc/soc.h"
#include <DHT.h>
#include <Firebase_ESP_Client.h>
#include <WiFi.h>
#include <addons/TokenHelper.h>
#include <time.h>

// ======================= 1. YOUR SETTINGS =======================
#define WIFI_SSID "TP-LINK_E7AE"
#define WIFI_PASSWORD "65136096"

#define API_KEY "AIzaSyBScis-XFP3HauZGljn143fKhmv6tR8FtE"
#define DATABASE_URL                                                           \
  "https://"                                                                   \
  "home-automation-8354f-default-rtdb.asia-southeast1.firebasedatabase.app"

// Put your Home ID from the website (Settings -> Home & ESP32 Configuration)
#define HOME_ID "home_mvv302pm_9wsa"

#define DEVICE_EMAIL "mdmuraduzzamansifat@gmail.com"
#define DEVICE_PASSWORD "2204019"

#define FW_VERSION "2.4"
#define RELAY_OFFSET 0

// ======================= PATH HELPER =======================
String homePath(const String &sub) {
  if (strlen(HOME_ID) == 0 || strcmp(HOME_ID, "YOUR_HOME_ID") == 0) {
    return sub;
  }
  return String("/homes/") + HOME_ID + sub;
}

// ======================= 2. HARDWARE: RELAYS =======================
const int RELAY_PINS[8] = {18, 19, 21, 22, 23, 27, 25, 26};
const int RELAY_ON =
    LOW; // active-LOW module. Swap LOW/HIGH if yours is active-HIGH.
const int RELAY_OFF = HIGH;

// ======================= 3. HARDWARE: MANUAL WALL SWITCHES
// ======================= Set to true to enable manual physical wall switch
// inputs.
#define ENABLE_MANUAL_SWITCHES true

// Switch Modes:
// 1 = TOGGLE: Traditional 2-way mode (any toggle inverts relay state)
// 2 = BUTTON: Momentary push button / bell switch (press toggles relay state)
// 3 = FOLLOW: Explicit position mode (Switch ON = Light ON, Switch OFF = Light
// OFF.
//             If turned OFF from website while switch was ON, you flip switch
//             OFF then ON to turn light back ON).
#define SWITCH_MODE_TOGGLE 1
#define SWITCH_MODE_BUTTON 2
#define SWITCH_MODE_FOLLOW 3
#define SWITCH_TYPE SWITCH_MODE_FOLLOW

// Logic level when manual switch is in the "ON" position.
// When switch is wired between GPIO and GND with internal INPUT_PULLUP:
// Contacts closed to GND = LOW.
// If your switch orientation is reversed, change this to HIGH.
#define SWITCH_ON_STATE HIGH

// Manual switch input pins corresponding to Relays 1 to 8:
// Wire each switch between the GPIO pin and GND.
// ESP32 internal INPUT_PULLUP is used (no external resistors needed!).
// Set any pin to -1 if that specific relay does not have a physical switch
// wired.
const int SWITCH_PINS[8] = {13, 14, 16, 17, 32, 33, 12, 15};

// Debounce state tracking
int lastSwitchReading[8];
int stableSwitchState[8];
unsigned long lastDebounceTime[8];
const unsigned long DEBOUNCE_DELAY_MS = 35; // 35ms mechanical filter (immune to AC hum / switch bounce)
volatile bool needSync[8] = {false, false, false, false, false, false, false, false};
volatile unsigned long lastManualActionTime[8] = {0, 0, 0, 0, 0, 0, 0, 0};

// ======================= 4. HARDWARE: SENSORS =======================
#define DHT_PIN 5
#define DHT_TYPE DHT11 // Set to DHT11 (blue sensor)
#define VOLTAGE_PIN 34
#define CURRENT_PIN 35
// Set to false for any sensor that is NOT wired.
#define HAS_DHT true
#define HAS_VOLTAGE_SENSOR true
#define HAS_CURRENT_SENSOR true
float VOLT_CAL = 0.50;
float CURR_CAL = 0.0080;

// ======================= 5. TIMING (milliseconds) =======================
const unsigned long RELAY_POLL_MS =
    750; // Fast relay polling (was 2500ms) for snappy response
const unsigned long SENSOR_MS =
    20000; // Telemetry broadcast interval (was 5000ms) to prevent SSL traffic
           // congestion
const unsigned long HEARTBEAT_MS = 10000;
const unsigned long HISTORY_MS = 60000;
const unsigned long WIFI_RETRY_MS = 10000;
const unsigned long AUTH_RETRY_MS = 30000; // retry token every 30 s on failure

// ======================= STATE =======================
DHT dht(DHT_PIN, DHT_TYPE);
FirebaseData fbdoRead;
FirebaseData fbdoWrite;
FirebaseAuth auth;
FirebaseConfig config;

bool applied[8];      // what each relay is physically set to
bool appliedKnown[8]; // false until the first command has been applied
bool statusDirty[8];  // true = needs to be reported to /relayStatus

float temperatureC = 0, humidityPct = 0, voltageRMS = 0, currentRMS = 0,
      realPower = 0;
bool haveDht = false;
int dhtFails = 0;

unsigned long lastRelay = 0, lastSensor = 0, lastHeartbeat = 0, lastHistory = 0;
unsigned long lastWifiTry = 0, lastAuthRetry = 0;
bool firebaseStarted = false;
int authFailCount = 0;

// ======================= TIME / NTP =======================
void syncNTP() {
  time_t nowSec = time(nullptr);
  if (nowSec > 24 * 3600)
    return; // already synchronized
  Serial.print("Synchronizing time via NTP");
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  int retry = 0;
  while (nowSec < 24 * 3600 && retry < 20) {
    delay(500);
    Serial.print(".");
    nowSec = time(nullptr);
    retry++;
  }
  if (nowSec > 24 * 3600) {
    Serial.printf(" OK (%ld)\n", (long)nowSec);
  } else {
    Serial.println(" Timed out - continuing with local fallback");
  }
}

// ======================= FIREBASE INIT =======================
void startFirebase() {
  syncNTP();
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  auth.user.email = DEVICE_EMAIL;
  auth.user.password = DEVICE_PASSWORD;

  config.token_status_callback = tokenStatusCallback;

  config.timeout.serverResponse = 15 * 1000;
  config.timeout.socketConnection = 15 * 1000;
  config.timeout.sslHandshake = 15 * 1000;
  config.timeout.tokenGenerationBeginStep = 30 * 1000;

  fbdoRead.setBSSLBufferSize(4096, 1024);
  fbdoRead.setResponseSize(2048);
  fbdoWrite.setBSSLBufferSize(4096, 1024);
  fbdoWrite.setResponseSize(2048);

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  firebaseStarted = true;
  authFailCount = 0;
  Serial.println("Firebase.begin() called.");
}

// ======================= SENSORS =======================
void measureElectrical() {
  const int N = 2000;
  static uint16_t vRaw[N], iRaw[N];
  for (int i = 0; i < N; i++) {
    vRaw[i] = analogRead(VOLTAGE_PIN);
    iRaw[i] = analogRead(CURRENT_PIN);
    delayMicroseconds(100);
  }
  double vMean = 0, iMean = 0;
  for (int i = 0; i < N; i++) {
    vMean += vRaw[i];
    iMean += iRaw[i];
  }
  vMean /= N;
  iMean /= N;

  double sumV2 = 0, sumI2 = 0, sumP = 0;
  for (int i = 0; i < N; i++) {
    double v = (vRaw[i] - vMean) * VOLT_CAL;
    double c = (iRaw[i] - iMean) * CURR_CAL;
    sumV2 += v * v;
    sumI2 += c * c;
    sumP += v * c;
  }
  voltageRMS = sqrt(sumV2 / N);
  currentRMS = sqrt(sumI2 / N);
  realPower = fabs(sumP / N);
  if (currentRMS < 0.05) {
    currentRMS = 0;
    realPower = 0;
  }
  if (voltageRMS < 5) {
    voltageRMS = 0;
  }
}

// Direct hardware bit-bang reader (immune to ESP32 240MHz library timing
// jitter)
bool readDHT11Direct(float &tOut, float &hOut) {
  uint8_t data[5] = {0, 0, 0, 0, 0};

  // 1. Start signal: Pull LOW for 25ms
  pinMode(DHT_PIN, OUTPUT);
  digitalWrite(DHT_PIN, LOW);
  delay(25);

  // 2. Open-drain release to INPUT_PULLUP
  pinMode(DHT_PIN, INPUT_PULLUP);

  // 3. Sensor handshake: wait up to 2000us for any LOW pulse from sensor
  unsigned long timeout = micros();
  bool sawLow = false;
  while (micros() - timeout < 2000) {
    if (digitalRead(DHT_PIN) == LOW) {
      sawLow = true;
      break;
    }
  }

  if (!sawLow) {
    Serial.printf("[DHT11 Handshake] Pin %d stayed 100%% HIGH. Sensor is not "
                  "transmitting.\n",
                  DHT_PIN);
    return false;
  }

  // Sensor holds LOW for ~80us
  timeout = micros();
  while (digitalRead(DHT_PIN) == LOW) {
    if (micros() - timeout > 150)
      return false;
  }

  // Sensor pulls HIGH for ~80us
  timeout = micros();
  while (digitalRead(DHT_PIN) == HIGH) {
    if (micros() - timeout > 150)
      return false;
  }

  // 4. Read 40 data bits
  noInterrupts();
  for (int i = 0; i < 40; i++) {
    timeout = micros();
    while (digitalRead(DHT_PIN) == LOW) {
      if (micros() - timeout > 100) {
        interrupts();
        return false;
      }
    }
    unsigned long tStart = micros();
    while (digitalRead(DHT_PIN) == HIGH) {
      if (micros() - tStart > 120) {
        interrupts();
        return false;
      }
    }
    if ((micros() - tStart) > 40) {
      data[i / 8] |= (1 << (7 - (i % 8)));
    }
  }
  interrupts();

  // 5. Checksum verification
  uint8_t sum = (data[0] + data[1] + data[2] + data[3]) & 0xFF;
  if (data[4] == sum && (data[0] != 0 || data[2] != 0)) {
    hOut = (float)data[0] + ((float)data[1] * 0.1f);
    tOut = (float)data[2] + ((float)data[3] * 0.1f);
    return true;
  }
  return false;
}

void readDht() {
  if (!HAS_DHT)
    return;
  int pinLevel = digitalRead(DHT_PIN);
  float t = dht.readTemperature();
  float h = dht.readHumidity();

  // If Adafruit library fails, fallback to direct bit-bang reader
  if (isnan(t) || isnan(h)) {
    float directT = 0, directH = 0;
    if (readDHT11Direct(directT, directH)) {
      t = directT;
      h = directH;
    }
  }

  if (!isnan(t) && !isnan(h)) {
    temperatureC = t;
    humidityPct = h;
    haveDht = true;
    dhtFails = 0;
    Serial.printf("[DHT11] Success -> Temp: %.1f C, Humidity: %.0f %%\n", t, h);
  } else {
    if (dhtFails < 100)
      dhtFails++;
    Serial.printf(
        "[DHT11] Warning: Reading failed (fail count: %d). Pin %d state: %s\n",
        dhtFails, DHT_PIN,
        pinLevel == HIGH ? "HIGH (Idle OK)" : "LOW (Stuck to GND/No pullup)");
  }
}

// ======================= RELAYS =======================
void readRelays() {
  if (!Firebase.RTDB.getJSON(&fbdoRead, homePath("/relays"))) {
    Serial.printf("Relay read failed: %s\n", fbdoRead.errorReason().c_str());
    return;
  }
  FirebaseJson &json = fbdoRead.jsonObject();
  FirebaseJsonData r;
  unsigned long now = millis();
  for (int i = 0; i < 8; i++) {
    int relayNum = i + 1 + RELAY_OFFSET;
    String key = "relay" + String(relayNum);
    if (json.get(r, key) && r.type == "boolean") {
      bool want = r.boolValue;

      // CRITICAL RACE-CONDITION GUARD:
      // If a physical switch was flipped locally (< 3500ms) or is waiting to sync,
      // ignore stale incoming cloud data for this relay!
      // Local physical switch ALWAYS has absolute priority over in-flight cloud packets.
      if (needSync[i] || (now - lastManualActionTime[i] < 3500)) {
        continue;
      }

      if (!appliedKnown[i] || applied[i] != want) {
        digitalWrite(RELAY_PINS[i], want ? RELAY_ON : RELAY_OFF);
        applied[i] = want;
        appliedKnown[i] = true;
        statusDirty[i] = true;
        Serial.printf("[Cloud Command] %s -> %s\n", key.c_str(),
                      want ? "ON" : "OFF");
      }
    }
  }
}

void publishRelayStatus() {
  bool any = false;
  FirebaseJson json;
  for (int i = 0; i < 8; i++) {
    if (!statusDirty[i])
      continue;
    int relayNum = i + 1 + RELAY_OFFSET;
    String key = "relay" + String(relayNum);
    json.set(key + "/state", applied[i]);
    json.set(key + "/updatedAt/.sv", "timestamp"); // server time
    any = true;
  }
  if (!any)
    return;
  if (Firebase.RTDB.updateNode(&fbdoWrite, homePath("/relayStatus"), &json)) {
    for (int i = 0; i < 8; i++)
      statusDirty[i] = false;
  } else {
    Serial.printf("Status write failed: %s\n", fbdoWrite.errorReason().c_str());
  }
}

// Immediately pushes state to both /relays and /relayStatus when physical
// switch is toggled
void syncRelayToFirebase(int i) {
  if (!Firebase.ready())
    return;
  int relayNum = i + 1 + RELAY_OFFSET;
  String key = "relay" + String(relayNum);

  // 1. Update desired state in /relays so website toggle reflects physical
  // action
  bool ok1 = Firebase.RTDB.setBool(&fbdoWrite, homePath("/relays/" + key), applied[i]);

  // 2. Update actual status in /relayStatus
  FirebaseJson statusJson;
  statusJson.set("state", applied[i]);
  statusJson.set("updatedAt/.sv", "timestamp");
  bool ok2 = Firebase.RTDB.updateNode(&fbdoWrite, homePath("/relayStatus/" + key),
                           &statusJson);

  // Only clear flag when write to Firebase has truly succeeded
  if (ok1 && ok2) {
    needSync[i] = false;
    statusDirty[i] = false;
  }
}

// ======================= MANUAL WALL SWITCHES LOGIC =======================
void checkManualSwitches() {
  if (!ENABLE_MANUAL_SWITCHES)
    return;
  unsigned long now = millis();

  for (int i = 0; i < 8; i++) {
    int pin = SWITCH_PINS[i];
    if (pin < 0)
      continue;

    int reading = digitalRead(pin);

    // If reading changed (noise or user flip)
    if (reading != lastSwitchReading[i]) {
      lastDebounceTime[i] = now;
      lastSwitchReading[i] = reading;
    }

    // Steady for longer than debounce delay
    if ((now - lastDebounceTime[i]) > DEBOUNCE_DELAY_MS) {
      if (reading != stableSwitchState[i]) {
        stableSwitchState[i] = reading;

#if (SWITCH_TYPE == SWITCH_MODE_BUTTON)
        // Push button (active LOW): trigger when pressed (HIGH -> LOW)
        if (reading == LOW) {
          bool newState = !applied[i];
          applied[i] = newState;
          appliedKnown[i] = true;
          // Instant 0ms hardware relay actuation!
          digitalWrite(RELAY_PINS[i], newState ? RELAY_ON : RELAY_OFF);
          statusDirty[i] = true;
          needSync[i] = true; // Signal Core 1 to sync to Firebase in background
          lastManualActionTime[i] = now;
          int relayNumber = i + 1 + RELAY_OFFSET;
          Serial.printf("[Physical Button] -> relay%d: %s\n", relayNumber,
                        newState ? "ON" : "OFF");
        }

#elif (SWITCH_TYPE == SWITCH_MODE_FOLLOW)
        // Explicit Position Mode (Switch ON = Light ON, Switch OFF = Light
        // OFF): If switch is flipped to ON position, turns relay ON. If switch
        // is flipped to OFF position, turns relay OFF. If turned OFF from
        // website while switch was ON, flipping switch OFF syncs it without
        // changing the light, and flipping it ON turns the light ON!
        bool targetState = (reading == SWITCH_ON_STATE);
        if (targetState != applied[i]) {
          applied[i] = targetState;
          appliedKnown[i] = true;
          // Instant 0ms hardware relay actuation!
          digitalWrite(RELAY_PINS[i], targetState ? RELAY_ON : RELAY_OFF);
          statusDirty[i] = true;
          needSync[i] = true; // Signal Core 1 to sync to Firebase in background
          lastManualActionTime[i] = now;
          int relayNumber = i + 1 + RELAY_OFFSET;
          Serial.printf("[Physical Switch Position] -> relay%d: %s\n",
                        relayNumber, targetState ? "ON" : "OFF");
        } else {
          int relayNumber = i + 1 + RELAY_OFFSET;
          Serial.printf("[Physical Switch Synced] -> relay%d already %s\n",
                        relayNumber, targetState ? "ON" : "OFF");
        }

#else
        // TOGGLE: Traditional 2-way mode (any position flip inverts relay)
        bool newState = !applied[i];
        applied[i] = newState;
        appliedKnown[i] = true;
        // Instant 0ms hardware relay actuation!
        digitalWrite(RELAY_PINS[i], newState ? RELAY_ON : RELAY_OFF);
        statusDirty[i] = true;
        needSync[i] = true; // Signal Core 1 to sync to Firebase in background
        lastManualActionTime[i] = now;
        int relayNumber = i + 1 + RELAY_OFFSET;
        Serial.printf("[Physical Switch Toggle] -> relay%d: %s\n", relayNumber,
                      newState ? "ON" : "OFF");
#endif
      }
    }
  }
}

// Dedicated FreeRTOS Real-Time Switch Task (pinned to Core 0)
// Runs every 10ms with ZERO latency, completely immune to Wi-Fi/SSL network blocking!
void manualSwitchTask(void *pvParameters) {
  for (;;) {
    checkManualSwitches();
    vTaskDelay(pdMS_TO_TICKS(10));
  }
}

// ======================= HEARTBEAT / SENSORS / HISTORY =======================
void publishHeartbeat() {
  FirebaseJson json;
  json.set("lastSeen/.sv", "timestamp");
  json.set("rssi", WiFi.RSSI());
  json.set("ip", WiFi.localIP().toString());
  json.set("uptimeSec", (int)(millis() / 1000));
  json.set("fw", FW_VERSION);
  if (!Firebase.RTDB.updateNode(&fbdoWrite, homePath("/device"), &json)) {
    Serial.printf("Heartbeat failed: %s\n", fbdoWrite.errorReason().c_str());
  }
}

void publishSensors() {
  readDht();
  if (HAS_VOLTAGE_SENSOR || HAS_CURRENT_SENSOR)
    measureElectrical();

  bool dhtOk = HAS_DHT && haveDht && dhtFails < 3;

  FirebaseJson data;
  data.set("updatedAt/.sv", "timestamp");
  if (dhtOk) {
    data.set("temperature", temperatureC);
    data.set("humidity", humidityPct);
  }
  if (HAS_VOLTAGE_SENSOR)
    data.set("voltage", voltageRMS);
  if (HAS_CURRENT_SENSOR)
    data.set("current", currentRMS);
  if (HAS_VOLTAGE_SENSOR && HAS_CURRENT_SENSOR)
    data.set("power", realPower);
  if (!Firebase.RTDB.setJSON(&fbdoWrite, homePath("/sensors"), &data)) {
    Serial.printf("Sensor write failed: %s\n", fbdoWrite.errorReason().c_str());
  } else if (dhtOk) {
    Serial.printf(
        "[Firebase] Sensors updated -> Temp: %.1f C, Humidity: %.0f %%\n",
        temperatureC, humidityPct);
  }

  FirebaseJson st;
  st.set("dht", !HAS_DHT ? "not_configured" : (dhtOk ? "ok" : "error"));
  st.set("voltage", HAS_VOLTAGE_SENSOR ? "ok" : "not_configured");
  st.set("current", HAS_CURRENT_SENSOR ? "ok" : "not_configured");
  if (!Firebase.RTDB.setJSON(&fbdoWrite, homePath("/sensorStatus"), &st)) {
    Serial.printf("Sensor status write failed: %s\n",
                  fbdoWrite.errorReason().c_str());
  }
}

void publishHistory() {
  bool dhtOk = HAS_DHT && haveDht && dhtFails < 3;
  if (!dhtOk && !HAS_VOLTAGE_SENSOR && !HAS_CURRENT_SENSOR)
    return;
  FirebaseJson rec;
  rec.set("ts/.sv", "timestamp");
  if (dhtOk) {
    rec.set("temperature", temperatureC);
    rec.set("humidity", humidityPct);
  }
  if (HAS_VOLTAGE_SENSOR)
    rec.set("voltage", voltageRMS);
  if (HAS_CURRENT_SENSOR)
    rec.set("current", currentRMS);
  if (HAS_VOLTAGE_SENSOR && HAS_CURRENT_SENSOR)
    rec.set("power", realPower);
  if (!Firebase.RTDB.pushJSON(&fbdoWrite, homePath("/history"), &rec)) {
    Serial.printf("History write failed: %s\n",
                  fbdoWrite.errorReason().c_str());
  }
}

// ======================= SETUP / LOOP =======================
void setup() {
  // Disable brownout detector to prevent reboot loops on power supply voltage
  // dips (e.g. ~4.6V on VIN)
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

  Serial.begin(115200);
  delay(500);
  Serial.println("\n\n=== Smart Home ESP32 v" FW_VERSION
                 " (Dual-Control Edition) ===");

  // Relays: set level BEFORE setting pin as OUTPUT to avoid glitch on power-up
  for (int i = 0; i < 8; i++) {
    digitalWrite(RELAY_PINS[i], RELAY_OFF);
    pinMode(RELAY_PINS[i], OUTPUT);
    digitalWrite(RELAY_PINS[i], RELAY_OFF);
    applied[i] = false;
    appliedKnown[i] = false;
    statusDirty[i] = false;
  }

  // Manual Switches: configure with internal pull-up (INPUT_PULLUP)
  if (ENABLE_MANUAL_SWITCHES) {
    for (int i = 0; i < 8; i++) {
      if (SWITCH_PINS[i] >= 0) {
        pinMode(SWITCH_PINS[i], INPUT_PULLUP);
        stableSwitchState[i] = digitalRead(SWITCH_PINS[i]);
        lastSwitchReading[i] = stableSwitchState[i];
        lastDebounceTime[i] = 0;
      }
    }
    Serial.println("Manual physical switches configured with INPUT_PULLUP.");

    // Launch Dedicated Real-Time Switch Task on Core 0!
    // Gives TRUE instantaneous sub-25ms switch response, completely immune to WiFi/Firebase SSL blocking!
    xTaskCreatePinnedToCore(
        manualSwitchTask,
        "SwitchTask",
        4096,
        NULL,
        2,              // High priority
        NULL,
        0               // Pinned to Core 0 (WiFi/Firebase runs on Core 1)
    );
    Serial.println("Real-time manual switch task started on Core 0.");
  }

  analogReadResolution(12);
  analogSetPinAttenuation(VOLTAGE_PIN, ADC_11db);
  analogSetPinAttenuation(CURRENT_PIN, ADC_11db);
  if (HAS_DHT)
    dht.begin();

  // --- Wi-Fi ---
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(
      false); // Disable modem sleep to prevent ping / SSL latency spikes
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to Wi-Fi");
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    delay(250);
    Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\nWi-Fi connected  IP: %s\n",
                  WiFi.localIP().toString().c_str());
    startFirebase();
  } else {
    Serial.println("\nWi-Fi not connected yet - will retry in loop()");
  }
}

void loop() {
  // 1. Process background cloud sync for any manual switches toggled by Core 0
  for (int i = 0; i < 8; i++) {
    if (needSync[i]) {
      syncRelayToFirebase(i);
    }
  }

  unsigned long now = millis();

  // ---- Wi-Fi watchdog ----
  if (WiFi.status() != WL_CONNECTED) {
    if (now - lastWifiTry > WIFI_RETRY_MS) {
      lastWifiTry = now;
      Serial.println("Wi-Fi lost - reconnecting...");
      WiFi.disconnect();
      WiFi.setSleep(false);
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    }
    return;
  }

  // ---- Start Firebase once Wi-Fi comes up ----
  if (!firebaseStarted) {
    startFirebase();
    return;
  }

  // ---- Token / auth watchdog ----
  if (Firebase.isTokenExpired() || !Firebase.ready()) {
    if (now - lastAuthRetry > AUTH_RETRY_MS) {
      lastAuthRetry = now;
      authFailCount++;
      Serial.printf("Firebase not ready (attempt %d) - refreshing token...\n",
                    authFailCount);
      Firebase.refreshToken(&config);
      delay(500);
      if (authFailCount >= 3) {
        Serial.println("3 failures - doing full Firebase re-init...");
        Firebase.reset(&config);
        delay(1000);
        startFirebase();
      }
    }
    return;
  }

  // ---- Clear fail counter once healthy ----
  if (authFailCount > 0) {
    Serial.println("Firebase token OK.");
    authFailCount = 0;
  }

  // ---- Normal operation ----
  if (now - lastRelay >= RELAY_POLL_MS) {
    lastRelay = now;
    readRelays();
    publishRelayStatus();
  }
  if (now - lastHeartbeat >= HEARTBEAT_MS) {
    lastHeartbeat = now;
    publishHeartbeat();
  }
  if (now - lastSensor >= SENSOR_MS) {
    lastSensor = now;
    publishSensors();
  }
  if (now - lastHistory >= HISTORY_MS) {
    lastHistory = now;
    publishHistory();
  }
}
