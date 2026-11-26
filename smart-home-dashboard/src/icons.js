import { Lightbulb, Fan, Snowflake, Plug, Tv, Flame, Droplets, Lamp } from 'lucide-react'

export const APPLIANCE_ICONS = {
  light:  { label: 'Light bulb',      Icon: Lightbulb },
  lamp:   { label: 'Lamp',            Icon: Lamp },
  fan:    { label: 'Fan',             Icon: Fan },
  ac:     { label: 'Air conditioner', Icon: Snowflake },
  tv:     { label: 'TV',              Icon: Tv },
  heater: { label: 'Heater',          Icon: Flame },
  pump:   { label: 'Water pump',      Icon: Droplets },
  plug:   { label: 'Others (Custom device)', Icon: Plug },
}

export const getApplianceIcon = (key) => (APPLIANCE_ICONS[key] || APPLIANCE_ICONS.plug).Icon
