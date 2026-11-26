/*
  Smart Home Relay Controller #2 - ESP32 DevKit V1 + 8-channel relay module + Firebase Realtime Database
  
  Dual-Control:
    1. Control via Website (Firebase commands)
    2. Control via Physical Manual Wall Switches (instant local toggle + cloud sync)

  Controls RELAYS 9 to 16 (Offset +8)
  Data flow:   Website -> /relays (desired) -> ESP32 #2 -> GPIO -> relay9..relay16
               Manual Switch -> ESP32 #2 -> GPIO -> relay (instant) -> sync /relays & /relayStatus
               ESP32 #2 -> /relayStatus (actual), /device (heartbeat)
*/
#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <addons/TokenHelper.h>
#include <DHT.h>
#include <time.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

// ======================= 1. YOUR SETTINGS =======================
#define WIFI_SSID       "TP-LINK_E7AE"
#define WIFI_PASSWORD   "65136096"

#define API_KEY         "AIzaSyBScis-XFP3HauZGljn143fKhmv6tR8FtE"
#define DATABASE_URL    "https://home-automation-8354f-default-rtdb.asia-southeast1.firebasedatabase.app"

// Put your Home ID from the website (Settings -> Home & ESP32 Configuration)
#define HOME_ID         "home_mvv5h96l_f84n"

// Dedicated Firebase account for ESP32 #2:
// Create in Firebase Console -> Authentication -> Users -> Add user
// Then add its UID to /devices in Realtime Database.
#define DEVICE_EMAIL    "esp32_2@home.local"
#define DEVICE_PASSWORD "CHANGE_ME_TO_A_LONG_PASSWORD"

#define FW_VERSION      "2.4-esp32-2"

// Relay offset: 8 means index 0..7 maps to relay9..relay16
#define RELAY_OFFSET    8

// ======================= PATH HELPER =======================
String homePath(const String& sub) {
  if (strlen(HOME_ID) == 0 || strcmp(HOME_ID, "YOUR_HOME_ID") == 0) {
    return sub;
  }
  return String("/homes/") + HOME_ID + sub;
}

// ======================= 2. HARDWARE: RELAYS =======================
// Pin assignments for ESP32 #2 (controlling relays 9 to 16)
const int RELAY_PINS[8] = {18, 19, 21, 22, 23, 27, 25, 26};
const int RELAY_ON  = LOW;    // active-LOW module. Swap LOW/HIGH if yours is active-HIGH.
const int RELAY_OFF = HIGH;

// ======================= 3. HARDWARE: MANUAL WALL SWITCHES =======================
// Set to true to enable manual physical wall switch inputs.
#define ENABLE_MANUAL_SWITCHES true

// Switch Modes:
// 1 = TOGGLE: Traditional 2-way mode (any toggle inverts relay state)
// 2 = BUTTON: Momentary push button / bell switch (press toggles relay state)
// 3 = FOLLOW: Explicit position mode (Switch ON = Light ON, Switch OFF = Light OFF.
//             If turned OFF from website while switch was ON, you flip switch OFF then ON to turn light back ON).
#define SWITCH_MODE_TOGGLE 1
#define SWITCH_MODE_BUTTON 2
#define SWITCH_MODE_FOLLOW 3
#define SWITCH_TYPE SWITCH_MODE_FOLLOW

// Logic level when manual switch is in the "ON" position.
// When switch is wired between GPIO and GND with internal INPUT_PULLUP:
// Contacts closed to GND = LOW.
// If your switch orientation is reversed, change this to HIGH.
#define SWITCH_ON_STATE LOW

// Manual switch input pins corresponding to Relays 9 to 16:
// Wire each switch between the GPIO pin and GND.
// ESP32 internal INPUT_PULLUP is used (no external resistors needed!).
// Set any pin to -1 if that specific relay does not have a physical switch wired.
const int SWITCH_PINS[8] = {13, 14, 16, 17, 32, 33, 12, 15};

// Debounce state tracking
int lastSwitchReading[8];
int stableSwitchState[8];
unsigned long lastDebounceTime[8];
const unsigned long DEBOUNCE_DELAY_MS = 35; // 35ms mechanical filter (immune to AC hum / switch bounce)
volatile bool needSync[8] = {false, false, false, false, false, false, false, false};
volatile unsigned long lastManualActionTime[8] = {0, 0, 0, 0, 0, 0, 0, 0};

// ======================= 4. HARDWARE: SENSORS =======================
#define DHT_PIN     4
#define DHT_TYPE    DHT11     // Set to DHT11 (blue sensor)
#define VOLTAGE_PIN 34
#define CURRENT_PIN 35
// Set to true if sensors are wired to ESP32 #2 as well
#define HAS_DHT            false
#define HAS_VOLTAGE_SENSOR false
#define HAS_CURRENT_SENSOR false
float VOLT_CAL = 0.50;
float CURR_CAL = 0.0080;

// ======================= 5. TIMING (milliseconds) =======================
const unsigned long RELAY_POLL_MS = 750;     // Fast relay polling (was 2500ms) for snappy response
const unsigned long SENSOR_MS     = 20000;   // Telemetry broadcast interval (was 5000ms) to prevent SSL congestion
const unsigned long HEARTBEAT_MS  = 10000;
const unsigned long HISTORY_MS    = 60000;
const unsigned long WIFI_RETRY_MS = 10000;
const unsigned long AUTH_RETRY_MS = 30000;

// ======================= STATE =======================
DHT dht(DHT_PIN, DHT_TYPE);
FirebaseData fbdoRead;
FirebaseData fbdoWrite;
FirebaseAuth auth;
FirebaseConfig config;

bool applied[8];        // what each relay is physically set to
bool appliedKnown[8];   // false until the first command has been applied
bool statusDirty[8];    // true = needs to be reported to /relayStatus

float temperatureC = 0, humidityPct = 0, voltageRMS = 0, currentRMS = 0, realPower = 0;
bool  haveDht = false;
int   dhtFails = 0;

unsigned long lastRelay = 0, lastSensor = 0, lastHeartbeat = 0, lastHistory = 0;
unsigned long lastWifiTry = 0, lastAuthRetry = 0;
bool firebaseStarted = false;
int  authFailCount = 0;

// ======================= TIME / NTP =======================
void syncNTP() {
  time_t nowSec = time(nullptr);
  if (nowSec > 24 * 3600) return;
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
  config.api_key      = API_KEY;
  config.database_url = DATABASE_URL;
  auth.user.email     = DEVICE_EMAIL;
  auth.user.password  = DEVICE_PASSWORD;

  config.token_status_callback = tokenStatusCallback;

  config.timeout.serverResponse           = 15 * 1000;
  config.timeout.socketConnection         = 15 * 1000;
  config.timeout.sslHandshake             = 15 * 1000;
  config.timeout.tokenGenerationBeginStep = 30 * 1000;

  fbdoRead.setBSSLBufferSize(4096, 1024);
  fbdoRead.setResponseSize(2048);
  fbdoWrite.setBSSLBufferSize(4096, 1024);
  fbdoWrite.setResponseSize(2048);

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  firebaseStarted = true;
  authFailCount   = 0;
  Serial.println("ESP32 #2 Firebase.begin() called.");
}

// ======================= SENSORS =======================
void measureElectrical() {
  if (!HAS_VOLTAGE_SENSOR && !HAS_CURRENT_SENSOR) return;
  const int N = 2000;
  static uint16_t vRaw[N], iRaw[N];
  for (int i = 0; i < N; i++) {
    vRaw[i] = analogRead(VOLTAGE_PIN);
    iRaw[i] = analogRead(CURRENT_PIN);
    delayMicroseconds(100);
  }
  double vMean = 0, iMean = 0;
  for (int i = 0; i < N; i++) { vMean += vRaw[i]; iMean += iRaw[i]; }
  vMean /= N; iMean /= N;

  double sumV2 = 0, sumI2 = 0, sumP = 0;
  for (int i = 0; i < N; i++) {
    double v = (vRaw[i] - vMean) * VOLT_CAL;
    double c = (iRaw[i] - iMean) * CURR_CAL;
    sumV2 += v * v; sumI2 += c * c; sumP += v * c;
  }
  voltageRMS = sqrt(sumV2 / N);
  currentRMS = sqrt(sumI2 / N);
  realPower  = fabs(sumP / N);
  if (currentRMS < 0.05) { currentRMS = 0; realPower = 0; }
  if (voltageRMS < 5)    { voltageRMS = 0; }
}

void readDht() {
  if (!HAS_DHT) return;
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  if (!isnan(t) && !isnan(h)) {
    temperatureC = t; humidityPct = h; haveDht = true; dhtFails = 0;
  } else if (dhtFails < 100) {
    dhtFails++;
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
        Serial.printf("[Cloud Command] %s -> %s\n", key.c_str(), want ? "ON" : "OFF");
      }
    }
  }
}

void publishRelayStatus() {
  bool any = false;
  FirebaseJson json;
  for (int i = 0; i < 8; i++) {
    if (!statusDirty[i]) continue;
    int relayNum = i + 1 + RELAY_OFFSET;
    String key = "relay" + String(relayNum);
    json.set(key + "/state", applied[i]);
    json.set(key + "/updatedAt/.sv", "timestamp");
    any = true;
  }
  if (!any) return;
  if (Firebase.RTDB.updateNode(&fbdoWrite, homePath("/relayStatus"), &json)) {
    for (int i = 0; i < 8; i++) statusDirty[i] = false;
  } else {
    Serial.printf("Status write failed: %s\n", fbdoWrite.errorReason().c_str());
  }
}

// Immediately pushes state to both /relays and /relayStatus when physical switch is toggled
void syncRelayToFirebase(int i) {
  if (!Firebase.ready()) return;
  int relayNum = i + 1 + RELAY_OFFSET;
  String key = "relay" + String(relayNum);

  // 1. Update desired state in /relays so website toggle reflects physical action
  bool ok1 = Firebase.RTDB.setBool(&fbdoWrite, homePath("/relays/" + key), applied[i]);

  // 2. Update actual status in /relayStatus
  FirebaseJson statusJson;
  statusJson.set("state", applied[i]);
  statusJson.set("updatedAt/.sv", "timestamp");
  bool ok2 = Firebase.RTDB.updateNode(&fbdoWrite, homePath("/relayStatus/" + key), &statusJson);

  // Only clear flag when write to Firebase has truly succeeded
  if (ok1 && ok2) {
    needSync[i] = false;
    statusDirty[i] = false;
  }
}

// ======================= MANUAL WALL SWITCHES LOGIC =======================
void checkManualSwitches() {
  if (!ENABLE_MANUAL_SWITCHES) return;
  unsigned long now = millis();

  for (int i = 0; i < 8; i++) {
    int pin = SWITCH_PINS[i];
    if (pin < 0) continue;

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
            Serial.printf("[Physical Button] -> relay%d: %s\n", relayNumber, newState ? "ON" : "OFF");
          }

        #elif (SWITCH_TYPE == SWITCH_MODE_FOLLOW)
          // Explicit Position Mode (Switch ON = Light ON, Switch OFF = Light OFF):
          // If switch is flipped to ON position, turns relay ON.
          // If switch is flipped to OFF position, turns relay OFF.
          // If turned OFF from website while switch was ON, flipping switch OFF
          // syncs it without changing the light, and flipping it ON turns the light ON!
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
            Serial.printf("[Physical Switch Position] -> relay%d: %s\n", relayNumber, targetState ? "ON" : "OFF");
          } else {
            int relayNumber = i + 1 + RELAY_OFFSET;
            Serial.printf("[Physical Switch Synced] -> relay%d already %s\n", relayNumber, targetState ? "ON" : "OFF");
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
          Serial.printf("[Physical Switch Toggle] -> relay%d: %s\n", relayNumber, newState ? "ON" : "OFF");
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

// ======================= HEARTBEAT / SENSORS =======================
void publishHeartbeat() {
  FirebaseJson json;
  json.set("lastSeen/.sv", "timestamp");
  json.set("rssi", WiFi.RSSI());
  json.set("ip", WiFi.localIP().toString());
  json.set("uptimeSec", (int)(millis() / 1000));
  json.set("fw", FW_VERSION);
  if (!Firebase.RTDB.updateNode(&fbdoWrite, homePath("/device_2"), &json)) {
    Serial.printf("ESP32 #2 Heartbeat failed: %s\n", fbdoWrite.errorReason().c_str());
  }
}

// ======================= SETUP / LOOP =======================
void setup() {
  // Disable brownout detector to prevent reboot loops on power supply voltage dips (e.g. ~4.6V on VIN)
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

  Serial.begin(115200);
  delay(500);
  Serial.println("\n\n=== Smart Home ESP32 #2 v" FW_VERSION " (Dual-Control Relays 9-16) ===");

  // Relays: set level BEFORE setting pin as OUTPUT to avoid glitch on power-up
  for (int i = 0; i < 8; i++) {
    digitalWrite(RELAY_PINS[i], RELAY_OFF);
    pinMode(RELAY_PINS[i], OUTPUT);
    digitalWrite(RELAY_PINS[i], RELAY_OFF);
    applied[i]      = false;
    appliedKnown[i] = false;
    statusDirty[i]  = false;
  }

  // Manual Switches: configure with internal pull-up (INPUT_PULLUP)
  if (ENABLE_MANUAL_SWITCHES) {
    for (int i = 0; i < 8; i++) {
      if (SWITCH_PINS[i] >= 0) {
        pinMode(SWITCH_PINS[i], INPUT_PULLUP);
        stableSwitchState[i] = digitalRead(SWITCH_PINS[i]);
        lastSwitchReading[i] = stableSwitchState[i];
        lastDebounceTime[i]  = 0;
      }
    }
    Serial.println("ESP32 #2 Manual physical switches configured with INPUT_PULLUP.");

    // Launch Dedicated Real-Time Switch Task on Core 0!
    // Gives TRUE instantaneous sub-25ms switch response, completely immune to WiFi/Firebase SSL blocking!
    xTaskCreatePinnedToCore(
        manualSwitchTask,
        "SwitchTask2",
        4096,
        NULL,
        2,              // High priority
        NULL,
        0               // Pinned to Core 0 (WiFi/Firebase runs on Core 1)
    );
    Serial.println("Real-time manual switch task started on Core 0.");
  }

  // --- Wi-Fi ---
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false); // Disable modem sleep to prevent ping / SSL latency spikes
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to Wi-Fi");
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    delay(250); Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\nWi-Fi connected  IP: %s\n", WiFi.localIP().toString().c_str());
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
      Serial.printf("Firebase not ready (attempt %d) - refreshing token...\n", authFailCount);
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
  if (now - lastHeartbeat >= HEARTBEAT_MS) { lastHeartbeat = now; publishHeartbeat(); }
}
