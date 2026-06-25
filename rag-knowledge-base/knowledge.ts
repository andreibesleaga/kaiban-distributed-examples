/**
 * Embedded product knowledge base for the RAG example.
 *
 * Kept as a compiled-in string (not a loose .md file) so the knowledge ships
 * inside dist/ and is available in the Docker runtime without an extra COPY.
 * Override at runtime with the RAG_CONTENT env var if you want your own corpus.
 *
 * Product: "Nimbus T3" — a fictional smart thermostat — so answers are clearly
 * grounded in THIS text rather than the model's general knowledge.
 */
export const PRODUCT_KB = `
# Nimbus T3 Smart Thermostat — Product Knowledge Base

## Overview
The Nimbus T3 is a Wi-Fi smart thermostat (model NB-T3-2025). It supports 24V HVAC
systems including heat pumps with up to 2 stages of heating and 2 stages of cooling.
It is NOT compatible with high-voltage (120V/240V) line-voltage baseboard heaters.

## Specifications
- Display: 3.5" color touchscreen, 320x480
- Connectivity: Wi-Fi 2.4GHz + 5GHz, Bluetooth LE for setup, Matter over Thread
- Sensors: temperature (±0.3°C), humidity, occupancy (PIR), ambient light
- Power: 24VAC via C-wire (required). A Nimbus Power Bridge is included for systems
  without a C-wire.
- Compatible voice assistants: Alexa, Google Assistant, Apple Home (via Matter)

## Installation
1. Turn off power at the breaker for your HVAC system.
2. Remove the old thermostat and photograph the wiring.
3. If you do NOT have a C-wire, install the included Power Bridge at the HVAC control board.
4. Connect wires to the labeled Nimbus terminals (R, C, W1, W2, Y1, Y2, G, O/B).
5. Restore power and follow the on-screen Bluetooth setup in the Nimbus app.

## Energy Saving / Eco Mode
Eco Mode uses the occupancy sensor and your schedule to set back the temperature when
the home is empty. Typical savings are 10–15% on heating and cooling costs. Eco Mode
can be scheduled or triggered automatically by geofencing in the Nimbus app.

## Warranty
The Nimbus T3 carries a 3-year limited warranty covering manufacturing defects.
The warranty does NOT cover damage from incorrect installation or line-voltage systems.
Register within 90 days of purchase to extend the warranty to 5 years.

## Troubleshooting
- "No power / blank screen": verify the C-wire or Power Bridge connection; check the
  breaker and the HVAC system's 3A fuse.
- "Wi-Fi keeps dropping": the T3 prefers 2.4GHz for range; disable band-steering on the
  router or create a dedicated 2.4GHz SSID.
- "Heat pump short-cycling": increase the minimum runtime in Settings → HVAC → Cycle
  Protection (default 5 minutes).
- "Occupancy not detected": the PIR has a 6 m / 120° field of view; avoid mounting behind
  doors or in narrow hallways.

## Support
Support hours are Mon–Fri 8am–8pm ET. Phone: 1-800-NIMBUS-0. In-app chat is 24/7.
Replacement parts (Power Bridge, wall plate) ship free within the warranty period.
`.trim();
