import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Check if we're running in Tauri environment
const isTauri = typeof window !== 'undefined' && (window as any).__TAURI__;

// Only import and use Tauri APIs if we're in a Tauri environment
if (isTauri) {
	import('@tauri-apps/api/window').then(({ appWindow }) => {
		appWindow.maximize();
	});
}

ReactDOM.createRoot(document.getElementById('app')!).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>
);
