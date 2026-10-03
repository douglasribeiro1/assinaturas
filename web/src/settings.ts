import { reactive, watch } from 'vue'

export interface Settings {
  defaultCurrency: string
  defaultRemindDays: number
}

const KEY = 'settings.v1'
const defaults: Settings = { defaultCurrency: 'BRL', defaultRemindDays: 1 }

function load(): Settings {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return { ...defaults }
  }
}

export const settings = reactive<Settings>(load())

watch(settings, (v) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(v))
  } catch {
    /* storage unavailable: keep in memory */
  }
})

export const CURRENCIES = ['BRL', 'USD', 'EUR']
