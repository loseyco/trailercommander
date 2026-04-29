#include <SPI.h>
#include <WiFiNINA.h>
#include <ArduinoMqttClient.h>
#include <utility/wifi_drv.h>
#include <Wire.h>
#include <ArduinoOTA.h>
#include <ArduinoJson.h>
#include "Adafruit_SHT31.h"
#include <TinyGPS++.h>

char ssid[] = "GridPass.App";
char pass[] = "gridpass";

WiFiServer server(80);
WiFiClient wifiClient;
WiFiSSLClient sslClient;
MqttClient mqttClient(wifiClient);

const char broker[] = "broker.hivemq.com";
int        port     = 1883;
const char commandTopic[]  = "TrailerCommander/a076dee5/commands";
const char stateTopic[]    = "TrailerCommander/a076dee5/state";
const char sensorTopic[]   = "TrailerCommander/a076dee5/sensors";
const char automationsTopic[] = "TrailerCommander/a076dee5/automations";

// Relay Config
const int NUM_RELAYS = 8;
const int relayPins[NUM_RELAYS] = {0, 1, 2, 3, 4, 5, 6, 7};
bool relayStates[NUM_RELAYS] = {false, false, false, false, false, false, false, false};
const bool ACTIVE_HIGH = false; 

// Hardware
Adafruit_SHT31 sht31 = Adafruit_SHT31();
TinyGPSPlus gps;
bool sensorEnabled = false;
unsigned long lastSensorRead = 0;

// Automations & Diagnostics
bool dogModeEnabled = false;
unsigned long lastLedCycle = 0;
int ledCycleState = 0;
unsigned long lastFirebaseUpdate = 0;

struct AutomationRule {
  bool active;
  String sensor; // "temperature", "voltage", "speed"
  String op;     // ">", "<", "=="
  float value;
  int targetRelay;
  bool targetState;
};

const int MAX_RULES = 10;
AutomationRule rules[MAX_RULES];
int activeRuleCount = 0;

void setup() {
  Serial.begin(9600);
  Serial1.begin(9600); // GPS
  
  // Set ADC to 12-bit for higher precision voltage reading (0-4095)
  analogReadResolution(12);
  
  for (int i = 0; i < NUM_RELAYS; i++) {
    pinMode(relayPins[i], OUTPUT);
    digitalWrite(relayPins[i], ACTIVE_HIGH ? LOW : HIGH);
  }

  WiFiDrv::pinMode(25, OUTPUT); 
  WiFiDrv::pinMode(26, OUTPUT); 
  WiFiDrv::pinMode(27, OUTPUT); 
  setRgbLed(0, 0, 0);

  // Unused Pins Monitor setup
  pinMode(A0, INPUT);
  pinMode(A2, INPUT);
  pinMode(A3, INPUT);
  pinMode(A4, INPUT);
  pinMode(A5, INPUT);
  pinMode(A6, INPUT);
  pinMode(8, INPUT);
  pinMode(9, INPUT);
  pinMode(10, INPUT);

  if (!sht31.begin(0x44)) {
    Serial.println("Couldn't find SHT31");
  } else {
    sensorEnabled = true;
  }

  if (WiFi.status() == WL_NO_MODULE) while (true);

  while (WiFi.status() != WL_CONNECTED) {
    WiFi.begin(ssid, pass);
    delay(5000);
  }
  
  server.begin();
  connectToMqtt();
  
  ArduinoOTA.begin(WiFi.localIP(), "TrailerCommander", "gridpass", InternalStorage);
}

void setRgbLed(int r, int g, int b) {
  WiFiDrv::analogWrite(25, r);
  WiFiDrv::analogWrite(26, g);
  WiFiDrv::analogWrite(27, b);
}

void connectToMqtt() {
  if (mqttClient.connect(broker, port)) {
    mqttClient.onMessage(onMqttMessage);
    mqttClient.subscribe(commandTopic);
    mqttClient.subscribe(automationsTopic);
  }
}

void setRelay(int index, bool state) {
  if (index >= 0 && index < NUM_RELAYS) {
    if ((index == 5 || index == 6) && state == true) {
      if (gps.speed.isValid() && gps.speed.mph() > 5.0) {
        state = false; 
      }
    }
    relayStates[index] = state;
    digitalWrite(relayPins[index], state ? (ACTIVE_HIGH ? HIGH : LOW) : (ACTIVE_HIGH ? LOW : HIGH));
  }
}

String getRelayStateJson() {
  String json = "{";
  for(int i=0; i<NUM_RELAYS; i++) {
    json += "\"relay" + String(i+1) + "\":\"" + (relayStates[i] ? "on" : "off") + "\"";
    if (i < NUM_RELAYS - 1) json += ",";
  }
  json += ",\"dog_mode\":\"" + String(dogModeEnabled ? "on" : "off") + "\"";
  json += "}";
  return json;
}

String getSensorJson() {
  String json = "{\"status\":\"success\"";
  if (sensorEnabled) {
    float t_f = (sht31.readTemperature() * 9.0 / 5.0) + 32.0;
    json += ",\"temperature\":" + String(t_f) + ",\"humidity\":" + String(sht31.readHumidity());
  }
  // 12V Battery Voltage Monitor (Pin A1)
  // Output raw ADC value (0-1023) so the UI can calibrate it
  int adc = analogRead(A1);
  json += ",\"raw_voltage\":" + String(adc);
  
  // Unused Pin Monitoring
  json += ",\"a0\":" + String(analogRead(A0));
  json += ",\"a2\":" + String(analogRead(A2));
  json += ",\"a3\":" + String(analogRead(A3));
  json += ",\"a4\":" + String(analogRead(A4));
  json += ",\"a5\":" + String(analogRead(A5));
  json += ",\"a6\":" + String(analogRead(A6));
  json += ",\"d8\":" + String(digitalRead(8));
  json += ",\"d9\":" + String(digitalRead(9));
  json += ",\"d10\":" + String(digitalRead(10));

  if (gps.speed.isValid()) {
    json += ",\"speed_mph\":" + String(gps.speed.mph());
  } else {
    json += ",\"speed_mph\":0.0";
  }
  if (gps.location.isValid()) {
    json += ",\"lat\":" + String(gps.location.lat(), 6) + ",\"lng\":" + String(gps.location.lng(), 6);
  }
  if (gps.satellites.isValid()) {
    json += ",\"gps_satellites\":" + String(gps.satellites.value());
  }
  if (gps.altitude.isValid()) {
    json += ",\"altitude_ft\":" + String(gps.altitude.feet());
  }
  json += ",\"dog_mode\":\"" + String(dogModeEnabled ? "on" : "off") + "\"";
  json += "}";
  return json;
}

void publishState() {
  if (mqttClient.connected()) {
    mqttClient.beginMessage(stateTopic);
    mqttClient.print(getRelayStateJson());
    mqttClient.endMessage();
  }
}

bool ledPulse = false;

void handleDiagnosticLed() {
  if (millis() - lastLedCycle > 500) {
    lastLedCycle = millis();
    ledPulse = !ledPulse;
    
    if (!ledPulse) {
      setRgbLed(0, 0, 0); // Pulse Off
      
      // Advance to next state when turning off
      ledCycleState++;
      if (ledCycleState > 3) ledCycleState = 0;
      return;
    }

    // Pulse On Phase
    if (ledCycleState == 0) {
      if (WiFi.status() == WL_CONNECTED) {
        if (mqttClient.connected()) {
          setRgbLed(0, 255, 0); // Green (Local + Cloud)
        } else {
          setRgbLed(0, 0, 255); // Blue (Local Only)
        }
      } else {
        setRgbLed(255, 0, 0); // Red (Disconnected)
      }
    } 
    else if (ledCycleState == 1) {
      if (dogModeEnabled) setRgbLed(255, 0, 255); // Magenta
      else setRgbLed(0, 0, 0);
    }
    else if (ledCycleState == 2) {
      if (gps.speed.isValid() && gps.speed.mph() > 5.0) setRgbLed(255, 255, 0);
      else setRgbLed(0, 0, 0);
    }
    else if (ledCycleState == 3) {
      int activeCount = 0;
      for (int i = 0; i < NUM_RELAYS; i++) {
        if (relayStates[i]) activeCount++;
      }
      if (activeCount > 0) setRgbLed(0, 255, 255); // Cyan
      else setRgbLed(0, 0, 0);
    }
  }
}

void postToFirestore() {
  if (sslClient.connect("firestore.googleapis.com", 443)) {
    String payload = "{\"fields\":{";
    
    int adc = analogRead(A1);
    payload += "\"raw_voltage\":{\"doubleValue\":" + String(adc) + "}";

    // Unused Pins Monitoring
    payload += ",\"a0\":{\"doubleValue\":" + String(analogRead(A0)) + "}";
    payload += ",\"a2\":{\"doubleValue\":" + String(analogRead(A2)) + "}";
    payload += ",\"a3\":{\"doubleValue\":" + String(analogRead(A3)) + "}";
    payload += ",\"a4\":{\"doubleValue\":" + String(analogRead(A4)) + "}";
    payload += ",\"a5\":{\"doubleValue\":" + String(analogRead(A5)) + "}";
    payload += ",\"a6\":{\"doubleValue\":" + String(analogRead(A6)) + "}";
    payload += ",\"d8\":{\"booleanValue\":" + String(digitalRead(8) ? "true" : "false") + "}";
    payload += ",\"d9\":{\"booleanValue\":" + String(digitalRead(9) ? "true" : "false") + "}";
    payload += ",\"d10\":{\"booleanValue\":" + String(digitalRead(10) ? "true" : "false") + "}";
    
    if (sensorEnabled) {
      float t_f = (sht31.readTemperature() * 9.0 / 5.0) + 32.0;
      payload += ",\"temperature\":{\"doubleValue\":" + String(t_f) + "}";
      payload += ",\"humidity\":{\"doubleValue\":" + String(sht31.readHumidity()) + "}";
    }
    
    if (gps.location.isValid()) {
      payload += ",\"lat\":{\"doubleValue\":" + String(gps.location.lat(), 6) + "}";
      payload += ",\"lng\":{\"doubleValue\":" + String(gps.location.lng(), 6) + "}";
    }
    if (gps.speed.isValid()) {
      payload += ",\"speed_mph\":{\"doubleValue\":" + String(gps.speed.mph()) + "}";
    }
    if (gps.satellites.isValid()) {
      payload += ",\"gps_satellites\":{\"integerValue\":\"" + String(gps.satellites.value()) + "\"}";
    }
    if (gps.altitude.isValid()) {
      payload += ",\"altitude_ft\":{\"doubleValue\":" + String(gps.altitude.feet()) + "}";
    }
    
    payload += ",\"uptime_seconds\":{\"integerValue\":\"" + String(millis() / 1000) + "\"}";
    payload += ",\"dog_mode\":{\"booleanValue\":" + String(dogModeEnabled ? "true" : "false") + "}";
    
    for (int i = 0; i < NUM_RELAYS; i++) {
      payload += ",\"relay" + String(i+1) + "\":{\"booleanValue\":" + String(relayStates[i] ? "true" : "false") + "}";
    }
    
    // Add accurate epoch timestamp via NTP
    unsigned long epoch = WiFi.getTime();
    if (epoch > 0) {
      payload += ",\"server_time_epoch\":{\"integerValue\":\"" + String(epoch) + "\"}";
    } else {
      payload += ",\"server_time_epoch\":{\"integerValue\":\"" + String(millis() / 1000) + "\"}"; // fallback
    }
    
    payload += "}}";

    sslClient.println("POST /v1/projects/gridpass/databases/trailercommander/documents/telemetry?key=AIzaSyCPGGHvDaZ3ymeQ0VE8EvMZLqD8cck48qI HTTP/1.1");
    sslClient.println("Host: firestore.googleapis.com");
    sslClient.println("Content-Type: application/json");
    sslClient.print("Content-Length: ");
    sslClient.println(payload.length());
    sslClient.println();
    sslClient.println(payload);
    
    sslClient.stop();
  }
}

void loop() {
  ArduinoOTA.poll();
  
  // Feed GPS
  while (Serial1.available() > 0) {
    gps.encode(Serial1.read());
  }

  // Diagnostic LED
  handleDiagnosticLed();

  bool isMoving = gps.speed.isValid() && gps.speed.mph() > 5.0;

  // Evaluate Automation Rules
  for (int i = 0; i < activeRuleCount; i++) {
    if (!rules[i].active) continue;
    float currentVal = -999;
    
    if (rules[i].sensor == "temperature" && sensorEnabled) {
      currentVal = (sht31.readTemperature() * 9.0 / 5.0) + 32.0;
    } else if (rules[i].sensor == "voltage") {
      currentVal = (analogRead(A1) / 1023.0) * 3.3 * 5.0; // 5.0 multiplier is hardware divider
    } else if (rules[i].sensor == "speed") {
      currentVal = gps.speed.isValid() ? gps.speed.mph() : 0.0;
    }

    if (currentVal != -999) {
      bool conditionMet = false;
      if (rules[i].op == ">") conditionMet = currentVal > rules[i].value;
      else if (rules[i].op == "<") conditionMet = currentVal < rules[i].value;
      else if (rules[i].op == "==") conditionMet = currentVal == rules[i].value;

      if (conditionMet) {
        if (relayStates[rules[i].targetRelay] != rules[i].targetState) {
          setRelay(rules[i].targetRelay, rules[i].targetState);
          publishState();
        }
      }
    }
  }

  // Firestore 60s Logger
  if (WiFi.status() == WL_CONNECTED && (millis() - lastFirebaseUpdate > 60000 || lastFirebaseUpdate == 0)) {
    lastFirebaseUpdate = millis();
    postToFirestore();
  }

  // Safety Monitor
  if (isMoving) {
    if (relayStates[5]) setRelay(5, false); 
    if (relayStates[6]) setRelay(6, false); 
  }

  // Dog Mode Monitor
  if (dogModeEnabled && !isMoving && sensorEnabled) {
    float t_f = (sht31.readTemperature() * 9.0 / 5.0) + 32.0;
    if (t_f > 75.0) {
      if (!relayStates[5]) setRelay(5, true);
      if (!relayStates[6]) setRelay(6, true);
    } else if (t_f < 70.0) {
      if (relayStates[5]) setRelay(5, false);
      if (relayStates[6]) setRelay(6, false);
    }
  }

  // Handle Local API
  WiFiClient client = server.available();
  if (client) {
    String currentLine = "";
    String request = "";
    while (client.connected()) {
      if (client.available()) {
        char c = client.read();
        request += c;
        if (c == '\n') {
          if (currentLine.length() == 0) {
            client.println("HTTP/1.1 200 OK");
            client.println("Content-Type: application/json");
            client.println("Access-Control-Allow-Origin: *"); 
            client.println("Connection: close");
            client.println();
            
            if (request.indexOf("GET /api/sensors") >= 0) {
              client.println(getSensorJson());
            } else if (request.indexOf("GET /api/dogmode/on") >= 0) {
              dogModeEnabled = true;
              client.println("{\"status\":\"success\", \"data\":" + getRelayStateJson() + "}");
              publishState();
            } else if (request.indexOf("GET /api/dogmode/off") >= 0) {
              dogModeEnabled = false;
              client.println("{\"status\":\"success\", \"data\":" + getRelayStateJson() + "}");
              publishState();
            } else if (request.indexOf("GET /api/relay/") >= 0) {
              int startIdx = request.indexOf("relay/") + 6;
              int endIdx = request.indexOf("/", startIdx);
              if (endIdx > startIdx) {
                int relayNum = request.substring(startIdx, endIdx).toInt();
                if (relayNum >= 1 && relayNum <= NUM_RELAYS) {
                  int actionIdx = request.indexOf("on", endIdx);
                  if (actionIdx > 0 && actionIdx < request.indexOf(" ", endIdx)) {
                    setRelay(relayNum - 1, true);
                  } else {
                    setRelay(relayNum - 1, false);
                  }
                  client.println("{\"status\":\"success\", \"data\":" + getRelayStateJson() + "}");
                  publishState();
                }
              }
            } else {
               client.println("{\"status\":\"ok\"}");
            }
            break;
          } else {
            currentLine = "";
          }
        } else if (c != '\r') {
          currentLine += c;
        }
      }
    }
    client.stop();
  }

  // Handle MQTT
  if (WiFi.status() == WL_CONNECTED) {
    if (!mqttClient.connected()) {
      static unsigned long lastReconnect = 0;
      if (millis() - lastReconnect > 10000) {
        lastReconnect = millis();
        connectToMqtt();
      }
    } else {
      mqttClient.poll();
      if (millis() - lastSensorRead > 5000) {
        lastSensorRead = millis();
        mqttClient.beginMessage(sensorTopic);
        mqttClient.print(getSensorJson());
        mqttClient.endMessage();
        publishState();
      }
    }
  }
}

void onMqttMessage(int messageSize) {
  String topic = mqttClient.messageTopic();
  String message = "";
  while (mqttClient.available()) {
    message += (char)mqttClient.read();
  }

  if (topic == automationsTopic) {
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, message);
    if (!error) {
      activeRuleCount = 0;
      JsonArray array = doc.as<JsonArray>();
      for (JsonVariant v : array) {
        if (activeRuleCount >= MAX_RULES) break;
        rules[activeRuleCount].active = true;
        rules[activeRuleCount].sensor = v["sensor"].as<String>();
        rules[activeRuleCount].op = v["op"].as<String>();
        rules[activeRuleCount].value = v["val"].as<float>();
        rules[activeRuleCount].targetRelay = v["pin"].as<int>();
        rules[activeRuleCount].targetState = v["state"].as<bool>();
        activeRuleCount++;
      }
    }
  } else if (topic == commandTopic) {
    if (message == "DOGMODE_ON") {
      dogModeEnabled = true;
      publishState();
    } else if (message == "DOGMODE_OFF") {
      dogModeEnabled = false;
      publishState();
    } else if (message.startsWith("RELAY_")) {
      int relayNum = message.substring(6, 7).toInt();
      if (relayNum >= 1 && relayNum <= NUM_RELAYS) {
        if (message.endsWith("_ON")) {
          setRelay(relayNum - 1, true);
        } else if (message.endsWith("_OFF")) {
          setRelay(relayNum - 1, false);
        }
        publishState();
      }
    }
  }
}
