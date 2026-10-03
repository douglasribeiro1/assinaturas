import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { registerSW } from 'virtual:pwa-register'
import App from './App.vue'
import { useSubscriptions } from './data/store'

registerSW({ immediate: true })
const app = createApp(App).use(createPinia())
app.mount('#app')

// Sync on open and whenever the connection comes back; also after each local write (see store).
const store = useSubscriptions()
void store.runSync()
window.addEventListener('online', () => void store.runSync())
