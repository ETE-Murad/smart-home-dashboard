# Smart Home Dashboard (React + Vite + Tailwind + Firebase Realtime Database)

Website → Firebase → ESP32 → relay module → appliance. The website never touches GPIO pins.

## How the data is organised (your existing keys are kept)

| Path | Written by | Meaning |
|---|---|---|
| `/relays/relay1…relay8` | website | **Desired** state (true = ON). Same keys your firmware already reads. |
| `/relayStatus/relayN/{state, updatedAt}` | ESP32 | **Actual** state after the GPIO changed |
| `/device/{lastSeen, rssi, ip, uptimeSec, fw}` | ESP32 | Heartbeat. Online = last heartbeat < 35 s ago |
| `/sensors/{temperature, humidity, voltage, current, power, updatedAt}` | ESP32 | Latest readings |
| `/sensorStatus/{dht, voltage, current}` | ESP32 | `ok`, `error` or `not_configured` |
| `/history/<id>/{ts, …readings}` | ESP32 | One record per minute, for the charts |
| `/settings/rooms/<id>` | website | Rooms: `{name, createdAt, devices:{<id>:{name, type, relay}}}`. A device is a label + icon for one relay |
| `/settings/temperature` | website | Temperature warning thresholds |
| `/admins/<uid>`, `/devices/<uid>` | you, in the Console | Who may use the website / which account is the ESP32 |

## Part A – Install the tools (Windows)
1. Install Node.js LTS from https://nodejs.org (accept the defaults). Open **Command Prompt** and check: `node -v` and `npm -v` both print a version.
2. Install Visual Studio Code from https://code.visualstudio.com.
3. Install Arduino IDE 2 from https://www.arduino.cc/en/software (for the ESP32).

## Part B – Run the website locally
1. Unzip the project, e.g. to `C:\Users\you\smart-home-dashboard`.
2. In VS Code: **File → Open Folder…** and choose that folder.
3. Open the terminal inside VS Code: **Terminal → New Terminal**. Every command below is typed there.
4. Install dependencies: `npm install`
5. The file `.env` is already filled with your project `home-automation-8354f`. (Other project? Copy `.env.example` to `.env` and fill it from Firebase Console → ⚙ Project settings → General → Your apps → Web app → Config.)
6. Start the site: `npm run dev` and open the address it prints (usually http://localhost:5173).

> Your database is a **Realtime Database** (not Firestore): the Console shows a JSON tree under *Build → Realtime Database*.

## Part C – Secure Firebase (do this before real use)
You need two Email/Password accounts: one for you, one for the ESP32.
1. Console → **Build → Authentication → Users → Add user**. Create `you@example.com` and `esp32@home.local` (any strong passwords).
2. Copy each account's **User UID** from the Users table.
3. Console → **Realtime Database → Data**. Hover the root and add:
   - `admins` → child = *your UID*, value `true` (type boolean)
   - `devices` → child = *the ESP32's UID*, value `true`
4. Console → **Realtime Database → Rules**, paste the contents of `database.rules.json`, click **Publish**.
5. Sign in or use **Create account** directly on the website. If you skip step 3 the site shows a screen with your UID to copy.
6. After the ESP32 works with its account, go to Authentication → Sign-in method and **disable Anonymous**.

What the rules do: nobody can read or write anything unless their UID is listed. Only admins write `/relays` and `/settings`; only the ESP32 account writes status, heartbeat, sensors and history. Anonymous users and strangers who sign up are refused. **Publishing the rules replaces your current ones**, so an older web page that writes to `/relays` anonymously will stop working. Review the rules yourself before calling the system secure.

## Part C2 – Rooms (new in this version)
- Sidebar → **Rooms**: add a room, rename it, delete it; inside each room add, rename, change type (light, fan, …), move to another relay, or remove devices. Each relay can belong to only one device.
- **Admin-Only Permissions & Member Approval Workflow**:
  - Only the home **admin / owner** can directly add or change rooms and devices.
  - When members (who joined via the invite code) propose creating, renaming, or deleting rooms or devices, a permission request is sent to the home owner.
  - The owner receives real-time alerts in the header, sidebar, and at the top of the **Rooms** page with one-click **Approve** and **Reject** buttons.
  - If approved, the change is applied to the rooms and devices; if rejected, no changes happen.
- **Relay Controls** now groups switches by room (with Room ON / Room OFF) and lists any relay not in a room under **Unassigned relays**, so nothing becomes uncontrollable.
- Deleting a room or device never switches a relay. If its appliance is ON it stays ON until you switch it from Unassigned.
- If you already published the rules from an earlier zip, paste the new `database.rules.json` again and Publish (it adds validation for `/settings/rooms` and permission rules for `/roomRequests`).
- First time: open Rooms and click **Use suggested rooms**, or add your own.

## Part C3 – Multi-Home Support (Separate Households & ESP32s)
The dashboard now supports multiple independent households, friends, or properties with complete isolation:
- **Private Namespaces (`/homes/<homeId>`)**: Each home has its own private data subtree. No household can view, switch, or interfere with another household's relays or sensors.
- **Auto-Provisioning**: When a user registers or signs in, their first private home is created automatically.
- **Home Switcher**: Users who manage or belong to multiple homes can switch between them with one click from the sidebar or header.
- **ESP32 Home Binding**:
  1. Open **Settings** on the website to view your unique **Home ID** (e.g. `home_17140...`).
  2. In `firmware/esp32_relay_controller/esp32_relay_controller.ino`, paste your Home ID into:
     ```c
     #define HOME_ID "YOUR_UNIQUE_HOME_ID"
     ```
  3. Flash your ESP32. It communicates strictly with your home's private namespace.
- **Sharing within a Household**:
  - The home owner can copy their **Invite Code** (e.g. `HOME-A7B2K9`) from Settings.
  - Family members or roommates register their own account, click **Join with invite code** in the home dropdown, and enter the code. They now share control of that home.

## Part D – Flash the ESP32
1. Arduino IDE → Library Manager: install **Firebase Arduino Client Library for ESP8266 and ESP32** (Mobizt), **DHT sensor library** and **Adafruit Unified Sensor**.
2. Open `firmware/esp32_relay_controller/esp32_relay_controller.ino`.
3. Fill in Wi-Fi name/password and the ESP32 account email/password (section 1 of the sketch).
4. Check section 2: `RELAY_ON = LOW` (active-LOW, as in your current sketch), `DHT_TYPE` (DHT22 or DHT11), and set `HAS_…` to `false` for sensors that are not wired.
5. Board: *ESP32 Dev Module*. Upload, then open Serial Monitor at 115200 baud. You should see `relay1 -> ON` lines when you switch from the website.

Electrical safety: power the relay module from a suitable supply, not from GPIO pins; keep mains wiring away from the ESP32 and breadboard; have mains work checked by a qualified person.

## Part E – Test each relay
1. Flash the firmware, power the ESP32. Within ~15 s the header shows **ESP32 online**.
2. Relay Controls → switch Relay 1. The switch shows a spinner, then turns green only after the ESP32 reports the new state.
3. Repeat for relays 2–8 with a low-voltage load (e.g. LED) first. Try **All Relays ON/OFF** (a confirmation dialog appears).
4. Unplug the ESP32: after ~35 s the status turns **Offline** and controls are disabled.

## Part F – Common errors
| Message | Fix |
|---|---|
| "Missing values in your .env file" | Fill `.env`, then restart `npm run dev`. |
| "Wrong email or password" | Check the account exists in Authentication → Users. |
| "This account is not authorised yet" | Add your UID under `/admins` (Part C step 3). |
| "Permission denied" in the console | Rules published but UID missing in `/admins` or `/devices`. |
| ESP32 always offline | Serial Monitor: check Wi-Fi, `DEVICE_EMAIL/PASSWORD`, and that its UID is under `/devices`. |
| Relays are inverted | Swap `RELAY_ON` / `RELAY_OFF` in the sketch. |
| Charts empty | History fills at one point per minute after the new firmware runs. |

## Part G – Deploy with Firebase Hosting
Deploying replaces whatever is currently on this project's Hosting site, so try a preview first.
1. `npm install -g firebase-tools`
2. `firebase login`
3. `npm run build`
4. Preview (temporary link): `firebase hosting:channel:deploy preview`
5. Go live: `firebase deploy --only hosting` (and `firebase deploy --only database` to publish the rules file).
6. Console → Authentication → Settings → **Authorized domains** must include your hosting domain (it does by default for `*.web.app`).
