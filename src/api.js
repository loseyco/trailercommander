import mqtt from 'mqtt';

const MKR1010_IP = '192.168.2.165';
const MQTT_BROKER = 'wss://broker.hivemq.com:8884/mqtt'; // HiveMQ public WebSocket port
const COMMAND_TOPIC = 'TrailerCommander/a076dee5/commands';
const AUTOMATIONS_TOPIC = 'TrailerCommander/a076dee5/automations';

// Initialize MQTT client
let mqttClient = null;

export const initMqtt = (onStateChange, onSensorData) => {
  if (!mqttClient) {
    mqttClient = mqtt.connect(MQTT_BROKER);

    mqttClient.on('connect', () => {
      console.log('Connected to MQTT via WebSockets');
      mqttClient.subscribe('TrailerCommander/a076dee5/state');
      mqttClient.subscribe('TrailerCommander/a076dee5/sensors');
    });

    mqttClient.on('message', (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        if (topic === 'TrailerCommander/a076dee5/state' && onStateChange) {
          onStateChange(data);
        } else if (topic === 'TrailerCommander/a076dee5/sensors' && onSensorData) {
          onSensorData(data);
        }
      } catch (e) {
        console.error('Failed to parse MQTT message', e);
      }
    });
  }
};

/**
 * Sends a command to the MKR1010.
 * Example commands: 'relay/1/on', 'relay/8/off'
 */
export const sendCommand = async (command) => {
  const url = `http://${MKR1010_IP}/api/${command}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return { success: true, mode: 'local', data };
    } else {
      throw new Error('Local server responded with an error');
    }
  } catch (error) {
    // Fallback to MQTT
    if (mqttClient && mqttClient.connected) {
      let mqttMessage = '';
      if (command === 'dogmode/on') {
        mqttMessage = 'DOGMODE_ON';
      } else if (command === 'dogmode/off') {
        mqttMessage = 'DOGMODE_OFF';
      } else if (command.startsWith('relay/')) {
        const parts = command.split('/');
        mqttMessage = `RELAY_${parts[1]}_${parts[2].toUpperCase()}`;
      }
      
      if (mqttMessage) {
        mqttClient.publish(COMMAND_TOPIC, mqttMessage);
        return { success: true, mode: 'mqtt' };
      }
    }
    
    return { success: false };
  }
};

export const fetchSensors = async () => {
  const url = `http://${MKR1010_IP}/api/sensors`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      if (data.status === 'success') {
        return { success: true, mode: 'local', temperature: data.temperature, humidity: data.humidity };
      }
    }
  } catch(e) {
    // Fails silently, MQTT handles fallback stream automatically
  }
  return { success: false };
};

export const publishAutomations = (rulesArray) => {
  if (mqttClient && mqttClient.connected) {
    mqttClient.publish(AUTOMATIONS_TOPIC, JSON.stringify(rulesArray));
    return true;
  }
  return false;
};
