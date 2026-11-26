import { useDashboard } from '../context/DashboardData'
import { getSensorState } from '../services/sensorService'

/** Latest readings plus a display state for each one. */
export function useSensorStates() {
  const { sensorState, nowMs } = useDashboard()
  const { sensors, sensorStatus, thresholds, loading, error } = sensorState
  const updatedAt = typeof sensors?.updatedAt === 'number' ? sensors.updatedAt : null
  const make = (key, status) => getSensorState({ value: sensors?.[key], status, updatedAt, nowMs })
  const dht = sensorStatus?.dht
  return {
    loading, error, thresholds, updatedAt, nowMs,
    values: sensors || {},
    states: {
      temperature: make('temperature', dht),
      humidity: make('humidity', dht),
      voltage: make('voltage', sensorStatus?.voltage),
      current: make('current', sensorStatus?.current),
      power: make('power', sensorStatus?.voltage === 'not_configured' || sensorStatus?.current === 'not_configured' ? 'not_configured' : sensorStatus?.current),
    },
  }
}
