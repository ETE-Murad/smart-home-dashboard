/**
 * Computes the Heat Index (apparent "Feels Like" temperature in Celsius)
 * using the NOAA formula adapted for Celsius and relative humidity.
 */
export function computeHeatIndex(tempC, humidity) {
  if (typeof tempC !== 'number' || typeof humidity !== 'number' || tempC < 20) {
    return tempC
  }
  // Convert Celsius to Fahrenheit
  const T = (tempC * 9) / 5 + 32
  const R = humidity

  // Simple approximation
  let hi = 0.5 * (T + 61.0 + ((T - 68.0) * 1.2) + (R * 0.094))

  if (hi >= 80) {
    // Full Rothfusz regression
    hi =
      -42.379 +
      2.04901523 * T +
      10.14333127 * R -
      0.22475541 * T * R -
      0.00683783 * T * T -
      0.05481717 * R * R +
      0.00122874 * T * T * R +
      0.00085282 * T * R * R -
      0.00000199 * T * T * R * R
  }

  // Convert back to Celsius
  const hiC = ((hi - 32) * 5) / 9
  return Number.isFinite(hiC) ? Number(hiC.toFixed(1)) : tempC
}

/**
 * Categorizes indoor comfort based on ASHRAE-55 standard
 */
export function getComfortStatus(tempC, humidity) {
  if (typeof tempC !== 'number' || typeof humidity !== 'number') {
    return { label: 'Awaiting Data', tone: 'neutral', icon: 'clock' }
  }

  if (tempC >= 32) {
    return { label: 'Extreme Heat', tone: 'bad', desc: 'Cooling required' }
  }
  if (tempC >= 28) {
    return { label: 'Warm & Humid', tone: 'warn', desc: 'Ventilation recommended' }
  }
  if (tempC < 18) {
    return { label: 'Cool Climate', tone: 'neutral', desc: 'Heating recommended' }
  }
  if (humidity >= 65) {
    return { label: 'High Humidity', tone: 'warn', desc: 'Risk of mold/dampness' }
  }
  if (humidity < 30) {
    return { label: 'Dry Atmosphere', tone: 'neutral', desc: 'Humidification suggested' }
  }
  return { label: 'Optimal Comfort', tone: 'on', desc: 'Ideal temperature & humidity' }
}
