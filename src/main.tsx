import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { appWindow } from '@tauri-apps/api/window';


appWindow.maximize();

ReactDOM.createRoot(document.getElementById('app')!).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>
);
