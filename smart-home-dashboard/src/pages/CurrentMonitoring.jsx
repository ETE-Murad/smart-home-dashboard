import { Activity, Gauge } from 'lucide-react'
import MetricPage from '../components/MetricPage'

export default function CurrentMonitoring() {
  return (
    <MetricPage title="Current Monitoring" metricKey="current" unit="A" digits={2} icon={Activity} color="#22d3ee"
      extra={{ key: 'power', card: { label: 'Power (V × I)', unit: 'W', digits: 1, icon: Gauge } }} />
  )
}
