import { Zap } from 'lucide-react'
import MetricPage from '../components/MetricPage'

export default function VoltageMonitoring() {
  return <MetricPage title="Voltage Monitoring" metricKey="voltage" unit="V" digits={1} icon={Zap} color="#f59e0b" />
}
